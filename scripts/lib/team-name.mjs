function trimmed(value) {
  return String(value || '').trim();
}

const RESERVED_ASSISTANT_TEAM_NAMES = new Set(['main', 'default']);
const OMITTED_TEAM_PLACEHOLDERS = new Set([
  'none',
  'null',
  'undefined',
  'omit',
  'omitted',
  '__omit__',
  '__none__',
]);

function normalizedTeamKey(value) {
  return trimmed(value).toLowerCase();
}

export function isReservedAssistantTeamName(value) {
  return RESERVED_ASSISTANT_TEAM_NAMES.has(normalizedTeamKey(value));
}

export function isOmittedTeamPlaceholder(value) {
  return OMITTED_TEAM_PLACEHOLDERS.has(normalizedTeamKey(value));
}

export function isNonRealTeamName(value) {
  return isReservedAssistantTeamName(value) || isOmittedTeamPlaceholder(value);
}

export function realTeamNameOrEmpty(value) {
  const teamName = trimmed(value);
  return isNonRealTeamName(teamName) ? '' : teamName;
}
