import { FORCED_OUTPUT_STYLE_NAME, configuredModels } from './config.mjs';
import { resolveWebSearchGuidanceState } from './api-topology.mjs';
import { observedAgentSurfaces } from './session-capabilities.mjs';

const IMPLICIT_ASSISTANT_TEAM_NAMES = new Set(['main', 'default']);

function trimmed(value) {
  return String(value || '').trim();
}

function uniqueStrings(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => trimmed(value))
      .filter(Boolean),
  )];
}

function compact(value) {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => compact(item))
      .filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, nestedValue]) => [key, compact(nestedValue)])
      .filter(([, nestedValue]) => nestedValue !== undefined);

    if (!entries.length) return undefined;
    return Object.fromEntries(entries);
  }

  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  return value;
}

function isImplicitAssistantTeamName(value) {
  return IMPLICIT_ASSISTANT_TEAM_NAMES.has(trimmed(value).toLowerCase());
}

function visibleTeamName(sessionContext = {}) {
  const teamName = trimmed(sessionContext?.teamName);
  if (!teamName || isImplicitAssistantTeamName(teamName)) {
    return '';
  }

  return teamName;
}

function mcpResourceRefs(sessionContext = {}) {
  const resources = Array.isArray(sessionContext?.mcpResources)
    ? sessionContext.mcpResources
    : [];

  return uniqueStrings(resources.map((resource) => {
    const server = trimmed(resource?.server);
    const uri = trimmed(resource?.uri);
    return server && uri ? `${server}:${uri}` : '';
  }));
}

function missingTeamNames(sessionContext = {}) {
  const missingTeams = sessionContext?.preconditionFailures?.missingTeams;
  if (!missingTeams || typeof missingTeams !== 'object') {
    return [];
  }

  return uniqueStrings(
    Object.entries(missingTeams).map(([fallbackName, record]) => record?.teamName || fallbackName),
  );
}

function blockedWorktreeCwds(sessionContext = {}) {
  const worktreeByCwd = sessionContext?.preconditionFailures?.worktreeByCwd;
  if (!worktreeByCwd || typeof worktreeByCwd !== 'object') {
    return [];
  }

  return uniqueStrings(
    Object.entries(worktreeByCwd).map(([fallbackCwd, record]) => record?.cwd || fallbackCwd),
  );
}

function hostAgentSurfaces(sessionContext = {}) {
  return observedAgentSurfaces(sessionContext?.agentTypes).map((surface) => compact({
    name: surface.label,
    role: surface.role,
    tool_surface: surface.toolSurface,
  }));
}

function webSearchState(sessionContext = {}, options = {}) {
  const state = resolveWebSearchGuidanceState(sessionContext);
  const stableMode = ['generic', 'available', 'not-exposed'].includes(state.mode);

  if (stableMode && !options.includeStableModes) {
    return undefined;
  }

  if (!options.includeStableModes && !state.degraded && !state.shouldProbe) {
    return undefined;
  }

  return compact({
    tool: sessionContext?.webSearchAvailable ? 'WebSearch' : undefined,
    mode: state.mode,
    degraded: state.degraded || undefined,
    probe_allowed: state.shouldProbe || undefined,
    transport_changed: state.transportChanged || undefined,
    model_changed: state.modelChanged || undefined,
    cooldown_expired: state.cooldownExpired || undefined,
  });
}

function protocolAdapters(sessionContext = {}) {
  const config = configuredModels(sessionContext);

  return compact({
    semantic_routing: 'model_decides',
    explicit_tool_input_wins: true,
    agent_model: config.routingPolicy === 'prompt-only'
      ? 'preserve_input'
      : 'fill_safe_claude_slot_if_missing',
    send_message_summary: 'fill_if_missing',
    repeated_failure_policy: 'block_same_failed_precondition_until_state_changes',
  });
}

function hostSnapshot(sessionContext = {}, options = {}) {
  return compact({
    session: compact({
      model: configuredModels(sessionContext).sessionModel || trimmed(sessionContext?.mainModel),
      output_style: trimmed(sessionContext?.outputStyle) || FORCED_OUTPUT_STYLE_NAME,
    }),
    host: compact({
      tools: uniqueStrings(sessionContext?.toolNames),
      agents: hostAgentSurfaces(sessionContext),
      surfaced_skills: uniqueStrings(sessionContext?.surfacedSkillNames),
      loaded_commands: uniqueStrings(sessionContext?.loadedCommandNames),
      workflows: uniqueStrings(sessionContext?.workflowNames),
      deferred_tools: compact({
        available: uniqueStrings(sessionContext?.availableDeferredToolNames),
        loaded: uniqueStrings(sessionContext?.loadedDeferredToolNames),
      }),
      mcp_resources: mcpResourceRefs(sessionContext),
      active_team: visibleTeamName(sessionContext),
    }),
    websearch: webSearchState(sessionContext, {
      includeStableModes: options.includeStableWebSearchModes,
    }),
    guards: compact({
      missing_teams: missingTeamNames(sessionContext),
      worktree_retry_blocked_cwds: blockedWorktreeCwds(sessionContext),
    }),
  });
}

export function buildSessionStartHostState(sessionContext = {}) {
  return compact({
    hello2cc_role: ['host-state', 'protocol-adapter', 'failure-debounce'],
    precedence: [
      'user_message',
      'claude_code_host',
      'CLAUDE.md',
      'AGENTS.md',
      'project_rules',
      'hello2cc',
    ],
    protocol_adapters: protocolAdapters(sessionContext),
    ...hostSnapshot(sessionContext, {
      includeStableWebSearchModes: true,
    }),
  });
}

export function buildPromptHostState(sessionContext = {}) {
  return compact({
    host: compact({
      surfaced_skills: uniqueStrings(sessionContext?.surfacedSkillNames),
      loaded_commands: uniqueStrings(sessionContext?.loadedCommandNames),
      workflows: uniqueStrings(sessionContext?.workflowNames),
      deferred_tools: compact({
        available: uniqueStrings(sessionContext?.availableDeferredToolNames),
        loaded: uniqueStrings(sessionContext?.loadedDeferredToolNames),
      }),
      mcp_resources: mcpResourceRefs(sessionContext),
      active_team: visibleTeamName(sessionContext),
    }),
    websearch: webSearchState(sessionContext, {
      includeStableModes: false,
    }),
    guards: compact({
      missing_teams: missingTeamNames(sessionContext),
      worktree_retry_blocked_cwds: blockedWorktreeCwds(sessionContext),
    }),
  });
}

export function renderHostStateBlock(title, snapshot) {
  const compacted = compact(snapshot);
  if (!compacted) {
    return '';
  }

  return [
    `# ${title}`,
    '',
    'Treat this as host state only. Semantic routing, workflow choice, and tool choice remain model-decided.',
    '',
    '```json',
    JSON.stringify(compacted, null, 2),
    '```',
  ].join('\n');
}
