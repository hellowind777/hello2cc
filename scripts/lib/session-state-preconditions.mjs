import {
  mutateSessionEntry,
  normalizePreconditionFailures,
  normalizeSessionId,
  readSessionEntry,
} from './session-state-store.mjs';
import {
  caseInsensitivePathKeys,
  enterWorktreeFailureError,
  failureRecord,
  missingTeamMatch,
  normalizeFailureKey,
  readToolTeamName,
  worktreeFailureError,
} from './session-state-basic-helpers.mjs';
import {
  rememberSharedTeamToolSuccess,
} from './session-state-team-updates.mjs';
import { rememberTeammateIdle } from './session-state-team-idle.mjs';
import { rememberWorkflowToolSuccess } from './session-state-workflow-updates.mjs';
import {
  recordWebSearchFailure,
  recordWebSearchSuccess,
} from './session-state-websearch-helpers.mjs';
import { realTeamNameOrEmpty } from './team-name.mjs';
import { isAgentToolName } from './tool-name-aliases.mjs';

export { rememberTeammateIdle };

/**
 * Remembers deterministic tool precondition failures so repeated retries can fail closed.
 */
export function rememberToolFailure(payload = {}) {
  const sessionId = normalizeSessionId(payload?.session_id);
  if (!sessionId) return {};

  const toolName = String(payload?.tool_name || '').trim();
  const cwd = String(payload?.cwd || '').trim();

  return mutateSessionEntry(sessionId, (current) => {
    const preconditionFailures = normalizePreconditionFailures(current.preconditionFailures);
    const worktreeByCwd = { ...(preconditionFailures.worktreeByCwd || {}) };
    const missingTeams = { ...(preconditionFailures.missingTeams || {}) };
    const webSearchHealth = toolName === 'WebSearch'
      ? recordWebSearchFailure(current, payload)
      : current.webSearchHealth;

    const agentWorktreeError = isAgentToolName(toolName) ? worktreeFailureError(payload) : '';
    const enterWorktreeError = toolName === 'EnterWorktree' ? enterWorktreeFailureError(payload) : '';
    const worktreeError = agentWorktreeError || enterWorktreeError;
    if (worktreeError && cwd) {
      const key = normalizeFailureKey(cwd, caseInsensitivePathKeys());
      worktreeByCwd[key] = failureRecord({
        cwd,
        error: worktreeError,
        toolName,
        source: 'tool_failure',
      });
    }

    if (isAgentToolName(toolName)) {
      const missingTeam = missingTeamMatch(payload);
      if (missingTeam?.teamName) {
        const key = normalizeFailureKey(missingTeam.teamName, true);
        missingTeams[key] = failureRecord({
          cwd,
          teamName: missingTeam.teamName,
          error: missingTeam.error,
          toolName,
          source: 'tool_failure',
        });
      }
    }

    const nextFailures = normalizePreconditionFailures({
      worktreeByCwd,
      missingTeams,
    });

    if (Object.keys(nextFailures).length === 0) {
      const next = { ...current };
      delete next.preconditionFailures;
      if (webSearchHealth) {
        next.webSearchHealth = webSearchHealth;
      }
      return next;
    }

    return {
      ...current,
      preconditionFailures: nextFailures,
      ...(webSearchHealth ? { webSearchHealth } : {}),
    };
  });
}

/**
 * Clears or refreshes remembered precondition failures after successful tool calls.
 */
export function rememberToolSuccess(payload = {}) {
  const sessionId = normalizeSessionId(payload?.session_id);
  if (!sessionId) return {};

  const toolName = String(payload?.tool_name || '').trim();
  const previousEntry = readSessionEntry(sessionId);
  const nextEntry = mutateSessionEntry(sessionId, (current) => {
    const preconditionFailures = normalizePreconditionFailures(current.preconditionFailures);
    const worktreeByCwd = { ...(preconditionFailures.worktreeByCwd || {}) };
    const missingTeams = { ...(preconditionFailures.missingTeams || {}) };
    const webSearchHealth = toolName === 'WebSearch'
      ? recordWebSearchSuccess(current, payload)
      : current.webSearchHealth;
    const workflowState = rememberWorkflowToolSuccess(current, payload);

    if (toolName === 'TeamCreate') {
      const requestedTeam = realTeamNameOrEmpty(payload?.tool_input?.team_name);
      const actualTeam = readToolTeamName(payload);
      for (const teamName of [requestedTeam, actualTeam]) {
        if (!teamName) continue;
        delete missingTeams[normalizeFailureKey(teamName, true)];
      }
    }

    if (toolName === 'TeamDelete') {
      const deletedTeam = readToolTeamName(payload) || realTeamNameOrEmpty(current.teamName);
      if (deletedTeam) {
        missingTeams[normalizeFailureKey(deletedTeam, true)] = failureRecord({
          teamName: deletedTeam,
          error: `Team "${deletedTeam}" was deleted in this session and must be recreated before teammate routing can resume.`,
          toolName,
          source: 'team_delete',
        });
      }
    }

    if (isAgentToolName(toolName)) {
      const teamName = realTeamNameOrEmpty(payload?.tool_input?.team_name);
      if (teamName) {
        delete missingTeams[normalizeFailureKey(teamName, true)];
      }
    }

    const nextFailures = normalizePreconditionFailures({
      worktreeByCwd,
      missingTeams,
    });
    const next = {
      ...current,
      ...(toolName === 'TeamCreate' && readToolTeamName(payload) ? { teamName: readToolTeamName(payload) } : {}),
      ...(toolName === 'TeamDelete' ? { teamName: '' } : {}),
      ...(webSearchHealth ? { webSearchHealth } : {}),
      ...(workflowState ? { workflowState } : {}),
    };

    if (Object.keys(nextFailures).length > 0) {
      next.preconditionFailures = nextFailures;
    } else {
      delete next.preconditionFailures;
    }

    return next;
  });

  rememberSharedTeamToolSuccess({
    toolName,
    payload,
    previous: previousEntry,
    next: nextEntry,
  });

  return nextEntry;
}
