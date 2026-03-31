# hello2cc

`hello2cc` 是一个面向 Claude Code 的 **skill-free、native-first** 插件。

它不负责 provider 绑定，也不重造一套“插件 + skills + 伪代理”的替代工作流；它只做一件事：

**让已经通过 `ccswitch`、provider profile、网关映射或模型别名方式接入 Claude Code 的第三方大模型，在 Claude Code 里尽可能接近原生 `Opus / Sonnet` 的使用体验。**

从 `0.0.6` 开始，`hello2cc` 重点聚焦四件事：

- 主会话模型别名镜像到原生 `Agent` / `TeamCreate`
- 原生优先的工具、计划、子代理、团队路由
- 子代理与任务完成质量护栏
- 安装后默认静默引导、可选自动写入持久化 `outputStyle`

## 目标

`hello2cc` 要解决的问题不是“如何把第三方模型接入 Claude Code”。

那一层应该继续交给：

- `ccswitch`
- provider profile
- 模型网关
- 原生槽位映射

`hello2cc` 解决的是下一层：

> 当第三方模型已经能被 Claude Code 正常调用后，如何让它们更像原生模型一样主动发现能力、优先走 `ToolSearch`、使用 `Plan`、调用原生 `Agent` / `TeamCreate` / `Task*`，并保持更贴近原生的输出与编排风格。

## 设计原则

- **Provider 无关**：不绑定任何第三方 API、网关或厂商
- **原生优先**：优先使用 Claude Code 内建能力，而不是技能包或文本模拟流程
- **静默运行**：安装后即可工作，不依赖每次任务前手动加载 skills
- **低侵入**：只在原生 hooks、原生 Agent 调用和少量持久配置上增强
- **可安全切换**：切回 Claude 原生模型，或切换新的第三方映射方案时，不需要重写插件

## 核心能力

### 1）当前主模型别名镜像到原生 Agent / Team

这是 `0.0.6` 最重要的变化。

`hello2cc` 会在 `SessionStart` 读取当前 Claude Code 会话的主模型别名，并在 `PreToolUse(Agent)` 里对缺失 `model` 的原生 Agent 调用做静默补齐。

默认行为：

- 如果当前主会话模型是 `opus`，原生 `Plan` / `General-Purpose` / `Claude Code Guide` / 团队 teammate 也会优先继承 `opus`
- 如果你通过 `ccswitch` 把 `opus` 实际映射到第三方模型，子代理和团队就会继续沿着这个原生槽位工作
- 如果你显式给某个 Agent 指定了 `model`，`hello2cc` 不会覆盖
- 如果你明确配置了 `primary_model`、`general_model`、`explore_model` 等插件选项，这些显式值优先

这让 `hello2cc` 更接近“跟随当前会话原生模型行为”，而不是“插件自己硬编码一套模型名”。

### 2）原生优先路由

`hello2cc` 在 `SessionStart` 和 `UserPromptSubmit` 里建立一个很薄的 native-first 行为基线：

- 先 `ToolSearch`，再判断工具、权限、MCP、agent 类型、插件能力是否存在
- 非 trivial 工作优先 `EnterPlanMode()` 或 `TaskCreate / TaskUpdate / TaskList`
- 开放式探索优先 `Agent(Explore)` / `Agent(Plan)`
- 边界清晰的实现、修复、验证切片优先 `Agent(General-Purpose)`
- Claude Code / hooks / MCP / settings / Agent SDK / API 问题优先 `Agent(Claude Code Guide)`
- 存在并行空间时优先 `Agent` 并行，持续协作优先 `TeamCreate + Task*`
- 涉及外部系统和连接器时优先 `ToolSearch` 后走 MCP / connected tools
- 收尾前先做最贴近改动范围的验证

### 3）安装后静默引导 output style

`hello2cc` 仍然提供 `hello2cc Native` output style，但从 `0.0.6` 开始，它支持**自动引导**：

- 默认策略：`bootstrap_output_style = user-if-unset`
- 行为：在插件首次生效或升级后的第一次 `SessionStart`，如果用户级 `~/.claude/settings.json` 尚未设置 `outputStyle`，且当前项目没有更高优先级的项目级样式覆盖，插件会自动写入：

```json
{
  "outputStyle": "hello2cc Native"
}
```

注意两点：

- 当前会话启动后才写入，因此**下一个新会话**才会看到这个 output style 生效
- 如果你追求“尽量严格接近 Claude Code 默认主 system prompt”，可以把 `bootstrap_output_style` 设为 `off`

也就是说，`hello2cc` 现在支持“默认零手动”，但不再强依赖用户自己每次去 `/config` 选择一次。

### 4）更细粒度的子代理 / 团队质量护栏

为了让第三方模型不只是“能调原生 Agent”，而是更像原生模型那样**把 Agent / Team 用对、用稳、用完整**，`hello2cc` 还增加了：

- `SubagentStart`：按 `Explore` / `Plan` / `General-Purpose` 注入更贴合职责的上下文
- `SubagentStop`：拦截空泛总结，要求精确路径、结构化计划和验证证据
- `TaskCompleted`：拦截没有交付证据或完成标准的任务关闭

## 一句话架构

```text
第三方模型 API
        │
        ▼
网关 / ccswitch / provider profile / 槽位映射
        │
        ▼
Claude Code 主模型槽位（如 opus / sonnet）
        │
        ▼
hello2cc
├─ SessionStart        -> 建立 native-first 基线 + 记录当前主模型别名
├─ UserPromptSubmit    -> 注入轻量原生路由提示
├─ PreToolUse(Agent)   -> 缺失 model 时镜像当前主模型或按插件配置补齐
├─ SubagentStart       -> 内建 Explore / Plan / General-Purpose 上下文增强
├─ SubagentStop        -> 子代理输出质量护栏
├─ TaskCompleted       -> 团队任务完成证据护栏
└─ output-style boot   -> 可选自动写入持久 outputStyle
```

## 与 ccswitch / 原生槽位映射的关系

如果你已经使用 `ccswitch` 或其他映射层，把第三方模型映射到了 Claude Code 原生槽位，`hello2cc` 最合适的工作方式是：

- 你负责 **模型映射**
- Claude Code 负责 **主线程模型选择**
- `hello2cc` 负责 **让子代理、团队与路由更贴近原生行为**

### 推荐模式：让 hello2cc 跟随当前会话模型

默认情况下，`hello2cc` 会启用：

- `mirror_session_model = true`

因此如果你当前用的是：

- `/model opus`
- 或者 settings 中默认主模型就是 `opus`

那么 `hello2cc` 会优先把 `opus` 镜像给需要 `model` 的原生 Agent。

这正是最接近“像原生 Opus 一样工作”的方式。

### 如果你想手动固定某些 Agent 模型

也可以显式配置，例如：

- `explore_model = sonnet`
- `general_model = opus`
- `guide_model = opus`

这样可以把探索代理固定到更轻量的槽位，而把实现/规划代理固定到高能力槽位。

## 安装

### 1）添加本地 marketplace

```text
/plugin marketplace add /absolute/path/to/hello2cc
```

### 2）安装或升级插件

```text
/plugin install hello2cc@hello2cc-local
```

### 3）安装后会自动发生什么

安装后不需要再依赖 skills，也不需要每次任务前手动加载任何入口。

默认情况下：

- 插件会在新会话里自动建立 native-first 行为基线
- 插件会自动镜像当前主模型到原生 Agent / Team teammate
- 插件会在首次生效或升级后的第一次 `SessionStart`，尝试把 `hello2cc Native` 写入用户级 `outputStyle`

因此一般只需要：

1. 安装插件
2. 新开一个 Claude Code 会话
3. 直接开始工作

## 配置项

| 配置键 | 默认值 | 说明 |
|---|---|---|
| `routing_policy` | `native-inject` | 原生优先路由策略；`prompt-only` 时只做提示，不做 Agent.model 注入 |
| `mirror_session_model` | `true` | 缺失 `model` 的原生 Agent 是否默认镜像当前主会话模型别名 |
| `primary_model` | 空 | 显式主模型；为空时优先镜像当前会话模型，否则回退 `cc-gpt-5.4` |
| `subagent_model` | 空 | 显式子代理默认模型；为空时优先使用 `CLAUDE_CODE_SUBAGENT_MODEL`，再镜像当前会话模型 |
| `guide_model` | 空 | `Claude Code Guide` 的显式模型；为空时继承主模型 |
| `explore_model` | 空 | `Explore` 的显式模型；为空时优先镜像当前会话模型，再回退 `cc-gpt-5.3-codex-medium` |
| `plan_model` | 空 | `Plan` 的显式模型；为空时继承主模型 |
| `general_model` | 空 | `General-Purpose` 的显式模型；为空时继承主模型 |
| `team_model` | 空 | 带 `team_name` 的 teammate 默认模型；为空时继承 `subagent_model` |
| `bootstrap_output_style` | `user-if-unset` | output style 自动写入策略：`user-if-unset` / `force-user` / `off` |
| `managed_output_style` | `hello2cc Native` | 自动写入用户级 settings 的 output style 名称 |

## 推荐配置

### 配置 A：追求最接近原生 Opus 体验

适合你已经通过 `ccswitch` 或 provider 映射，把第三方模型映射到 Claude Code 原生槽位。

- `mirror_session_model = true`
- `bootstrap_output_style = off`

这样主线程和子代理都会尽量跟随当前原生模型槽位，主会话也不会被额外 output style 改写。

### 配置 B：追求更稳定的结构化输出

- `mirror_session_model = true`
- `bootstrap_output_style = user-if-unset`

这样保留当前主模型镜像，同时让插件自动把 `hello2cc Native` 设为默认输出风格。

### 配置 C：强制托管 output style

- `bootstrap_output_style = force-user`
- `managed_output_style = hello2cc Native`

适合你明确希望插件在升级后自动把用户级 `outputStyle` 重置为 `hello2cc Native`。

## 本地验证

```bash
npm run validate
npm test
npm run check
npm run test:real
```

说明：

- `npm run validate`：校验 manifest、hooks、核心脚本与 output style
- `npm test`：执行单元测试，包括路由、模型镜像、output style 自动写入、子代理与任务护栏
- `npm run check`：组合执行 `validate + test`
- `npm run test:real`：调用本机 Claude Code CLI 做真实会话回归，验证插件是否正确装载、原生工具/Agent 能力面是否暴露、插件缓存是否保持 skill-free 形态

## 当前边界

`hello2cc` 能显著拉近第三方模型与原生模型在 Claude Code 里的体验，但边界仍然存在：

- 它无法公开 Claude Code 未公开的内部 system prompt
- 它无法复刻官方模型内部隐藏策略、工具选择偏好和 provider 侧特性
- 它能增强显式 `Agent` / `TeamCreate` / `Task*` 流程，但不能保证 Claude Code 内部所有隐藏模型路径都可拦截
- output style 属于主会话 system prompt 层增强，是否启用要在“更结构化”与“更贴近默认主 prompt”之间做权衡

因此，`hello2cc` 的目标不是“字节级复刻原生 Opus”，而是：

**在不依赖 skills、不依赖每次手动加载、尽量保留 Claude Code 原生工作流的前提下，把第三方模型体验尽可能推近原生模型。**

## 版本

当前版本：`0.0.6`

## 许可证

Apache-2.0
