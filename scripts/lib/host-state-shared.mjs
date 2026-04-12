import { realTeamNameOrEmpty } from './team-name.mjs';

export function trimmed(value) {
  return String(value || '').trim();
}

export function uniqueStrings(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => trimmed(value))
      .filter(Boolean),
  )];
}

export function truncatePreview(value, limit = 140) {
  const text = trimmed(value);
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function compact(value) {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => compact(item))
      .filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, nestedValue]) => [key, compact(nestedValue)])
      .filter(([, nestedValue]) => nestedValue !== undefined);

    if (!entries.length) return undefined;
    return Object.fromEntries(entries);
  }

  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  return value;
}

export function compactState(value) {
  return compact(value);
}

export function visibleTeamName(sessionContext = {}) {
  return realTeamNameOrEmpty(sessionContext?.teamName);
}
