#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { configuredModels } from './lib/config.mjs';
import { preferredModelForAgent } from './lib/agent-models.mjs';
import { classifyPrompt, isSubagentPrompt, startsWithExplicitCommand } from './lib/prompt-signals.mjs';

const cmd = process.argv[2] || '';

function readStdinJson() {
  try {
    const raw = readFileSync(0, 'utf8').trim();
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    process.stderr.write(`orchestrator.mjs: failed to parse stdin JSON: ${error.message}\n`);
    return {};
  }
}

function writeJson(payload) {
  process.stdout.write(JSON.stringify(payload));
}

function suppress(hookEventName, additionalContext) {
  writeJson({
    hookSpecificOutput: {
      hookEventName,
      ...(additionalContext ? { additionalContext } : {}),
    },
    suppressOutput: true,
  });
}

function emptySuppress() {
  writeJson({ suppressOutput: true });
}

function allowWithUpdatedInput(updatedInput, reason) {
  writeJson({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: reason,
      updatedInput,
    },
    suppressOutput: true,
  });
}

function buildModelPolicyLines(config) {
  if (config.routingPolicy === 'prompt-only') return [];

  const lines = [
    '## Native Agent model policy',
    `- routing_policy: \`${config.routingPolicy}\``,
    `- primary_model: \`${config.primaryModel}\``,
    `- subagent_model: \`${config.subagentModel}\``,
    `- guide_model: \`${config.guideModel}\``,
    `- explore_model: \`${config.exploreModel}\``,
    `- plan_model: \`${config.planModel}\``,
    `- general_model: \`${config.generalModel}\``,
    `- team_model: \`${config.teamModel}\``,
    '- If a native `Agent` call omits `model`, hello2cc injects the preferred model during `PreToolUse(Agent)`.',
  ];

  return ['', ...lines];
}

function buildSessionStartContext() {
  const config = configuredModels();

  return [
    '# hello2cc',
    '',
    'hello2cc is a thin, native-first Claude Code plugin for GPT and other third-party models routed through Claude Code.',
    'Its job is to preserve Claude Code’s built-in workflows instead of replacing them with skill-heavy orchestration.',
    '',
    '## Default posture',
    '- Trivial, low-risk edits: do them directly.',
    '- If you are unsure whether a tool, skill, plugin, agent type, permission, or MCP capability exists, run `ToolSearch` before guessing.',
    '- For Claude Code / Claude API / Agent SDK / hooks / MCP / settings questions, prefer native `Claude Code Guide` first and use official docs when needed.',
    '- For multi-step or cross-file work, prefer `EnterPlanMode()` or at least `TaskCreate` / `TaskUpdate` / `TaskList`.',
    '- For open-ended repository exploration after a couple of searches, prefer native `Agent` with `Explore` or `Plan`.',
    '- For parallelizable work, prefer native `Agent`; for sustained coordination, use `TeamCreate` plus `Task*`.',
    '- Never roleplay agents or teams in plain text when native tools exist.',
    '- Before claiming completion, run the narrowest relevant validation first and expand only if needed.',
    '- Use aligned ASCII tables or diagrams when they genuinely improve clarity.',
    '',
    '## Built-in agent types',
    '- `Explore`',
    '- `Plan`',
    '- `General-Purpose` (internal id `general-purpose`)',
    '- `Claude Code Guide` (internal id `claude-code-guide`)',
    '',
    '## Optional one-time output style',
    '- If the user selects `hello2cc Native` once in `/config`, keep following that formatting and native-first behavior silently in new sessions.',
    '',
    '## Optional manual escape hatches',
    '- Slash skills remain available, but they are fallback entry points rather than the default path.',
    ...buildModelPolicyLines(config),
  ].join('\n');
}

function buildRouteSteps(prompt) {
  const signals = classifyPrompt(prompt);
  const config = configuredModels();
  const steps = [];

  if (signals.toolSearchFirst) {
    steps.push('先 `ToolSearch` 确认可用工具、原生 agent 类型、插件能力、权限与 MCP 边界，不要凭记忆猜。');
  }

  if (signals.claudeGuide) {
    steps.push('这是 Claude Code / Claude API / Agent SDK / hooks / settings / MCP 能力问题：优先调用原生 `Agent` 的 `Claude Code Guide`，必要时再抓取官方文档。');
  } else if (signals.research) {
    steps.push('这是研究 / 对比 / 文档任务：先定向搜索，再在需要时转原生 `Explore` 或 `Plan`，不要默认走 skill。');
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

  if (signals.diagram) {
    steps.push('需要结构化表达：优先高质量 ASCII 图或对照表，保持列宽、标签和连线风格一致。');
  }

  if (signals.verify) {
    steps.push('收尾前先做最贴近改动范围的验证，再视结果扩大范围；未验证不要声称已完成。');
  }

  if (config.routingPolicy !== 'prompt-only') {
    steps.push('如果原生 `Agent` / team teammate 调用漏掉 `model`，hello2cc 会在 `PreToolUse(Agent)` 自动注入；显式传入的 `model` 优先。');
  }

  if (steps.length === 0) return '';

  return [
    '# hello2cc native-first routing',
    '',
    '按下面顺序优先决策：',
    '',
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    'skills 只是手动备用入口，不是默认首选路径。',
  ].join('\n');
}

async function cmdSessionStart() {
  suppress('SessionStart', buildSessionStartContext());
}

async function cmdRoute() {
  const payload = await readStdinJson();
  const prompt = String(payload.prompt || '').trim();

  if (!prompt || startsWithExplicitCommand(prompt) || isSubagentPrompt(prompt)) {
    emptySuppress();
    return;
  }

  const additionalContext = buildRouteSteps(prompt);
  if (!additionalContext) {
    emptySuppress();
    return;
  }

  suppress('UserPromptSubmit', additionalContext);
}

async function cmdPreAgentModel() {
  const payload = await readStdinJson();
  const input = payload.tool_input || {};

  if (payload.tool_name && payload.tool_name !== 'Agent') {
    emptySuppress();
    return;
  }

  const preferredModel = preferredModelForAgent(input, configuredModels());
  if (!preferredModel) {
    emptySuppress();
    return;
  }

  allowWithUpdatedInput(
    {
      ...input,
      model: preferredModel,
    },
    `hello2cc injected Agent.model=${preferredModel}`,
  );
}

async function main() {
  switch (cmd) {
    case 'session-start':
      await cmdSessionStart();
      break;
    case 'route':
      await cmdRoute();
      break;
    case 'pre-agent-model':
      await cmdPreAgentModel();
      break;
    default:
      process.stderr.write(`orchestrator.mjs: unknown command "${cmd}"\n`);
      process.exit(1);
  }
}

await main();
