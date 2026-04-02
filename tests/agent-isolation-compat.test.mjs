import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const orchestratorPath = resolve('scripts/orchestrator.mjs');
const subagentContextPath = resolve('scripts/subagent-context.mjs');

function run(cmd, payload, env = {}) {
  const result = spawnSync(process.execPath, [orchestratorPath, cmd], {
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

function isolatedEnv(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'hello2cc-test-'));

  return {
    HOME: root,
    USERPROFILE: root,
    CLAUDE_PLUGIN_DATA: join(root, 'plugin-data'),
    CLAUDE_PLUGIN_ROOT: resolve('.'),
    ...overrides,
  };
}

test('pre-agent-model strips implicit worktree isolation when the user did not request it', () => {
  const env = isolatedEnv();

  run('route', {
    session_id: 'strip-worktree',
    prompt: 'Implement this focused fix and validate it.',
  }, env);

  const output = run('pre-agent-model', {
    session_id: 'strip-worktree',
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'general-purpose',
      isolation: 'worktree',
    },
  }, env);

  assert.equal(output.hookSpecificOutput.updatedInput.isolation, undefined);
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /removed Agent\.isolation=worktree/);
});

test('pre-agent-model preserves explicit worktree isolation when the user asked for it', () => {
  const env = isolatedEnv({
    CLAUDE_PLUGIN_OPTION_DEFAULT_AGENT_MODEL: 'opus',
  });

  run('route', {
    session_id: 'keep-worktree',
    prompt: 'Use a git worktree for an isolated worktree while changing this feature.',
  }, env);

  const output = run('pre-agent-model', {
    session_id: 'keep-worktree',
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'general-purpose',
      isolation: 'worktree',
    },
  }, env);

  assert.equal(output.hookSpecificOutput.updatedInput.isolation, 'worktree');
  assert.equal(output.hookSpecificOutput.updatedInput.model, 'opus');
});

test('sanitize-only compatibility mode suppresses overlays but keeps pretool sanitization', () => {
  const env = isolatedEnv({
    CLAUDE_PLUGIN_OPTION_COMPATIBILITY_MODE: 'sanitize-only',
  });

  const sessionOutput = run('session-start', {
    session_id: 'sanitize-only-mode',
    model: 'opus',
  }, env);
  assert.deepEqual(sessionOutput, { suppressOutput: true });

  const routeOutput = run('route', {
    session_id: 'sanitize-only-mode',
    prompt: 'Implement this focused fix and validate it.',
  }, env);
  assert.deepEqual(routeOutput, { suppressOutput: true });

  const pretoolOutput = run('pre-agent-model', {
    session_id: 'sanitize-only-mode',
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'general-purpose',
      isolation: 'worktree',
    },
  }, env);
  assert.equal(pretoolOutput.hookSpecificOutput.updatedInput.isolation, undefined);

  const subagentOutput = spawnSync(process.execPath, [subagentContextPath, 'explore'], {
    cwd: resolve('.'),
    env: {
      ...process.env,
      ...env,
    },
    encoding: 'utf8',
  });

  assert.equal(subagentOutput.status, 0, subagentOutput.stderr);
  assert.deepEqual(JSON.parse(subagentOutput.stdout), { suppressOutput: true });
});
