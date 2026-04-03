import {
  rememberRouteStateSignature,
  rememberSessionContext,
  sessionContextFromPayload,
} from './session-state-context.mjs';
import {
  rememberToolFailure,
  rememberToolSuccess,
} from './session-state-preconditions.mjs';
import {
  clearAllSessionEntries,
  clearSessionEntry,
  readSessionEntry,
} from './session-state-store.mjs';

export function readSessionContext(sessionId) {
  return readSessionEntry(sessionId);
}

export function clearSessionContext(sessionId) {
  return clearSessionEntry(sessionId);
}

export function clearAllSessionContexts() {
  clearAllSessionEntries();
}

export {
  rememberRouteStateSignature,
  rememberSessionContext,
  rememberToolFailure,
  rememberToolSuccess,
  sessionContextFromPayload,
};
