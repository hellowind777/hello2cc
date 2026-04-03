import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ensureClaudeCli, spawnClaude } from './claude-regression-cli.mjs';
import {
  assertPluginCacheShape,
  ensureHello2ccEnabled,
  runIsolatedInstallSmoke,
} from './claude-regression-plugin.mjs';
import { fail, ok, parseHookContext, parseJsonLines } from './claude-regression-shared.mjs';

function getHello2ccPluginPath(initLine) {
  const plugin = Array.isArray(initLine.plugins) && initLine.plugins.find((entry) => entry.name === 'hello2cc');
  return plugin?.path || '';
}

function buildClaudeArgs(name, prompt) {
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
  return { args, debugPath };
}

function failInvalidModelAlias(name, lines) {
  const invalidModelMessage = lines.find((line) => line.type === 'assistant' && line.error === 'invalid_request');
  const invalidModelText = invalidModelMessage?.message?.content?.[0]?.text || '';
  if (invalidModelText.includes('selected model')) {
    fail(`real-session case "${name}" failed before hooks because Claude Code rejected the active model alias. Set HELLO2CC_REAL_MODEL to a valid Claude Code model alias or fix your current Claude Code model mapping first.`);
  }
}

function assertRequiredTools(name, initLine) {
  const requiredTools = ['ToolSearch', 'Task', 'TaskOutput', 'TaskStop'];
  for (const tool of requiredTools) {
    if (!Array.isArray(initLine.tools) || !initLine.tools.includes(tool)) {
      fail(`real-session case "${name}" missing native tool "${tool}"`);
    }
  }
}

function assertRequiredAgents(name, initLine) {
  const requiredAgents = [
    ['general-purpose', 'General-Purpose', 'General Purpose'],
    ['Explore'],
    ['Plan'],
  ];

  for (const aliases of requiredAgents) {
    if (!Array.isArray(initLine.agents) || !aliases.some((agent) => initLine.agents.includes(agent))) {
      fail(`real-session case "${name}" missing native agent "${aliases[0]}"`);
    }
  }
}

function assertInitSurface(name, initLine) {
  if (!initLine) {
    fail(`real-session case "${name}" did not emit init event`);
  }

  const pluginLoaded = Array.isArray(initLine.plugins) && initLine.plugins.some((plugin) => plugin.name === 'hello2cc');
  if (!pluginLoaded) {
    fail(`real-session case "${name}" did not load hello2cc`);
  }

  assertRequiredTools(name, initLine);
  assertRequiredAgents(name, initLine);

  if (!Array.isArray(initLine.agents) || !initLine.agents.includes('hello2cc:native')) {
    fail(`real-session case "${name}" missing namespaced hello2cc main agent`);
  }

  assertPluginCacheShape(getHello2ccPluginPath(initLine), name);
}

function assertSessionExpectations(name, lines, sessionExpectations) {
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
}

/**
 * Runs one real Claude CLI session and asserts hello2cc surfaces the expected host-state contract.
 */
export function runCase(name, prompt, sessionExpectations) {
  const { args, debugPath } = buildClaudeArgs(name, prompt);
  const result = spawnClaude(args);

  if (result.error || result.status !== 0) {
    writeFileSync(debugPath, result.stdout || '', 'utf8');
    const lines = parseJsonLines(result.stdout || '');
    failInvalidModelAlias(name, lines);
    fail(`real-session case "${name}" failed: ${result.stderr || result.error?.message || 'unknown error'}`);
  }

  const lines = parseJsonLines(result.stdout);
  const initLine = lines.find((line) => line.type === 'system' && line.subtype === 'init');
  assertInitSurface(name, initLine);
  assertSessionExpectations(name, lines, sessionExpectations);
  ok(`real-session ${name}`);
}

/**
 * Runs the full real-session regression suite, including install smoke and state restoration.
 */
export function runRealRegression() {
  ensureClaudeCli();
  runIsolatedInstallSmoke();
  const pluginState = ensureHello2ccEnabled();
  let primaryError = null;

  try {
    runCase('baseline', 'Reply with exactly OK.', [
      'hello2cc host_state',
      '"semantic_routing": "model_decides"',
      'ToolSearch',
    ]);
    runCase('repeat', 'Reply with exactly STILL_OK.', [
      'hello2cc host_state',
      '"semantic_routing": "model_decides"',
      'ToolSearch',
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
