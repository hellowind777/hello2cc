# hello2cc

`hello2cc` 是一个面向 Claude Code 的静默型、native-first 插件。

它不负责 provider、gateway、账号权限或模型接入；它负责的是：

**当你已经把外部模型接进 Claude Code 后，让它更像原生 Claude Code 一样使用工具、Agent、计划、任务、MCP 和团队能力。**

当前版本：`0.2.7`

---

## 一句话理解

如果你已经通过以下任一方式把模型接进 Claude Code：

- CCSwitch
- provider profile
- API gateway
- 原生槽位映射

那么 `hello2cc` 解决的是下一层问题：

> **如何让这个模型在 Claude Code 里更自然地工作，而不是只“能连上”。**

---

## 它能带来什么

| 方向 | 你能感受到的变化 |
|---|---|
| 原生工具使用 | 更主动使用 Claude Code 原生工具，而不是总想绕去别的路径 |
| ToolSearch | 更自然地把 `ToolSearch` 作为能力确认入口 |
| 规划与任务 | 非 trivial 任务更倾向先进入 `EnterPlanMode()`；只有真的需要任务盘时再使用 `Task*` |
| 原生 Agent | 更自然地调用 `Explore`、`Plan`、`General-Purpose`、`Claude Code Guide` |
| 多 worker 协作 | 普通并行任务优先并行多个原生 `Agent` worker，而不是轻易误进 team |
| TeamCreate | 只有明确需要团队编排时才使用 `TeamCreate` / `TeamDelete` |
| 用户交互 | 单一真实决策阻塞时，更自然地使用 `AskUserQuestion` |
| MCP / connected tools | 更自然地优先 `ListMcpResources` / `ReadMcpResource` 与原生 MCP 路径 |
| 输出风格 | 更接近 Claude Code 原生的简洁、行动优先、结构化表达 |
| 语言跟随 | 中文会话更倾向持续中文输出，减少无故切到英文和元叙述 |

---

## 适合谁

如果你符合下面任一场景，`hello2cc` 会比较有价值：

- 你已经把外部模型映射进 Claude Code 的 `opus / sonnet / haiku` 体系
- 你希望模型更主动地用原生工具、计划、Agent 和 MCP
- 你不想每轮手动加载 skills
- 你希望普通对话不要误触发 agent team
- 你希望中文会话尽量保持中文输出
- 你希望插件尽量安静，不强行改写你现有工作流

---

## 它不做什么

`hello2cc` 不会：

- 接管你的 provider / gateway / CCSwitch 配置
- 替宿主打开本来不存在的能力
- 覆盖你已经显式传入的 `model`
- 接管 CCSwitch 的 `Thinking` / 推理模型映射
- 强迫你进入一套插件专属工作流
- 覆盖高优先级的 `CLAUDE.md` / `AGENTS.md` / 项目规则 / 用户明确要求

它追求的是：

**静默增强原生感，而不是接管 Claude Code。**

---

## 快速开始

### 1. 添加本地 marketplace

```bash
claude plugin marketplace add "D:\GitHub\dev\hello2cc"
```

### 2. 安装插件

```bash
claude plugin install hello2cc@hello2cc-local
```

### 3. 重新打开 Claude Code 会话

安装后通常不需要手动切 output style，也不需要再加载任何额外入口。

默认会自动生效的内容：

- 主线程使用 `hello2cc:native`
- 插件输出风格自动启用
- 优先原生工具、原生 Agent、原生计划 / 任务路径
- 关键 Agent 路径尽量保持与当前会话模型语义一致

---

## 重装 / 清缓存 / 升级

如果你修改了本地仓库，或者想彻底清理旧版本缓存，推荐顺序：

### 1. 卸载旧插件

```bash
claude plugin uninstall --scope user hello2cc@hello2cc-local
```

### 2. 移除旧 marketplace（可选但推荐）

```bash
claude plugin marketplace remove hello2cc-local
```

### 3. 重新添加 marketplace

```bash
claude plugin marketplace add "D:\GitHub\dev\hello2cc"
```

### 4. 重新安装

```bash
claude plugin install hello2cc@hello2cc-local
```

### 5. 建议重开会话

如果你刚更新了仓库内容，建议：

- 重新打开 Claude Code
- 或执行 `/reload`

这样更容易拿到最新缓存内容。

---

## 与 CCSwitch 配合的推荐方式

这是最推荐的组合：

### CCSwitch 负责

- 主模型
- 推理模型（Thinking）
- `Haiku 默认模型`
- `Sonnet 默认模型`
- `Opus 默认模型`

### hello2cc 负责

- 原生工具 / Agent / 计划 / 任务 / MCP 使用习惯
- `Agent.model` 的宿主安全槽位处理
- 普通 worker 与 team workflow 的边界净化
- worktree 使用边界
- 与其他 orchestration 插件的兼容模式

### 最佳实践

如果你想让 Opus 家族最终落到 `opus(1M)`：

- 在 **CCSwitch** 里把 **Opus 默认模型** 配成 `opus(1M)`
- 在 **hello2cc** 里继续使用 `opus`

也就是说：

- hello2cc 只负责写宿主安全槽位
- CCSwitch 决定这个槽位最终映射到哪个实际模型

---

## 推荐配置方案

### 方案 A：最省心

适合：你已经用 CCSwitch / gateway 把模型映射好了，只想让行为更接近原生。

建议：

- `mirror_session_model = true`
- 其他模型覆盖项尽量留空

效果：

- 主线程跟随当前会话模型语义
- `Claude Code Guide` / `Explore` 等关键路径必要时跟随当前会话语义
- `Plan` / `General-Purpose` 等路径尽量保留原生习惯

### 方案 B：只修正少数 Agent

适合：你只想调整某几个 Agent 的默认槽位。

建议：

- `mirror_session_model = true`
- 按需填写 `guide_model`、`explore_model`、`general_model`、`team_model`
- 其他覆盖项留空

### 方案 C：统一设一个默认 Agent 模型

适合：你想让多数 Agent 都稳定落到某个家族槽位。

例如：

- `default_agent_model = opus`

或者：

- `default_agent_model = inherit`

---

## 配置项说明

| 配置键 | 默认行为 | 说明 |
|---|---|---|
| `routing_policy` | `native-inject` | `native-inject` 会在需要时静默补 `Agent.model`；`prompt-only` 只做行为引导，不改工具输入 |
| `mirror_session_model` | `true` | 优先镜像当前会话模型语义 |
| `default_agent_model` | 空 | 原生 Agent 的统一默认模型偏好；推荐填写 `inherit / opus / sonnet / haiku` |
| `primary_model` | 空 | 高能力原生 Agent 的显式槽位 |
| `subagent_model` | 空 | 为未显式设模的原生 Agent 提供统一槽位 |
| `guide_model` | 空 | `Claude Code Guide` 的显式槽位 |
| `explore_model` | 空 | `Explore` 的显式槽位 |
| `plan_model` | 空 | `Plan` 的显式槽位 |
| `general_model` | 空 | `General-Purpose` 的显式槽位 |
| `team_model` | 空 | 真实 team teammate 的显式槽位 |
| `compatibility_mode` | `full` | 与其他 orchestration 插件冲突时可切到 `sanitize-only`，只保留参数净化 |

---

## 关于 `opus(1M)` 的正确理解

`hello2cc` 推荐你直接填写 Claude Code 宿主安全槽位：

- `inherit`
- `opus`
- `sonnet`
- `haiku`

如果你兼容性地填写了：

- `opus(1M)`

`hello2cc` 会在真正写入 `Agent.model` 时自动归一化为：

- `opus`

也就是说：

- **hello2cc 可以识别 `opus(1M)`**
- **但不会把 `opus(1M)` 原样写进 `Agent.model`**

真正的 `opus -> opus(1M)` 落点，应该继续交给 CCSwitch 的 **Opus 默认模型** 去处理。

---

## 关于 worktree 的行为

`hello2cc` 当前的策略是：

- **只有用户明确要求 worktree / 隔离工作区时**，才保留 `worktree` 相关路径
- 普通并行 worker 不再默认误带 `worktree`

这能减少并发 subagent 时出现：

- worktree 创建失败
- `.git/config.lock` 竞争
- UI 显示 `0 tool uses` 但其实 agent 没真正开始工作

---

## 关于与其他插件共存

如果你同时启用了 OMC 或其他也会大量注入 hooks / system-reminder 的插件，建议尝试：

```json
{
  "compatibility_mode": "sanitize-only"
}
```

启用后：

- 保留 `model / team / isolation` 这类参数净化
- 不再继续注入 `SessionStart / UserPromptSubmit / SubagentStart` 的额外上下文

这更适合多插件并存环境。

---

## 常见问题

### 安装后还需要手动切 output style 吗？

通常不需要。

### hello2cc 要不要接管 CCSwitch 的 Thinking 模型？

不建议。

`Thinking` 更适合继续由 CCSwitch / 主线程模型配置负责；hello2cc 只处理原生 Agent 行为层。

### 可以直接把第三方别名写进 hello2cc 吗？

不推荐。

更推荐：

- 在 CCSwitch / provider / gateway 层处理实际模型映射
- 在 hello2cc 里只写 Claude Code 宿主安全槽位

### 普通并行任务为什么不推荐默认走 team？

因为普通 worker 和持久 team 是两种不同语义。

普通并行任务更适合：

- 多个原生 `Agent` worker 并行
- 完成后回传结果

而不是一上来就进入 `TeamCreate`

### 会不会影响已有项目规则？

设计目标是不影响。

只要更高优先级规则已经定义了格式、流程、命令路由或输出习惯，hello2cc 会尽量让位。

---

## 本地验证

```bash
npm run validate
npm test
npm run check
npm run test:real
```

说明：

- `npm run validate`：校验 manifest、hooks、settings、脚本结构
- `npm test`：运行自动化测试
- `npm run check`：组合执行 `validate + test`
- `npm run test:real`：调用本机 Claude Code CLI 做真实回归

---

## 许可证

Apache-2.0
