import { configuredManagedOutputStyle, configuredModels, configuredOutputStyleBootstrapPolicy } from './config.mjs';
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

function buildModelPolicyLines(config) {
  if (config.routingPolicy === 'prompt-only') return [];

  const lines = [
    '## Native Agent model policy',
    `- routing_policy: \`${config.routingPolicy}\``,
    `- mirror_session_model: \`${config.mirrorSessionModel}\``,
    `- session_model: \`${config.sessionModel || '(none detected yet)'}\``,
    `- primary_model: \`${config.primaryModel}\``,
    `- subagent_model: \`${config.subagentModel}\``,
    `- guide_model: \`${config.guideModel}\``,
    `- explore_model: \`${config.exploreModel}\``,
    `- plan_model: \`${config.planModel}\``,
    `- general_model: \`${config.generalModel}\``,
    `- team_model: \`${config.teamModel}\``,
    '- If the current session has a model alias and `mirror_session_model` is enabled, hello2cc mirrors that alias into native `Agent.model` when `model` is omitted.',
    '- If a native `Agent` call already sets `model`, hello2cc does not override it.',
  ];

  return ['', ...lines];
}

function quoteTrack(track) {
  return `\`${track}\``;
}

function recommendedTrackLabels(signals) {
  if (signals.tracks?.length) return signals.tracks;
  if (signals.research && signals.verify) return ['research', 'verification'];
  if (signals.research && signals.implement) return ['research', 'implementation'];
  if (signals.implement && signals.verify) return ['implementation', 'verification'];
  return [];
}

function buildTeamStep(signals) {
  const tracks = recommendedTrackLabels(signals);
  if (tracks.length < 2 && !signals.swarm) return '';

  const trackList = tracks.length > 0 ? tracks.map(quoteTrack).join(' / ') : '`track-1` / `track-2`';
  return `这是多线任务：优先 \`TeamCreate\` 建立原生团队，并立即为 ${trackList} 创建独立 \`TaskCreate\`；执行中持续使用 \`TaskList\` / \`TaskUpdate\` 跟踪进度。`;
}

export function buildSessionStartContext(sessionContext = {}) {
  const config = configuredModels(sessionContext);
  const managedOutputStyle = configuredManagedOutputStyle();
  const outputStylePolicy = configuredOutputStyleBootstrapPolicy();

  return [
    '# hello2cc',
    '',
    'hello2cc is a thin, native-first Claude Code plugin for GPT and other third-party models routed through Claude Code.',
    'Its job is to preserve Claude Code’s built-in workflows with silent model injection, current-model mirroring, and optional persistent response shaping.',
    '',
    '## Default posture',
    '- Trivial, low-risk edits: do them directly.',
    '- If you are unsure whether a tool, plugin, agent type, permission, or MCP capability exists, run `ToolSearch` before guessing.',
    '- For Claude Code / Claude API / Agent SDK / hooks / MCP / settings questions, prefer native `Claude Code Guide` first and use official docs when needed.',
    '- For multi-step or cross-file work, prefer `EnterPlanMode()` or at least `TaskCreate` / `TaskUpdate` / `TaskList`.',
    '- For open-ended repository exploration after a couple of searches, prefer native `Agent` with `Explore` or `Plan`.',
    '- For bounded delegated implementation or verification, prefer native `Agent` with `General-Purpose` over ad-hoc text delegation.',
    '- For parallelizable work, prefer native `Agent`; for sustained coordination, use `TeamCreate` plus `Task*`.',
    '- For external systems, connected tools, or MCP-backed data sources, run `ToolSearch` first and prefer native MCP tools before web fallback.',
    '- Never roleplay agents or teams in plain text when native tools exist.',
    '- Before claiming completion, run the narrowest relevant validation first and expand only if needed.',
    '- Prefer Markdown or aligned ASCII tables for comparisons, inventories, task matrices, validation summaries, and option trade-offs when they improve scanability.',
    '',
    '## Built-in agent types',
    '- `Explore`',
    '- `Plan`',
    '- `General-Purpose` (internal id `general-purpose`)',
    '- `Claude Code Guide` (internal id `claude-code-guide`)',
    '',
    '## Output style bootstrap',
    `- bootstrap_output_style: \`${outputStylePolicy}\``,
    `- managed_output_style: \`${managedOutputStyle}\``,
    '- hello2cc may seed the user-level `outputStyle` once per plugin version, but the current session still follows the style that was active when the session started.',
    '',
    ...buildModelPolicyLines(config),
  ].join('\n');
}

export function buildRouteSteps(prompt, sessionContext = {}) {
  const signals = classifyPrompt(prompt);
  const config = configuredModels(sessionContext);
  const steps = [];

  if (signals.toolSearchFirst) {
    steps.push('先 `ToolSearch` 确认可用工具、原生 agent 类型、插件能力、权限与 MCP 边界，不要凭记忆猜。');
  }

  if (signals.mcp) {
    steps.push('如果任务涉及外部系统、数据源或集成平台，优先查找并调用原生 MCP / connected tools；只有在本地能力不存在时再退回网页搜索。');
  }

  if (signals.claudeGuide) {
    steps.push('这是 Claude Code / Claude API / Agent SDK / hooks / settings / MCP 能力问题：优先调用原生 `Agent` 的 `Claude Code Guide`，必要时再抓取官方文档。');
  } else if (signals.research) {
    steps.push('这是研究 / 对比 / 文档任务：先定向搜索，再在需要时转原生 `Explore` 或 `Plan`。');
  }

  if (signals.boundedImplementation) {
    steps.push('这是边界清晰的实现 / 修复 / 验证子任务：优先使用原生 `Agent` 的 `General-Purpose` 承接单一切片，而不是把探索、规划和实现都混在主线程。');
  }

  if (signals.complex) {
    steps.push('这是非 trivial 实现：先 `EnterPlanMode()`，或至少用 `TaskCreate` / `TaskUpdate` / `TaskList` 建立可追踪任务，再开始编辑。');
  }

  if (signals.plan) {
    steps.push('任务存在跨文件、架构取舍或多个阶段：优先计划模式；如果不进入计划模式，也要维护原生任务清单。');
  } else if (signals.taskList) {
    steps.push('该任务适合显式拆解：优先维护 `TaskCreate` / `TaskUpdate` / `TaskList`，不要只在正文里口头列步骤。');
  }

  if (signals.swarm) {
    steps.push('存在并行空间：优先并行调用原生 `Agent`；持续协作或共享状态时使用 `TeamCreate` + `Task*`，不要用文本模拟团队。');
  }

  const teamStep = buildTeamStep(signals);
  if (teamStep) {
    steps.push(teamStep);
  }

  if (signals.diagram) {
    steps.push('需要结构化表达：优先高质量 Markdown/ASCII 表格或图示，保持列宽、标签和连线风格一致。');
  }

  if (signals.verify) {
    steps.push('收尾前先做最贴近改动范围的验证，再视结果扩大范围；未验证不要声称已完成。');
  }

  if (config.routingPolicy !== 'prompt-only') {
    steps.push('如果原生 `Agent` / team teammate 调用漏掉 `model`，hello2cc 会优先镜像当前会话模型别名；无会话别名时再按插件配置补齐。显式传入的 `model` 优先。');
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
