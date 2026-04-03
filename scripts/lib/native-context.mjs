import { buildRouteStateContext } from './route-guidance.mjs';
import { buildSessionStartContext as buildSessionStartContextText } from './session-guidance.mjs';

function flattenPromptValue(value, seen = new WeakSet()) {
  if (typeof value === 'string') return value;
  if (!value) return '';
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '';

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => flattenPromptValue(item, seen)).filter(Boolean).join(' ');
  }

  const preferredKeys = ['text', 'prompt', 'message', 'content', 'input'];
  const parts = [];

  for (const key of preferredKeys) {
    if (key in value) {
      parts.push(flattenPromptValue(value[key], seen));
    }
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (preferredKeys.includes(key)) continue;
    parts.push(flattenPromptValue(nestedValue, seen));
  }

  return parts.filter(Boolean).join(' ');
}

export function extractPromptText(payload) {
  const candidates = [
    payload?.prompt,
    payload?.userPrompt,
    payload?.message,
    payload?.input,
    payload?.text,
  ];

  return candidates
    .map((candidate) => flattenPromptValue(candidate))
    .find((text) => String(text || '').trim()) || '';
}

export function buildSessionStartContext(sessionContext = {}) {
  return buildSessionStartContextText(sessionContext);
}

export function buildRouteContext(sessionContext = {}) {
  return buildRouteStateContext(sessionContext);
}
