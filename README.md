# hello2cc

`hello2cc` is a native-first Claude Code plugin for GPT and other third-party models that already reach Claude Code through your own gateway, profile, or model mapping layer.

它不负责 provider 绑定，也不硬编码你必须使用哪家模型。
它的职责只有一件事：尽可能让映射后的第三方模型在 Claude Code 里更像原生 `Opus / Sonnet` 一样工作，优先走 Claude Code 自带的 `ToolSearch`、`Agent`、`TeamCreate`、`Task*`、验证链路与输出风格，而不是每次任务都靠手动加载 skill。

## Why hello2cc

很多“第三方模型接入 Claude Code”的方案，最终会退化成两种体验：

1. 只是在 prompt 里提醒模型“记得去用某个 skill”
2. 通过 skills / 自定义 agents 模拟工作流，但和 Claude Code 原生能力脱节

`hello2cc` 的目标不是再造一层伪代理系统，而是做一个很薄的 orchestration shim：

- 让复杂任务优先进入 Claude Code 原生计划与任务链路
- 让研究型任务优先走原生 `Claude Code Guide`、`Explore`、`Plan`
- 让并行任务优先走原生 `Agent` 或 `TeamCreate + Task*`
- 在原生 `Agent` 调用缺少 `model` 时静默注入合适模型
- 通过一次性可选的 output style，减少“每次任务前先加载 skill”的摩擦

## What it does

- Native-first routing via `SessionStart` and `UserPromptSubmit`
- Silent model injection for native `Agent` calls via `PreToolUse(Agent)`
- One-time selectable output style: `hello2cc Native`
- Optional manual skills kept as fallback entry points
- Validation and automated tests for routing and hook behavior

## Design principles

- **Provider-agnostic**: gateway / provider profile / ccswitch mapping stays outside `hello2cc`
- **Native-first**: built-in Claude Code workflows come before skills
- **Low intrusion**: only hooks that materially improve orchestration are added
- **Silent by default**: once installed and configured, most behavior is invisible
- **Safe switching**: changing Claude Code model mappings does not require rewriting the plugin

## Architecture

```text
third-party model API
        │
        ▼
gateway / provider profile / ccswitch
        │
        ▼
Claude Code model slot mapping
        │
        ▼
hello2cc
├─ SessionStart       -> native-first orchestration baseline
├─ UserPromptSubmit   -> lightweight routing hints
├─ PreToolUse(Agent)  -> silent Agent.model injection
└─ output-styles      -> one-time persistent response shape
```

## Native-first behavior

After the plugin is enabled, `hello2cc` nudges the model toward Claude Code’s built-in capabilities:

- `ToolSearch` before guessing whether a capability exists
- `EnterPlanMode()` or `TaskCreate / TaskUpdate / TaskList` for non-trivial work
- `Agent(Explore)` / `Agent(Plan)` for open-ended codebase exploration
- `Agent(claude-code-guide)` for Claude Code / Agent SDK / hooks / MCP questions
- Parallel native `Agent` calls or `TeamCreate + Task*` for multi-track work
- Narrow validation before claiming completion
- Clean ASCII tables / diagrams only when they actually help

The plugin no longer treats skills as the default execution path.
Skills remain available, but only as manual fallback tools.

## Silent model injection

The most important compatibility layer is `PreToolUse(Agent)`.

When Claude Code is about to call a native `Agent` and the tool input does not explicitly include `model`, `hello2cc` injects one according to plugin config.

### Default mapping

| Native agent target | Config key | Default |
|---|---|---|
| Primary session / high-capability fallback | `primary_model` | `cc-gpt-5.4` |
| Generic subagent fallback | `subagent_model` | `cc-gpt-5.4` |
| `Claude Code Guide` | `guide_model` | `cc-gpt-5.4` |
| `Explore` | `explore_model` | `cc-gpt-5.3-codex-medium` |
| `Plan` | `plan_model` | `cc-gpt-5.4` |
| `General-Purpose` | `general_model` | `cc-gpt-5.4` |
| Teammates with `team_name` | `team_model` | inherit `subagent_model` |

### Important behavior

- If Claude Code already passes a `model`, `hello2cc` leaves it untouched
- If you change gateway mapping or switch back to native first-party models, the plugin still works
- `hello2cc` does **not** replace Claude Code’s model configuration system
- `hello2cc` does **not** force a provider; it only fills missing `Agent.model`

This is why the plugin does not block switching back to native `Opus / Sonnet`, and does not permanently hijack your Claude Code model stack.

## Optional one-time output style

The best replacement for “load a skill every task” is not more skill routing.
It is a one-time output style selection.

`hello2cc` ships `hello2cc Native`, which keeps coding instructions and nudges the model toward:

- concise structured responses
- native Claude Code workflows
- aligned ASCII tables / diagrams when useful
- explicit validation reporting

Once selected, it keeps applying automatically in later sessions.

## Installation

### 1. Add the local marketplace

```text
/plugin marketplace add /absolute/path/to/hello2cc
```

### 2. Install the plugin

```text
/plugin install hello2cc@hello2cc-local
```

### 3. Enable the optional output style once

Use `/config` and set:

```json
{
  "outputStyle": "hello2cc Native"
}
```

After this, you do not need to load a skill before each task.

## Configuration

`hello2cc` exposes the following plugin config keys:

- `routing_policy`
- `primary_model`
- `subagent_model`
- `guide_model`
- `explore_model`
- `plan_model`
- `general_model`
- `team_model`

### Recommended policy

- `routing_policy = native-inject`

This keeps routing native-first and injects `Agent.model` only when it is missing.

### Example strategies

**Consistency first**

- `primary_model = cc-gpt-5.4`
- `subagent_model = cc-gpt-5.4`
- `guide_model = cc-gpt-5.4`
- `explore_model = cc-gpt-5.3-codex-medium`

**Cost-aware**

- `primary_model = cc-gpt-5.4`
- `subagent_model = cc-gpt-5.3-codex-medium`
- `guide_model = cc-gpt-5.4`
- `explore_model = cc-gpt-5.3-codex-medium`
- `team_model = cc-gpt-5.3-codex-medium`

## Manual fallback skills

These are still included, but they are no longer the main path:

- `hello2cc:hello2cc-research`
- `hello2cc:hello2cc-orchestrate`
- `hello2cc:hello2cc-swarm`
- `hello2cc:hello2cc-diagram`
- `hello2cc:hello2cc-verify`

Use them only when you want an explicit manual entry point.

## Repository layout

```text
hello2cc/
├── .claude-plugin/
│   ├── marketplace.json
│   └── plugin.json
├── hooks/
│   └── hooks.json
├── output-styles/
│   └── hello2cc-native.md
├── scripts/
│   ├── lib/
│   │   ├── agent-models.mjs
│   │   ├── config.mjs
│   │   └── prompt-signals.mjs
│   ├── orchestrator.mjs
│   └── validate-plugin.mjs
├── skills/
│   ├── hello2cc-diagram/
│   ├── hello2cc-orchestrate/
│   ├── hello2cc-research/
│   ├── hello2cc-swarm/
│   └── hello2cc-verify/
├── tests/
│   └── orchestrator.test.mjs
├── CHANGELOG.md
├── LICENSE
├── package.json
└── README.md
```

## Local validation

```bash
npm run validate
npm test
npm run check
```

## Current limitations

- `hello2cc` can improve explicit native `Agent` / `TeamCreate` flows, but it cannot guarantee interception of every hidden internal model path inside Claude Code
- Claude Code’s first-party `auto` behavior is still an official product boundary and cannot be perfectly cloned on third-party providers
- Tooling like `ToolSearch` still depends on your gateway/provider compatibility

## Version

Current public release target: `0.0.1`

## License

Apache-2.0
