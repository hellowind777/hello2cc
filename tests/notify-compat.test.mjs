import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const scriptPath = resolve('scripts/notify.mjs');
const realRegressionScriptPath = resolve('scripts/claude-real-regression.mjs');
const repoRoot = resolve('.');

function isolatedEnv(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'hello2cc-notify-test-'));

  return {
    ...process.env,
    HOME: root,
    USERPROFILE: root,
    CLAUDE_PLUGIN_DATA: join(root, 'plugin-data'),
    CLAUDE_PLUGIN_ROOT: resolve('.'),
    ...overrides,
  };
}

function runNotify(args, payload = '', env = isolatedEnv()) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: resolve('.'),
    env,
    input: payload,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  return result;
}

function createFakeClaudeHome(root, behavior) {
  const appData = join(root, 'appdata');
  const npmDir = join(appData, 'npm');
  mkdirSync(npmDir, { recursive: true });

  const logPath = join(root, 'claude-log.txt');
  const stdoutFile = join(root, 'stream.jsonl');
  if (behavior.streamJsonl) {
    writeFileSync(stdoutFile, behavior.streamJsonl, 'utf8');
  }

  const quotedLogPath = logPath.replace(/'/g, "''");
  const quotedStdoutFile = stdoutFile.replace(/'/g, "''");
  const quotedStderr = String(behavior.stderrOutput || '').replace(/'/g, "''");
  const quotedPrintStderr = String(behavior.printStderr || '').replace(/'/g, "''");
  const exitCode = Number.isInteger(behavior.exitCode) ? behavior.exitCode : 42;
  const printExitCode = Number.isInteger(behavior.printExitCode) ? behavior.printExitCode : (behavior.streamJsonl ? 0 : exitCode);
  const enableExitCode = Number.isInteger(behavior.enableExitCode) ? behavior.enableExitCode : 0;
  const disableExitCode = Number.isInteger(behavior.disableExitCode) ? behavior.disableExitCode : 0;
  const listLines = String(behavior.listOutput || '')
    .split('\n')
    .filter(Boolean)
    .map((line) => `Write-Output '${String(line).replace(/'/g, "''")}'`)
    .join('\n');
  const printBody = behavior.streamJsonl ? `Get-Content -Raw '${quotedStdoutFile}' | Write-Output` : '';

  const psScript = `param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Rest)
$logPath = '${quotedLogPath}'
if ($Rest) { Add-Content -Path $logPath -Value ($Rest -join ' ') }
if ($Rest.Count -ge 2 -and (($Rest[0] -eq 'plugin') -or ($Rest[0] -eq 'plugins')) -and $Rest[1] -eq '--help') { exit 0 }
if ($Rest.Count -ge 2 -and (($Rest[0] -eq 'plugin') -or ($Rest[0] -eq 'plugins')) -and $Rest[1] -eq 'list') {
${listLines}
  exit 0
}
if ($Rest.Count -ge 2 -and (($Rest[0] -eq 'plugin') -or ($Rest[0] -eq 'plugins')) -and $Rest[1] -eq 'enable') { exit ${enableExitCode} }
if ($Rest.Count -ge 2 -and (($Rest[0] -eq 'plugin') -or ($Rest[0] -eq 'plugins')) -and $Rest[1] -eq 'disable') { exit ${disableExitCode} }
if ($Rest.Count -ge 1 -and $Rest[0] -eq '-p') {
  if (${behavior.printStderr ? '$true' : '$false'}) { [Console]::Error.WriteLine('${quotedPrintStderr}') }
  ${printBody}
  exit ${printExitCode}
}
if (${behavior.stderrOutput ? '$true' : '$false'}) { [Console]::Error.WriteLine('${quotedStderr}') }
exit ${exitCode}
`;

  writeFileSync(join(npmDir, 'claude.ps1'), psScript, 'utf8');
  return { appData, logPath, stdoutFile };
}

test('notify inject stays compatible with the new session-start orchestration', () => {
  const result = runNotify(
    ['inject'],
    JSON.stringify({
      session_id: 'compat-inject',
      model: 'opus',
    }),
  );

  const payload = JSON.parse(result.stdout);
  assert.match(payload.hookSpecificOutput.additionalContext, /ToolSearch/);
  assert.equal(payload.suppressOutput, true);
});

test('notify stop is a safe no-op for stale stop-hook references', () => {
  const result = runNotify(
    ['stop'],
    JSON.stringify({
      hook_event_name: 'Stop',
    }),
  );

  assert.deepEqual(JSON.parse(result.stdout), { suppressOutput: true });
});

test('notify codex-notify exits cleanly for stale notification-program references', () => {
  const result = runNotify(['codex-notify']);

  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('real regression script fails fast when Claude CLI is unavailable', () => {
  const result = spawnSync(process.execPath, [realRegressionScriptPath], {
    cwd: repoRoot,
    env: {
      ...isolatedEnv(),
      PATH: '',
      APPDATA: '',
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /claude CLI is required for real-session regression/);
});

test('windows fake claude home can fail -p invocations and exposes logPath', () => {
  if (process.platform !== 'win32') {
    return;
  }

  const root = mkdtempSync(join(tmpdir(), 'hello2cc-fake-claude-home-'));
  const fake = createFakeClaudeHome(root, {
    listOutput: '  ❯ hello2cc@hello2cc-local\n    Version: 0.1.1\n    Scope: user\n    Status: ✔ enabled\n',
    printStderr: 'ORIGINAL_STDERR',
    printExitCode: 42,
    exitCode: 0,
  });

  const ps1Path = join(fake.appData, 'npm', 'claude.ps1');
  const ps1Text = readFileSync(ps1Path, 'utf8');
  assert.ok(fake.logPath.endsWith('claude-log.txt'));
  assert.match(ps1Text, /\$Rest\[0\] -eq '-p'/);
  assert.match(ps1Text, /ORIGINAL_STDERR/);
  assert.match(ps1Text, /exit 42/);
});

test('real regression script does not hide the original Claude failure', () => {
  if (process.platform === 'win32') {
    return;
  }

  const root = mkdtempSync(join(tmpdir(), 'hello2cc-fake-claude-'));
  const fakeClaude = join(root, 'claude');
  writeFileSync(fakeClaude, '#!/bin/sh\nif [ "$1" = "plugin" ] || [ "$1" = "plugins" ]; then exit 0; fi\necho ORIGINAL_STDERR 1>&2\nexit 42\n', { mode: 0o755 });

  const result = spawnSync(process.execPath, [realRegressionScriptPath], {
    cwd: repoRoot,
    env: {
      ...isolatedEnv(),
      PATH: `${root}:${process.env.PATH || ''}`,
      APPDATA: '',
      HELLO2CC_REAL_MODEL: 'opus',
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /ORIGINAL_STDERR/);
});

test('real regression script preserves original error when restore also fails', () => {
  if (process.platform === 'win32') {
    return;
  }

  const root = mkdtempSync(join(tmpdir(), 'hello2cc-fake-restore-fail-'));
  const fakeClaude = join(root, 'claude');
  writeFileSync(fakeClaude, '#!/bin/sh\nif [ "$1" = "plugin" ] || [ "$1" = "plugins" ]; then\n  if [ "$2" = "--help" ]; then exit 0; fi\n  if [ "$2" = "list" ]; then\n    printf "hello2cc@hello2cc-local\\n  Scope: user\\n  Status: ✘ disabled\\n"\n    exit 0\n  fi\n  if [ "$2" = "enable" ]; then exit 0; fi\n  if [ "$2" = "disable" ]; then exit 9; fi\n  exit 0\nfi\necho ORIGINAL_STDERR 1>&2\nexit 42\n', { mode: 0o755 });

  const result = spawnSync(process.execPath, [realRegressionScriptPath], {
    cwd: repoRoot,
    env: {
      ...isolatedEnv(),
      PATH: `${root}:${process.env.PATH || ''}`,
      APPDATA: '',
      HELLO2CC_REAL_MODEL: 'opus',
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /ORIGINAL_STDERR/);
  assert.match(result.stderr, /restore also failed/);
});

