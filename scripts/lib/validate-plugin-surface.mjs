import { parseFrontmatter } from './validate-plugin-shared.mjs';

const LIFECYCLE_SCRIPTS = [
  'scripts/subagent-context.mjs',
  'scripts/subagent-stop.mjs',
  'scripts/task-lifecycle.mjs',
  'scripts/lib/hook-io.mjs',
  'scripts/lib/native-context.mjs',
  'scripts/lib/plugin-data.mjs',
  'scripts/lib/plugin-meta.mjs',
  'scripts/lib/route-guidance.mjs',
  'scripts/lib/session-state.mjs',
  'scripts/lib/session-guidance.mjs',
  'scripts/lib/transcript-context.mjs',
  'scripts/lib/task-quality.mjs',
  'scripts/lib/subagent-quality.mjs',
];

/**
 * Validates that hello2cc ships the native main agent without forcing default selection.
 */
export function validateAgents(context) {
  if (!context.exists('agents')) {
    context.fail('agents directory should exist to provide hello2cc native agent guidance');
  } else if (!context.exists('agents/native.md')) {
    context.fail('missing agents/native.md');
  } else {
    const text = context.readText('agents/native.md');
    if (!/name:\s*native/m.test(text) || !/model:\s*inherit/m.test(text)) {
      context.fail('hello2cc main agent should declare name and model: inherit');
    } else {
      context.ok('native main agent');
    }

    if (!/CLAUDE\.md|AGENTS\.md/.test(text)) {
      context.fail('native main agent should explicitly defer to higher-priority CLAUDE.md / AGENTS.md rules');
    } else {
      context.ok('native main agent precedence');
    }
  }

  if (context.exists('legacy-agents')) {
    context.fail('legacy-agents directory should not ship in the native-first public release');
  }

  if (context.exists('settings.json')) {
    context.fail('settings.json must not ship because hello2cc should not inject a default main-thread agent');
  } else {
    context.ok('no plugin default agent injection');
  }
}

/**
 * Validates the skill-free release does not accidentally ship bundled skills.
 */
export function validateNoEmbeddedSkills(context) {
  if (context.exists('skills')) {
    context.fail('skills directory should not ship in the skill-free core release');
    return;
  }

  context.ok('no embedded skills directory');
}

/**
 * Validates that native-first releases do not include legacy compatibility shims.
 */
export function validateNoLegacyCompat(context) {
  const legacyCompatFiles = ['scripts/notify.mjs'];

  for (const relativePath of legacyCompatFiles) {
    if (context.exists(relativePath)) {
      context.fail(`${relativePath} should not ship in the strict native-first release`);
      return;
    }
  }

  context.ok('no legacy compatibility shims');
}

/**
 * Validates the forced native output style metadata and precedence hints.
 */
export function validateOutputStyles(context) {
  const relativePath = 'output-styles/hello2cc-native.md';
  if (!context.exists(relativePath)) {
    context.fail('missing output-styles/hello2cc-native.md');
    return;
  }

  const text = context.readText(relativePath);
  const frontmatter = parseFrontmatter(text);
  if (!frontmatter) {
    context.fail('invalid frontmatter in output-styles/hello2cc-native.md');
    return;
  }

  if (!/^name:\s*.+$/m.test(frontmatter)) {
    context.fail('missing name in output-styles/hello2cc-native.md');
  }

  if (!/^description:\s*.+$/m.test(frontmatter)) {
    context.fail('missing description in output-styles/hello2cc-native.md');
  }

  if (!/^keep-coding-instructions:\s*true$/m.test(frontmatter)) {
    context.fail('output style should keep coding instructions');
  } else {
    context.ok('output style frontmatter');
  }

  if (!/^force-for-plugin:\s*true$/m.test(frontmatter)) {
    context.fail('output style should enable force-for-plugin');
  } else {
    context.ok('output style force-for-plugin');
  }

  if (!/CLAUDE\.md|AGENTS\.md/.test(text)) {
    context.fail('output style should explicitly defer to higher-priority CLAUDE.md / AGENTS.md rules');
  } else {
    context.ok('output style precedence');
  }
}

/**
 * Validates the orchestrator remains native-first without hard-blocking host skills.
 */
export function validateNativeFirstRouting(context) {
  const relativePath = 'scripts/orchestrator.mjs';
  if (!context.exists(relativePath)) {
    context.fail('missing scripts/orchestrator.mjs');
    return;
  }

  const text = context.readText(relativePath);
  if (/do not use\s+`?Skill`?/i.test(text)) {
    context.fail('scripts/orchestrator.mjs should not hard-block host skill usage');
  } else {
    context.ok('host-surface routing');
  }
}

/**
 * Validates the lifecycle scripts required by the published plugin are present.
 */
export function validateLifecycleScripts(context) {
  for (const relativePath of LIFECYCLE_SCRIPTS) {
    if (!context.exists(relativePath)) {
      context.fail(`missing ${relativePath}`);
      continue;
    }

    context.ok(relativePath);
  }
}
