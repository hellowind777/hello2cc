import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const scriptPath = resolve('scripts/orchestrator.mjs');

export { test, assert, existsSync, mkdirSync, readFileSync, writeFileSync, join };

export function parseAdditionalContextJson(text) {
  const match = String(text || '').match(/```json\r?\n([\s\S]*?)\r?\n```/);
  assert.ok(match, 'expected a json code block in additionalContext');
  return JSON.parse(match[1]);
}

export function run(cmd, payload, env = {}) {
  const result = spawnSync(process.execPath, [scriptPath, cmd], {
    cwd: resolve('.'),
    env: {
      ...process.env,
      ...env,
    },
    input: payload ? JSON.stringify(payload) : '',
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  return result.stdout ? JSON.parse(result.stdout) : {};
}

export function isolatedEnv(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'hello2cc-test-'));

  return {
    HOME: root,
    USERPROFILE: root,
    CLAUDE_PLUGIN_DATA: join(root, 'plugin-data'),
    CLAUDE_PLUGIN_ROOT: resolve('.'),
    ...overrides,
  };
}

export function writeTranscript(root, sessionId, payload, extraRecords = []) {
  const transcriptPath = join(root, 'session.jsonl');
  const records = [
    {
      type: 'system',
      subtype: 'init',
      session_id: sessionId,
      ...payload,
    },
    ...extraRecords,
  ];
  writeFileSync(transcriptPath, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`, 'utf8');
  return transcriptPath;
}
