import { availableDeferredToolNames } from './session-context-accessors.mjs';
import {
  activeTeamName,
  hasBootstrappableTeamWorkflowSurface,
  hasVisibleTeamWorkflowSurface,
  requestNeedsParallelWorkers,
  requestNeedsPlanning,
  requestNeedsTaskTracking,
  requestNeedsTeamWorkflow,
  uniqueStrings,
  visibleTaskBoardTools,
} from './capability-policy-helpers.mjs';

export const EXECUTION_POLICY_DEFINITIONS = [
  {
    id: 'team-workflow',
    title: 'TeamCreate / task board / teammate routing',
    available(sessionContext) {
      return hasVisibleTeamWorkflowSurface(sessionContext);
    },
    sessionLines(sessionContext) {
      const taskBoardTools = visibleTaskBoardTools(sessionContext);
      const lines = [
        '- team 语义只在“持久 task board / owner / handoff / shared teammate context”成立时启用；普通并行 worker 不等于 team。',
      ];

      if (activeTeamName(sessionContext)) {
        lines.push('- 当前已处于真实 active team continuity；继续沿 `SendMessage` 与 task board 工具收口，不要把团队状态退化回正文口头广播。');
      } else if (hasBootstrappableTeamWorkflowSurface(sessionContext)) {
        lines.push('- 进入 team 模式后，先 `TeamCreate`，再 `TaskList` / `TaskCreate` 建真实 task board，再启动 teammate；后续 `Agent` 显式传 `name` + `team_name`。');
      } else {
        lines.push('- 当前未看到完整的 team bootstrapping 工具面；不要把普通 `Agent` worker、background agents，或暂时出现的 teammate UI 误读成真实 team 已创建。');
      }

      if (sessionContext?.sendMessageAvailable || taskBoardTools.length) {
        const continuityTools = uniqueStrings([
          sessionContext?.sendMessageAvailable ? 'SendMessage' : '',
          ...taskBoardTools,
        ]);
        lines.push(`- 当前可见的 team continuity 工具面：${continuityTools.map((tool) => `\`${tool}\``).join(', ')}；只在这些已 surfaced 的能力内继续。`);
      }

      return lines;
    },
    routeLines(requestProfile, sessionContext) {
      const lines = [];
      const activeTeam = activeTeamName(sessionContext);
      const taskBoardTools = visibleTaskBoardTools(sessionContext);

      if (requestNeedsTeamWorkflow(requestProfile) && activeTeam) {
        lines.push(`当前已有 active team continuity（\`${activeTeam}\`）；优先沿 \`SendMessage\`${taskBoardTools.length ? ` + ${taskBoardTools.map((tool) => `\`${tool}\``).join(' / ')}` : ''} 继续，不要重建 team 或口头宣布 team 已创建。`);
      } else if (requestNeedsTeamWorkflow(requestProfile) && hasBootstrappableTeamWorkflowSurface(sessionContext)) {
        lines.push('把当前任务按持续协作型 team 语义处理：优先 `TeamCreate` → `TaskList` / `TaskCreate` 建真实 task board → teammate，而不是只靠一次性 plain workers 或正文口头分工。');
      } else if (requestNeedsTeamWorkflow(requestProfile)) {
        lines.push('用户想要真实 team 协作，但当前宿主没有显式 surfaced 完整的 `TeamCreate` + task board + `SendMessage` 工具面；不要口头宣称 team 已创建。若只有 `Agent`，退回 plain workers；若必须 real team，先明确这是宿主能力缺口。');
      } else if (requestNeedsParallelWorkers(requestProfile)) {
        lines.push('把当前任务按一次性并行 worker 处理而不是持久 team；普通 worker 默认不要带 `name` / `team_name`。');
      }

      return lines;
    },
    snapshot(sessionContext, requestProfile) {
      const taskBoardTools = visibleTaskBoardTools(sessionContext);

      return {
        id: 'team-workflow',
        active_team: activeTeamName(sessionContext) || undefined,
        requested: requestNeedsTeamWorkflow(requestProfile) || undefined,
        bootstrappable: hasBootstrappableTeamWorkflowSurface(sessionContext) || undefined,
        task_board_tools: uniqueStrings([
          ...taskBoardTools,
          sessionContext?.sendMessageAvailable ? 'SendMessage' : '',
        ]),
      };
    },
  },
  {
    id: 'task-tracking',
    title: 'Todo / task tracking',
    available(sessionContext) {
      return Boolean(
        sessionContext?.todoWriteAvailable ||
        sessionContext?.taskCreateAvailable ||
        sessionContext?.taskListAvailable ||
        sessionContext?.taskUpdateAvailable,
      );
    },
    sessionLines() {
      return [
        '- 复杂任务用宿主任务能力显式跟踪，不要只在正文里口头列步骤；简单单步任务则直接做。',
      ];
    },
    routeLines(requestProfile, sessionContext) {
      const lines = [];
      const trackingTool = sessionContext?.taskCreateAvailable ? 'TaskCreate / TaskList / TaskUpdate' : (sessionContext?.todoWriteAvailable ? 'TodoWrite' : '');
      if (!trackingTool) return lines;

      if (requestNeedsTaskTracking(requestProfile)) {
        lines.push(`把当前任务按多步任务处理：优先用 \`${trackingTool}\` 维护真实任务状态，而不是把计划或进度藏在长段落里。`);
      }

      if (
        requestNeedsTaskTracking(requestProfile) &&
        requestNeedsParallelWorkers(requestProfile) &&
        !requestNeedsTeamWorkflow(requestProfile)
      ) {
        lines.push(`复杂但非 team 的并行任务先用 \`${trackingTool}\` 建真实任务状态，再只把真正独立的切片 fan-out 给 worker；不要一上来对同一问题并行开多个 agent。`);
      }
      return lines;
    },
    snapshot(sessionContext) {
      return {
        id: 'task-tracking',
        task_tools: uniqueStrings([
          sessionContext?.todoWriteAvailable ? 'TodoWrite' : '',
          sessionContext?.taskCreateAvailable ? 'TaskCreate' : '',
          sessionContext?.taskListAvailable ? 'TaskList' : '',
          sessionContext?.taskGetAvailable ? 'TaskGet' : '',
          sessionContext?.taskUpdateAvailable ? 'TaskUpdate' : '',
        ]),
      };
    },
  },
  {
    id: 'enter-worktree',
    title: 'EnterWorktree',
    available(sessionContext) {
      return Boolean(sessionContext?.enterWorktreeAvailable);
    },
    sessionLines() {
      return [
        '- 只在用户明确要求隔离工作树 / 并行工作区时使用 `EnterWorktree`；不要把它当成普通分支切换的默认替代。',
      ];
    },
    routeLines(requestProfile) {
      if (!requestProfile?.wantsWorktree) {
        return [];
      }

      return [
        '用户明确要求隔离工作树：只有在确实需要独立工作区时才进入 `EnterWorktree`，不要把它当成普通实现路径。',
      ];
    },
    snapshot(sessionContext, requestProfile) {
      return {
        id: 'enter-worktree',
        explicit_only: true,
        requested: requestProfile?.wantsWorktree || undefined,
        blocked_retry_cwds: uniqueStrings(Object.keys(sessionContext?.preconditionFailures?.worktreeByCwd || {})),
      };
    },
  },
  {
    id: 'deferred-tool-follow-through',
    title: 'Deferred tool follow-through',
    available(sessionContext) {
      return availableDeferredToolNames(sessionContext).length > 0;
    },
    sessionLines(sessionContext) {
      return [
        `- 当前 surfaced 的 deferred tools：${availableDeferredToolNames(sessionContext).map((tool) => `\`${tool}\``).join(', ')}；如果下一步正好需要这些能力，优先精确加载并直接使用，不要重新回到更宽的 agent 路径。`,
      ];
    },
    routeLines(requestProfile, sessionContext) {
      if (!availableDeferredToolNames(sessionContext).length || requestNeedsTeamWorkflow(requestProfile)) {
        return [];
      }

      return [
        '把当前已出现的 deferred tool 线索当成下一步的优先路径；如果它们覆盖下一步，就沿着该具体工具面继续，不要直接升级成更宽的协作路径。',
      ];
    },
    snapshot(sessionContext) {
      return {
        id: 'deferred-tool-follow-through',
        surfaced_deferred_tools: availableDeferredToolNames(sessionContext),
      };
    },
  },
];
