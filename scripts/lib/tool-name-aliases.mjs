function trimmed(value) {
  return String(value || '').trim();
}

/**
 * Claude Code historically exposed the native subagent tool as `Task`.
 * Newer surfaces prefer `Agent`, but both names should be treated as the
 * same native capability inside hello2cc.
 */
export function canonicalToolName(value = '') {
  const toolName = trimmed(value);
  return toolName === 'Task' ? 'Agent' : toolName;
}

export function isAgentToolName(value = '') {
  return canonicalToolName(value) === 'Agent';
}
