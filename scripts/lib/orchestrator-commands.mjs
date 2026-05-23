import {
  normalizeAgentIsolation,
  normalizeAgentTeamSemantics,
  normalizeEnterWorktreeInput,
  normalizeTeamCreateInput,
} from './agent-input.mjs';
import { configuredModels, shouldEmitAdditionalContext } from './config.mjs';
import { resolvedAgentModelOverride } from './agent-models.mjs';
import {
  allowWithUpdatedInput,
  denyToolUse,
  emptySuppress,
  maybeDumpPayload,
  readStdinJson,
  suppressHook,
} from './hook-io.mjs';
import { buildRouteContext, buildSessionStartContext, extractPromptText } from './native-context.mjs';
import { normalizeSendMessageInput } from './send-message-input.mjs';
import {
  normalizeAskUserQuestionInput,
  normalizeExitPlanModeInput,
  normalizeEnterPlanModeInput,
  normalizeTaskCreateInput,
  normalizeTaskGetInput,
  normalizeTaskListInput,
  normalizeTaskUpdateInput,
  normalizeTeamDeleteInput,
  normalizeToolSearchInput,
} from './tool-policy-input.mjs';
import {
  clearAllSessionContexts,
  clearSessionContext,
  rememberIntentProfile,
  rememberRouteStateSignature,
  rememberToolFailure,
  rememberToolSuccess,
  rememberSessionContext,
  readSessionContext,
} from './session-state.mjs';
import { readTeamEntry } from './team-state-store.mjs';
import { analyzeIntentProfile } from './intent-profile.mjs';
import { isSubagentPrompt, startsWithExplicitCommand } from './prompt-signals.mjs';
import { canonicalToolName, isAgentToolName } from './tool-name-aliases.mjs';

function currentSessionContext(payload = {}) {
  const stored = readSessionContext(payload?.session_id);
  const refreshed = rememberSessionContext(payload);
  const merged = {
    ...stored,
    ...refreshed,
  };
  const sharedTeamState = merged?.teamName
    ? readTeamEntry(merged.teamName)
    : {};

  return {
    ...merged,
    ...(Object.keys(sharedTeamState).length > 0 ? { sharedTeamState } : {}),
  };
}

function handleNormalizedPreTool(payload, expectedToolName, normalization) {
  const toolName = canonicalToolName(payload.tool_name);
  if (toolName && toolName !== expectedToolName) {
    emptySuppress();
    return;
  }

  if (normalization.blocked) {
    denyToolUse(normalization.reason);
    return;
  }

  if (normalization.changed) {
    allowWithUpdatedInput(
      normalization.input,
      normalization.reason,
    );
    return;
  }

  emptySuppress();
}

function buildNormalizedPreToolCommand(expectedToolName, normalizeInput) {
  return async function runNormalizedPreTool() {
    const payload = readStdinJson('orchestrator.mjs');
    handleNormalizedPreTool(
      payload,
      expectedToolName,
      normalizeInput(payload.tool_input || {}, currentSessionContext(payload)),
    );
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
    rememberIntentProfile(payload?.session_id, {});
    emptySuppress();
    return;
  }

  const signals = analyzeIntentProfile(prompt, sessionContext);
  rememberIntentProfile(payload?.session_id, signals);

  if (!shouldEmitAdditionalContext()) {
    emptySuppress();
    return;
  }

  const additionalContext = buildRouteContext(prompt, sessionContext);
  if (!additionalContext) {
    rememberRouteStateSignature(payload?.session_id, '');
    emptySuppress();
    return;
  }

  if (sessionContext?.lastRouteStateSignature === additionalContext) {
    emptySuppress();
    return;
  }

  rememberRouteStateSignature(payload?.session_id, additionalContext);
  suppressHook('UserPromptSubmit', additionalContext);
}

async function cmdPreAgentModel() {
  const payload = readStdinJson('orchestrator.mjs');
  const input = payload.tool_input || {};
  const sessionContext = currentSessionContext(payload);

  if (payload.tool_name && !isAgentToolName(payload.tool_name)) {
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

  allowWithUpdatedInput(
    {
      ...isolationNormalization.input,
      ...(override.model ? { model: override.model } : {}),
    },
    [
      teamNormalization.reason,
      isolationNormalization.reason,
      override.reason,
    ].filter(Boolean).join('; '),
  );
}

const cmdPreEnterWorktree = buildNormalizedPreToolCommand('EnterWorktree', normalizeEnterWorktreeInput);
const cmdPreTeamCreate = buildNormalizedPreToolCommand('TeamCreate', normalizeTeamCreateInput);
const cmdPreTaskCreate = buildNormalizedPreToolCommand('TaskCreate', normalizeTaskCreateInput);
const cmdPreTeamDelete = buildNormalizedPreToolCommand('TeamDelete', normalizeTeamDeleteInput);
const cmdPreTaskList = buildNormalizedPreToolCommand('TaskList', normalizeTaskListInput);
const cmdPreTaskGet = buildNormalizedPreToolCommand('TaskGet', normalizeTaskGetInput);
const cmdPreTaskUpdate = buildNormalizedPreToolCommand('TaskUpdate', normalizeTaskUpdateInput);
const cmdPreToolSearch = buildNormalizedPreToolCommand('ToolSearch', normalizeToolSearchInput);
const cmdPreEnterPlanMode = buildNormalizedPreToolCommand('EnterPlanMode', normalizeEnterPlanModeInput);
const cmdPreExitPlanMode = buildNormalizedPreToolCommand('ExitPlanMode', normalizeExitPlanModeInput);
const cmdPreAskUserQuestion = buildNormalizedPreToolCommand('AskUserQuestion', normalizeAskUserQuestionInput);

async function cmdPreSendMessage() {
  const payload = readStdinJson('orchestrator.mjs');
  const normalization = normalizeSendMessageInput(payload.tool_input || {}, currentSessionContext(payload));

  if (payload.tool_name && payload.tool_name !== 'SendMessage') {
    emptySuppress();
    return;
  }

  if (normalization.blocked) {
    denyToolUse(normalization.reason);
    return;
  }

  if (!normalization.changed) {
    emptySuppress();
    return;
  }

  allowWithUpdatedInput(normalization.input, normalization.reason);
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
  rememberToolFailure(readStdinJson('orchestrator.mjs'));
  emptySuppress();
}

async function cmdPostToolUse() {
  rememberToolSuccess(readStdinJson('orchestrator.mjs'));
  emptySuppress();
}

const COMMAND_HANDLERS = {
  'session-start': cmdSessionStart,
  route: cmdRoute,
  'pre-agent-model': cmdPreAgentModel,
  'pre-enter-worktree': cmdPreEnterWorktree,
  'pre-team-create': cmdPreTeamCreate,
  'pre-task-create': cmdPreTaskCreate,
  'pre-team-delete': cmdPreTeamDelete,
  'pre-task-list': cmdPreTaskList,
  'pre-task-get': cmdPreTaskGet,
  'pre-task-update': cmdPreTaskUpdate,
  'pre-tool-search': cmdPreToolSearch,
  'pre-enter-plan-mode': cmdPreEnterPlanMode,
  'pre-exit-plan-mode': cmdPreExitPlanMode,
  'pre-ask-user-question': cmdPreAskUserQuestion,
  'pre-send-message': cmdPreSendMessage,
  'config-change': cmdConfigChange,
  'post-tool-failure': cmdPostToolFailure,
  'post-tool-use': cmdPostToolUse,
};

/**
 * Runs a single orchestrator hook command using the shared Claude Code adapter pipeline.
 */
export async function runOrchestratorCommand(command = '') {
  const handler = COMMAND_HANDLERS[command];
  if (!handler) {
    process.stderr.write(`orchestrator.mjs: unknown command "${command}"\n`);
    process.exit(1);
  }

  await handler();
}
