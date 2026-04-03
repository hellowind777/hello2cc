import { configuredModels } from './config.mjs';
import { resolveWebSearchGuidanceState } from './api-topology.mjs';

/**
 * Builds the opening session model usage guidance shown at session start.
 */
export function buildSessionModelLines(sessionContext = {}) {
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

export function buildWorkingHabitLines() {
  return [
    '## 原生工作习惯',
    '- 保持 Claude / Opus 风格的原生工作方式：先读相关代码，再改动；优先改已有文件而不是新建文件。',
    '- 可见文本默认跟随用户当前语言；除非用户明确要求，否则不要无故切换语言。',
    '- 不要把内部思考过程直接说出来；工具前说明保持一句简短行动描述，避免“我打算 / 我应该 / let’s”式元叙述。',
    '- 把宿主已暴露的 skills / workflows / plugin tools / MCP tools 视为一等能力；不要因为 hello2cc 存在就绕开它们。',
    '- 有专用读写 / 搜索工具时优先用专用工具，再考虑 shell。',
    '- 优先走最具体的能力表面：已加载的 workflow / slash command / skill 连续体 → 已 surfaced 的 skill → `DiscoverSkills` → 已知 MCP resource → 已加载 / 已 surfaced 的 deferred tool → `ToolSearch` → 更宽的 agent 路径。',
    '- 只有当实现路径 genuinely unclear、存在明显架构取舍，或需要先探索再定方案时，才 `EnterPlanMode()`；多文件但路径清晰时直接推进，具体分歧再 `AskUserQuestion`。',
    '- 不确定可用工具、agent、MCP、权限边界时，优先 `ToolSearch`。',
    '- Claude Code / hooks / MCP / settings / Agent SDK / Claude API 问题优先 `Claude Code Guide`（本地读搜 + `WebFetch` + `WebSearch`）。',
    '- 代码库研究与范围探索优先原生搜索，再按需要转 `Explore`（只读搜索）或 `Plan`（只读规划）。',
    '- 边界清晰的实现、修复、验证切片优先 `General-Purpose`（全工具面）。',
    '- 只有当多条线 genuinely independent 且并行能明显缩短关键路径时，才并行多个原生 `Agent` worker；续派优先 `SendMessage`；跑偏时再 `TaskStop`。',
    '- 普通 `Agent` worker 默认不要传 `name` / `team_name`；避免宿主把普通 subagent 误路由成 teammate。',
    '- 只有当任务需要持久 task board / owner / handoff，或用户明确要求 team / teammate / `TeamCreate` 时，才进入 team 模式；前后端并行、研究 + 实现本身不自动等于 team。',
    '- 进入 team 模式后，先 `TeamCreate`，然后 `TaskList` / `TaskCreate` 建立真实 task board，再启动实现 teammate；不要一建团队就只靠正文口头分工。',
    '- 选择 teammate 时遵守原生 agent 工具面：`Explore` / `Plan` 只读，只做搜索或规划；需要改文件、联调、验证的切片交给 `General-Purpose`。',
    '- 真正需要 agent team 时，后续 `Agent` 要显式传入 `name` + `team_name`；团队内任务流转优先 `TaskCreate` / `TaskList` / `TaskUpdate` / `TaskGet`，分派和接力时显式维护 `owner`，补充协作或续派时再 `SendMessage`；完成后及时 `TeamDelete`。不要依赖 `main` / `default` 这类隐式 team 上下文。',
    '- teammate 每回合结束后变成 idle 是正常行为，不等于失败；如果某个 teammate 出现 `0 tool uses`、没有实质推进或 task 失配，优先用 `TaskGet` / `TaskList` + `SendMessage` 在团队内重对齐，而不是立刻判定 team 路径失效。',
    '- 如果同一个前提错误已经出现过一次（例如当前 cwd 不是 git 仓库却尝试 worktree，或某个 team 已确认不存在），在前提变化前不要沿着同一路径原样重试；前提一旦恢复（例如切到 git 仓库、补好 WorktreeCreate hooks、重新建 team），再继续原生路径。',
    '- 普通 worker 的结果默认看完成通知 / 回传消息，不要把 `TaskOutput` 当成普通 worker 的默认结果获取方式。',
    '- 纯文本 `SendMessage` 最好带简短 `summary` 预览；如果忘了带，hello2cc 会尽量补齐兼容层，避免踩到宿主校验坑。',
    '- 外部系统与集成优先原生 MCP / connected tools，优先 `ListMcpResources` / `ReadMcpResource`。',
    '- 如果只被一个真实用户选择阻塞，优先 `AskUserQuestion`。',
    '- 只有用户明确要求隔离工作树时才使用 `EnterWorktree`。',
    '- 宣称完成前先跑与改动最贴近的验证；验证结果要诚实。',
  ];
}

export function buildTeamCoordinationLines() {
  return [
    '## Team / task-board 协作',
    '- 原生 team 顺序：`TeamCreate` → `TaskList` / `TaskCreate` → `Agent(name + team_name)` → `TaskUpdate` / `TaskGet` / `SendMessage` → `TeamDelete`。',
    '- task board 要写成真实可执行项：subject 清晰、description 足够让 teammate 独立推进；需要依赖关系时明确 `blockedBy` / `owner`。',
    '- teammate 开工前先看 `TaskList`，更新任务前先 `TaskGet`；开始做事时把任务推进到 `in_progress`，只有真正完成才标 `completed`。',
    '- 做完一个 task 后先 `TaskList` 看下一个未阻塞任务；如果卡住，就保持任务未完成并通过 `SendMessage` 说明 blocker 或需要的 handoff。',
    '- teammate 之间真正的沟通靠 `SendMessage`；写在普通正文里的话不是团队协作通道。',
  ];
}

export function buildToolSearchLines() {
  return [
    '## ToolSearch 状态',
    '- 原生 `ToolSearch` 是默认优先路径：先用它确认可用工具、原生 agent 类型、MCP 能力、权限与边界。',
    '- hello2cc 不会主动把第三方模型从这条原生路径拉走。',
  ];
}

export function buildWebSearchLines(sessionContext = {}) {
  const { mode } = resolveWebSearchGuidanceState(sessionContext);

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

  if (mode === 'proxy-cooldown') {
    return [
      '## 实时信息与 WebSearch',
      '- 当前会话里的代理链路最近连续把原生 `WebSearch` 跑成了 `Did 0 searches` 或错误；不要在同一条件下机械重试。',
      '- 默认先明确说明联网边界；只有当用户明确要求重试、链路/模型发生变化，或冷却窗口到期后，才做一次探测性 `WebSearch`。',
      '- 如果探测后仍然没有真实搜索条目或来源，就继续按未联网处理，而不是在同一回合里连续重试。',
    ];
  }

  if (mode === 'proxy-probe') {
    return [
      '## 实时信息与 WebSearch',
      '- 当前会话里的代理链路最近不稳定，但恢复条件已满足；可以做一次探测性 `WebSearch` 来确认是否恢复。',
      '- 只有当这次探测真正返回搜索条目或来源链接时，才按联网成功处理；若再次出现 `Did 0 searches`、无来源或无搜索结果，就重新回到边界说明。',
      '- hello2cc 不会把这条路径永久判死；它只阻止在同一失败条件下机械重试。',
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
