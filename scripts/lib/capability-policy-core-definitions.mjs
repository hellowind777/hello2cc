import {
  activeTeamName,
  baseDecisionLadder,
  requestNeedsCapabilityDiscovery,
  requestNeedsDecisionHelp,
  requestNeedsGuideSurface,
  requestNeedsParallelWorkers,
  requestNeedsPlanning,
  requestNeedsTaskTracking,
  requestNeedsTeamWorkflow,
  requestNeedsWorkflowRouting,
  requestOutputShape,
  sessionModelLine,
} from './capability-policy-helpers.mjs';
import { SURFACE_POLICY_DEFINITIONS } from './capability-policy-surface-definitions.mjs';

export const CORE_POLICY_DEFINITIONS = [
  {
    id: 'specificity-ladder',
    title: 'Specificity / capability ladder',
    available: () => true,
    sessionLines(sessionContext) {
      const lines = [
        '- 宿主先定义能力边界与优先级；模型只在这个受约束空间里做语义匹配和最终工具选择。',
        '- 默认顺序：已加载连续体 → surfaced capability → discovery → 更宽的 agent / team 路径；不要一上来就退回最宽的工具或自创工作流。',
        '- `Plan` / `Explore` 只是只读 helper，不等于 session 级 `EnterPlanMode`；不要因为有这些 agent 就默认先进入 plan mode。',
      ];
      const modelLine = sessionModelLine(sessionContext);
      if (modelLine) lines.push(`- ${modelLine}`);
      return lines;
    },
    routeLines(requestProfile) {
      const lines = [];
      const shouldSurface = Boolean(
        requestNeedsPlanning(requestProfile) ||
        requestProfile?.boundedImplementation ||
        requestProfile?.compare ||
        requestNeedsGuideSurface(requestProfile) ||
        requestNeedsCapabilityDiscovery(requestProfile) ||
        requestNeedsWorkflowRouting(requestProfile) ||
        requestNeedsTeamWorkflow(requestProfile) ||
        requestNeedsTaskTracking(requestProfile) ||
        requestNeedsParallelWorkers(requestProfile) ||
        requestNeedsDecisionHelp(requestProfile),
      );

      if (!shouldSurface) {
        return lines;
      }

      lines.push('先按宿主能力优先级决策，再在被允许的能力面内选择工具；不要把未知能力、隐含权限或未 surfaced 的 workflow 当成可直接使用。');

      if (requestNeedsPlanning(requestProfile)) {
        lines.push(requestProfile?.planningProbeShape
          ? '先把这次规划收成目标、阶段顺序、验证方式和未决问题/风险；`planning` 路由只要求给出计划，不等于必须进入 session 级 `EnterPlanMode`。'
          : '如果实现路径 genuinely unclear、架构取舍明显或需要先探索再定方案，先走原生规划；不要因为多文件、可用 `Plan` agent 或需要先读代码就自动进 plan mode。');
      }

      if (requestNeedsCapabilityDiscovery(requestProfile)) {
        lines.push('先回答当前已 visible 的 capability / workflow / MCP surface，再指出真实缺口；只有缺口仍存在时才进入 discovery。');
      }

      if (requestNeedsGuideSurface(requestProfile)) {
        lines.push('把当前问题按 Claude Code / hooks / settings / SDK / API guide 主题处理：优先沿可见 guide surface 直接回答，不要误切到 skill/workflow discovery。');
      }

      if (requestProfile?.boundedImplementation) {
        lines.push('把当前任务按边界清晰的实现 / 修复 / 验证切片处理：优先直接推进或交给 `General-Purpose`；必要时可派只读 `Explore` / `Plan` 补信息，但不要先把它升级成 session 级 plan mode。');
      }

      if (requestProfile?.compare) {
        lines.push('把当前任务按比较 / 选型 / 能力边界问题处理：默认直接回答，必要时用紧凑 Markdown 对比表；不要先进入 plan。');
      }

      if (requestNeedsTaskTracking(requestProfile) && !requestNeedsTeamWorkflow(requestProfile)) {
        lines.push('复杂多步但非 team 的任务先用宿主 task tracking 立住真实状态，再决定是否需要并行 worker；不要因为能并行就跳过任务板。');
      }

      return lines;
    },
    snapshot(sessionContext, requestProfile) {
      return {
        id: 'specificity-ladder',
        mode: 'host_defines_capability_priority',
        order: baseDecisionLadder(),
        output_shape: requestOutputShape(requestProfile),
        active_team: activeTeamName(sessionContext) || undefined,
      };
    },
  },
  ...SURFACE_POLICY_DEFINITIONS,
];
