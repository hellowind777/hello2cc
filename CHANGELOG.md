# Changelog

## 0.1.2 - 2026-03-31

- Added a GitHub Actions npm publishing pipeline at `.github/workflows/publish.yml`, aligned with the helloloop release flow and supporting both tag-triggered releases and manual dispatch
- Added npm publish metadata in `package.json` and release documentation in `README.md`, including support for both `NPM_TOKEN` and trusted-publishing based automation

## 0.1.1 - 2026-03-31

- Rebuilt more of Claude Code's host-side tasking guidance into the forced plugin output style so third-party models keep stronger native habits even when plugin output styles replace part of the host prompt composition
- Tightened the default native main-agent, route, and subagent overlays to prefer dedicated tools before shell, parallelize independent tool calls, and report validation status more honestly
- Added ToolSearch readiness diagnostics so hello2cc now distinguishes between “prompt the model to use ToolSearch” and “the Claude Code host actually exposed ToolSearch for this session”, with explicit remediation for third-party gateway setups
- Added a compatibility `scripts/notify.mjs` shim so stale legacy references such as `notify.mjs inject`, `notify.mjs route`, `notify.mjs stop`, and `codex-notify` no longer fail immediately when old local hook or notification-program paths still point at hello2cc
- Improved transcript/session-state capture so hook guidance can remember observed tool and agent availability, not only the mirrored session model
- Expanded validation, unit tests, and real-regression diagnostics, including clearer failure reporting when Claude Code rejects the currently mapped third-party model alias before plugin hooks can run

## 0.1.0 - 2026-03-31

- Promoted hello2cc to the first `0.1.0` milestone to reflect that the core architecture is now stable enough for alpha-style iteration instead of `0.0.x` patch-only experimentation
- Kept the official-plugin-path architecture introduced in recent releases: namespaced default main agent, `force-for-plugin` output style, minimal native-agent model injection, and real Claude Code regression coverage
- Kept the clearer default main-agent runtime id `hello2cc:native`, which better communicates that hello2cc is active in native-first mode without locking the main session model

## 0.0.10 - 2026-03-31

- Renamed the default plugin main-agent runtime id from `hello2cc:main` to `hello2cc:native`, making the active native-first role more self-explanatory while keeping the same `model: inherit` behavior
- Switched the plugin default agent setting to the actual namespaced runtime agent id `hello2cc:native`, matching Claude Code's plugin agent loader
- Switched the plugin output style to Claude Code's official `force-for-plugin` path so the native-first style is applied without mutating user `settings.json`
- Removed automatic user-settings output-style bootstrapping and the related runtime script in favor of the host-supported plugin output-style mechanism
- Narrowed `Agent.model` injection to the places that truly need correction (`Claude Code Guide`, `Explore`, and explicit override cases), preserving Claude Code's native inherit behavior for `Plan`, `general-purpose`, and custom agents by default
- Added `ConfigChange` handling that clears cached session model state so config swaps do not leave stale session-model mirroring behind
- Updated validation, unit tests, and real-session regression checks for namespaced plugin agents and forced plugin output styles

## 0.0.7 - 2026-03-31

- Added a default plugin `settings.json` that activates `main` as the main-thread agent, using `model: inherit` for a more silent and native-feeling baseline
- Added `agents/main.md` so the main thread gets stronger native-first routing, ToolSearch-first posture, and table-friendly output guidance without relying solely on output styles
- Added transcript-based session context discovery so native `Agent.model` injection can recover the active session model alias from real Claude Code transcripts when hook payloads do not expose it directly
- Expanded regression coverage to validate transcript-driven model mirroring and to ensure the packaged plugin exports the new default main agent

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
