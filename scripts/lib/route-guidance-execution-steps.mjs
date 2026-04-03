import { resolveWebSearchGuidanceState } from './api-topology.mjs';

function buildTaskPlanningStep(signals = {}) {
  if (signals.teamSemantics) {
    return '只有当实现路径 genuinely unclear、存在明显架构取舍，或需要先探索再定方案时，才 `EnterPlanMode()` 收敛方案；如果随后确实进入持续协作型 team 工作流，再把计划落到原生 task board（`TeamCreate` 自带 task list），不要只停留在口头分工。';
  }

  return '只有当实现路径 genuinely unclear、存在明显架构取舍，或需要先探索再定方案时，才 `EnterPlanMode()`；多文件但路径清晰时直接推进，具体分歧再用 `AskUserQuestion`。如果要把只读规划切给 subagent，优先 `Plan`（只读规划，工具面基本继承 `Explore`）；只有真的需要任务盘时再用 `TaskCreate` / `TaskList` / `TaskUpdate`。';
}

function buildTaskTrackingStep(signals = {}) {
  if (signals.teamSemantics) {
    return '该任务适合显式拆解：先 `TaskList` 看现有任务并避免重复；新增项用 `TaskCreate`；开始前先 `TaskGet` / `TaskUpdate(status:"in_progress")` 对齐最新状态、owner 与 handoff；只有真正完成才 `TaskUpdate(status:"completed")`，阻塞时保持未完成并明确 blocker。';
  }

  return '该任务适合显式拆解：维护 `TaskCreate` / `TaskList` / `TaskUpdate`；更新前先 `TaskGet` 看当前状态，不要只在正文里口头列步骤。';
}

function recommendedTrackLabels(signals) {
  if (signals.tracks?.length) return signals.tracks;
  if (signals.research && signals.verify) return ['research', 'verification'];
  if (signals.research && signals.implement) return ['research', 'implementation'];
  if (signals.implement && signals.verify) return ['implementation', 'verification'];
  return ['track-1', 'track-2'];
}

export function buildSwarmStep(signals) {
  const trackList = recommendedTrackLabels(signals)
    .map((track) => `\`${track}\``)
    .join(' / ');

  if (signals.teamWorkflow) {
    return [
      `用户显式要求团队编排：用 \`TeamCreate\` 建立持久团队来推进 ${trackList}。`,
      '`TeamCreate` 之后先 `TaskList` 看现有任务；如果还没有可执行任务，就先 `TaskCreate` 建出具体 task board（含 subject / description / blockedBy / owner 语义），再启动实现 teammate。',
      '选择 teammate 时要匹配原生工具面：`Explore` / `Plan` 只读，只做搜索和规划；需要改文件、联调或验证的切片交给 `General-Purpose`，不要把实现任务派给只读 agent。',
      '等 `TeamCreate` 产出真实团队后，后续 `Agent` 调用再显式传入 `name` + `team_name`；不要依赖 `main` / `default` 这类隐式 team 上下文。',
      '团队成员已启动后，任务流转优先 `TaskCreate` / `TaskList` / `TaskUpdate` / `TaskGet`；分派或认领时显式维护 `owner`，完成一个 task 后先 `TaskList` 看下一个未阻塞任务，补充协作、修正范围或续派时用 `SendMessage`。',
      'teammate 每回合结束后 idle 是正常行为，不要把 idle 当异常；如果某个 teammate 出现 `0 tool uses`、无实质进展或 task 不匹配，先用 `TaskGet` / `TaskList` + `SendMessage` 重新对齐 task、上下文和 owner，再考虑降级成 plain worker。',
      '团队完成后用 `TeamDelete` 清理。',
    ].join(' ');
  }

  if (signals.proactiveTeamWorkflow) {
    return [
      `这是持续协作型多 agent 任务：更接近 Claude Code 原生 team 语义，优先主动用 \`TeamCreate\` 建立持久团队来推进 ${trackList}。`,
      '当任务需要共享 task list、任务 owner、多轮续派或 teammate 之间协作时，不要只停留在一次性 plain worker。',
      '先 `TeamCreate`，再 `TaskList` / `TaskCreate` 把研究、实现、验证和 handoff 落成真实 task board；不要一建团队就直接口头分工。',
      '后续 `Agent` 要显式传入 `name` + `team_name` 加入团队；选 agent 类型时遵守原生工具面：`Explore` / `Plan` 只读，`General-Purpose` 才承担实现或验证。',
      '团队内任务流转优先 `TaskCreate` / `TaskList` / `TaskUpdate` / `TaskGet`；分派和接力时显式维护 `owner`，补充协作或续派时用 `SendMessage`。',
      'teammate 每回合结束后 idle 是正常行为；如果某个 teammate 返回 `0 tool uses`、没有实质推进或拿错 task，先在团队内用 `TaskGet` / `TaskList` + `SendMessage` 自修复，再考虑退回普通并行 worker。',
      '如果只是一次性 fan-out / fan-in，且不需要持久协作或共享任务状态，才退回普通并行 worker。',
      '团队完成后用 `TeamDelete` 清理。',
    ].join(' ');
  }

  return [
    `这是明确的多线并行任务：优先在同一条回复里并行发起多个原生 \`Agent\` worker，分别覆盖 ${trackList}。`,
    '普通并行 worker 走 plain subagent 路径：不要给普通 worker 传 `name` 或 `team_name`，避免被宿主误判为 teammate。',
    '研究 / 定位 slice 优先 `Explore`（只读搜索）；规划 slice 优先 `Plan`（只读规划）；边界清晰的实现 / 验证 slice 优先 `General-Purpose`（全工具面）。',
    '启动后简短告诉用户已启动哪些 worker，然后等待完成通知 / 回传消息，不要立刻轮询普通 agent 结果。',
    '需要补充指令或续派时用 `SendMessage`；纯文本 `SendMessage` 最好带简短 `summary` 预览；如果某个 worker 明显走错方向，再用 `TaskStop`。',
    '不要把 `TaskOutput` 当成普通 worker 的默认结果获取方式；它更适合明确的后台任务日志读取。',
  ].join(' ');
}

export function buildResearchStep(signals) {
  if (signals.claudeGuide) {
    return '这是 Claude Code / Claude API / Agent SDK / hooks / settings / MCP 能力问题：优先调用原生 `Agent` 的 `Claude Code Guide`（本地读搜 + `WebFetch` + `WebSearch`）。';
  }

  if (signals.codeResearch) {
    return '这是代码库研究 / 定位任务：先用原生读写 / 搜索工具缩小范围，再在需要更大搜索面时转原生 `Explore`（只读搜索）或 `Plan`（只读规划）。';
  }

  if (!signals.research) {
    return '';
  }

  return '这是研究 / 对比 / 文档任务：先做定向搜索与证据收集，再在需要扩大搜索面时转原生 `Explore`（只读搜索）或 `Plan`（只读规划）。';
}

export function buildCurrentInfoStep(signals, sessionContext = {}) {
  if (!signals.currentInfo) {
    return '';
  }

  const { mode } = resolveWebSearchGuidanceState(sessionContext, {
    retryRequested: signals.webSearchRetry,
  });

  if (mode === 'available') {
    return '这是最新/实时信息任务：优先原生 `WebSearch` 获取当下来源，再组织答案；不要只凭记忆回答这类问题。';
  }

  if (mode === 'proxy-conditional') {
    return '这是最新/实时信息任务：优先尝试原生 `WebSearch`；只有当它真实返回搜索条目或来源链接时，才按联网结果回答。若界面出现 `Did 0 searches`、无来源或无搜索结果，必须明确说明未完成真实搜索。';
  }

  if (mode === 'proxy-cooldown') {
    return '这是最新/实时信息任务：当前代理链路里的原生 `WebSearch` 在本会话最近连续返回 `Did 0 searches` 或错误；先明确说明联网边界，不要在同一条件下机械重试。只有当用户明确要求重试、链路/模型发生变化，或冷却窗口到期后，才做一次探测性 `WebSearch`；若仍无条目或来源，就继续按未联网处理。';
  }

  if (mode === 'proxy-probe') {
    return '这是最新/实时信息任务：当前代理链路里的原生 `WebSearch` 最近不稳定，但恢复条件已满足；可以先做一次探测性 `WebSearch`。只有当它真实返回搜索条目或来源链接时，才按联网成功处理；若再次出现 `Did 0 searches`、无来源或无搜索结果，就重新回到边界说明，不要连续重试。';
  }

  if (mode === 'not-exposed') {
    return '这是最新/实时信息任务：当前未显式看到原生 `WebSearch`；不要把记忆包装成最新联网信息，必要时先说明当前边界。';
  }

  return '这是最新/实时信息任务：若宿主暴露原生 `WebSearch`，优先用它获取实时来源；如果没有真实搜索结果或来源，就明确说明边界，不要假装已经联网。';
}

export function buildTaskPlanningLine(signals) {
  return buildTaskPlanningStep(signals);
}

export function buildTaskTrackingLine(signals) {
  return buildTaskTrackingStep(signals);
}
