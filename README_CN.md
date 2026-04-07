# hello2cc

[![npm version](https://img.shields.io/npm/v/hello2cc.svg)](https://www.npmjs.com/package/hello2cc)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)
[![Publish](https://img.shields.io/github/actions/workflow/status/hellowind777/hello2cc/publish.yml?label=publish)](https://github.com/hellowind777/hello2cc/actions/workflows/publish.yml)

让第三方模型在 Claude Code 里尽量按 Opus 一样思考、运行、选工具和输出。

`hello2cc` 不负责替你接入模型、管理网关、配置账号权限。  
它解决的是另一层问题：

> 当你已经通过 **CCSwitch** 或其他映射方式把 GPT、Kimi、DeepSeek、Gemini、Qwen 等第三方模型接进 Claude Code 后，`hello2cc` 会把它们继续往 Opus-compatible 的 Claude Code 原生工作方式上推：原生能力优先级、工具/agent/team 选择、失败恢复，以及输出风格。

**语言：** [English](./README.md) | 简体中文

---

## 🆕 0.4.6 相对 0.4.5 的变化

这次补丁版重点是把 current-info、WebSearch 和多步骤执行继续往原生 Claude Code 的行为上收紧：

| 0.4.6 变化 | 你更容易感受到的结果 |
|---|---|
| current-info 搜索整形更严格 | 对比类问题更容易先发起短而真实的搜索，而不是把整段需求塞进单条 query |
| `Did 0 searches` 恢复更稳 | 空搜索或失败搜索不再更容易被误当成“已经搜到了结果” |
| task tracking 与 team 路由进一步解耦 | 复杂多步骤任务更容易先走 task tracking，只有真正需要协作时才升级到 team |
| 结构化语义信号继续增强 | 对 slash-pair 对比和结构化输入的判断更少依赖关键词命中 |

---

## 🎯 为什么使用 hello2cc

| 常见问题 | hello2cc 的改善 |
|---|---|
| 明明已有 skill 或 workflow，模型却反复重写流程 | 更倾向续用已 surfaced 或已加载的流程 |
| 明明 MCP resource 或工具已经可直接调用，模型却还在绕路 | 更容易优先走当前会话里已经可用的能力 |
| 普通并行 worker 被误判成 team / teammate 语义 | 减少可避免的 agent 路由错误 |
| 模型能回答，但不会选合适的 Claude Code 能力入口 | 把工具、agent、workflow、MCP 的选择压回 Claude Code 原生优先级 |
| 模型过度依赖固定措辞或关键词提示 | 改成在宿主公开候选内做语言无关的语义匹配 |
| 输出风格和原生 Opus 差异很大 | 强制收敛到更接近原生 Claude Code 的结果导向风格 |
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
| 常见配置方案 | 2 种 |
| 核心目标 | 1 个 —— 让第三方模型尽量按原生 Claude Code / Opus 习惯工作 |

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
- 安装插件不会再向 Claude Code 的 settings 写入 `agent=hello2cc:native`
- 插件启用状态继续由 Claude Code 自己管理，而不是由插件随包附带的 `settings.json` 决定
- 第三方模型更容易直接使用当前会话已暴露的能力
- 普通并行 agent 更不容易误走错误路径
- team/subagent 场景更不容易因为注入上下文过重而放大 UI 重绘问题

---

## 🔧 推荐配置

### 方案 A：尽量保持默认强对齐

适合：你的模型映射已经由 **CCSwitch** 处理，希望 hello2cc 直接按默认强对齐层工作。

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

### 0.4.6 特别加强了什么

- 对 current-info / 对比题先收敛成更干净的真实搜索步骤
- 当 `WebSearch` 返回 `Did 0 searches` 时更安全地恢复
- 对复杂但非 team 的任务先偏向 task tracking，再决定是否 fan-out 普通 agent
- 更少依赖关键词，更偏向结构化意图判断

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

### 禁用插件或执行 `/reload` 后，`hello2cc:native` 还显示着

这通常是 Claude Code 当前会话或历史恢复出来的 agent 状态残留，不等于插件又被重新启用了。
现在的 `hello2cc` 已不再通过插件侧 `settings.json` 强行写入 `agent=hello2cc:native`；完整重装后，新会话不会再继续产生这种默认注入。

### 模型还是没有使用你想要的 skill、工具或 MCP

先确认：

1. 该能力当前确实已经在会话里暴露出来
2. 更高优先级的项目规则或用户指令没有限制它
3. 你是在延续同一个流程，而不是换了一条完全不同的路径

### 多个插件一起启用时感觉很乱

当前版本不再提供 `sanitize-only` 这类把 hello2cc 降成轻量兼容层的模式。  
如果多个插件同时注入提示，优先保留一个主导行为对齐层；需要时禁用冲突插件或调整它们的提示，避免让多个插件同时争夺主工作流。

### 仍然遇到 `summary is required when message is a string`

请升级到最新版本，重新加载会话，必要时重装插件。  
新版本已为纯文本 `SendMessage` 增加兼容处理。

### current-info 或对比题经常搜不到结果

请升级到 `0.4.6` 后重新加载插件。  
这个版本进一步收紧了短 query 规则，并把 `Did 0 searches` 明确视为一次空搜索而不是成功结果。

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
<summary><strong>安装后会强制把当前主线程切成 <code>hello2cc:native</code> 吗？</strong></summary>

不会。插件只是提供一个可用的 native agent 选项，不再向 Claude Code 注入默认 `agent` 设置。

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
<summary><strong>现在还能把 hello2cc 切成轻量兼容模式吗？</strong></summary>

不能。当前方向是把 hello2cc 保持成默认强对齐层，而不是在需要时退回只做少量净化和兼容修正的弱模式。

</details>

---

## 📞 支持

- Issues：https://github.com/hellowind777/hello2cc/issues
- Releases：https://github.com/hellowind777/hello2cc/releases

---

## 📜 许可证

Apache-2.0
