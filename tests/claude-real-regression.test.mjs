import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

const scriptPath = resolve('scripts/claude-real-regression.mjs');
const repoRoot = resolve('.');

function isolatedEnv() {
  const root = mkdtempSync(join(tmpdir(), 'hello2cc-real-regression-'));
  return {
    root,
    env: {
      ...process.env,
      HOME: root,
      USERPROFILE: root,
      APPDATA: '',
      PATH: process.env.PATH || '',
    },
  };
}

function createPluginCache(root) {
  const pluginPath = join(root, 'plugin-cache');
  mkdirSync(join(pluginPath, '.claude-plugin'), { recursive: true });
  mkdirSync(join(pluginPath, 'agents'), { recursive: true });
  mkdirSync(join(pluginPath, 'output-styles'), { recursive: true });

  writeFileSync(join(pluginPath, '.claude-plugin', 'plugin.json'), JSON.stringify({
    name: 'hello2cc',
    version: '0.2.3',
  }), 'utf8');
  writeFileSync(join(pluginPath, 'settings.json'), JSON.stringify({
    agent: 'hello2cc:native',
  }), 'utf8');
  writeFileSync(join(pluginPath, 'agents', 'native.md'), '# hello2cc native\n', 'utf8');
  writeFileSync(join(pluginPath, 'output-styles', 'hello2cc-native.md'), '---\nforce-for-plugin: true\n---\n', 'utf8');
  return pluginPath;
}

function createSuccessfulStream(pluginPath) {
  const initLine = {
    type: 'system',
    subtype: 'init',
    plugins: [{ name: 'hello2cc', path: pluginPath }],
    tools: ['ToolSearch', 'Task', 'TaskOutput', 'TaskStop'],
    agents: ['Explore', 'Plan', 'General-Purpose', 'hello2cc:native'],
  };
  const hookLine = {
    type: 'system',
    subtype: 'hook_response',
    output: JSON.stringify({
      hookSpecificOutput: {
        additionalContext: '# hello2cc host_state\n\nTreat this as host state only.\n\n```json\n{\n  "protocol_adapters": {\n    "semantic_routing": "model_decides"\n  },\n  "host": {\n    "tools": [\n      "ToolSearch"\n    ]\n  }\n}\n```',
      },
    }),
  };
  return `${JSON.stringify(initLine)}\n${JSON.stringify(hookLine)}\n`;
}

function createFakeClaudeRunner(root, behavior) {
  const logPath = join(root, 'claude-log.txt');
  const behaviorPath = join(root, 'claude-behavior.json');
  const runnerPath = join(root, 'claude-runner.mjs');

  writeFileSync(behaviorPath, JSON.stringify({
    ...behavior,
    logPath,
  }), 'utf8');

  const runnerSource = `#!/usr/bin/env node
import { appendFileSync, readFileSync } from 'node:fs';

const behavior = JSON.parse(readFileSync(${JSON.stringify(behaviorPath)}, 'utf8'));
const args = process.argv.slice(2);
appendFileSync(behavior.logPath, \`\${args.join(' ')}\\n\`, 'utf8');

const first = args[0] || '';
const second = args[1] || '';
const pluginCommand = first === 'plugin' || first === 'plugins';
const helpCommands = new Set(Array.isArray(behavior.helpCommands) ? behavior.helpCommands : ['plugins']);

if (pluginCommand && second === '--help') {
  process.exit(helpCommands.has(first) ? 0 : 1);
}

if (pluginCommand && second === 'list') {
  const wantsJson = args.includes('--json');
  process.stdout.write(String(wantsJson ? behavior.listJsonOutput || '[]' : behavior.listOutput || ''));
  process.exit(0);
}

if (pluginCommand && second === 'marketplace' && args[2] === 'add') {
  process.exit(0);
}

if (pluginCommand && second === 'install') {
  process.exit(0);
}

if (pluginCommand && second === 'enable') {
  process.exit(Number.isInteger(behavior.enableExitCode) ? behavior.enableExitCode : 0);
}

if (pluginCommand && second === 'disable') {
  process.exit(Number.isInteger(behavior.disableExitCode) ? behavior.disableExitCode : 0);
}

if (first === '-p') {
  if (behavior.printStderr) {
    process.stderr.write(\`\${behavior.printStderr}\\n\`);
  }
  if (behavior.streamJsonl) {
    process.stdout.write(String(behavior.streamJsonl));
  }
  process.exit(Number.isInteger(behavior.printExitCode) ? behavior.printExitCode : 0);
}

if (behavior.stderrOutput) {
  process.stderr.write(\`\${behavior.stderrOutput}\\n\`);
}

process.exit(Number.isInteger(behavior.exitCode) ? behavior.exitCode : 0);
`;

  writeFileSync(runnerPath, runnerSource, 'utf8');
  return { logPath, runnerPath };
}

function createFakeClaudeEnv(options = {}) {
  const { root, env } = isolatedEnv();
  const pluginPath = createPluginCache(root);
  const behavior = {
    helpCommands: options.helpCommands || ['plugins'],
    listOutput: options.listOutput || `Installed plugins:\n\n  hello2cc@hello2cc-local\n    Scope: user\n    Status: ✔ enabled\n`,
    listJsonOutput: options.listJsonOutput || JSON.stringify([
      {
        id: 'hello2cc@hello2cc-local',
        enabled: true,
        installPath: pluginPath,
      },
    ]),
    enableExitCode: options.enableExitCode,
    disableExitCode: options.disableExitCode,
    printStderr: options.printStderr,
    printExitCode: options.printExitCode,
    streamJsonl: options.streamJsonl ?? createSuccessfulStream(pluginPath),
    stderrOutput: options.stderrOutput,
    exitCode: options.exitCode,
  };
  const { logPath, runnerPath } = createFakeClaudeRunner(root, behavior);
  const transport = options.transport || (process.platform === 'win32' ? 'ps1' : 'direct');

  if (process.platform === 'win32' && transport === 'ps1') {
    const appData = join(root, 'appdata');
    const npmDir = join(appData, 'npm');
    mkdirSync(npmDir, { recursive: true });
    const ps1Path = join(npmDir, 'claude.ps1');
    writeFileSync(ps1Path, `param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Rest)\n& ${JSON.stringify(process.execPath)} ${JSON.stringify(runnerPath)} @Rest\nexit $LASTEXITCODE\n`, 'utf8');
    env.APPDATA = appData;
    env.PATH = process.env.PATH || '';
  } else if (process.platform === 'win32') {
    const cmdPath = join(root, 'claude.cmd');
    writeFileSync(cmdPath, `@echo off\r\n\"${process.execPath}\" \"${runnerPath}\" %*\r\nexit /b %ERRORLEVEL%\r\n`, 'utf8');
    env.APPDATA = '';
    env.PATH = `${root}${delimiter}${process.env.PATH || ''}`;
  } else {
    const cliPath = join(root, 'claude');
    writeFileSync(cliPath, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(runnerPath)} "$@"\n`, 'utf8');
    chmodSync(cliPath, 0o755);
    env.APPDATA = '';
    env.PATH = `${root}${delimiter}${process.env.PATH || ''}`;
  }

  return { env, logPath };
}

function runRealRegression(env) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  });
}

test('real regression fails fast when Claude CLI is unavailable', () => {
  const { root, env } = isolatedEnv();
  env.APPDATA = '';
  env.PATH = root;

  const result = runRealRegression(env);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /claude CLI is required for real-session regression/);
});

test('real regression accepts singular plugin command and restores disabled plugin state', () => {
  const { env, logPath } = createFakeClaudeEnv({
    helpCommands: ['plugin'],
    listOutput: 'hello2cc@hello2cc-local\n  Scope: user\n  Status: ✘ disabled\n',
  });

  const result = runRealRegression(env);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /OK real-session baseline/);
  assert.match(result.stdout, /OK real-session repeat/);

  const logText = readFileSync(logPath, 'utf8');
  assert.match(logText, /^plugin --help/m);
  assert.match(logText, /^plugin list/m);
  assert.match(logText, /^plugin enable --scope user hello2cc@hello2cc-local/m);
  assert.match(logText, /^plugin disable --scope user hello2cc@hello2cc-local/m);
  assert.doesNotMatch(logText, /^plugins list/m);
});

test('real regression falls back to PATH Claude binary when claude.ps1 is missing', () => {
  const { env, logPath } = createFakeClaudeEnv({
    transport: 'direct',
  });

  const result = runRealRegression(env);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /OK real-session baseline/);
  assert.match(readFileSync(logPath, 'utf8'), /^plugins --help/m);
});

test('real regression preserves original failure when restore also fails', () => {
  const { env } = createFakeClaudeEnv({
    helpCommands: ['plugins'],
    listOutput: 'hello2cc@hello2cc-local\n  Scope: user\n  Status: ✘ disabled\n',
    enableExitCode: 0,
    disableExitCode: 9,
    printExitCode: 42,
    printStderr: 'ORIGINAL_STDERR',
    streamJsonl: '',
  });

  const result = runRealRegression(env);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /ORIGINAL_STDERR/);
  assert.match(result.stderr, /restore also failed/);
});
