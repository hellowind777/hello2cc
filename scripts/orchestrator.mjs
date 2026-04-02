#!/usr/bin/env node
import { normalizeAgentIsolation, normalizeAgentTeamSemantics } from './lib/agent-input.mjs';
import { configuredModels, shouldEmitAdditionalContext } from './lib/config.mjs';
import { resolvedAgentModelOverride } from './lib/agent-models.mjs';
import {
  allowWithUpdatedInput,
  emptySuppress,
  maybeDumpPayload,
  readStdinJson,
  suppressHook,
} from './lib/hook-io.mjs';
import { buildRouteSteps, buildSessionStartContext, extractPromptText } from './lib/native-context.mjs';
import {
  clearAllSessionContexts,
  clearSessionContext,
  rememberSessionContext,
  rememberPromptSignals,
  readSessionContext,
} from './lib/session-state.mjs';
import { classifyPrompt, isSubagentPrompt, startsWithExplicitCommand } from './lib/prompt-signals.mjs';

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

  const signals = classifyPrompt(prompt);
  rememberPromptSignals(payload?.session_id, signals);

  if (!shouldEmitAdditionalContext()) {
    emptySuppress();
    return;
  }

  const additionalContext = buildRouteSteps(prompt, sessionContext);
  if (!additionalContext) {
    emptySuppress();
    return;
  }

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
  const isolationNormalization = normalizeAgentIsolation(teamNormalization.input, sessionContext);
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
    case 'config-change':
      await cmdConfigChange();
      break;
    default:
      process.stderr.write(`orchestrator.mjs: unknown command "${cmd}"\n`);
      process.exit(1);
  }
}

await main();
