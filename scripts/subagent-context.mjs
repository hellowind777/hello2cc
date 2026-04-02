#!/usr/bin/env node
import { shouldEmitAdditionalContext } from './lib/config.mjs';

const cmd = process.argv[2] || '';

function writeJson(additionalContext) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SubagentStart',
      additionalContext,
    },
    suppressOutput: true,
  }));
}

function writeSuppress() {
  process.stdout.write(JSON.stringify({ suppressOutput: true }));
}

const contexts = {
  explore: [
    '# hello2cc Explore mode',
    '',
    '- Follow the parent task and any higher-priority `CLAUDE.md` / project formatting rules; do not restyle the response on your own.',
    '- Stay read-only unless the parent task explicitly asks for changes.',
    '- Start with native search and targeted reads; use `ToolSearch` only for capability uncertainty, MCP discovery, or tool availability questions.',
    '- Return exact file paths, concrete symbols or interfaces, and any remaining unknowns.',
    '- When comparing candidates, entry points, or risks, prefer a compact Markdown table; use ASCII only when plain text layout is necessary.',
    '- Parallelize independent searches when doing so improves coverage.',
  ].join('\n'),
  plan: [
    '# hello2cc Plan mode',
    '',
    '- Follow the parent task and any higher-priority `CLAUDE.md` / project formatting rules; do not restyle the response on your own.',
    '- Convert findings into an executable plan with ordered phases, dependencies, validation checks, and rollback risks.',
    '- Call out which slices stay in the main thread, which should become parallel native `Agent` work, and which ones truly need a persistent team workflow.',
    '- Use tables for task matrices, ownership splits, or trade-off comparisons when that makes the plan easier to scan.',
    '- Keep the plan concrete enough that a `General-Purpose` teammate can implement one slice without reinterpretation.',
  ].join('\n'),
  general: [
    '# hello2cc General-Purpose mode',
    '',
    '- Follow the parent task and any higher-priority `CLAUDE.md` / project formatting rules; do not restyle the response on your own.',
    '- Stay tightly scoped to the assigned slice; avoid broad repo-wide drift.',
    '- Prefer surgical edits in existing files, use dedicated tools before shell when possible, and run the narrowest relevant validation before reporting done.',
    '- Summarize changed files, validations, and remaining risks in a compact table when there are multiple items.',
    '- Report outcomes faithfully: if a validation failed or was not run, say so plainly.',
    '- If the task needs more context or a split into multiple tracks, say so explicitly instead of improvising a team in plain text.',
  ].join('\n'),
};

switch (cmd) {
  case 'explore':
    if (!shouldEmitAdditionalContext()) {
      writeSuppress();
      break;
    }
    writeJson(contexts.explore);
    break;
  case 'plan':
    if (!shouldEmitAdditionalContext()) {
      writeSuppress();
      break;
    }
    writeJson(contexts.plan);
    break;
  case 'general':
    if (!shouldEmitAdditionalContext()) {
      writeSuppress();
      break;
    }
    writeJson(contexts.general);
    break;
  default:
    process.stderr.write(`subagent-context.mjs: unknown command "${cmd}"\n`);
    process.exit(1);
}
