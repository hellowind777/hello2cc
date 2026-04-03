#!/usr/bin/env node
import { normalizeAgentIsolation, normalizeAgentTeamSemantics, normalizeEnterWorktreeInput } from './lib/agent-input.mjs';
import { configuredModels, shouldEmitAdditionalContext } from './lib/config.mjs';
import { resolvedAgentModelOverride } from './lib/agent-models.mjs';
import {
  allowWithUpdatedInput,
  denyToolUse,
  emptySuppress,
  maybeDumpPayload,
  readStdinJson,
  suppressHook,
} from './lib/hook-io.mjs';
import { buildRouteContext, buildSessionStartContext, extractPromptText } from './lib/native-context.mjs';
import { normalizeSendMessageInput } from './lib/send-message-input.mjs';
import {
  clearAllSessionContexts,
  clearSessionContext,
  rememberRouteStateSignature,
  rememberToolFailure,
  rememberToolSuccess,
  rememberSessionContext,
  readSessionContext,
} from './lib/session-state.mjs';
import { isSubagentPrompt, startsWithExplicitCommand } from './lib/prompt-signals.mjs';

const cmd = process.argv[2] || '';

function currentSessionContext(payload = {}) {
  return {
    ...readSessionContext(payload?.session_id),
    ...rememberSessionContext(payload),
  };
}

async function cmdSessionStart() {
  const payload = readStdinJson('orchestrator.mjs');
  const sessionContext = currentSessionContext(payload);

  if (!shouldEmitAdditionalContext()) {
    emptySuppress();
    return;
  }

  suppressHook('SessionStart', buildSessionStartContext(sessionContext));
}

async function cmdRoute() {
  const payload = readStdinJson('orchestrator.mjs');
  const sessionContext = currentSessionContext(payload);
  maybeDumpPayload('route', payload);

  const prompt = extractPromptText(payload).trim();
  if (!prompt || startsWithExplicitCommand(prompt) || isSubagentPrompt(prompt)) {
    emptySuppress();
    return;
  }

  if (!shouldEmitAdditionalContext()) {
    emptySuppress();
    return;
  }

  const additionalContext = buildRouteContext(sessionContext);
  if (!additionalContext) {
    rememberRouteStateSignature(payload?.session_id, '');
    emptySuppress();
    return;
  }

  const signature = additionalContext;
  if (!signature || sessionContext?.lastRouteStateSignature === signature) {
    emptySuppress();
    return;
  }

  rememberRouteStateSignature(payload?.session_id, signature);

  suppressHook('UserPromptSubmit', additionalContext);
}

async function cmdPreAgentModel() {
  const payload = readStdinJson('orchestrator.mjs');
  const input = payload.tool_input || {};
  const sessionContext = currentSessionContext(payload);

  if (payload.tool_name && payload.tool_name !== 'Agent') {
    emptySuppress();
    return;
  }

  const teamNormalization = normalizeAgentTeamSemantics(input, sessionContext);
  if (teamNormalization.blocked) {
    denyToolUse(teamNormalization.reason);
    return;
  }

  const isolationNormalization = normalizeAgentIsolation(teamNormalization.input, sessionContext);
  if (isolationNormalization.blocked) {
    denyToolUse(isolationNormalization.reason);
    return;
  }

  const override = resolvedAgentModelOverride(isolationNormalization.input, configuredModels(sessionContext));
  if (!override.model && !teamNormalization.changed && !isolationNormalization.changed) {
    emptySuppress();
    return;
  }

  const updatedInput = {
    ...isolationNormalization.input,
    ...(override.model ? { model: override.model } : {}),
  };
  const reasons = [
    teamNormalization.reason,
    isolationNormalization.reason,
    override.reason,
  ].filter(Boolean);

  allowWithUpdatedInput(
    updatedInput,
    reasons.join('; '),
  );
}

async function cmdPreEnterWorktree() {
  const payload = readStdinJson('orchestrator.mjs');
  const sessionContext = currentSessionContext(payload);
  const input = payload.tool_input || {};

  if (payload.tool_name && payload.tool_name !== 'EnterWorktree') {
    emptySuppress();
    return;
  }

  const normalization = normalizeEnterWorktreeInput(input, sessionContext);
  if (normalization.blocked) {
    denyToolUse(normalization.reason);
    return;
  }

  emptySuppress();
}

async function cmdPreSendMessage() {
  const payload = readStdinJson('orchestrator.mjs');
  const input = payload.tool_input || {};

  if (payload.tool_name && payload.tool_name !== 'SendMessage') {
    emptySuppress();
    return;
  }

  const normalization = normalizeSendMessageInput(input);
  if (!normalization.changed) {
    emptySuppress();
    return;
  }

  allowWithUpdatedInput(
    normalization.input,
    normalization.reason,
  );
}

async function cmdConfigChange() {
  const payload = readStdinJson('orchestrator.mjs');
  const source = String(payload?.source || '').trim();
  const sessionId = String(payload?.session_id || '').trim();

  if (source === 'user_settings' || source === 'policy_settings') {
    clearAllSessionContexts();
  } else if (sessionId) {
    clearSessionContext(sessionId);
  }

  emptySuppress();
}

async function cmdPostToolFailure() {
  const payload = readStdinJson('orchestrator.mjs');
  rememberToolFailure(payload);
  emptySuppress();
}

async function cmdPostToolUse() {
  const payload = readStdinJson('orchestrator.mjs');
  rememberToolSuccess(payload);
  emptySuppress();
}

async function main() {
  switch (cmd) {
    case 'session-start':
      await cmdSessionStart();
      break;
    case 'route':
      await cmdRoute();
      break;
    case 'pre-agent-model':
      await cmdPreAgentModel();
      break;
    case 'pre-enter-worktree':
      await cmdPreEnterWorktree();
      break;
    case 'pre-send-message':
      await cmdPreSendMessage();
      break;
    case 'config-change':
      await cmdConfigChange();
      break;
    case 'post-tool-failure':
      await cmdPostToolFailure();
      break;
    case 'post-tool-use':
      await cmdPostToolUse();
      break;
    default:
      process.stderr.write(`orchestrator.mjs: unknown command "${cmd}"\n`);
      process.exit(1);
  }
}

await main();
