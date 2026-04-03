import { buildPromptHostState, renderHostStateBlock } from './host-state-context.mjs';

/**
 * Builds prompt-submit state updates without semantic routing advice.
 */
export function buildRouteStateContext(sessionContext = {}) {
  return renderHostStateBlock(
    'hello2cc prompt_state',
    buildPromptHostState(sessionContext),
  );
}
