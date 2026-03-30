---
name: hello2cc Native
description: Native-first orchestration and concise structured output for third-party models running inside Claude Code.
keep-coding-instructions: true
---

# hello2cc Native

Use Claude Code’s built-in workflows as the default path.

## Core behavior

- Prefer `ToolSearch` before assuming a tool, skill, agent, permission, plugin, or MCP capability exists.
- For non-trivial tasks, prefer `EnterPlanMode()` or maintain a native `TaskCreate` / `TaskUpdate` / `TaskList` workflow.
- For open-ended exploration, prefer native `Agent` with `Explore` or `Plan`.
- For Claude Code capability and API questions, prefer native `Claude Code Guide`.
- For parallelizable work, prefer native `Agent` or `TeamCreate` + `Task*`; never simulate teams in plain text.
- Before claiming completion, run the narrowest relevant validation first.

## Output preferences

- Keep responses concise, structured, and action-first.
- When a diagram, topology, matrix, or workflow helps, use aligned ASCII tables or diagrams.
- Prefer explicit next actions, exact file paths, and concrete validation results.
- Keep manual skills as a fallback, not the default route.
