import { buildSessionStartHostState, renderHostStateBlock } from './host-state-context.mjs';

/**
 * Builds the session-start additionalContext block as a compact host-state snapshot.
 */
export function buildSessionStartContext(sessionContext = {}) {
  return renderHostStateBlock(
    'hello2cc host_state',
    buildSessionStartHostState(sessionContext),
  );
}
