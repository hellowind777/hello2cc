import { FORCED_OUTPUT_STYLE_NAME, configuredModels } from './config.mjs';
import { classifyPrompt } from './prompt-signals.mjs';

function flattenPromptValue(value, seen = new WeakSet()) {
  if (typeof value === 'string') return value;
  if (!value) return '';
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '';

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => flattenPromptValue(item, seen)).filter(Boolean).join(' ');
  }

  const preferredKeys = ['text', 'prompt', 'message', 'content', 'input'];
  const parts = [];

  for (const key of preferredKeys) {
    if (key in value) {
      parts.push(flattenPromptValue(value[key], seen));
    }
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (preferredKeys.includes(key)) continue;
    parts.push(flattenPromptValue(nestedValue, seen));
  }

  return parts.filter(Boolean).join(' ');
}

export function extractPromptText(payload) {
  const candidates = [
    payload?.prompt,
    payload?.userPrompt,
    payload?.message,
    payload?.input,
    payload?.text,
  ];

  return candidates
    .map((candidate) => flattenPromptValue(candidate))
    .find((text) => String(text || '').trim()) || '';
}

function envValue(name) {
  return String(process.env[name] || '').trim();
}

function isAnthropicHost(url) {
  const value = String(url || '').trim().toLowerCase();
  if (!value) return true;

  return value.includes('api.anthropic.com') || value.includes('api.claude.ai');
}

function toolSearchStatus(sessionContext = {}) {
  if (typeof sessionContext?.toolSearchAvailable === 'boolean') {
    return {
      available: sessionContext.toolSearchAvailable,
      observed: true,
      source: 'session',
    };
  }

  const enableToolSearch = envValue('ENABLE_TOOL_SEARCH');
  const baseUrl = envValue('ANTHROPIC_BASE_URL');
  const proxyLikely = Boolean(baseUrl) && !isAnthropicHost(baseUrl);

  if (proxyLikely && !enableToolSearch) {
    return {
      available: false,
      observed: false,
      source: 'env',
    };
  }

  return {
    available: true,
    observed: false,
    source: proxyLikely ? 'env-optimistic' : 'unknown',
  };
}

function capabilityState(sessionContext, key) {
  return typeof sessionContext?.[key] === 'boolean' ? sessionContext[key] : null;
}

function optimisticCapability(sessionContext, key, fallback = true) {
  const value = capabilityState(sessionContext, key);
  return value === null ? fallback : value;
}

function formatNames(values) {
  return values.map((value) => `\`${value}\``).join(', ');
}

function detectedTools(sessionContext = {}) {
  return Array.isArray(sessionContext?.toolNames) ? sessionContext.toolNames.filter(Boolean) : [];
}

function detectedAgents(sessionContext = {}) {
  return Array.isArray(sessionContext?.agentTypes) ? sessionContext.agentTypes.filter(Boolean) : [];
}

function buildObservedSurfaceLines(sessionContext = {}) {
  const tools = detectedTools(sessionContext);
  const agents = detectedAgents(sessionContext);

  if (tools.length === 0 && agents.length === 0) {
    return [
      '## 当前会话能力',
      '- Claude Code 还没有在 hook 负载里显式暴露本会话的能力清单；正常工作即可，看到原生工具或原生 agent 时优先使用，不要凭空假设。',
    ];
  }

  const lines = ['## 当前会话能力'];
  if (tools.length) {
    lines.push(`- 已观测到的原生工具：${formatNames(tools)}。`);
  }
  if (agents.length) {
    lines.push(`- 已观测到的内建 agent：${formatNames(agents)}。`);
  }
  return lines;
}

function buildSessionModelLines(sessionContext = {}) {
  const config = configuredModels(sessionContext);
  const lines = ['## 会话使用方式'];

  lines.push('- 像平常一样直接使用 Claude Code；不需要额外手动加载，也不需要切换到另一套工作流。');
  lines.push('- hello2cc 只补充原生工具/agent/task/team 的使用方式，不替换现有 `CLAUDE.md`、项目规则或用户指定输出格式。');

  if (config.sessionModel) {
    lines.push(`- 当前会话模型别名：\`${config.sessionModel}\`。`);
  }

  if (config.routingPolicy === 'prompt-only') {
    lines.push('- 当前仅做原生能力引导，不会改写原生工具输入。');
  } else {
    lines.push('- 当 `Claude Code Guide` 或 `Explore` 没有显式 `model` 且宿主可能走偏时，优先保持与当前会话模型一致。');
  }

  lines.push('- 如果原生工具调用里已经显式传入 `model`，始终以显式值为准。');
  return lines;
}

function buildWorkingHabitLines(sessionContext = {}) {
  const lines = [
    '## 原生工作习惯',
    '- Trivial、低风险修改直接做；改代码前先读相关文件，优先改已有文件而不是新建文件。',
    '- 有专用读写/搜索工具时优先用专用工具，再考虑 shell。',
    '- 多个独立操作可以并行时就并行。',
    '- 验证要诚实：没跑就明确说没跑，失败就直接说失败。',
  ];

  if (optimisticCapability(sessionContext, 'claudeCodeGuideAvailable', true)) {
    lines.push('- 遇到 Claude Code / hooks / MCP / settings / permissions / Agent SDK 类问题，优先用 `Claude Code Guide`。');
  } else {
    lines.push('- 当前会话未暴露 `Claude Code Guide` 时，直接查官方文档、本地配置和项目内说明。');
  }

  if (optimisticCapability(sessionContext, 'askUserQuestionAvailable', false)) {
    lines.push('- 如果进度只被一个真实用户选择阻塞，优先用 `AskUserQuestion`，不要把确认点埋在长段落里。');
  } else {
    lines.push('- 如果进度只被一个真实用户选择阻塞，就提一个简短明确的问题，不要一次堆多个确认点。');
  }

  if (optimisticCapability(sessionContext, 'enterPlanModeAvailable', true)) {
    if (optimisticCapability(sessionContext, 'taskToolAvailable', false)) {
      lines.push('- 非 trivial 任务优先 `EnterPlanMode()`；只有明确需要任务盘时再维护原生 `Task*`。');
    } else if (optimisticCapability(sessionContext, 'todoWriteAvailable', false)) {
      lines.push('- 非 trivial 任务优先 `EnterPlanMode()`；如果当前没有原生 `Task*`，就用 `TodoWrite` 维护清单。');
    } else {
      lines.push('- 非 trivial 任务优先 `EnterPlanMode()`；不要只靠口头描述计划。');
    }
  } else if (optimisticCapability(sessionContext, 'taskToolAvailable', false)) {
    lines.push('- 当前会话可用原生 `Task*`；只有明确需要任务盘时再维护任务状态，不要默认把所有复杂任务都写成任务盘。');
  } else if (optimisticCapability(sessionContext, 'todoWriteAvailable', false)) {
    lines.push('- 当前会话没有原生 `Task*` 时，用 `TodoWrite` 维护清单，而不是把计划散落在正文里。');
  }

  if (optimisticCapability(sessionContext, 'sendMessageAvailable', false)) {
    lines.push('- 已启动的原生 worker / teammate 需要补充指令时，优先用 `SendMessage`，不要重复整段背景。');
  }

  if (optimisticCapability(sessionContext, 'teamDeleteAvailable', false)) {
    lines.push('- 只有真的创建了持久团队时，完成后再 `TeamDelete`，避免留下无用团队状态。');
  }

  if (optimisticCapability(sessionContext, 'taskOutputAvailable', false)) {
    lines.push('- 普通 `Agent` worker 的结果默认等完成通知或回传消息；不要把 `TaskOutput` 当成默认的子代理结果轮询工具。');
  }

  if (
    optimisticCapability(sessionContext, 'listMcpResourcesAvailable', false) ||
    optimisticCapability(sessionContext, 'readMcpResourceAvailable', false)
  ) {
    lines.push('- 遇到 MCP / connected tools 数据源时，优先 `ListMcpResources` / `ReadMcpResource` 再决定后续动作。');
  } else {
    lines.push('- 遇到外部系统、集成平台或数据源时，优先原生 MCP / connected tools，再考虑网页搜索。');
  }

  if (optimisticCapability(sessionContext, 'enterWorktreeAvailable', false)) {
    lines.push('- 只有用户明确要求隔离工作树、分支式隔离或并行工作区时，才使用 `EnterWorktree`。');
  }

  if (optimisticCapability(sessionContext, 'lspAvailable', false)) {
    lines.push('- 有 `LSP` 时优先做符号级导航、诊断和定位。');
  }

  if (optimisticCapability(sessionContext, 'notebookEditAvailable', false)) {
    lines.push('- 遇到 notebook 任务时优先用 `NotebookEdit`。');
  }

  if (optimisticCapability(sessionContext, 'briefAvailable', false)) {
    lines.push('- 需要给用户短通知或阶段性状态时，优先简短、清晰、面向结果。');
  }

  if (optimisticCapability(sessionContext, 'powerShellAvailable', false)) {
    lines.push('- 需要真实终端操作时再用 `PowerShell`，不要拿它代替已有专用工具。');
  }

  return lines;
}

function buildToolSearchLines(sessionContext = {}) {
  const status = toolSearchStatus(sessionContext);

  if (status.available) {
    return [
      '## ToolSearch 状态',
      '- 当会话暴露原生 `ToolSearch` 时，优先用它确认可用工具、agent、插件能力、权限和 MCP 边界。',
      ...(status.observed ? ['- 当前会话已确认暴露 `ToolSearch`。'] : []),
    ];
  }

  return [
    '## ToolSearch 状态',
    '- 当前会话没有暴露原生 `ToolSearch`；hello2cc 不能在插件层强行开启它。',
    '- 如果你正在通过第三方网关使用 Claude Code，请确认 `ENABLE_TOOL_SEARCH=true`，并确保网关透传 beta headers 与 `tool_reference` blocks。',
  ];
}

function routeAvailability(sessionContext = {}) {
  return {
    agent: optimisticCapability(sessionContext, 'agentToolAvailable', true),
    askUserQuestion: optimisticCapability(sessionContext, 'askUserQuestionAvailable', false),
    brief: optimisticCapability(sessionContext, 'briefAvailable', false),
    claudeCodeGuide: optimisticCapability(sessionContext, 'claudeCodeGuideAvailable', true),
    enterPlanMode: optimisticCapability(sessionContext, 'enterPlanModeAvailable', true),
    enterWorktree: optimisticCapability(sessionContext, 'enterWorktreeAvailable', false),
    explore: optimisticCapability(sessionContext, 'exploreAgentAvailable', true),
    general: optimisticCapability(sessionContext, 'generalPurposeAgentAvailable', true),
    listMcpResources: optimisticCapability(sessionContext, 'listMcpResourcesAvailable', false),
    plan: optimisticCapability(sessionContext, 'planAgentAvailable', true),
    readMcpResource: optimisticCapability(sessionContext, 'readMcpResourceAvailable', false),
    sendMessage: optimisticCapability(sessionContext, 'sendMessageAvailable', false),
    taskCreate: optimisticCapability(sessionContext, 'taskCreateAvailable', false),
    taskGet: optimisticCapability(sessionContext, 'taskGetAvailable', false),
    taskList: optimisticCapability(sessionContext, 'taskListAvailable', false),
    taskOutput: optimisticCapability(sessionContext, 'taskOutputAvailable', false),
    taskTool: optimisticCapability(sessionContext, 'taskToolAvailable', false),
    taskUpdate: optimisticCapability(sessionContext, 'taskUpdateAvailable', false),
    taskStop: optimisticCapability(sessionContext, 'taskStopAvailable', false),
    teamCreate: optimisticCapability(sessionContext, 'teamCreateAvailable', false),
    teamDelete: optimisticCapability(sessionContext, 'teamDeleteAvailable', false),
    todoWrite: optimisticCapability(sessionContext, 'todoWriteAvailable', false),
  };
}

function buildTaskPlanningStep(availability) {
  if (availability.enterPlanMode) {
    if (availability.taskTool) {
      return '这是非 trivial 实现：先 `EnterPlanMode()`；只有真的需要任务盘时再用 `TaskCreate` / `TaskList` / `TaskUpdate`。';
    }

    if (availability.todoWrite) {
      return '这是非 trivial 实现：先 `EnterPlanMode()`；如果当前没有原生 `Task*`，至少用 `TodoWrite` 维护清单。';
    }

    return '这是非 trivial 实现：先 `EnterPlanMode()`，再按计划逐步执行。';
  }

  if (availability.taskTool) {
    return '这是非 trivial 实现：先写出简短有序计划；只有真的需要任务盘时再用 `TaskCreate` / `TaskList` / `TaskUpdate`。';
  }

  if (availability.todoWrite) {
    return '这是非 trivial 实现：当前会话没有原生 `Task*`，改用 `TodoWrite` 维护清单，不要只在正文里口头列步骤。';
  }

  return '这是非 trivial 实现：先写出简短有序清单，再开始编辑。';
}

function buildTaskTrackingStep(availability) {
  if (availability.taskTool) {
    const base = '该任务适合显式拆解：维护 `TaskCreate` / `TaskList` / `TaskUpdate`，不要只在正文里口头列步骤。';
    if (availability.taskGet && availability.taskUpdate) {
      return `${base} 更新前先 \`TaskGet\` 看当前任务状态。`;
    }
    return base;
  }

  if (availability.todoWrite) {
    return '该任务适合显式拆解：当前没有原生 `Task*` 时，用 `TodoWrite` 维护清单。';
  }

  return '该任务适合显式拆解：请保持简短、编号化的执行清单。';
}

function recommendedTrackLabels(signals) {
  if (signals.tracks?.length) return signals.tracks;
  if (signals.research && signals.verify) return ['research', 'verification'];
  if (signals.research && signals.implement) return ['research', 'implementation'];
  if (signals.implement && signals.verify) return ['implementation', 'verification'];
  return [];
}

function buildSwarmStep(signals, availability) {
  const tracks = recommendedTrackLabels(signals);
  const trackList = tracks.length > 0
    ? tracks.map((track) => `\`${track}\``).join(' / ')
    : '`track-1` / `track-2`';

  if (!availability.agent) {
    return '';
  }

  if (signals.teamWorkflow && availability.teamCreate) {
    const lines = [
      `用户显式要求团队编排：可以用 \`TeamCreate\` 建立持久团队来推进 ${trackList}。`,
    ];

    if (availability.sendMessage) {
      lines.push('团队成员已启动后，补充指令、修正范围或续派时用 `SendMessage`。');
    }

    if (availability.teamDelete) {
      lines.push('团队完成后用 `TeamDelete` 清理。');
    }

    return lines.join(' ');
  }

  const lines = [
    `这是多线任务：优先在同一条回复里并行发起多个原生 \`Agent\` worker，分别覆盖 ${trackList}。`,
    '启动后简短告诉用户已启动哪些 worker，然后等待完成通知 / 回传消息，不要立刻轮询普通 agent 结果。',
  ];

  if (availability.sendMessage) {
    lines.push('需要补充指令或续派时用 `SendMessage`。');
  }

  if (availability.taskStop) {
    lines.push('如果某个 worker 明显走错方向，再用 `TaskStop` 中止。');
  }

  if (availability.taskOutput) {
    lines.push('不要把 `TaskOutput` 当成普通 worker 的默认结果获取方式；它更适合明确的后台任务日志读取。');
  }

  if (signals.teamWorkflow && !availability.teamCreate) {
    lines.push('当前会话没有暴露 `TeamCreate`，所以退回并行原生 `Agent`。');
  }

  return lines.join(' ');
}

function buildResearchStep(signals, availability) {
  if (signals.claudeGuide) {
    if (availability.agent && availability.claudeCodeGuide) {
      return '这是 Claude Code / Claude API / Agent SDK / hooks / settings / MCP 能力问题：优先调用原生 `Agent` 的 `Claude Code Guide`。';
    }

    return '这是 Claude Code / 配置 / 能力问题：当前会话没有暴露 `Claude Code Guide` 时，直接查官方文档、本地配置和项目内说明。';
  }

  if (signals.codeResearch) {
    if (availability.agent && (availability.explore || availability.plan)) {
      return '这是代码库研究 / 定位任务：先用原生读写 / 搜索工具缩小范围，再在需要更大搜索面时转原生 `Explore` 或 `Plan`。';
    }

    return '这是代码库研究 / 定位任务：优先用原生读写 / 搜索工具缩小范围。';
  }

  if (!signals.research) {
    return '';
  }

  if (availability.agent && (availability.explore || availability.plan)) {
    return '这是研究 / 对比 / 文档任务：先做定向搜索与证据收集，再在需要扩大搜索面时转原生 `Explore` 或 `Plan`。';
  }

  return '这是研究 / 对比 / 文档任务：先做定向搜索与证据收集。';
}

export function buildSessionStartContext(sessionContext = {}) {
  return [
    '# hello2cc',
    '',
    'hello2cc 会让你在 Claude Code 里尽量按原生方式工作：优先原生工具、原生 agent、原生 task/team 流程。',
    '',
    '## 优先级',
    '- 用户当前消息、Claude Code 宿主规则、`CLAUDE.md` / `AGENTS.md` / 项目规则，始终高于 hello2cc。',
    '- hello2cc 不得覆盖现有工作流、输出格式、命令路由、顶部/底部信息栏或项目约定。',
    '',
    ...buildSessionModelLines(sessionContext),
    '',
    ...buildWorkingHabitLines(sessionContext),
    '',
    ...buildObservedSurfaceLines(sessionContext),
    '',
    ...buildToolSearchLines(sessionContext),
    '',
    '## 输出风格',
    `- 当前插件输出风格：\`${FORCED_OUTPUT_STYLE_NAME}\`。`,
    '- 如果更高优先级规则没有指定格式，保持 Claude Code 原生、简洁、结果导向的表达。',
    '- 如果需要表格，优先 Markdown 表格；只有 Markdown 明显不适合时再使用 ASCII。',
  ].join('\n');
}

export function buildRouteSteps(prompt, sessionContext = {}) {
  const signals = classifyPrompt(prompt);
  const availability = routeAvailability(sessionContext);
  const config = configuredModels(sessionContext);
  const toolSearch = toolSearchStatus(sessionContext);
  const steps = [];

  if (signals.toolSearchFirst && toolSearch.available) {
    steps.push('先 `ToolSearch` 确认可用工具、原生 agent 类型、插件能力、权限与 MCP 边界，不要凭记忆猜。');
  } else if (signals.toolSearchFirst && !toolSearch.available) {
    steps.push('当前会话没有暴露原生 `ToolSearch`：hello2cc 不能在插件层强行开启它。若你正通过第三方网关使用 Claude Code，请确认 `ENABLE_TOOL_SEARCH=true`，并确保网关透传 beta headers 与 `tool_reference` blocks。');
  }

  if (signals.mcp) {
    if (availability.listMcpResources || availability.readMcpResource) {
      steps.push('如果任务涉及外部系统、数据源或集成平台，优先 `ListMcpResources` 盘点资源，再按需 `ReadMcpResource` 或调用对应 MCP / connected tools；只有本地能力不存在时再退回网页搜索。');
    } else {
      steps.push('如果任务涉及外部系统、数据源或集成平台，优先查找并调用原生 MCP / connected tools；只有在本地能力不存在时再退回网页搜索。');
    }
  }

  const researchStep = buildResearchStep(signals, availability);
  if (researchStep) {
    steps.push(researchStep);
  }

  if (signals.boundedImplementation && availability.agent && availability.general) {
    steps.push('这是边界清晰的实现 / 修复 / 验证子任务：优先使用原生 `Agent` 的 `General-Purpose` 承接单一切片，而不是把探索、规划和实现都混在主线程。');
  }

  if (signals.complex) {
    steps.push(buildTaskPlanningStep(availability));
  }

  if (signals.plan) {
    if (availability.taskTool || availability.todoWrite || availability.enterPlanMode) {
      steps.push('任务存在跨文件、架构取舍或多个阶段：优先计划模式；如果不进入计划模式，也要维护可追踪任务清单。');
    } else {
      steps.push('任务存在跨文件、架构取舍或多个阶段：先写出有序计划，再逐步执行。');
    }
  }

  if (signals.taskList) {
    steps.push(buildTaskTrackingStep(availability));
  }

  if (signals.decisionHeavy) {
    if (availability.askUserQuestion) {
      steps.push('如果执行过程中出现单一真实阻塞选择，优先用 `AskUserQuestion` 发起结构化选择，不要把确认埋在长段落里。');
    } else {
      steps.push('如果执行过程中出现单一真实阻塞选择，就提一个简短明确的问题，不要堆多个确认点。');
    }
  }

  if (signals.swarm) {
    const swarmStep = buildSwarmStep(signals, availability);
    if (swarmStep) {
      steps.push(swarmStep);
    }
  }

  if (signals.wantsWorktree) {
    if (availability.enterWorktree) {
      steps.push('用户明确要求隔离工作树：只有确实需要隔离工作区、分支式实验或并行修改时才进入 `EnterWorktree`。');
    } else {
      steps.push('用户提到了隔离工作树，但当前会话没有暴露 `EnterWorktree`；说明限制后在当前工作区继续，除非宿主后来显式提供该能力。');
    }
  }

  if (signals.diagram) {
    steps.push('需要结构化表达：优先标准 Markdown 表格或图示；只有 Markdown 明显不适合时再使用 ASCII。');
  }

  if (signals.verify) {
    steps.push('收尾前先做最贴近改动范围的验证，再视结果扩大范围；未验证不要声称已完成。');
  }

  if (config.routingPolicy !== 'prompt-only') {
    steps.push('如果原生 `Agent` 调用命中了 `Claude Code Guide` / `Explore` 等路径且没有显式 `model`，优先与当前会话模型保持一致；显式传入的 `model` 永远优先。');
  }

  if (steps.length === 0) return '';

  return [
    '# hello2cc native-first routing',
    '',
    '按下面顺序优先决策：',
    '',
    ...steps.map((step, index) => `${index + 1}. ${step}`),
  ].join('\n');
}
