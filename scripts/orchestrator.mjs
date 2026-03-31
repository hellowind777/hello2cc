#!/usr/bin/env node
import { configuredModels } from './lib/config.mjs';
import { preferredModelForAgent } from './lib/agent-models.mjs';
import {
  allowWithUpdatedInput,
  emptySuppress,
  maybeDumpPayload,
  readStdinJson,
  suppressHook,
} from './lib/hook-io.mjs';
import { buildRouteSteps, buildSessionStartContext, extractPromptText } from './lib/native-context.mjs';
import { ensureManagedOutputStyle } from './lib/output-style-bootstrap.mjs';
import { rememberSessionContext, readSessionContext } from './lib/session-state.mjs';
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

  ensureManagedOutputStyle(process.cwd());
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

  if (payload.tool_name && payload.tool_name !== 'Agent') {
    emptySuppress();
    return;
  }

  const preferredModel = preferredModelForAgent(input, configuredModels(currentSessionContext(payload)));
  if (!preferredModel) {
    emptySuppress();
    return;
  }

  allowWithUpdatedInput(
    {
      ...input,
      model: preferredModel,
    },
    `hello2cc injected Agent.model=${preferredModel}`,
  );
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
    default:
      process.stderr.write(`orchestrator.mjs: unknown command "${cmd}"\n`);
      process.exit(1);
  }
}

await main();
