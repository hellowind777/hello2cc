#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] || process.cwd();

function ok(message) {
  console.log(`OK ${message}`);
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${path}: ${error.message}`);
    return null;
  }
}

function validateJsonFiles() {
  const files = [
    'package.json',
    '.claude-plugin/plugin.json',
    '.claude-plugin/marketplace.json',
    'hooks/hooks.json',
    'settings.json',
  ];

  for (const relativePath of files) {
    const absolutePath = join(root, relativePath);
    if (!existsSync(absolutePath)) {
      fail(`missing ${relativePath}`);
      continue;
    }
    const data = readJson(absolutePath);
    if (data) ok(relativePath);
  }
}

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return null;
  return text.slice(4, end);
}

function validatePluginManifest() {
  const pluginPath = join(root, '.claude-plugin', 'plugin.json');
  const plugin = readJson(pluginPath);
  if (!plugin) return;
  const pkg = readJson(join(root, 'package.json'));
  const marketplace = readJson(join(root, '.claude-plugin', 'marketplace.json'));

  if (plugin.hooks === './hooks/hooks.json') {
    fail('plugin.json must not reference standard hooks/hooks.json; that file is auto-loaded');
  } else {
    ok('plugin manifest hook reference');
  }

  if (!plugin.userConfig || typeof plugin.userConfig !== 'object') {
    fail('plugin.json should define userConfig for model injection strategy');
    return;
  }

  const invalidEntries = Object.entries(plugin.userConfig).filter(([, option]) => {
    return !option || typeof option !== 'object' || !option.title || !option.type || !option.description;
  });

  if (invalidEntries.length > 0) {
    fail(`plugin.json userConfig entries missing required fields: ${invalidEntries.map(([key]) => key).join(', ')}`);
  } else {
    ok('plugin manifest userConfig');
  }

  if (plugin.outputStyles !== './output-styles') {
    fail('plugin.json should expose outputStyles as ./output-styles');
  } else {
    ok('plugin manifest outputStyles');
  }

  if ('skills' in plugin) {
    fail('plugin.json must not expose skills in the skill-free core release');
  } else {
    ok('plugin manifest skill-free');
  }

  if (pkg && plugin.version !== pkg.version) {
    fail('plugin.json version should match package.json');
  } else if (pkg) {
    ok('plugin manifest version sync');
  }

  const marketplaceEntry = marketplace?.plugins?.find?.((entry) => entry?.name === plugin.name);
  if (!marketplaceEntry) {
    fail('marketplace.json should expose the hello2cc plugin entry');
  } else if (pkg && marketplaceEntry.version !== pkg.version) {
    fail('marketplace.json plugin version should match package.json');
  } else {
    ok('marketplace version sync');
  }
}

function validateHooks() {
  const hooksPath = join(root, 'hooks', 'hooks.json');
  const hooks = readJson(hooksPath);
  if (!hooks || !hooks.hooks) return;

  const subagentStart = hooks.hooks.SubagentStart;
  if (!Array.isArray(subagentStart)) {
    fail('hooks.json should define SubagentStart hooks for built-in native agents');
  } else {
    const matchers = new Set(subagentStart.map((entry) => entry.matcher));
    if (!matchers.has('Explore') || !matchers.has('Plan') || !matchers.has('general-purpose')) {
      fail('hooks.json should attach SubagentStart guidance for Explore, Plan, and general-purpose');
    } else {
      ok('hooks SubagentStart coverage');
    }
  }

  const subagentStop = hooks.hooks.SubagentStop;
  const taskCompleted = hooks.hooks.TaskCompleted;
  if (!Array.isArray(subagentStop) || !Array.isArray(taskCompleted)) {
    fail('hooks.json should define SubagentStop and TaskCompleted guards');
  } else {
    const stopMatchers = new Set(subagentStop.map((entry) => entry.matcher));
    if (!stopMatchers.has('Explore') || !stopMatchers.has('Plan') || !stopMatchers.has('general-purpose')) {
      fail('hooks.json should attach SubagentStop quality gates for Explore, Plan, and general-purpose');
    } else {
      ok('hooks subagent stop guards');
    }

    ok('hooks task lifecycle guards');
  }

  const preToolUse = hooks.hooks.PreToolUse;
  if (!Array.isArray(preToolUse)) {
    fail('hooks.json should define PreToolUse hooks');
    return;
  }

  const hasAgentHook = preToolUse.some((entry) => entry.matcher === 'Agent');
  if (!hasAgentHook) {
    fail('hooks.json should inject model on PreToolUse matcher Agent');
  } else {
    ok('hooks Agent pretool injection');
  }

  const configChange = hooks.hooks.ConfigChange;
  if (!Array.isArray(configChange) || configChange.length === 0) {
    fail('hooks.json should define ConfigChange hooks');
  } else {
    ok('hooks ConfigChange coverage');
  }
}

function validateAgents() {
  const agentsPath = join(root, 'agents');
  if (!existsSync(agentsPath)) {
    fail('agents directory should exist to provide the default main-thread agent');
  } else {
    const mainAgentPath = join(agentsPath, 'native.md');
    if (!existsSync(mainAgentPath)) {
      fail('missing agents/native.md');
    } else {
      const text = readFileSync(mainAgentPath, 'utf8');
      if (!/name:\s*native/m.test(text) || !/model:\s*inherit/m.test(text)) {
        fail('hello2cc main agent should declare name and model: inherit');
      } else {
        ok('native main agent');
      }

      if (!/CLAUDE\.md|AGENTS\.md/.test(text)) {
        fail('native main agent should explicitly defer to higher-priority CLAUDE.md / AGENTS.md rules');
      } else {
        ok('native main agent precedence');
      }
    }
  }

  const legacyAgentsPath = join(root, 'legacy-agents');
  if (existsSync(legacyAgentsPath)) {
    fail('legacy-agents directory should not ship in the native-first public release');
    return;
  }

  const settingsPath = join(root, 'settings.json');
  if (!existsSync(settingsPath)) {
    fail('settings.json should exist and activate the default hello2cc main agent');
    return;
  }

  const settings = readJson(settingsPath);
  if (!settings) return;

  if (settings.agent !== 'hello2cc:native') {
    fail('settings.json should activate namespaced agent hello2cc:native');
  } else {
    ok('plugin default agent setting');
  }
}

function validateNoEmbeddedSkills() {
  const skillRoot = join(root, 'skills');
  if (existsSync(skillRoot)) {
    fail('skills directory should not ship in the skill-free core release');
    return;
  }

  ok('no embedded skills directory');
}

function validateNoLegacyCompat() {
  const legacyCompatFiles = [
    join(root, 'scripts', 'notify.mjs'),
  ];

  for (const legacyPath of legacyCompatFiles) {
    if (existsSync(legacyPath)) {
      fail(`${legacyPath.replace(`${root}\\`, '')} should not ship in the strict native-first release`);
      return;
    }
  }

  ok('no legacy compatibility shims');
}

function validateOutputStyles() {
  const outputStylePath = join(root, 'output-styles', 'hello2cc-native.md');
  if (!existsSync(outputStylePath)) {
    fail('missing output-styles/hello2cc-native.md');
    return;
  }

  const text = readFileSync(outputStylePath, 'utf8');
  const frontmatter = parseFrontmatter(text);
  if (!frontmatter) {
    fail('invalid frontmatter in output-styles/hello2cc-native.md');
    return;
  }

  if (!/^name:\s*.+$/m.test(frontmatter)) fail('missing name in output-styles/hello2cc-native.md');
  if (!/^description:\s*.+$/m.test(frontmatter)) fail('missing description in output-styles/hello2cc-native.md');
  if (!/^keep-coding-instructions:\s*true$/m.test(frontmatter)) {
    fail('output style should keep coding instructions');
  } else {
    ok('output style frontmatter');
  }

  if (!/^force-for-plugin:\s*true$/m.test(frontmatter)) {
    fail('output style should enable force-for-plugin');
  } else {
    ok('output style force-for-plugin');
  }

  if (!/CLAUDE\.md|AGENTS\.md/.test(text)) {
    fail('output style should explicitly defer to higher-priority CLAUDE.md / AGENTS.md rules');
  } else {
    ok('output style precedence');
  }
}

function validateNativeFirstRouting() {
  const orchestratorPath = join(root, 'scripts', 'orchestrator.mjs');
  if (!existsSync(orchestratorPath)) {
    fail('missing scripts/orchestrator.mjs');
    return;
  }

  const text = readFileSync(orchestratorPath, 'utf8');
  if (/do not use\s+`?Skill`?/i.test(text)) {
    fail('scripts/orchestrator.mjs should not hard-block host skill usage');
  } else {
    ok('host-surface routing');
  }
}

function validateLifecycleScripts() {
  const scriptPaths = [
    join(root, 'scripts', 'subagent-context.mjs'),
    join(root, 'scripts', 'subagent-stop.mjs'),
    join(root, 'scripts', 'task-lifecycle.mjs'),
    join(root, 'scripts', 'lib', 'hook-io.mjs'),
    join(root, 'scripts', 'lib', 'native-context.mjs'),
    join(root, 'scripts', 'lib', 'plugin-data.mjs'),
    join(root, 'scripts', 'lib', 'plugin-meta.mjs'),
    join(root, 'scripts', 'lib', 'route-guidance.mjs'),
    join(root, 'scripts', 'lib', 'session-state.mjs'),
    join(root, 'scripts', 'lib', 'session-guidance.mjs'),
    join(root, 'scripts', 'lib', 'transcript-context.mjs'),
    join(root, 'scripts', 'lib', 'task-quality.mjs'),
    join(root, 'scripts', 'lib', 'subagent-quality.mjs'),
  ];

  for (const scriptPath of scriptPaths) {
    if (!existsSync(scriptPath)) {
      fail(`missing ${scriptPath.replace(`${root}\\`, '')}`);
      continue;
    }

    ok(scriptPath.replace(`${root}\\`, ''));
  }
}

validateJsonFiles();
validatePluginManifest();
validateHooks();
validateAgents();
validateNoEmbeddedSkills();
validateNoLegacyCompat();
validateOutputStyles();
validateNativeFirstRouting();
validateLifecycleScripts();

if (process.exitCode) {
  process.exit(process.exitCode);
}
