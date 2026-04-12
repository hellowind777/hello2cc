import { worktreePreconditionsAppearSatisfied } from './worktree-preconditions.mjs';
import { hasActiveTaskBoard } from './tool-policy-state.mjs';
import { isNonRealTeamName, isOmittedTeamPlaceholder } from './team-name.mjs';

function trimmed(value) {
  return String(value || '').trim();
}

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

export function activeWorktreeFailure(sessionContext = {}) {
  const failure = knownWorktreeFailure(sessionContext);
  if (!failure) return null;

  const cwd = trimmed(sessionContext?.currentCwd);
  if (!cwd) return failure;

  return worktreePreconditionsAppearSatisfied(cwd) ? null : failure;
}

export function knownMissingTeamFailure(sessionContext = {}, teamName) {
  const normalizedTeamName = normalizedFailureKey(teamName, true);
  if (!normalizedTeamName) return null;

  const failures = preconditionFailures(sessionContext);
  const missingTeams = failures?.missingTeams && typeof failures.missingTeams === 'object'
    ? failures.missingTeams
    : {};

  return missingTeams[normalizedTeamName] || null;
}

export function isImplicitAssistantTeamName(value) {
  return isNonRealTeamName(value);
}

export { isOmittedTeamPlaceholder };

export function stripAgentTeamFields(input) {
  const updatedInput = { ...input };
  delete updatedInput.name;
  delete updatedInput.team_name;
  return updatedInput;
}

export function stripAgentWorktreeIsolation(input) {
  const updatedInput = { ...input };
  delete updatedInput.isolation;
  return updatedInput;
}

function lastIntentProfile(sessionContext = {}) {
  if (sessionContext?.lastIntentProfile && typeof sessionContext.lastIntentProfile === 'object') {
    return sessionContext.lastIntentProfile;
  }

  return sessionContext?.lastPromptSignals && typeof sessionContext.lastPromptSignals === 'object'
    ? sessionContext.lastPromptSignals
    : {};
}

function intentCollaborationState(sessionContext = {}) {
  const profile = lastIntentProfile(sessionContext);
  return profile?.collaboration && typeof profile.collaboration === 'object'
    ? profile.collaboration
    : {};
}

function intentRoutingState(sessionContext = {}) {
  const profile = lastIntentProfile(sessionContext);
  return profile?.routing && typeof profile.routing === 'object'
    ? profile.routing
    : {};
}

export function hasIntentTeamSemantics(sessionContext = {}) {
  const collaboration = intentCollaborationState(sessionContext);
  return Boolean(
    collaboration.team_semantics ||
    collaboration.team_workflow ||
    collaboration.proactive_team ||
    sessionContext?.lastPromptSignals?.teamSemantics ||
    sessionContext?.lastPromptSignals?.teamWorkflow ||
    sessionContext?.lastPromptSignals?.proactiveTeamWorkflow,
  );
}

export function wantsIntentWorktree(sessionContext = {}) {
  const collaboration = intentCollaborationState(sessionContext);
  return Boolean(
    collaboration.wants_worktree ||
    sessionContext?.lastPromptSignals?.wantsWorktree,
  );
}

export function hasIntentParallelOrTeamState(sessionContext = {}) {
  const collaboration = intentCollaborationState(sessionContext);
  const routing = intentRoutingState(sessionContext);

  return Boolean(
    collaboration.team_semantics ||
    collaboration.team_workflow ||
    collaboration.proactive_team ||
    collaboration.task_board ||
    collaboration.swarm ||
    collaboration.parallel_requested ||
    routing.complex,
  );
}

export function provenActiveTeamContext(sessionContext = {}) {
  const activeTeamName = trimmed(sessionContext?.teamName);
  if (!activeTeamName || isImplicitAssistantTeamName(activeTeamName)) {
    return false;
  }

  if (knownMissingTeamFailure(sessionContext, activeTeamName)) {
    return false;
  }

  const collaboration = intentCollaborationState(sessionContext);
  return Boolean(
    hasActiveTaskBoard(sessionContext) ||
    (trimmed(sessionContext?.agentName) && (
      collaboration.team_workflow ||
      collaboration.task_board ||
      collaboration.swarm
    )),
  );
}

export function readTrimmed(value) {
  return trimmed(value);
}

export { hasActiveTaskBoard };
