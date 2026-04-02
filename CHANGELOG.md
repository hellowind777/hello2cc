# Changelog

## 0.2.9 - 2026-04-02

- Corrected hello2cc's routing stance from overly narrow native-first bias to host-surface-first guidance: third-party models are now reminded to respect all host-exposed capability surfaces instead of over-preferring only built-in tools and agents
- Added explicit `Skill` / `DiscoverSkills` capability detection plus new session and route guidance so surfaced skills, slash-command workflows, and plugin workflows are treated as first-class options rather than being silently overshadowed by `ToolSearch` / `Plan` / `Agent`
- Clarified routing boundaries between discovery layers: use `Skill` for known matching workflows, `DiscoverSkills` for skill/workflow discovery, and `ToolSearch` for tool / MCP / permission discovery instead of conflating them
- Updated output-style, subagent guidance, validation rules, and regression tests so hello2cc no longer encodes “avoid skill usage” as a success condition
- Added deterministic GitHub release-notes generation from `CHANGELOG.md`, with automatic acknowledgement sections when referenced issues / PRs exist, and backfilled all historical releases that were previously empty or only contained `Full Changelog`

## 0.2.8 - 2026-04-02

- Added softer native `WebSearch` guidance for real-time / latest-information questions so hello2cc encourages the host's built-in search path without pretending the plugin itself can create missing network capability
- Added authenticity-focused proxy guidance: custom `ANTHROPIC_BASE_URL` sessions are still encouraged to try native `WebSearch`, but the model is reminded to treat `Did 0 searches`, missing links, or missing search hits as “not actually searched” instead of presenting memory as a real web result
- Added regression coverage to keep this boundary stable: hello2cc should not hard-disable `WebSearch` just because a custom proxy is present, but it should keep result-truthfulness guidance intact

## 0.2.7 - 2026-04-02

- Added a true `default_agent_model` option so users can define one native-safe default agent model preference without having to overuse per-agent overrides
- Normalized `opus(1M)` to the host-safe `opus` agent slot while keeping the actual Opus-family landing point in the user's external model mapping layer such as CCSwitch
- Kept `Thinking` / reasoning model routing out of hello2cc's responsibility boundary so the plugin stays focused on native agent behavior instead of duplicating provider or session model wiring
- Added persistent `wantsWorktree` intent tracking plus `PreToolUse(Agent)` isolation sanitization so ordinary parallel workers no longer accidentally inherit `worktree` isolation unless the user explicitly asked for it
- Added `compatibility_mode = sanitize-only` so hello2cc can coexist more safely with other hook-heavy plugins by keeping only `Agent` input sanitization and suppressing extra SessionStart / UserPromptSubmit / SubagentStart overlays
- Expanded regression coverage for default agent model handling, `opus(1M)` normalization, worktree isolation sanitization, and sanitize-only compatibility mode
- Refreshed the README to focus on practical usage, installation, upgrade, configuration, and CCSwitch pairing guidance instead of implementation details

## 0.2.6 - 2026-04-01

- Fixed the ordinary-dialogue agent path so hello2cc now strips implicit teammate fields outside real team workflows, preventing third-party models from accidentally turning plain subagent work into `team=main` / `team=default` teammate spawns
- Blocked assistant-mode placeholder team names such as `main` and `default` from being treated as real reusable team identities until a real `TeamCreate` workflow has established an explicit team
- Tightened the native guidance and output style so visible narration follows the user's current language more closely and avoids verbose meta self-talk, making third-party models feel more like Claude Code's native coordinator style in Chinese sessions
- Added focused regression coverage for reserved assistant-team names, explicit-team gating, and the updated language/style guidance so the issue #6 family does not regress

## 0.2.5 - 2026-04-01

- Fixed native `Agent.model` injection for Claude Code `2.1.76+` by constraining hello2cc to host-safe `opus / sonnet / haiku` agent slots instead of passing arbitrary third-party aliases that newer Claude Code versions reject with `Invalid tool parameters`
- Added slot normalization and fallback logic so full Claude model IDs such as `claude-opus-*` / `claude-sonnet-*` still collapse back to the correct native agent slot when hello2cc needs to inject a built-in agent override
- Updated plugin option copy and README guidance to make the boundary explicit: third-party aliases belong in provider / gateway / ccswitch mapping, while hello2cc model override fields should stay on native Claude slots
- Added focused regression coverage for unsupported agent override aliases, slot fallback behavior, and supported-slot coercion so issue #4 does not regress
- Added real Claude CLI install smoke coverage for the self-marketplace install path (`marketplace add` → `plugin install` → `plugin list`) to continuously guard the supported `2.1.76+` range against self-install / reload regressions reported in issue #3

## 0.2.4 - 2026-04-01

- Hardened `scripts/claude-real-regression.mjs` so real-session checks now auto-detect both `plugin` and `plugins` Claude Code CLI forms instead of assuming only one command spelling
- Added Windows fallback execution through PATH command resolution when `APPDATA\\npm\\claude.ps1` is missing, making local real-regression runs less fragile across shell and install layouts
- Restored the original plugin enabled / disabled state after temporary real-regression enablement, so test runs no longer leave the user's Claude Code plugin state mutated
- Preserved the original Claude CLI failure in real-regression output and appended restore failures when both happen, making debugging much clearer without reviving removed legacy compatibility files
- Added focused automated coverage for missing Claude CLI, singular plugin command support, Windows/PATH fallback, and restore-error reporting

## 0.2.3 - 2026-04-01

- Removed the old `scripts/notify.mjs` compatibility shim and its tests so the public plugin no longer ships legacy notification / hook bridge baggage
- Tightened the main agent, output style, and routing overlays toward a stricter native-first policy: no `TodoWrite` fallback wording, no web-fallback wording, and no capability-withdrawal phrasing in the model-facing guidance
- Dropped transcript-level transport diagnostics from the model-facing prompt path so hello2cc no longer injects proxy / compatibility commentary into the active Claude Code session
- Split the oversized native-context orchestration into focused guidance modules so the transport-safety logic stays maintainable while preserving the same exported plugin behavior

## 0.2.2 - 2026-04-01

- Re-aligned hello2cc's multi-worker guidance with Claude Code's native worker flow: parallel work now prefers multiple `Agent` launches first instead of over-promoting `TeamCreate` for ordinary research / implement / verify turns
- Added explicit guidance to wait for worker completion notifications and use `SendMessage` / `TaskStop` for continuation or correction, instead of nudging models toward polling ordinary worker results via `TaskOutput`
- Kept native task-board support for explicit checklist / task-board requests, while stopping the plugin from pushing `TaskCreate` / `TaskList` / `TaskUpdate` as the default for every complex task
- Updated the default main-agent overlay, output style, route heuristics, and regression tests so third-party models stay closer to Claude Code's native coordinator behavior without interfering with higher-priority repo rules

## 0.2.1 - 2026-04-01

- Reduced hello2cc output-layer interference so user instructions, Claude Code host rules, and repository / user `CLAUDE.md` or `AGENTS.md` now explicitly take precedence over hello2cc overlays
- Removed the earlier ASCII-leaning presentation bias and switched hello2cc guidance back to Markdown-first tables unless plain-text layout is explicitly needed
- Tightened main-thread and subagent overlays so hello2cc augments native tool and agent usage without replacing project-specific wrappers, command routing, or branded response formats
- Bumped the plugin version so Claude Code can install a fresh cache entry instead of continuing to reuse an older `0.2.0` cache payload

## 0.2.0 - 2026-04-01

- Reworked hello2cc toward a more capability-aware native parity model so session guidance now prioritizes observed tool and agent exposure over broad keyword-triggered routing
- Expanded native-first routing to cover `AskUserQuestion`, `SendMessage`, `TeamDelete`, `TaskGet`, `TodoWrite` fallback, `ListMcpResources`, `ReadMcpResource`, and explicit-only `EnterWorktree` handling when those capabilities are actually exposed by the host
- Tightened prompt intent classification to reduce over-broad keyword heuristics, especially for decision routing and worktree routing, and shifted more multi-track detection to structural signals
- Reduced overly broad agent alias normalization so model injection stays closer to real host agent identities instead of fuzzy aliases
- Strengthened quality gates for task and subagent completion by accepting more structure-based evidence (lists, paths, commands) instead of relying only on wording cues
- Refreshed the default main-agent overlay, forced output style guidance, README, and test coverage to reflect the quieter capability-aware native-first behavior

## 0.1.3 - 2026-03-31

- Added a GitHub Actions npm publishing pipeline at `.github/workflows/publish.yml`, aligned with the helloloop release flow and supporting both tag-triggered releases and manual dispatch
- Added npm publish metadata in `package.json` and release documentation in `README.md`, including support for both `NPM_TOKEN` and trusted-publishing based automation
- Fixed the GitHub Actions publish workflow so npm token detection no longer relies on unsupported `secrets.*` checks inside `if:` expressions, which previously caused zero-job failed workflow runs

## 0.1.2 - 2026-03-31

- Added the first automated npm publishing workflow at `.github/workflows/publish.yml`, covering tag-triggered releases and manual dispatch entry points
- Updated package metadata and README release guidance so the npm package and Claude Code plugin manifest stay version-aligned during release preparation
- Cut the dedicated `0.1.2` release after wiring the publish automation and related release documentation into the repository

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

## 0.0.9 - 2026-03-31

- Finalized the first public native-first plugin defaults before the later `hello2cc:native` rename, consolidating the default main-thread agent and packaged settings into a quieter baseline
- Simplified the shipped plugin surface by removing the old output-style bootstrap runtime, tightening manifest/settings defaults, and stabilizing the packaged hooks layout
- Expanded routing, session-state, regression, and validation coverage so transcript-driven session-model discovery and native-first prompt overlays behaved reliably in real Claude Code sessions

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
