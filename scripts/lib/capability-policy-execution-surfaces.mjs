import { observedAgentSurfaces } from './session-capabilities.mjs';
import {
  availableDeferredToolNames,
  detectedAgents,
} from './session-context-accessors.mjs';
import { formatNames } from './session-surface-formatters.mjs';
import {
  requestNeedsCapabilityDiscovery,
  requestNeedsDecisionHelp,
  requestNeedsParallelWorkers,
  requestNeedsTaskTracking,
  requestNeedsTeamWorkflow,
  requestNeedsWorkflowRouting,
} from './capability-policy-helpers.mjs';
import { resolveWebSearchGuidanceState } from './api-topology.mjs';
import { hasDeferredSurface, hasMcpSurface, hasSkillSurface } from './capability-policy-surface-helpers.mjs';

export const EXECUTION_SURFACE_POLICY_DEFINITIONS = [
  {
    id: 'tool-discovery',
    title: 'Deferred tools / ToolSearch',
    available(sessionContext) {
      return Boolean(sessionContext?.toolSearchAvailable || hasDeferredSurface(sessionContext));
    },
    sessionLines(sessionContext) {
      const lines = [];
      const deferred = availableDeferredToolNames(sessionContext);
      if (deferred.length) {
        lines.push(`- 当前 surfaced 的 deferred tools：${formatNames(deferred)}；需要时优先精确 ` + '`ToolSearch`' + '，不要先泛化到更宽的 agent 路径。');
      }
      if (sessionContext?.toolSearchAvailable) {
        lines.push('- `ToolSearch` 只用于工具 / MCP / agent 类型 / 权限边界发现；不是 clear execution path 下“先搜一下再说”的默认首步。');
      }
      return lines;
    },
    routeLines(requestProfile, sessionContext) {
      const lines = [];
      if (!sessionContext?.toolSearchAvailable) {
        return lines;
      }

      if (requestNeedsCapabilityDiscovery(requestProfile)) {
        lines.push('如果你真正不确定可用工具、agent、MCP 能力或权限边界，再用 `ToolSearch`；已知更具体表面时直接用具体表面。');
      }

      if (!requestNeedsCapabilityDiscovery(requestProfile) && (requestNeedsWorkflowRouting(requestProfile) || hasSkillSurface(sessionContext) || hasMcpSurface(sessionContext))) {
        lines.push('当前已有更具体的宿主能力线索；除非这些线索无法覆盖下一步，否则不要先退回 `ToolSearch`。');
      }

      return lines;
    },
    snapshot(sessionContext) {
      return {
        id: 'tool-discovery',
        discovery_tool: sessionContext?.toolSearchAvailable ? 'ToolSearch' : undefined,
        surfaced_deferred_tools: availableDeferredToolNames(sessionContext),
        constrained_to_host_surface: true,
      };
    },
  },
  {
    id: 'agent-routing',
    title: 'Native agents',
    available(sessionContext) {
      return Boolean(sessionContext?.agentToolAvailable || detectedAgents(sessionContext).length);
    },
    sessionLines(sessionContext) {
      const lines = [
        '- `Agent` 不是默认万能兜底；优先把简单定向搜索留给原生搜索工具，把开放式探索交给 `Explore`，把只读规划交给 `Plan`，把边界清晰的实现 / 修复 / 验证交给 `General-Purpose`。',
      ];
      const surfaces = observedAgentSurfaces(detectedAgents(sessionContext));
      if (surfaces.length) {
        lines.push(`- 当前已观测到的 agent surfaces：${formatNames(surfaces.map((surface) => surface.label))}。`);
      }
      return lines;
    },
    routeLines(requestProfile) {
      const lines = [];

      if (requestProfile?.codeResearch) {
        lines.push('代码库研究与范围探索优先原生搜索，必要时再转 `Explore`（只读搜索）或 `Plan`（只读规划）。');
      }

      if (requestProfile?.boundedImplementation) {
        lines.push('边界清晰的实现、修复、验证切片优先 `General-Purpose`。');
      }

      if (requestNeedsParallelWorkers(requestProfile) && !requestNeedsTeamWorkflow(requestProfile)) {
        lines.push(
          requestNeedsTaskTracking(requestProfile)
            ? '复杂多步但非 team 的任务先用 task tracking 收住真实状态，再只把真正独立的切片 fan-out 给 plain `Agent` workers；默认不要一上来并行多个同题 agent。'
            : '只有子问题真正独立时才 fan-out plain `Agent` workers；同一问题的多个角度先主线程或单个合适 worker 处理。',
        );
      }

      return lines;
    },
    snapshot(sessionContext) {
      return {
        id: 'agent-routing',
        observed_surfaces: observedAgentSurfaces(detectedAgents(sessionContext)).map((surface) => ({
          name: surface.label,
          role: surface.role,
          tool_surface: surface.toolSurface,
        })),
      };
    },
  },
  {
    id: 'websearch',
    title: 'WebSearch / current info',
    available(sessionContext) {
      return Boolean(sessionContext?.webSearchAvailable || sessionContext?.webFetchAvailable);
    },
    sessionLines(sessionContext) {
      if (!sessionContext?.webSearchAvailable) {
        return [
          '- 当前会话未显式看到原生 `WebSearch`；不要把记忆包装成已经联网获取的最新信息。',
        ];
      }

      return [
        '- 涉及时效事实、波动事实或外部当前状态时，优先原生 `WebSearch` 拿来源；没有真实搜索条目或来源时必须诚实说明边界。',
      ];
    },
    routeLines(requestProfile, sessionContext) {
      const lines = [];
      const compareNeedsCurrentSources = Boolean(
        requestProfile?.compare &&
        requestProfile?.currentInfo &&
        sessionContext?.webSearchAvailable &&
        !requestProfile?.codeResearch &&
        !requestProfile?.implement &&
        !requestProfile?.review &&
        !requestProfile?.verify &&
        !requestProfile?.plan &&
        !requestProfile?.tools &&
        !requestProfile?.claudeGuide,
      );
      const queryHygieneLines = [
        '首条 `WebSearch` 查询保持单意图、短 query；不要把完整任务句、对比结论、长约束或多站点条件一次性塞进 query。',
        '比较题或多实体题先拆成多次搜索拿真实来源，再汇总成判断与对比表；优先用 `allowed_domains` 之类的结构化限制，不要把一串 `site:` 直接拼进 query 文本。',
        '如果返回 `Did 0 searches`，把它视为这次没有真正发出搜索；先改短 query 或拆分查询，再决定是否重试，不要立刻改走 `Fetch` 假装补救。',
      ];

      if (compareNeedsCurrentSources) {
        lines.push('这是依赖当前外部信息的对比：先拆成多次短 `WebSearch` 获取真实来源，再给一句判断、紧凑对比表和结论。');
      }

      if (!requestProfile?.currentInfo) {
        return lines;
      }

      const { mode } = resolveWebSearchGuidanceState(sessionContext, {
        retryRequested: requestProfile?.webSearchRetry,
      });

      if (['available', 'proxy-conditional', 'generic'].includes(mode)) {
        return [...lines, ...queryHygieneLines];
      }
      if (mode === 'proxy-probe') {
        return [
          ...lines,
          '按 current-info 路径处理：当前代理链路刚满足恢复条件，可做一次探测性 `WebSearch`；只有拿到真实搜索条目或来源时才按联网成功处理。',
          ...queryHygieneLines,
        ];
      }
      if (mode === 'proxy-cooldown') {
        return [
          ...lines,
          '按 current-info 路径处理：当前代理链路最近连续返回 `Did 0 searches` 或错误；先说明联网边界，不要在同一条件下机械重试。',
          ...queryHygieneLines,
        ];
      }
      if (mode === 'not-exposed') {
        return [
          ...lines,
          '按 current-info 路径处理：当前没有看到可用的原生联网搜索面，不要把记忆包装成实时结果。',
        ];
      }

      return [
        ...lines,
        '按 current-info 路径处理：当前链路是否真正提供 `WebSearch` 仍不确定；只有拿到真实来源后才按联网结果回答。',
        ...queryHygieneLines,
      ];
    },
    snapshot(sessionContext, requestProfile) {
      return {
        id: 'websearch',
        available: sessionContext?.webSearchAvailable || undefined,
        current_info_request: requestProfile?.currentInfo || undefined,
      };
    },
  },
  {
    id: 'ask-user-question',
    title: 'AskUserQuestion',
    available(sessionContext) {
      return Boolean(sessionContext?.askUserQuestionAvailable);
    },
    sessionLines() {
      return [
        '- `AskUserQuestion` 只用于真实阻塞选择或关键信息缺失；不要把“继续吗”“计划行不行”这类弱确认塞进去。',
      ];
    },
    routeLines(requestProfile) {
      if (!requestNeedsDecisionHelp(requestProfile)) {
        return [];
      }

      return [
        '如果执行过程中只被一个真实用户选择阻塞，优先 `AskUserQuestion` 发起结构化选择，不要把确认埋在长段落里。',
      ];
    },
    snapshot() {
      return {
        id: 'ask-user-question',
        tool: 'AskUserQuestion',
        use_only_for_real_blockers: true,
      };
    },
  },
];
