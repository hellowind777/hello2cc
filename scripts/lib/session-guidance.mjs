import { FORCED_OUTPUT_STYLE_NAME, configuredModels } from './config.mjs';
import { resolveWebSearchGuidanceMode } from './api-topology.mjs';

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
      '- Claude Code 还没有在 hook 负载里显式列出本会话能力；保持原生工作方式即可，不要凭空发明不存在的工具或 agent。',
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
  lines.push('- hello2cc 负责强化宿主已暴露的能力表面：原生工具、原生 agent、skills / workflows、MCP / connected tools 与计划任务习惯；它不替换现有 `CLAUDE.md`、项目规则或用户指定输出格式。');

  if (config.sessionModel) {
    lines.push(`- 当前会话模型别名：\`${config.sessionModel}\`。`);
  }

  if (config.routingPolicy === 'prompt-only') {
    lines.push('- 当前仅做原生能力引导，不改写原生工具输入。');
  } else {
    lines.push('- 当原生 `Agent` 调用没有显式 `model` 时，优先保持与当前会话模型一致。');
  }

  lines.push('- 如果原生工具调用里已经显式传入 `model`，始终以显式值为准。');
  return lines;
}

function buildWorkingHabitLines() {
  return [
    '## 原生工作习惯',
    '- 保持 Claude / Opus 风格的原生工作方式：先读相关代码，再改动；优先改已有文件而不是新建文件。',
    '- 可见文本默认跟随用户当前语言；除非用户明确要求，否则不要无故切换语言。',
    '- 不要把内部思考过程直接说出来；工具前说明保持一句简短行动描述，避免“我打算 / 我应该 / let’s”式元叙述。',
    '- 把宿主已暴露的 skills / workflows / plugin tools / MCP tools 视为一等能力；不要因为 hello2cc 存在就绕开它们。',
    '- 有专用读写 / 搜索工具时优先用专用工具，再考虑 shell。',
    '- 非 trivial 任务优先 `EnterPlanMode()`；只有真的需要任务盘时再维护原生 `Task*`。',
    '- 不确定可用工具、agent、MCP、权限边界时，优先 `ToolSearch`。',
    '- Claude Code / hooks / MCP / settings / Agent SDK / Claude API 问题优先 `Claude Code Guide`。',
    '- 代码库研究与范围探索优先原生搜索，再按需要转 `Explore` 或 `Plan`。',
    '- 边界清晰的实现、修复、验证切片优先 `General-Purpose`。',
    '- 多线任务默认优先并行多个原生 `Agent` worker；续派优先 `SendMessage`；跑偏时再 `TaskStop`。',
    '- 普通 `Agent` worker 默认不要传 `name` / `team_name`；避免宿主把普通 subagent 误路由成 teammate。',
    '- 只有用户明确要求团队编排或持久团队身份时，才使用 `TeamCreate`；完成后及时 `TeamDelete`。',
    '- 真正需要 agent team 时，先 `TeamCreate` 拿到真实团队，再给 `Agent` 显式传入 `name` + `team_name`；不要依赖 `main` / `default` 这类隐式 team 上下文。',
    '- 普通 worker 的结果默认看完成通知 / 回传消息，不要把 `TaskOutput` 当成普通 worker 的默认结果获取方式。',
    '- 外部系统与集成优先原生 MCP / connected tools，优先 `ListMcpResources` / `ReadMcpResource`。',
    '- 如果只被一个真实用户选择阻塞，优先 `AskUserQuestion`。',
    '- 只有用户明确要求隔离工作树时才使用 `EnterWorktree`。',
    '- 宣称完成前先跑与改动最贴近的验证；验证结果要诚实。',
  ];
}

function buildSkillWorkflowLines(sessionContext = {}) {
  const skillToolAvailable = Boolean(sessionContext?.skillToolAvailable);
  const discoverSkillsAvailable = Boolean(sessionContext?.discoverSkillsAvailable);

  if (!skillToolAvailable && !discoverSkillsAvailable) {
    return [];
  }

  const lines = ['## Skills / 插件工作流'];

  if (skillToolAvailable) {
    lines.push('- 当前会话已暴露 `Skill`；如果本轮已经出现 `Skills relevant to your task`、用户明确提到某个 slash command / skill / workflow，或你已经知道有匹配 skill，优先调用它，而不是自己重写流程。');
    lines.push('- 不要猜 skill 名称；只使用当前会话已暴露、已提示或已发现的 skill。');
  }

  if (discoverSkillsAvailable) {
    lines.push('- 当前会话已暴露 `DiscoverSkills`；遇到中途转向、专门 workflow、插件化能力，或你怀疑已有现成 skill 但当前列表不够时，先发现再调用。');
  }

  if (skillToolAvailable && discoverSkillsAvailable) {
    lines.push('- `DiscoverSkills` 用于 skill / workflow 发现；`ToolSearch` 用于工具 / MCP / 权限边界发现。');
  }

  return lines;
}

function buildToolSearchLines() {
  return [
    '## ToolSearch 状态',
    '- 原生 `ToolSearch` 是默认优先路径：先用它确认可用工具、原生 agent 类型、MCP 能力、权限与边界。',
    '- hello2cc 不会主动把第三方模型从这条原生路径拉走。',
  ];
}

function buildWebSearchLines(sessionContext = {}) {
  const mode = resolveWebSearchGuidanceMode(sessionContext);

  if (mode === 'available') {
    return [
      '## 实时信息与 WebSearch',
      '- 当前会话已暴露原生 `WebSearch`；遇到最新/今天/新闻/价格/天气/发布动态等问题时，优先先拿到实时来源，再组织回答。',
      '- 如果 `WebSearch` 没有给出真实来源或搜索条目，就不要把记忆包装成联网结果。',
      '- `WebSearch` 只负责实时来源；代码执行、文件读写、MCP 与 agent 协作仍优先走各自原生工具。',
    ];
  }

  if (mode === 'proxy-conditional') {
    return [
      '## 实时信息与 WebSearch',
      '- 当前会话已暴露原生 `WebSearch`，但链路看起来是自定义 `ANTHROPIC_BASE_URL` 代理；有些代理会转发真实搜索，有些不会。',
      '- 仍然优先尝试原生 `WebSearch`；hello2cc 不会因为使用自定义代理就直接阻断这条路径。',
      '- 只有当 `WebSearch` 真正返回搜索条目或来源链接时，才把它当成联网成功；如果界面出现 `Did 0 searches`、无来源或无搜索结果，必须明确说明未完成真实搜索。',
      '- `WebSearch` 只负责实时来源；代码执行、文件读写、MCP 与 agent 协作仍优先走各自原生工具。',
    ];
  }

  if (mode === 'not-exposed') {
    return [
      '## 实时信息与 WebSearch',
      '- 当前会话未显式暴露原生 `WebSearch`；不要声称自己已经联网搜索了最新信息。',
      '- 如果用户要求最新/实时信息，优先查找宿主真实暴露的联网工具；没有就明确说明边界。',
    ];
  }

  if (mode === 'proxy-unknown') {
    return [
      '## 实时信息与 WebSearch',
      '- 当前链路看起来是自定义 `ANTHROPIC_BASE_URL` 代理；若宿主暴露原生 `WebSearch`，优先用它获取实时来源。',
      '- hello2cc 不会因为你使用代理就自动禁用 `WebSearch`；它只要求在没有真实搜索结果时诚实表达边界。',
      '- 只有拿到真实搜索条目或来源链接时，才按联网结果回答；否则必须明确说明边界，不要把记忆当成实时搜索。',
    ];
  }

  return [
    '## 实时信息与 WebSearch',
    '- 遇到最新/实时信息任务时，若宿主暴露原生 `WebSearch`，优先用它获取来源；不要只凭记忆回答这类问题。',
    '- 如果没有真实搜索条目或来源，就明确说明当前边界，不要假装已经联网。',
  ];
}

export function buildSessionStartContext(sessionContext = {}) {
  return [
    '# hello2cc',
    '',
    'hello2cc 会让第三方模型在 Claude Code 里尽量按宿主真实暴露的方式工作：优先使用已暴露的工具、agent、skills / workflows、MCP 与计划协作能力，而不是绕过它们另写一套。',
    '',
    '## 优先级',
    '- 用户当前消息、Claude Code 宿主规则、`CLAUDE.md` / `AGENTS.md` / 项目规则，始终高于 hello2cc。',
    '- hello2cc 不得覆盖现有工作流、输出格式、命令路由、顶部/底部信息栏或项目约定。',
    '',
    ...buildSessionModelLines(sessionContext),
    '',
    ...buildWorkingHabitLines(),
    '',
    ...buildSkillWorkflowLines(sessionContext),
    '',
    ...buildObservedSurfaceLines(sessionContext),
    '',
    ...buildToolSearchLines(),
    '',
    ...buildWebSearchLines(sessionContext),
    '',
    '## 输出风格',
    `- 当前插件输出风格：\`${FORCED_OUTPUT_STYLE_NAME}\`。`,
    '- 如果更高优先级规则没有指定格式，保持 Claude Code 原生、简洁、结果导向的表达。',
    '- 如果需要表格，优先 Markdown 表格；只有 Markdown 明显不适合时再使用 ASCII。',
  ].join('\n');
}
