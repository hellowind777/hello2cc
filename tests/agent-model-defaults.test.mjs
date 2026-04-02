import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const scriptPath = resolve('scripts/orchestrator.mjs');

function run(cmd, payload, env = {}) {
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

test('pre-agent-model injects default_agent_model for general-purpose workers and normalizes opus(1M)', () => {
  const env = isolatedEnv({
    CLAUDE_PLUGIN_OPTION_DEFAULT_AGENT_MODEL: 'opus(1M)',
  });

  const output = run('pre-agent-model', {
    session_id: 'default-general-model',
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'general-purpose',
    },
  }, env);

  assert.equal(output.hookSpecificOutput.updatedInput.model, 'opus');
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /Agent\.model=opus/);
});

test('pre-agent-model applies default_agent_model to Plan when explicitly configured', () => {
  const env = isolatedEnv({
    CLAUDE_PLUGIN_OPTION_DEFAULT_AGENT_MODEL: 'opus(1M)',
  });

  const output = run('pre-agent-model', {
    session_id: 'default-plan-model',
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'Plan',
    },
  }, env);

  assert.equal(output.hookSpecificOutput.updatedInput.model, 'opus');
});

test('pre-agent-model lets inherit opt out of default_agent_model for per-agent overrides', () => {
  const env = isolatedEnv({
    CLAUDE_PLUGIN_OPTION_DEFAULT_AGENT_MODEL: 'opus',
    CLAUDE_PLUGIN_OPTION_GUIDE_MODEL: 'inherit',
  });

  const output = run('pre-agent-model', {
    session_id: 'guide-inherit-override',
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'claude-code-guide',
    },
  }, env);

  assert.deepEqual(output, { suppressOutput: true });
});
