function normalizeNames(values) {
  return Array.isArray(values)
    ? values.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function canonicalSet(values) {
  return new Set(normalizeNames(values).map((value) => value.toLowerCase()));
}

function hasAnyName(values, names) {
  const normalized = canonicalSet(values);
  return names.some((name) => normalized.has(String(name || '').trim().toLowerCase()));
}

const TOOL_CAPABILITY_RULES = [
  { key: 'agentToolAvailable', names: ['Agent', 'Task'] },
  { key: 'claudeCodeGuideAvailable', names: ['ClaudeCodeGuide', 'claude-code-guide', 'Claude Code Guide'] },
  { key: 'skillToolAvailable', names: ['Skill'] },
  { key: 'discoverSkillsAvailable', names: ['DiscoverSkills'] },
  { key: 'toolSearchAvailable', names: ['ToolSearch'] },
  { key: 'teamCreateAvailable', names: ['TeamCreate'] },
  { key: 'teamDeleteAvailable', names: ['TeamDelete'] },
  { key: 'sendMessageAvailable', names: ['SendMessage'] },
  { key: 'askUserQuestionAvailable', names: ['AskUserQuestion'] },
  { key: 'enterPlanModeAvailable', names: ['EnterPlanMode'] },
  { key: 'exitPlanModeAvailable', names: ['ExitPlanMode'] },
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
  { key: 'claudeCodeGuideAvailable', names: ['claude-code-guide', 'Claude Code Guide', 'ClaudeCodeGuide'] },
  { key: 'exploreAgentAvailable', names: ['Explore'] },
  { key: 'planAgentAvailable', names: ['Plan'] },
  { key: 'generalPurposeAgentAvailable', names: ['general-purpose', 'General-Purpose', 'General Purpose'] },
];

const AGENT_SURFACE_SPECS = [
  {
    key: 'Explore',
    label: 'Explore',
    names: ['Explore'],
    role: '只读搜索',
    toolSurface: ['Glob/Grep/Read', 'Bash(只读)'],
    disallowedTools: ['Agent', 'ExitPlanMode', 'Edit', 'Write', 'NotebookEdit'],
  },
  {
    key: 'Plan',
    label: 'Plan',
    names: ['Plan'],
    role: '只读规划',
    toolSurface: ['继承 Explore 的只读搜索面', 'Read'],
    disallowedTools: ['Agent', 'ExitPlanMode', 'Edit', 'Write', 'NotebookEdit'],
  },
  {
    key: 'general-purpose',
    label: 'General-Purpose',
    names: ['general-purpose', 'General-Purpose', 'General Purpose'],
    role: '通用执行',
    toolSurface: ['*'],
    disallowedTools: [],
  },
  {
    key: 'claude-code-guide',
    label: 'Claude Code Guide',
    names: ['claude-code-guide', 'Claude Code Guide'],
    role: 'Claude Code / API / SDK 指南',
    toolSurface: ['本地读搜', 'WebFetch', 'WebSearch'],
    disallowedTools: [],
  },
];

function canonicalAgentSurfaceKey(value) {
  const slug = normalizeSlug(value);

  if (slug === 'explore') return 'Explore';
  if (slug === 'plan') return 'Plan';
  if (['general-purpose', 'general-purpose-agent', 'generalpurpose'].includes(slug)) {
    return 'general-purpose';
  }
  if (['claude-code-guide', 'claude-code-guide-agent', 'claude-guide', 'claudecodeguide'].includes(slug)) {
    return 'claude-code-guide';
  }

  return String(value || '').trim();
}

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

export function agentSurfaceForType(agentType) {
  const key = canonicalAgentSurfaceKey(agentType);
  const spec = AGENT_SURFACE_SPECS.find((candidate) => candidate.key === key);
  if (!spec) return null;

  return {
    key: spec.key,
    label: spec.label,
    role: spec.role,
    toolSurface: [...spec.toolSurface],
    disallowedTools: [...spec.disallowedTools],
  };
}

export function observedAgentSurfaces(agentTypes) {
  const surfaces = normalizeAgentTypes(agentTypes)
    .map((agentType) => agentSurfaceForType(agentType))
    .filter(Boolean);

  return [...new Map(surfaces.map((surface) => [surface.key, surface])).values()];
}
