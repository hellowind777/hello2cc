import {
  deriveAgentCapabilities,
  deriveToolCapabilities,
  normalizeAgentTypes,
  normalizeToolNames,
} from './session-capabilities.mjs';
import { extractSessionContextFromTranscript } from './transcript-context.mjs';
import {
  mutateSessionEntry,
  normalizeSessionId,
} from './session-state-store.mjs';

/**
 * Builds the in-memory session snapshot from hook payload fields and transcript hints.
 */
export function sessionContextFromPayload(payload = {}) {
  const sessionId = normalizeSessionId(payload?.session_id);
  const tools = normalizeToolNames(payload?.tools);
  const agents = normalizeAgentTypes(payload?.agents);

  return {
    ...extractSessionContextFromTranscript(payload?.transcript_path, sessionId),
    ...(String(payload?.model || '').trim() ? { mainModel: String(payload.model).trim() } : {}),
    ...(String(payload?.output_style || '').trim() ? { outputStyle: String(payload.output_style).trim() } : {}),
    ...(String(payload?.cwd || '').trim() ? { currentCwd: String(payload.cwd).trim() } : {}),
    ...(tools.length ? {
      toolNames: tools,
      ...deriveToolCapabilities(tools),
    } : {}),
    ...(agents.length ? {
      agentTypes: agents,
      ...deriveAgentCapabilities(agents),
    } : {}),
  };
}

function rememberableContext(context = {}) {
  return {
    mainModel: String(context.mainModel || '').trim(),
    outputStyle: String(context.outputStyle || '').trim(),
    currentCwd: String(context.currentCwd || '').trim(),
    toolNames: Array.isArray(context.toolNames) ? context.toolNames : [],
    agentTypes: Array.isArray(context.agentTypes) ? context.agentTypes : [],
    surfacedSkills: Array.isArray(context.surfacedSkills) ? context.surfacedSkills : [],
    surfacedSkillNames: Array.isArray(context.surfacedSkillNames) ? context.surfacedSkillNames : [],
    loadedCommands: Array.isArray(context.loadedCommands) ? context.loadedCommands : [],
    loadedCommandNames: Array.isArray(context.loadedCommandNames) ? context.loadedCommandNames : [],
    workflowEntries: Array.isArray(context.workflowEntries) ? context.workflowEntries : [],
    workflowNames: Array.isArray(context.workflowNames) ? context.workflowNames : [],
    availableDeferredToolNames: Array.isArray(context.availableDeferredToolNames) ? context.availableDeferredToolNames : [],
    loadedDeferredToolNames: Array.isArray(context.loadedDeferredToolNames) ? context.loadedDeferredToolNames : [],
    mcpResources: Array.isArray(context.mcpResources) ? context.mcpResources : [],
    teamName: String(context.teamName || '').trim(),
    agentName: String(context.agentName || '').trim(),
  };
}

function hasRememberableFields(context = {}) {
  return Boolean(
    context.mainModel ||
    context.outputStyle ||
    context.currentCwd ||
    context.toolNames.length ||
    context.agentTypes.length ||
    context.surfacedSkills.length ||
    context.surfacedSkillNames.length ||
    context.loadedCommands.length ||
    context.loadedCommandNames.length ||
    context.workflowEntries.length ||
    context.workflowNames.length ||
    context.availableDeferredToolNames.length ||
    context.loadedDeferredToolNames.length ||
    context.mcpResources.length ||
    context.teamName ||
    context.agentName
  );
}

/**
 * Persists the latest session context snapshot for future hooks in the same session.
 */
export function rememberSessionContext(payload) {
  const key = normalizeSessionId(payload?.session_id);
  const context = rememberableContext(sessionContextFromPayload(payload));
  if (!key || !hasRememberableFields(context)) {
    return {};
  }

  return mutateSessionEntry(key, (current) => ({
    ...current,
    ...(context.mainModel ? { mainModel: context.mainModel } : {}),
    ...(context.outputStyle ? { outputStyle: context.outputStyle } : {}),
    ...(context.currentCwd ? { currentCwd: context.currentCwd } : {}),
    ...(context.toolNames.length ? {
      toolNames: context.toolNames,
      ...deriveToolCapabilities(context.toolNames),
    } : {}),
    ...(context.agentTypes.length ? {
      agentTypes: context.agentTypes,
      ...deriveAgentCapabilities(context.agentTypes),
    } : {}),
    ...(context.surfacedSkills.length ? { surfacedSkills: context.surfacedSkills } : {}),
    ...(context.surfacedSkillNames.length ? { surfacedSkillNames: context.surfacedSkillNames } : {}),
    ...(context.loadedCommands.length ? { loadedCommands: context.loadedCommands } : {}),
    ...(context.loadedCommandNames.length ? { loadedCommandNames: context.loadedCommandNames } : {}),
    ...(context.workflowEntries.length ? { workflowEntries: context.workflowEntries } : {}),
    ...(context.workflowNames.length ? { workflowNames: context.workflowNames } : {}),
    ...(context.availableDeferredToolNames.length ? { availableDeferredToolNames: context.availableDeferredToolNames } : {}),
    ...(context.loadedDeferredToolNames.length ? { loadedDeferredToolNames: context.loadedDeferredToolNames } : {}),
    ...(context.mcpResources.length ? { mcpResources: context.mcpResources } : {}),
    ...(context.teamName ? { teamName: context.teamName } : {}),
    ...(context.agentName ? { agentName: context.agentName } : {}),
  }));
}

/**
 * Stores the last emitted prompt-state signature so route hooks can avoid repeats.
 */
export function rememberRouteStateSignature(sessionId, signature = '') {
  const key = normalizeSessionId(sessionId);
  if (!key) return {};

  const nextSignature = String(signature || '').trim();
  return mutateSessionEntry(key, (current) => {
    if (!nextSignature) {
      const next = { ...current };
      delete next.lastRouteStateSignature;
      return next;
    }

    return {
      ...current,
      lastRouteStateSignature: nextSignature,
    };
  });
}
