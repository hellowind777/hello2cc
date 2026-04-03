import {
  mutateSessionEntry,
  normalizePreconditionFailures,
  normalizeSessionId,
} from './session-state-store.mjs';
import { envValue } from './config.mjs';

const ZERO_SEARCH_DEGRADE_THRESHOLD = 2;
const ZERO_SEARCH_COOLDOWN_MS = 10 * 60 * 1000;
const ERROR_COOLDOWN_MS = 15 * 60 * 1000;

function normalizeFailureKey(value, caseInsensitive = false) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return caseInsensitive ? normalized.toLowerCase() : normalized;
}

function caseInsensitivePathKeys() {
  return process.platform === 'win32';
}

function worktreeFailureError(payload = {}) {
  const error = String(payload?.error || '').trim();
  if (!error.includes('Cannot create agent worktree: not in a git repository')) return '';
  return error;
}

function enterWorktreeFailureError(payload = {}) {
  const error = String(payload?.error || '').trim();
  if (!error.includes('Cannot create a worktree: not in a git repository')) return '';
  return error;
}

function missingTeamMatch(payload = {}) {
  const error = String(payload?.error || '').trim();
  const match = error.match(/Team "([^"]+)" does not exist\. Call spawnTeam first to create the team\./);
  if (!match) return null;

  return {
    teamName: String(match[1] || '').trim(),
    error,
  };
}

function readToolTeamName(payload = {}) {
  const candidates = [
    payload?.tool_input?.team_name,
    payload?.tool_response?.team_name,
    payload?.tool_response?.data?.team_name,
    payload?.tool_response?.result?.team_name,
  ];

  return candidates
    .map((value) => String(value || '').trim())
    .find(Boolean) || '';
}

function failureRecord({ cwd = '', teamName = '', error = '', toolName = '', source = '' } = {}) {
  return {
    ...(cwd ? { cwd } : {}),
    ...(teamName ? { teamName } : {}),
    ...(error ? { error } : {}),
    ...(toolName ? { toolName } : {}),
    ...(source ? { source } : {}),
    recordedAt: new Date().toISOString(),
  };
}

function normalizeWebSearchHealth(health = {}) {
  return {
    consecutiveZeroSearches: Number(health?.consecutiveZeroSearches || 0),
    consecutiveErrors: Number(health?.consecutiveErrors || 0),
    lastAttemptAt: String(health?.lastAttemptAt || '').trim(),
    lastSuccessAt: String(health?.lastSuccessAt || '').trim(),
    lastFailureAt: String(health?.lastFailureAt || '').trim(),
    cooldownUntil: String(health?.cooldownUntil || '').trim(),
    lastBaseUrl: String(health?.lastBaseUrl || '').trim(),
    lastModel: String(health?.lastModel || '').trim(),
    lastOutcome: String(health?.lastOutcome || '').trim(),
  };
}

function nextIsoOffset(now, offsetMs) {
  return new Date(now.getTime() + offsetMs).toISOString();
}

function currentModelName(payload = {}, current = {}) {
  return String(
    payload?.model ||
    current?.mainModel ||
    current?.model ||
    '',
  ).trim();
}

function webSearchSnapshot(payload = {}, current = {}) {
  return {
    lastBaseUrl: envValue('ANTHROPIC_BASE_URL'),
    lastModel: currentModelName(payload, current),
  };
}

function extractSearchCount(response = {}) {
  const numericCandidates = [
    response?.searchCount,
    response?.search_count,
    response?.searches,
  ];

  for (const candidate of numericCandidates) {
    if (typeof candidate === 'number' && candidate >= 0) {
      return candidate;
    }
  }

  const results = Array.isArray(response?.results) ? response.results : [];
  if (Array.isArray(response?.results) && results.length === 0) {
    return 0;
  }

  let searchCount = 0;
  for (const result of results) {
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      if (Array.isArray(result.content)) {
        searchCount += 1;
      }
    }
  }

  return searchCount;
}

function recordWebSearchSuccess(current = {}, payload = {}) {
  const response = payload?.tool_response || payload?.tool_result || payload?.result || {};
  const searchCount = extractSearchCount(response);
  if (searchCount === null) {
    return current.webSearchHealth;
  }

  const previous = normalizeWebSearchHealth(current.webSearchHealth);
  const now = new Date();
  const snapshot = webSearchSnapshot(payload, current);

  if (searchCount > 0) {
    return {
      ...previous,
      ...snapshot,
      consecutiveZeroSearches: 0,
      consecutiveErrors: 0,
      lastAttemptAt: now.toISOString(),
      lastSuccessAt: now.toISOString(),
      cooldownUntil: '',
      lastOutcome: 'success',
    };
  }

  const consecutiveZeroSearches = previous.consecutiveZeroSearches + 1;
  return {
    ...previous,
    ...snapshot,
    consecutiveZeroSearches,
    consecutiveErrors: 0,
    lastAttemptAt: now.toISOString(),
    cooldownUntil:
      consecutiveZeroSearches >= ZERO_SEARCH_DEGRADE_THRESHOLD
        ? nextIsoOffset(now, ZERO_SEARCH_COOLDOWN_MS)
        : '',
    lastOutcome: 'zero-search',
  };
}

function recordWebSearchFailure(current = {}, payload = {}) {
  const previous = normalizeWebSearchHealth(current.webSearchHealth);
  const now = new Date();
  const snapshot = webSearchSnapshot(payload, current);

  return {
    ...previous,
    ...snapshot,
    consecutiveZeroSearches: 0,
    consecutiveErrors: previous.consecutiveErrors + 1,
    lastAttemptAt: now.toISOString(),
    lastFailureAt: now.toISOString(),
    cooldownUntil: nextIsoOffset(now, ERROR_COOLDOWN_MS),
    lastOutcome: 'error',
  };
}

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

    const agentWorktreeError = toolName === 'Agent' ? worktreeFailureError(payload) : '';
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

    if (toolName === 'Agent') {
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

  return mutateSessionEntry(sessionId, (current) => {
    const preconditionFailures = normalizePreconditionFailures(current.preconditionFailures);
    const worktreeByCwd = { ...(preconditionFailures.worktreeByCwd || {}) };
    const missingTeams = { ...(preconditionFailures.missingTeams || {}) };
    const webSearchHealth = toolName === 'WebSearch'
      ? recordWebSearchSuccess(current, payload)
      : current.webSearchHealth;

    if (toolName === 'TeamCreate') {
      const requestedTeam = String(payload?.tool_input?.team_name || '').trim();
      const actualTeam = readToolTeamName(payload);
      for (const teamName of [requestedTeam, actualTeam]) {
        if (!teamName) continue;
        delete missingTeams[normalizeFailureKey(teamName, true)];
      }
    }

    if (toolName === 'TeamDelete') {
      const deletedTeam = readToolTeamName(payload) || String(current.teamName || '').trim();
      if (deletedTeam) {
        missingTeams[normalizeFailureKey(deletedTeam, true)] = failureRecord({
          teamName: deletedTeam,
          error: `Team "${deletedTeam}" was deleted in this session and must be recreated before teammate routing can resume.`,
          toolName,
          source: 'team_delete',
        });
      }
    }

    if (toolName === 'Agent') {
      const teamName = String(payload?.tool_input?.team_name || '').trim();
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
    };

    if (Object.keys(nextFailures).length > 0) {
      next.preconditionFailures = nextFailures;
    } else {
      delete next.preconditionFailures;
    }

    return next;
  });
}
