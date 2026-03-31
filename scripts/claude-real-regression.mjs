#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function fail(message) {
  throw new Error(String(message || 'unknown failure'));
}

function ok(message) {
  console.log(`OK ${message}`);
}

function quoteForPowerShell(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function spawnClaudeDirect(args) {
  return spawnSync('claude', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    shell: false,
  });
}

function spawnClaude(args) {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || '';
    const claudePs1 = appData ? join(appData, 'npm', 'claude.ps1') : '';

    if (claudePs1 && existsSync(claudePs1)) {
      const command = `& ${quoteForPowerShell(claudePs1)} ${args.map(quoteForPowerShell).join(' ')}`;
      return spawnSync('pwsh.exe', ['-NoLogo', '-NoProfile', '-Command', command], {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        shell: false,
      });
    }
  }

  return spawnClaudeDirect(args);
}

function pluginCommand() {
  const singular = spawnClaude(['plugin', '--help']);
  if (!singular.error && singular.status === 0) {
    return 'plugin';
  }

  const plural = spawnClaude(['plugins', '--help']);
  if (!plural.error && plural.status === 0) {
    return 'plugins';
  }

  fail('claude CLI is required for real-session regression');
}

let cachedPluginCommand = '';

function ensureClaudeCli() {
  if (!cachedPluginCommand) {
    cachedPluginCommand = pluginCommand();
  }

  return cachedPluginCommand;
}

function extractPluginBlock(text, pluginName) {
  const lines = String(text || '').split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(pluginName));
  if (index < 0) {
    return '';
  }

  const block = [lines[index]];
  for (let i = index + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      break;
    }

    if (line.includes('@') && !line.includes(pluginName)) {
      break;
    }

    if (/^\S/.test(line)) {
      break;
    }

    block.push(line);
  }

  return block.join('\n');
}

function ensureHello2ccEnabled() {
  const cliPluginCommand = ensureClaudeCli();
  const result = spawnClaude([cliPluginCommand, 'list']);
  if (result.error || result.status !== 0) {
    fail('unable to inspect installed Claude Code plugins');
  }

  const text = String(result.stdout || '');
  const pluginBlock = extractPluginBlock(text, 'hello2cc@hello2cc-local');

  if (!pluginBlock) {
    fail('hello2cc@hello2cc-local is not installed in the current Claude Code environment');
  }

  const scopeMatch = pluginBlock.match(/Scope:\s*(user|project|local)/i);
  const scope = String(scopeMatch?.[1] || '').toLowerCase();
  const scopedArgs = scope ? ['--scope', scope] : [];
  const wasDisabled = /Status:\s*✘\s*disabled/i.test(pluginBlock);
  if (wasDisabled) {
    const enableResult = spawnClaude([cliPluginCommand, 'enable', ...scopedArgs, 'hello2cc@hello2cc-local']);
    if (enableResult.error || enableResult.status !== 0) {
      fail('hello2cc is installed but disabled, and automatic enable failed');
    }
  }

  return {
    restore() {
      if (!wasDisabled) {
        return;
      }

      const disableResult = spawnClaude([cliPluginCommand, 'disable', ...scopedArgs, 'hello2cc@hello2cc-local']);
      if (disableResult.error || disableResult.status !== 0) {
        fail('hello2cc was initially disabled, but restoring the disabled state failed after real-session regression');
      }
    },
  };
}

function parseJsonLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function parseHookContext(line) {
  try {
    const payload = JSON.parse(line.output || '{}');
    return payload?.hookSpecificOutput?.additionalContext || '';
  } catch {
    return '';
  }
}

function getHello2ccPluginPath(initLine) {
  const plugin = Array.isArray(initLine.plugins) && initLine.plugins.find((entry) => entry.name === 'hello2cc');
  return plugin?.path || '';
}

function assertPluginCacheShape(pluginPath, name) {
  if (!pluginPath) {
    fail(`real-session case "${name}" did not expose hello2cc plugin path`);
  }

  const manifestPath = join(pluginPath, '.claude-plugin', 'plugin.json');
  if (!existsSync(manifestPath)) {
    fail(`real-session case "${name}" missing cached plugin manifest`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if ('skills' in manifest) {
    fail(`real-session case "${name}" cached manifest still exposes skills`);
  }

  if (existsSync(join(pluginPath, 'skills'))) {
    fail(`real-session case "${name}" cached plugin still ships a skills directory`);
  }

  const settingsPath = join(pluginPath, 'settings.json');
  if (!existsSync(settingsPath)) {
    fail(`real-session case "${name}" missing plugin settings.json`);
  }

  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  if (settings.agent !== 'hello2cc:native') {
    fail(`real-session case "${name}" plugin settings did not activate the namespaced hello2cc main agent`);
  }

  const agentPath = join(pluginPath, 'agents', 'native.md');
  if (!existsSync(agentPath)) {
    fail(`real-session case "${name}" missing hello2cc native main agent`);
  }

  const outputStylePath = join(pluginPath, 'output-styles', 'hello2cc-native.md');
  if (!existsSync(outputStylePath)) {
    fail(`real-session case "${name}" missing hello2cc native output style`);
  }

  const outputStyleText = readFileSync(outputStylePath, 'utf8');
  if (!/force-for-plugin:\s*true/m.test(outputStyleText)) {
    fail(`real-session case "${name}" output style is not force-for-plugin`);
  }
}

function runCase(name, prompt, sessionExpectations) {
  const debugDir = join(homedir(), '.claude', 'debug');
  mkdirSync(debugDir, { recursive: true });
  const debugPath = join(debugDir, `hello2cc-real-${name}.jsonl`);

  const explicitModel = String(process.env.HELLO2CC_REAL_MODEL || '').trim();
  const args = [
    '-p',
    '--verbose',
    '--output-format',
    'stream-json',
    '--max-budget-usd',
    '0.20',
    '--debug-file',
    debugPath,
  ];

  if (explicitModel) {
    args.push('--model', explicitModel);
  }

  args.push(prompt);

  const result = spawnClaude(args);

  if (result.error || result.status !== 0) {
    writeFileSync(debugPath, result.stdout || '', 'utf8');
    const lines = parseJsonLines(result.stdout || '');
    const invalidModelMessage = lines.find((line) => line.type === 'assistant' && typeof line.error === 'string' && line.error === 'invalid_request');
    const invalidModelText = invalidModelMessage?.message?.content?.[0]?.text || '';

    if (invalidModelText.includes('selected model')) {
      fail(`real-session case "${name}" failed before hooks because Claude Code rejected the active model alias. Set HELLO2CC_REAL_MODEL to a valid Claude Code model alias or fix your current Claude Code model mapping first.`);
    }

    fail(`real-session case "${name}" failed: ${result.stderr || result.error?.message || 'unknown error'}`);
  }

  const lines = parseJsonLines(result.stdout);
  const initLine = lines.find((line) => line.type === 'system' && line.subtype === 'init');
  if (!initLine) {
    fail(`real-session case "${name}" did not emit init event`);
  }

  const pluginLoaded = Array.isArray(initLine.plugins) && initLine.plugins.some((plugin) => plugin.name === 'hello2cc');
  if (!pluginLoaded) {
    fail(`real-session case "${name}" did not load hello2cc`);
  }

  const requiredTools = ['ToolSearch', 'TeamCreate', 'Task', 'TaskOutput', 'TaskStop'];
  for (const tool of requiredTools) {
    if (!Array.isArray(initLine.tools) || !initLine.tools.includes(tool)) {
      fail(`real-session case "${name}" missing native tool "${tool}"`);
    }
  }

  const requiredAgents = ['general-purpose', 'Explore', 'Plan'];
  for (const agent of requiredAgents) {
    if (!Array.isArray(initLine.agents) || !initLine.agents.includes(agent)) {
      fail(`real-session case "${name}" missing native agent "${agent}"`);
    }
  }

  if (!Array.isArray(initLine.agents) || !initLine.agents.includes('hello2cc:native')) {
    fail(`real-session case "${name}" missing namespaced hello2cc main agent`);
  }

  assertPluginCacheShape(getHello2ccPluginPath(initLine), name);

  const contexts = lines
    .filter((line) => line.type === 'system' && line.subtype === 'hook_response')
    .map(parseHookContext)
    .filter(Boolean);

  const mergedContext = contexts.join('\n\n');
  for (const expected of sessionExpectations) {
    if (!mergedContext.includes(expected)) {
      fail(`real-session case "${name}" missing "${expected}"`);
    }
  }

  ok(`real-session ${name}`);
}

function main() {
  ensureClaudeCli();
  const pluginState = ensureHello2ccEnabled();
  let primaryError = null;

  try {
    runCase('baseline', 'Reply with exactly OK.', [
      'Claude Code Guide',
      'ToolSearch',
      'General-Purpose',
      'TeamCreate',
      'force-for-plugin',
    ]);
    runCase('repeat', 'Reply with exactly STILL_OK.', [
      'Claude Code Guide',
      'ToolSearch',
      'General-Purpose',
      'TeamCreate',
      'force-for-plugin',
    ]);
  } catch (error) {
    primaryError = error;
  }

  try {
    pluginState.restore();
  } catch (restoreError) {
    if (primaryError) {
      primaryError.message = `${primaryError.message} (restore also failed: ${restoreError.message})`;
      throw primaryError;
    }

    throw restoreError;
  }

  if (primaryError) {
    throw primaryError;
  }
}

try {
  main();
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exit(1);
}
