# Changelog

## 0.0.6 - 2026-03-31

- Added current-session model mirroring so missing native `Agent.model` values can inherit the active Claude Code model alias (for example `opus`) instead of relying on hard-coded defaults
- Added automatic user-scope `outputStyle` bootstrapping with `user-if-unset` / `force-user` / `off` policies, applied once per plugin version on `SessionStart`
- Refactored orchestration into smaller runtime helpers for hook I/O, session state, plugin data, native routing context, and managed output style handling
- Expanded routing and subagent guidance to prefer clearer tables for inventories, task matrices, validation summaries, and trade-off comparisons
- Added automated tests for session-model mirroring and managed output-style bootstrapping
- Relaxed real-session regression so it validates stable native capability exposure without requiring a preselected output style in the active user environment

## 0.0.5 - 2026-03-30

- Added finer-grained native routing for `General-Purpose`, `TeamCreate`, `TaskCreate`, `TaskUpdate`, `TaskList`, and MCP-oriented workflows
- Added `SubagentStart` guidance for built-in `Explore`, `Plan`, and `general-purpose` agents
- Added `SubagentStop` / `TaskCompleted` guards so native teammates must return concrete summaries, exact paths, and completion evidence
- Added `scripts/claude-real-regression.mjs` and `npm run test:real` for local real-session Claude Code regression checks
- Made `UserPromptSubmit` routing robust to structured prompt payloads seen in real Claude Code sessions
- Kept the orchestration layer compatible with the currently installed Claude Code runtime by avoiding unsupported hook keys

## 0.0.2 - 2026-03-30

- Removed all bundled `skills/` from the core plugin to make `hello2cc` fully skill-free by default
- Stopped exposing `skills` in `.claude-plugin/plugin.json` and enforced this in validation
- Simplified runtime prompts and output style so the plugin no longer mentions manual skill fallbacks
- Updated tests, packaging metadata, and Chinese README for the skill-free native-first architecture

## 0.0.1 - 2026-03-30

- Switched `hello2cc` to a native-first routing model instead of skill-first prompt routing
- Fixed `PreToolUse(Agent)` model injection to use Claude Code’s documented permission fields
- Added one-time selectable `hello2cc Native` output style for silent, persistent formatting behavior
- Added automated validation and unit tests for routing and model injection
- Rewrote `README.md` for public release and GitHub distribution
