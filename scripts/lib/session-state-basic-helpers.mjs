import { realTeamNameOrEmpty } from './team-name.mjs';

function trimmed(value) {
  return String(value || '').trim();
}

function collapseWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncateText(value, limit = 96) {
  if (!value) return '';
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

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

  const teamName = realTeamNameOrEmpty(match[1]);
  if (!teamName) return null;

  return {
    teamName,
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

export {
  caseInsensitivePathKeys,
  collapseWhitespace,
  enterWorktreeFailureError,
  failureRecord,
  missingTeamMatch,
  normalizeFailureKey,
  readToolTeamName,
  trimmed,
  truncateText,
  worktreeFailureError,
};
