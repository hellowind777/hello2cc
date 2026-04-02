function normalizeNames(values) {
  return Array.isArray(values)
    ? values.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
}

function canonicalSet(values) {
  return new Set(normalizeNames(values).map((value) => value.toLowerCase()));
}

function hasAnyName(values, names) {
  const normalized = canonicalSet(values);
  return names.some((name) => normalized.has(String(name || '').trim().toLowerCase()));
}

const TOOL_CAPABILITY_RULES = [
  { key: 'agentToolAvailable', names: ['Agent'] },
  { key: 'skillToolAvailable', names: ['Skill'] },
  { key: 'discoverSkillsAvailable', names: ['DiscoverSkills'] },
  { key: 'toolSearchAvailable', names: ['ToolSearch'] },
  { key: 'teamCreateAvailable', names: ['TeamCreate'] },
  { key: 'teamDeleteAvailable', names: ['TeamDelete'] },
  { key: 'sendMessageAvailable', names: ['SendMessage'] },
  { key: 'askUserQuestionAvailable', names: ['AskUserQuestion'] },
  { key: 'enterPlanModeAvailable', names: ['EnterPlanMode'] },
  { key: 'enterWorktreeAvailable', names: ['EnterWorktree'] },
  { key: 'taskCreateAvailable', names: ['TaskCreate'] },
  { key: 'taskGetAvailable', names: ['TaskGet'] },
  { key: 'taskListAvailable', names: ['TaskList'] },
  { key: 'taskUpdateAvailable', names: ['TaskUpdate'] },
  { key: 'taskOutputAvailable', names: ['TaskOutput'] },
  { key: 'taskStopAvailable', names: ['TaskStop'] },
  { key: 'todoWriteAvailable', names: ['TodoWrite'] },
  { key: 'listMcpResourcesAvailable', names: ['ListMcpResources'] },
  { key: 'readMcpResourceAvailable', names: ['ReadMcpResource'] },
  { key: 'webFetchAvailable', names: ['WebFetch'] },
  { key: 'webSearchAvailable', names: ['WebSearch'] },
  { key: 'notebookEditAvailable', names: ['NotebookEdit'] },
  { key: 'lspAvailable', names: ['LSP'] },
  { key: 'powerShellAvailable', names: ['PowerShell'] },
  { key: 'briefAvailable', names: ['SendUserMessage', 'Brief'] },
];

const AGENT_CAPABILITY_RULES = [
  { key: 'claudeCodeGuideAvailable', names: ['claude-code-guide', 'Claude Code Guide'] },
  { key: 'exploreAgentAvailable', names: ['Explore'] },
  { key: 'planAgentAvailable', names: ['Plan'] },
  { key: 'generalPurposeAgentAvailable', names: ['general-purpose', 'General-Purpose', 'General Purpose'] },
];

export function normalizeToolNames(values) {
  return normalizeNames(values);
}

export function normalizeAgentTypes(values) {
  return normalizeNames(values);
}

export function deriveToolCapabilities(toolNames) {
  const normalized = normalizeToolNames(toolNames);
  const capabilities = Object.fromEntries(
    TOOL_CAPABILITY_RULES.map(({ key, names }) => [key, hasAnyName(normalized, names)]),
  );

  return {
    ...capabilities,
    taskToolAvailable: capabilities.taskCreateAvailable || hasAnyName(normalized, ['Task']),
  };
}

export function deriveAgentCapabilities(agentTypes) {
  const normalized = normalizeAgentTypes(agentTypes);
  return Object.fromEntries(
    AGENT_CAPABILITY_RULES.map(({ key, names }) => [key, hasAnyName(normalized, names)]),
  );
}
