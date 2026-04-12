# 重构 Claude Code 方案对齐审计

本审计基于本地文件进行，不依赖线上资料：

- 方案文档：`D:\GitHub\dev\hellox\docs`
- Claude Code 源码：`C:\Users\hellowind\Downloads\cc-recovered-main`
- 当前实现：`D:\GitHub\dev\hello2cc`

## 结论

- `hello2cc` 不是 `hellox` Rust workspace，不能把 `hellox-cli`、`hellox-gateway`、`hellox-tui` 等 crate 的完整落地进度计入本仓库。
- 按完整 `Hellox Rust 重构` 产品目标看，本仓库只承担插件适配层，整体产品级完成度不应按本仓库计算。
- 按 `hello2cc` 可承担的 Claude Code 插件适配职责看，当前已覆盖主要高风险面：hook lifecycle、Agent / Team / Task 参数归一、session 状态提取、subagent 上下文注入、失败防抖、`ccstatusline` transcript usage 回填。
- 当前真实待补齐项集中在边界兼容：状态线 subagent transcript 发现更稳健、对 Claude Code snake_case / camelCase 字段同时兼容、以及把“可做 / 不可做”的方案边界写清楚。

## 对照范围

| 方案能力域 | Claude Code 源码锚点 | hello2cc 当前承接方式 | 状态 |
|---|---|---|---|
| Hooks / lifecycle | `src/utils/hooks.ts`、`src/tools/TaskCreateTool`、`src/query/stopHooks.ts` | `hooks/hooks.json` + `scripts/*` | 基本完成 |
| Agent / Team / Task 语义 | `src/tools/AgentTool`、`src/utils/swarm/*`、`src/tools/Task*` | `orchestrator` pre/post tool 归一与状态记忆 | 基本完成 |
| StatusLine context usage | `src/components/StatusLine.tsx`、`src/utils/tokens.ts`、`src/utils/context.ts` | `ccstatusline-bridge` 从 transcript 回填 usage | 部分完成 |
| Session / transcript 状态 | `src/utils/sessionStorage.ts`、`src/utils/messages.ts` | transcript 解析、host-state snapshot、team continuity | 基本完成 |
| Gateway / provider adapter | `docs/HELLOX_ANTHROPIC_GATEWAY_SPEC.md` | 第三方接入层不在 hello2cc；仅保留行为提示和 statusline 回填 | 不由本仓库实现 |
| Full TUI / CLI / Rust crates | `docs/HELLOX_RUST_REFACTOR_PLAN.md` | 不属于 Claude Code 插件仓库职责 | 不由本仓库实现 |
| Hosted cloud / remote hub | `docs/HELLOX_LOCAL_FIRST_BOUNDARIES.md` | 明确不做托管云端服务 | 不做 |

## 已完成项

- Hook 覆盖：`SessionStart`、`UserPromptSubmit`、`SubagentStart`、`SubagentStop`、`TeammateIdle`、`TaskCreated`、`TaskCompleted`、`ConfigChange`、`PreToolUse`、`PostToolUse`、`PostToolUseFailure` 均已接线。
- Task lifecycle：`TaskCreated` 不再要求完成态证据；`TaskCompleted` 保留交付物与验收证据校验，当前回归测试覆盖 issue #15 形态。
- Agent / Team：普通 subagent 默认避免伪 `name` / `team_name`，仅在宿主状态证明真实 active team 后才补齐 team 语义。
- Model slot：仅向 Claude Code 原生安全槽位注入 `opus` / `sonnet` / `haiku` / `inherit`，避免把第三方模型别名写入原生 `Agent.model`。
- StatusLine 桥接：当 Claude Code status payload 中 `context_window.current_usage`、`used_percentage`、累计 token 字段为 0 时，可从 transcript usage 回填。
- Local-first 边界：不实现 hosted auth、remote hub、web console、托管 session sync；如需远端能力，只保留用户自定义接入层之外的接口边界说明。

## 仍需对齐的缺口

- `ccstatusline` 的静默自动接管：Claude Code 当前只从 settings 的 `statusLine.command` 执行命令，插件 hooks 没有 `StatusLine` 事件，插件 manifest 也不能直接覆盖用户已有 `statusLine.command`；因此无法在 hello2cc 内部做到完全静默替换第三方 statusline 命令。
- subagent token/context 统计：现有桥接可从 main transcript 中的 `agentId` 找 subagent transcript，但 Claude Code hooks 与部分结构化事件常用 `agent_id`、`agent_transcript_path`；应同时兼容 snake_case 字段和直接 transcript path。
- context window 推断：Claude Code 的 `StatusLine` 由 `getContextWindowForModel()` 计算窗口大小；当第三方接入层传入的 status payload 缺失窗口大小时，hello2cc 当前只做 200k / 1M 粗略推断，需要更贴近宿主模型命名规则。
- 审计入口：当前仓库缺少一份把 `hellox` 方案、Claude Code 源码和 `hello2cc` 插件边界放在一起的对照文档，容易把 Rust 产品目标误判成插件仓库 TODO。

## 分组实施清单

### 第一组：审计与边界收敛

- 新增本文件，记录文档 / 源码 / 当前仓库的真实对照关系。
- 明确 `hello2cc` 只承担 Claude Code 插件适配层，不承接 `hellox` Rust workspace 或云端服务。
- 将后续待做项限定为本仓库可测试、可发布、可回归的插件层缺口。
- 验收：`npm run validate` 通过。

### 第二组：StatusLine / subagent usage 兼容补强

- `collectReferencedSubagentIds()` 同时识别 `agentId`、`agent_id`、`agent.id`。
- 支持 transcript 记录里直接出现的 `agent_transcript_path`，避免只依赖 `subagents/agent-<id>.jsonl` 推断路径。
- `inferContextWindowSize()` 增强模型名识别，贴近 Claude Code `getContextWindowForModel()` 对 `[1m]`、`opus-4-6`、`sonnet-4-6`、`claude-sonnet-4` 等常见命名的判断。
- 补充回归测试，覆盖 snake_case subagent 引用和直接 transcript path。
- 验收：`npm test -- tests/ccstatusline-filter.test.mjs` 与 `npm run check` 通过。

## 不纳入本轮的事项

- 不在本仓库创建 `hellox` Rust workspace。
- 不实现 `hellox-gateway` 或 provider adapter。
- 不修改 Claude Code 或 `ccstatusline` 第三方源码。
- 不开发 hosted auth、remote hub、web console、托管云端服务。
