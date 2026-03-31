#!/usr/bin/env node
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

const contexts = {
  explore: [
    '# hello2cc Explore mode',
    '',
    '- Search before concluding: use `ToolSearch`, `Glob`, `Grep`, and targeted reads to map entry points.',
    '- Return exact file paths, concrete interfaces, and remaining unknowns.',
    '- When comparing candidates, entry points, or risks, prefer a compact Markdown/ASCII table over loose prose.',
    '- Do not drift into implementation unless the parent task explicitly asks for changes.',
  ].join('\n'),
  plan: [
    '# hello2cc Plan mode',
    '',
    '- Convert findings into an executable plan with ordered phases, acceptance checks, and rollback risks.',
    '- Call out which slices can stay in the main thread and which should become native `Agent` or `TeamCreate + Task*` work.',
    '- Use tables for task matrices, ownership splits, or trade-off comparisons when that makes the plan easier to scan.',
    '- Keep the plan concrete enough that a `General-Purpose` teammate can implement a single slice without reinterpretation.',
  ].join('\n'),
  general: [
    '# hello2cc General-Purpose mode',
    '',
    '- Stay tightly scoped to the assigned slice; avoid broad repo-wide drift.',
    '- Prefer surgical edits, cite exact file paths, and run the narrowest relevant validation before reporting done.',
    '- Summarize changed files, validations, and remaining risks in a compact table when there are multiple items.',
    '- If the task needs more context or a split into multiple tracks, say so explicitly instead of improvising a team in plain text.',
  ].join('\n'),
};

switch (cmd) {
  case 'explore':
    writeJson(contexts.explore);
    break;
  case 'plan':
    writeJson(contexts.plan);
    break;
  case 'general':
    writeJson(contexts.general);
    break;
  default:
    process.stderr.write(`subagent-context.mjs: unknown command "${cmd}"\n`);
    process.exit(1);
}
