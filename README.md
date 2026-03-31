# hello2cc

`hello2cc` 是一个面向 Claude Code 的**静默型、native-first、capability-aware** 插件。

它不负责 provider、gateway、模型映射或账号权限；它负责的是：**当你已经把第三方模型接入 Claude Code 之后，让这些模型尽量像原生 Opus / Sonnet 一样使用 Claude Code。**

当前版本：`0.2.2`

---

## 这个插件解决什么问题

如果你已经通过下面任一方式把第三方模型接进了 Claude Code：

- `ccswitch`
- provider profile / gateway
- 原生模型槽位映射
- 第三方 API 代理

那么 `hello2cc` 解决的是下一层问题：

> 如何让第三方模型在 Claude Code 里更像原生模型那样：
>
> - 主动发现并使用原生工具
> - 更自然地走 `ToolSearch`
> - 更自然地走 `EnterPlanMode()` / `Task*`
> - 更自然地走 `Explore` / `Plan` / `General-Purpose` / `Claude Code Guide`
> - 更自然地走并行原生 `Agent` / `SendMessage` / `TaskStop`
> - 只在真正需要时才走 `TeamCreate` / `TeamDelete`
> - 更自然地使用 `AskUserQuestion`
> - 更自然地优先 MCP / connected tools / `ListMcpResources` / `ReadMcpResource`
> - 输出更接近 Claude Code 原生的简洁、结构化、行动优先风格

---

## 0.2.2 的核心方向

`0.2.2` 的重点是在保持 capability-aware、native-first 的同时，进一步把多代理行为拉回 Claude Code 更原生的 worker 协调方式：

- **能力感知优先**：先看当前会话真实暴露了哪些工具和 agent
- **状态感知优先**：尽量依赖会话上下文、任务状态、团队状态，而不是靠大段关键词猜意图
- **结构化优先**：能靠任务结构、资源结构、验证证据结构判断的，就少靠自然语言词表
- **静默增强**：尽量不打断用户现有工作流，不额外引入 skills，不要求手动加载
- **规则让位**：用户消息、Claude Code 宿主规则、`CLAUDE.md` / `AGENTS.md` / 项目规则，始终高于 hello2cc
- **格式不接管**：如果你的工作流要求顶部信息栏、底部操作栏、固定格式或特殊命令路由，hello2cc 不应覆盖它们
- **并行优先回归原生**：普通多线任务默认优先并行启动多个原生 `Agent` worker，而不是先把所有事情都推成 `TeamCreate`
- **结果回传更原生**：普通 worker 默认等待完成通知回传，不把 `TaskOutput` 当成默认轮询方式

这能明显降低：

- 语言切换导致的误判
- 模糊关键词导致的误触发
- 多代理结果回传不顺导致的错误调用
- 对其他 Claude Code 工作流的干扰

---

## 你装上以后，会得到什么

| 能力方向 | hello2cc 做什么 |
|---|---|
| 原生工具发现 | 优先引导第三方模型发现和使用 Claude Code 原生工具 |
| `ToolSearch` | 可用时主动优先用；不可用时明确提示宿主/网关门控原因 |
| 规划与任务 | 复杂任务优先 `EnterPlanMode()`；只有明确需要任务盘时再走 `TaskCreate` / `TaskList` / `TaskUpdate` / `TaskGet`；如果当前没有 `Task*` 但有 `TodoWrite`，自动退回 `TodoWrite` |
| 原生 agent | 更自然地使用 `Explore` / `Plan` / `General-Purpose` / `Claude Code Guide` |
| 多代理协作 | 普通多线任务优先并行原生 `Agent`；续派优先 `SendMessage`，跑偏时用 `TaskStop`；只有显式团队编排需求时再用 `TeamCreate` / `TeamDelete` |
| 用户交互 | 当执行只被一个真实选择阻塞时，更自然地用 `AskUserQuestion` |
| MCP / connected tools | 优先 `ListMcpResources` / `ReadMcpResource` 与原生 MCP 工具，而不是先上网搜索 |
| 输出风格 | 默认更接近 Claude Code 的简洁、结构化、行动优先输出；如无更高优先级格式约束，优先 Markdown 表格而不是强推 ASCII |
| 模型一致性 | 仅在必要时让 `Claude Code Guide` / `Explore` 与当前会话模型保持一致，避免子代理走偏 |

---

## 它不会做什么

`hello2cc` **不会**：

- 接管你的 provider / gateway / 模型槽位映射
- 替你强行开启宿主没有暴露的 `ToolSearch`
- 覆盖你已经显式传入的 `model`
- 让 Claude Code 进入另一套“插件专属工作流”
- 修改你的用户级持久化 `settings.json`
- 覆盖 `CLAUDE.md` / `AGENTS.md` / 项目规则里已经定义的输出格式、命令路由或包装约定

也就是说，它追求的是：

**在不破坏 Claude Code 原生使用方式的前提下，静默增强第三方模型的原生感。**

---

## 为什么它尽量不影响其他工作流

`hello2cc` 的默认策略是保守的：

- 默认主线程 agent 只是插件层默认值，不会锁死更高优先级设置
- 仅对必要的原生 `Agent` 路径做最小模型修正
- 当前会话真实没暴露某项能力时，不会假装那项能力存在
- `force-for-plugin` output style 跟随插件启用状态，不污染用户全局设置
- 如果用户、仓库或 `CLAUDE.md` 已经规定了输出结构，hello2cc 会让位而不是重写格式
- 插件禁用后，原生会话会回到 Claude Code 默认路径

如果你在 Claude Code 里：

- 切换模型
- 替换 settings
- 切换回原生模型
- 使用其他插件或其他正常工作流

`hello2cc` 的目标都是：**尽量不打扰。**

---

## 安装

### 1）添加本地 marketplace

```text
/plugin marketplace add /absolute/path/to/hello2cc
```

### 2）安装或升级插件

```text
/plugin install hello2cc@hello2cc-local
```

### 3）新开会话后直接使用

安装后不需要再加载 skills，也不需要手动切换 output style。

默认会发生：

- 主线程默认进入 hello2cc 的 native-first 工作方式
- 插件 output style 自动生效
- 第三方模型会更自然地优先原生工具、原生 agent、原生计划流程与原生 worker 协调方式
- `Claude Code Guide` / `Explore` 这类必要路径会尽量跟随当前会话模型

---

## 推荐使用方式

### 场景 A：你已经用 `ccswitch` 或网关把第三方模型映射到 Claude Code 原生槽位

这是最推荐的方式。

此时建议：

- `mirror_session_model = true`
- 其余模型覆盖项都留空

效果：

- 主线程沿用当前会话模型槽位
- 必要时 `Claude Code Guide` / `Explore` 跟随当前会话模型
- `Plan` / `General-Purpose` / 自定义 agent 尽量保留 Claude Code 原生 inherit 行为

### 场景 B：你只想修正 Guide / Explore，不想动其他 agent

建议：

- `mirror_session_model = true`
- `guide_model` / `explore_model` 按需填写
- 其他覆盖项留空

### 场景 C：你要强制某些原生 agent 固定走某个模型

例如：

- `guide_model = cc-gpt-5.4`
- `explore_model = cc-gpt-5.3-codex-medium`

或：

- `general_model = opus`
- `team_model = opus`

只有在你明确要覆盖宿主 inherit 时才建议这样做。

### 场景 D：你通过第三方 gateway 使用 Claude Code，并希望尽量保住 `ToolSearch`

建议同时满足：

- `ENABLE_TOOL_SEARCH=true`
- 网关支持并透传 `tool_reference`
- 网关支持并透传 Claude Code 所需 beta headers

hello2cc 会在会话里优先引导第三方模型主动使用 `ToolSearch`，但如果宿主没有真正暴露 `ToolSearch`，插件不会假装它存在。

---

## 配置项

| 配置键 | 默认行为 | 说明 |
|---|---|---|
| `routing_policy` | `native-inject` | `native-inject` 会在必要路径静默补 `Agent.model`；`prompt-only` 只做行为引导，不改工具输入 |
| `mirror_session_model` | `true` | 优先镜像当前会话模型别名 |
| `primary_model` | 空 | 高能力原生 agent 的显式模型；为空时优先跟随当前会话 |
| `subagent_model` | 空 | 为未显式设模的原生 agent / teammate 指定统一模型；为空时尽量保留原生 inherit |
| `guide_model` | 空 | `Claude Code Guide` 的显式模型 |
| `explore_model` | 空 | `Explore` 的显式模型 |
| `plan_model` | 空 | 仅当你想强制覆盖 `Plan` 时填写 |
| `general_model` | 空 | 仅当你想强制覆盖 `General-Purpose` 时填写 |
| `team_model` | 空 | 仅当你想强制覆盖带 `team_name` 的 teammate 时填写 |

---

## hello2cc 现在优先怎么判断该用什么能力

优先级大致是：

1. **当前会话真实暴露了哪些工具 / agent**
2. **当前是否已经存在 task / team / teammate 状态**
3. **当前任务是否明显属于复杂、多步、多轨、需验证**
4. **用户是否显式提到了 Claude Code 原生功能名**
5. **最后才是少量高精度关键词辅助**

也就是说，hello2cc 当前已经尽量避免把“关键词命中”当成主控制逻辑。

---

## 边界说明

如果你的目标是“第三方模型在 Claude Code 下尽可能接近原生 Opus”，那么 hello2cc 已经会把差距尽量压小。

但它仍然不是字节级复制，边界主要来自：

- 第三方模型本身与原生 Claude 模型的能力差异
- gateway / provider 对工具协议、`tool_reference`、beta headers 的兼容程度
- Claude Code 宿主内部未对插件开放的部分

所以它的目标不是：

- **100% 复制原生模型的所有内部行为**

而是：

- **在插件层可控范围内，尽可能让第三方模型获得接近原生的 Claude Code 使用体验。**

---

## 本地验证

```bash
npm run validate
npm test
npm run check
npm run test:real
```

说明：

- `npm run validate`：校验 manifest、hooks、settings、output style 和脚本结构
- `npm test`：运行单元测试
- `npm run check`：组合执行 `validate + test`
- `npm run test:real`：调用本机 Claude Code CLI 做真实会话回归

如果真实回归失败，请优先检查：

- 当前模型别名是否有效
- 当前账号是否有该模型权限
- 当前 gateway / provider 是否正确透传工具协议

---

## 发布

hello2cc 已配置 npm 自动发布工作流：

- 推送 `v*` tag 自动发布
- 支持手动 `workflow_dispatch`
- 发布前自动执行 `npm run check`
- 发布前自动执行 `npm pack --dry-run`
- 发布后自动创建或更新对应 GitHub Release

---

## 许可证

Apache-2.0
