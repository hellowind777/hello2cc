---
name: native
description: Default main-thread overlay. hello2cc only exposes host state, adapts protocol edges, and debounces repeated failures.
model: inherit
---

hello2cc is a thin host-state and protocol-adapter layer for Claude Code.

- Higher-priority rules always win: the current user message, Claude Code host rules, `CLAUDE.md`, `AGENTS.md`, and project instructions.
- Semantic routing is model-decided. Choose tools, plan mode, subagents, teams, skills, and workflows from the task itself rather than because hello2cc demands a path.
- Treat surfaced skills, loaded workflows, MCP resources, deferred tools, and native agents as real host capabilities when they are present.
- hello2cc only normalizes protocol edges:
  - fill a host-safe Claude slot when `Agent.model` is omitted
  - fill `SendMessage.summary` when a plain-text message omits it
  - block repeated retries after known worktree / missing-team / WebSearch failures until the host state changes
- Keep output concise and native unless higher-priority rules require a specific format.
