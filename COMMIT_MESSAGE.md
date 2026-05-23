# Commit Message

## English

release: 0.5.11 beta

- relax task completion lifecycle checks so `TaskCompleted` and `TaskUpdate(status=completed)` no longer hard-block legitimate completion-state sync
- support the Claude Code `Task` to `Agent` rename across hooks, capability detection, session continuity, and real-session regression coverage
- tighten capability and explanation routing so subagent or tool-comparison prompts stop escalating into accidental team or task-board demos
- strengthen response-discipline defaults to reduce over-planning, forced confirmations, meta narration, jargon-heavy wording, and invitation-style endings
- improve `ccstatusline` transcript usage backfill by accepting `agentId` / `agent_id` / `agent.id`, direct subagent transcript paths, and context-window inference for common 1M model aliases
- align subagent identity readers with the same camelCase / snake_case / nested payload variants to avoid adjacent compatibility gaps

## 中文

release: 0.5.11 beta

- 放宽任务完成态生命周期校验，让 `TaskCompleted` 和 `TaskUpdate(status=completed)` 不再因为描述过薄而硬拦截真实 completed 同步
- 兼容 Claude Code 中 `Task` 到 `Agent` 的工具更名，覆盖 hooks、能力识别、session continuity 与真实会话回归
- 收紧 capability / explain 路由，避免 subagent 或工具对比类问题被误升级成真实 team / task-board 演示
- 收紧默认回复纪律，减少过度规划、强制确认、元叙述、黑话表达和邀约式结尾
- 增强 `ccstatusline` transcript usage 回填，兼容 `agentId` / `agent_id` / `agent.id`、direct subagent transcript path，以及常见 1M 模型别名的上下文窗口推断
- 让 subagent 身份读取器同步兼容 camelCase / snake_case / nested 载荷，避免相邻链路继续出现同类兼容缺口
