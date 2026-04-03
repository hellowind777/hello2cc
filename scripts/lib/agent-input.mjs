import { worktreePreconditionsAppearSatisfied } from './worktree-preconditions.mjs';

function trimmed(value) {
  return String(value || '').trim();
}

const IMPLICIT_ASSISTANT_TEAM_NAMES = new Set(['main', 'default']);

function normalizedFailureKey(value, caseInsensitive = false) {
  const normalized = trimmed(value);
  if (!normalized) return '';
  return caseInsensitive ? normalized.toLowerCase() : normalized;
}

function pathKeysAreCaseInsensitive() {
  return process.platform === 'win32';
}

function preconditionFailures(sessionContext = {}) {
  return sessionContext?.preconditionFailures && typeof sessionContext.preconditionFailures === 'object'
    ? sessionContext.preconditionFailures
    : {};
}

function knownWorktreeFailure(sessionContext = {}) {
  const cwd = trimmed(sessionContext?.currentCwd);
  if (!cwd) return null;

  const key = normalizedFailureKey(cwd, pathKeysAreCaseInsensitive());
  const failures = preconditionFailures(sessionContext);
  const worktreeByCwd = failures?.worktreeByCwd && typeof failures.worktreeByCwd === 'object'
    ? failures.worktreeByCwd
    : {};

  return worktreeByCwd[key] || null;
}

function activeWorktreeFailure(sessionContext = {}) {
  const failure = knownWorktreeFailure(sessionContext);
  if (!failure) return null;

  const cwd = trimmed(sessionContext?.currentCwd);
  if (!cwd) return failure;

  return worktreePreconditionsAppearSatisfied(cwd) ? null : failure;
}

function knownMissingTeamFailure(sessionContext = {}, teamName) {
  const normalizedTeamName = normalizedFailureKey(teamName, true);
  if (!normalizedTeamName) return null;

  const failures = preconditionFailures(sessionContext);
  const missingTeams = failures?.missingTeams && typeof failures.missingTeams === 'object'
    ? failures.missingTeams
    : {};

  return missingTeams[normalizedTeamName] || null;
}

function isImplicitAssistantTeamName(value) {
  return IMPLICIT_ASSISTANT_TEAM_NAMES.has(trimmed(value).toLowerCase());
}

function stripAgentTeamFields(input) {
  const updatedInput = { ...input };
  delete updatedInput.name;
  delete updatedInput.team_name;
  return updatedInput;
}

export function normalizeAgentTeamSemantics(input = {}, sessionContext = {}) {
  const workerName = trimmed(input?.name);
  const explicitTeamName = trimmed(input?.team_name);
  const hasTeamSemantics = Boolean(workerName || explicitTeamName);
  const explicitTeamIsImplicit = isImplicitAssistantTeamName(explicitTeamName);
  const candidateTeamName = explicitTeamName;
  const missingTeamFailure = candidateTeamName && !isImplicitAssistantTeamName(candidateTeamName)
    ? knownMissingTeamFailure(sessionContext, candidateTeamName)
    : null;

  if (!hasTeamSemantics) {
    return { input, changed: false, reason: '', blocked: false };
  }

  if (missingTeamFailure) {
    return {
      input,
      changed: false,
      blocked: true,
      reason: `hello2cc blocked Agent retry because team "${candidateTeamName}" is known missing in this session; create the team again with TeamCreate or fall back to a plain non-team subagent path before retrying`,
    };
  }

  if (explicitTeamName && !explicitTeamIsImplicit) {
    return { input, changed: false, reason: '', blocked: false };
  }

  return {
    input: stripAgentTeamFields(input),
    changed: true,
    reason: explicitTeamIsImplicit
      ? 'hello2cc stripped reserved assistant team placeholders; use a real explicit team_name created by TeamCreate or fall back to a plain subagent'
      : 'hello2cc stripped implicit teammate fields; plain workers should omit name/team_name, and real teammates should pass an explicit team_name',
    blocked: false,
  };
}

export function normalizeAgentIsolation(input = {}, sessionContext = {}) {
  const explicitIsolation = trimmed(input?.isolation).toLowerCase();
  const worktreeFailure = explicitIsolation === 'worktree'
    ? activeWorktreeFailure(sessionContext)
    : null;

  if (worktreeFailure) {
    return {
      input,
      changed: false,
      blocked: true,
      reason: `hello2cc blocked repeated worktree isolation in this cwd because Claude Code already failed here with a non-git/no-hook precondition; switch to a git repository, configure WorktreeCreate hooks, or retry without worktree isolation`,
    };
  }

  return { input, changed: false, reason: '', blocked: false };
}

export function normalizeEnterWorktreeInput(input = {}, sessionContext = {}) {
  const worktreeFailure = activeWorktreeFailure(sessionContext);
  if (!worktreeFailure) {
    return { input, changed: false, reason: '', blocked: false };
  }

  return {
    input,
    changed: false,
    blocked: true,
    reason: 'hello2cc blocked repeated EnterWorktree retry in this cwd because Claude Code already proved the worktree preconditions were not met here; switch into a git repository or configure WorktreeCreate/WorktreeRemove hooks first',
  };
}
