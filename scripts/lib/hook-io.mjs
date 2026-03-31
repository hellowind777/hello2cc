import { readFileSync, writeFileSync } from 'node:fs';

export function readStdinJson(label = 'hook') {
  try {
    const raw = readFileSync(0, 'utf8').trim();
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    process.stderr.write(`${label}: failed to parse stdin JSON: ${error.message}\n`);
    return {};
  }
}

export function writeJson(payload) {
  process.stdout.write(JSON.stringify(payload));
}

export function maybeDumpPayload(label, payload) {
  const dumpPath = String(process.env.HELLO2CC_DEBUG_ROUTE_PATH || '').trim();
  if (!dumpPath) return;

  try {
    writeFileSync(dumpPath, JSON.stringify({ label, payload }, null, 2), 'utf8');
  } catch (error) {
    process.stderr.write(`${label}: failed to write debug payload: ${error.message}\n`);
  }
}

export function suppressHook(hookEventName, additionalContext) {
  writeJson({
    hookSpecificOutput: {
      hookEventName,
      ...(additionalContext ? { additionalContext } : {}),
    },
    suppressOutput: true,
  });
}

export function emptySuppress() {
  writeJson({ suppressOutput: true });
}

export function allowWithUpdatedInput(updatedInput, reason) {
  writeJson({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: reason,
      updatedInput,
    },
    suppressOutput: true,
  });
}
