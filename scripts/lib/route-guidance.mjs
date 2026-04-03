import { configuredModels } from './config.mjs';
import { hasSpecificContinuationSurface } from './route-guidance-capability-steps.mjs';
import {
  buildDeferredToolStep,
  buildMcpSpecificityStep,
  buildSkillWorkflowStep,
} from './route-guidance-capability-steps.mjs';
import {
  buildCurrentInfoStep,
  buildResearchStep,
  buildSwarmStep,
  buildTaskPlanningLine,
  buildTaskTrackingLine,
} from './route-guidance-execution-steps.mjs';

/**
 * Builds prompt-submit routing steps that steer the model toward native Claude Code surfaces.
 */
export function buildRouteStepsFromSignals(signals, sessionContext = {}) {
  const config = configuredModels(sessionContext);
  const steps = [];
  const specificContinuationSurface = hasSpecificContinuationSurface(sessionContext);

  steps.push('可见文本默认跟随用户当前语言；不要输出“我打算 / 我应该 / let’s”这类内部思考式元叙述。');

  const skillWorkflowStep = buildSkillWorkflowStep(signals, sessionContext);
  if (skillWorkflowStep) {
    steps.push(skillWorkflowStep);
  }

  const mcpSpecificityStep = buildMcpSpecificityStep(signals, sessionContext);
  if (mcpSpecificityStep) {
    steps.push(mcpSpecificityStep);
  }

  const deferredToolStep = buildDeferredToolStep(signals, sessionContext);
  if (deferredToolStep) {
    steps.push(deferredToolStep);
  }

  if (signals.toolSearchFirst && specificContinuationSurface) {
    steps.push('只有当更具体的 workflow / skill / MCP resource / deferred tool 线索都不覆盖时，再 `ToolSearch` 确认可用工具、原生 agent 类型、MCP 能力、权限与边界。');
  } else if (signals.toolSearchFirst) {
    steps.push('先 `ToolSearch` 确认可用工具、原生 agent 类型、MCP 能力、权限与边界，不要凭记忆猜。');
  }

  if (signals.mcp) {
    steps.push('如果任务涉及外部系统、数据源或集成平台，优先 `ListMcpResources` / `ReadMcpResource` 或对应 MCP / connected tools。');
  }

  const researchStep = buildResearchStep(signals);
  if (researchStep) {
    steps.push(researchStep);
  }

  const currentInfoStep = buildCurrentInfoStep(signals, sessionContext);
  if (currentInfoStep) {
    steps.push(currentInfoStep);
  }

  if (signals.boundedImplementation) {
    steps.push('这是边界清晰的实现 / 修复 / 验证子任务：优先使用原生 `Agent` 的 `General-Purpose`（全工具面）承接单一切片，而不是把探索、规划和实现都混在主线程。');
  }

  if (signals.plan) {
    steps.push(buildTaskPlanningLine(signals));
    steps.push('只有当实现路径存在真实歧义、明显架构取舍，或需要先探索再定方案时，才进入计划模式；路径清晰时直接推进。');
  }

  if (signals.taskList) {
    steps.push(buildTaskTrackingLine(signals));
  }

  if (signals.decisionHeavy) {
    steps.push('如果执行过程中出现单一真实阻塞选择，优先用 `AskUserQuestion` 发起结构化选择，不要把确认埋在长段落里。');
  }

  if (signals.swarm) {
    steps.push(buildSwarmStep(signals));
  }

  if (signals.wantsWorktree) {
    steps.push('用户明确要求隔离工作树：只有确实需要隔离工作区、分支式实验或并行修改时才进入 `EnterWorktree`。');
  }

  if (signals.diagram) {
    steps.push('需要结构化表达：优先标准 Markdown 表格或图示；只有 Markdown 明显不适合时再使用 ASCII。');
  }

  if (signals.verify) {
    steps.push('收尾前先做最贴近改动范围的验证，再视结果扩大范围；未验证不要声称已完成。');
  }

  if (config.routingPolicy !== 'prompt-only') {
    steps.push('如果原生 `Agent` 调用没有显式 `model`，优先与当前会话模型保持一致；显式传入的 `model` 永远优先。');
  }

  if (steps.length === 0) {
    return '';
  }

  return [
    '# hello2cc host-surface routing',
    '',
    '按下面顺序优先决策：',
    '',
    ...steps.map((step, index) => `${index + 1}. ${step}`),
  ].join('\n');
}
