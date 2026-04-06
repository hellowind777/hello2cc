# hello2cc

[![npm version](https://img.shields.io/npm/v/hello2cc.svg)](https://www.npmjs.com/package/hello2cc)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)
[![Publish](https://img.shields.io/github/actions/workflow/status/hellowind777/hello2cc/publish.yml?label=publish)](https://github.com/hellowind777/hello2cc/actions/workflows/publish.yml)

让第三方模型在 Claude Code 里用得更自然。

`hello2cc` 不负责替你接入模型、管理网关、配置账号权限。  
它解决的是另一层问题：

> 当你已经通过 **CCSwitch** 或其他映射方式把 GPT、Kimi、DeepSeek、Gemini、Qwen 等第三方模型接进 Claude Code 后，`hello2cc` 帮它们更容易发现并正确使用当前会话里已经可用的能力。

**语言：** [English](./README.md) | 简体中文

---

## 🆕 0.4.4 相对 0.4.3 的变化

这次版本重点不是安装层面的修补，而是运行时行为更贴近原生 Claude Code：

| 0.4.4 变化 | 你更容易感受到的结果 |
|---|---|
| 更贴近 Claude Code 原生能力策略流 | 第三方模型会更多地在宿主已定义的能力边界内做选择，而不是自己发散重建流程 |
| 与语言无关的意图判断更强 | 不再更依赖某些固定措辞或关键词命中 |
| 团队 / task board 连续体更完整 | 持续协作任务更容易维持真实的 team + task board 路径 |
| subagent 上下文更轻 | team/subagent 场景下更不容易给 Claude Code UI 带来额外重绘压力 |

---

## 🎯 为什么使用 hello2cc

| 常见问题 | hello2cc 的改善 |
|---|---|
| 明明已有 skill 或 workflow，模型却反复重写流程 | 更倾向续用已 surfaced 或已加载的流程 |
| 明明 MCP resource 或工具已经可直接调用，模型却还在绕路 | 更容易优先走当前会话里已经可用的能力 |
| 普通并行 worker 被误判成 team / teammate 语义 | 减少可避免的 agent 路由错误 |
| 模型能回答，但不会选合适的 Claude Code 能力入口 | 让工具、agent、workflow、MCP 的使用更自然 |
| 模型过度依赖固定措辞或关键词提示 | 更倾向根据真实意图，在 Claude Code 已暴露能力边界内做选择 |
| 多个插件同时启用，提示互相打架 | 提供更安静的兼容模式 |
| 对话里元叙述过多 | 更接近简洁、行动优先的原生风格 |

---

## ✅ 适合谁 / ❌ 不适合谁

### ✅ 适合谁

- 你已经通过 **CCSwitch** 或其他映射层把第三方模型接进 Claude Code
- 你希望这些模型更像原生 Claude Code 会话那样工作
- 你本地已经装了 skills、workflows、MCP 或插件，希望它们更容易被用到
- 你希望并行 agent 更容易走对路径

### ❌ 不适合谁

- 还没完成 provider、账号、API key 或网关接入的人
- 希望插件替 Claude Code 打开原本不存在的工具的人
- 想用它替代 **CCSwitch** 的人
- 想让它覆盖 `CLAUDE.md`、`AGENTS.md` 或用户明确要求的人

---

## 📊 一眼看懂

| 项目 | 数值 |
|---|---|
| 安装流程 | 3 步 |
| 安装后额外入口命令 | 0 |
| 常见配置方案 | 3 种 |
| 核心目标 | 1 个 —— 让第三方模型更自然地使用 Claude Code |

---

## ✨ 它主要帮助什么

<table>
<tr>
<td width="50%">

### Skills 与 workflows

当流程已经出现或已经开始时，更容易沿着现有流程继续，而不是重新来一遍。

</td>
<td width="50%">

### Tools 与 MCP

更倾向优先使用当前会话里已经可见、已经可用的能力。

</td>
</tr>
<tr>
<td width="50%">

### Agents 与 teams

一次性并行任务更容易保留普通 agent 路径，持续协作任务更容易走真实的 team + task board 路径。

</td>
<td width="50%">

### 对话体验

减少不必要的元叙述和可避免的路由错误。

</td>
</tr>
</table>

---

## 🚀 快速开始

### 1）克隆仓库

```bash
git clone https://github.com/hellowind777/hello2cc.git
cd hello2cc
```

### 2）添加本地 marketplace

```bash
claude plugins marketplace add "<repo-path>"
```

把 `<repo-path>` 替换成你本地 `hello2cc` 仓库路径。

### 3）安装插件

```bash
claude plugins install hello2cc@hello2cc-local
```

然后重开 Claude Code，或执行 `/reload-plugins`。

### 你会看到什么

- 不需要再额外输入特殊入口命令
- 第三方模型更容易直接使用当前会话已暴露的能力
- 普通并行 agent 更不容易误走错误路径
- team/subagent 场景更不容易因为注入上下文过重而放大 UI 重绘问题

---

## 🔧 推荐配置

### 方案 A：尽量保持默认

适合：你的模型映射已经由 **CCSwitch** 处理，只想让行为更顺一点。

```json
{
  "mirror_session_model": true
}
```

### 方案 B：为 agent 固定一个默认 Claude 槽位

适合：你希望大多数 agent 默认走同一个 Claude 槽位。

```json
{
  "mirror_session_model": true,
  "default_agent_model": "opus"
}
```

如果真实模型落点由 **CCSwitch** 控制，就继续把真实映射放在 CCSwitch 里。  
在 `hello2cc` 里优先使用稳定的 Claude 槽位值，例如 `inherit`、`opus`、`sonnet`、`haiku`。

### 方案 C：和其他插件安静共存

适合：多个插件一起注入提示，导致会话太吵。

```json
{
  "compatibility_mode": "sanitize-only"
}
```

### 0.4.4 特别加强了什么

- 更贴近 Claude Code 原生“宿主先定边界，模型在边界内做语义选择”的工作方式
- 让能力选择更少依赖固定关键词，更依赖真实意图
- 更清楚地区分普通 worker 与真实团队协作路径
- 压缩 subagent 上下文，降低 team-heavy 场景的额外 UI 压力

---

## 🔧 它如何融入你的日常使用

```mermaid
flowchart LR
    A[第三方模型已接入 Claude Code] --> B[像平常一样打开 Claude Code 会话]
    B --> C[当前会话暴露工具、agent、skills、workflows 或 MCP]
    C --> D[hello2cc 帮模型更自然地选择路径]
    D --> E[减少绕路和错误路由]

    style A fill:#e3f2fd
    style B fill:#e3f2fd
    style C fill:#fff3e0
    style D fill:#e8f5e9
    style E fill:#4caf50,color:#fff
```

---

## 🛠️ 重装 / 升级

如果你修改了本地仓库，或者想完整重装：

```bash
claude plugins uninstall --scope user hello2cc@hello2cc-local
claude plugins marketplace remove hello2cc-local
claude plugins marketplace add "<repo-path>"
claude plugins install hello2cc@hello2cc-local
```

然后重开 Claude Code，或执行 `/reload-plugins`。

---

## 🛠️ 排错

### 安装后感觉没生效

按这个顺序检查：

1. 重开 Claude Code 或执行 `/reload-plugins`
2. 确认插件已安装并启用
3. 如果你是从本地仓库升级，先完整重装一次

### 模型还是没有使用你想要的 skill、工具或 MCP

先确认：

1. 该能力当前确实已经在会话里暴露出来
2. 更高优先级的项目规则或用户指令没有限制它
3. 你是在延续同一个流程，而不是换了一条完全不同的路径

### 多个插件一起启用时感觉很乱

可以使用：

```json
{
  "compatibility_mode": "sanitize-only"
}
```

如果你在插件配置界面里一时没看到它：

1. 查找名为 `Compatibility Mode` 的字段
2. 升级或重装到最新本地版本
3. 在旧版本里继续翻后面的分页字段，因为它之前排在表单较后位置

### 仍然遇到 `summary is required when message is a string`

请升级到最新版本，重新加载会话，必要时重装插件。  
新版本已为纯文本 `SendMessage` 增加兼容处理。

### team 或 subagent 场景里界面显得更容易重绘

请升级到 `0.4.4` 后重新加载插件。  
这个版本已经压缩 subagent 注入上下文，重点缓解 team-heavy 场景下对 Claude Code UI 的额外压力。

---

## ❓ 常见问题

<details>
<summary><strong>hello2cc 会替代 CCSwitch 吗？</strong></summary>

不会。模型映射继续交给 CCSwitch；hello2cc 关注的是模型已经进入 Claude Code 之后的行为。

</details>

<details>
<summary><strong>它会替我打开 Claude Code 原本没有暴露的工具吗？</strong></summary>

不会。它只能帮助模型更好地使用当前会话已经可用的能力。

</details>

<details>
<summary><strong>安装后还需要手动切 output style 吗？</strong></summary>

通常不需要。安装完成后一般可以直接用。

</details>

<details>
<summary><strong>它会阻止我现有的 skills、插件或 MCP 吗？</strong></summary>

不会。目标恰恰相反：让第三方模型更容易发现并使用这些现有能力。

</details>

<details>
<summary><strong>是不是所有多 agent 任务都会变成 team？</strong></summary>

不会。一次性的并行任务可以继续走普通 agent；更持续的协作型任务才更容易进入团队路径。

</details>

<details>
<summary><strong>我一定要设置默认 agent 模型吗？</strong></summary>

不一定。只有当你希望多数 agent 默认固定到同一个 Claude 槽位时，才建议额外设置。

</details>

<details>
<summary><strong>什么时候建议使用 <code>sanitize-only</code>？</strong></summary>

当多个插件同时工作、你希望 hello2cc 保持更安静，只保留关键兼容修正时，就适合用它。

</details>

---

## 📞 支持

- Issues：https://github.com/hellowind777/hello2cc/issues
- Releases：https://github.com/hellowind777/hello2cc/releases

---

## 📜 许可证

Apache-2.0
