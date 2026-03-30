import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

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

test('session-start stays native-first and mentions one-time output style', () => {
  const output = run('session-start');
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /ToolSearch/);
  assert.match(context, /Optional one-time output style/);
  assert.doesNotMatch(context, /Skill\(/);
});

test('route promotes native guide flow without skill-first routing', () => {
  const output = run('route', {
    prompt: 'How do Claude Code hooks and MCP permissions work?',
  });
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /Claude Code Guide/);
  assert.match(context, /ToolSearch/);
  assert.doesNotMatch(context, /Skill\(/);
});

test('route skips explicit slash commands', () => {
  const output = run('route', {
    prompt: '/hello2cc:hello2cc-research',
  });

  assert.deepEqual(output, { suppressOutput: true });
});

test('pre-agent-model injects guide model using official permission fields', () => {
  const output = run(
    'pre-agent-model',
    {
      tool_name: 'Agent',
      tool_input: {
        subagent_type: 'Claude Code Guide',
      },
    },
    {
      CLAUDE_PLUGIN_OPTION_GUIDE_MODEL: 'cc-gpt-5.4',
    },
  );

  assert.equal(output.hookSpecificOutput.permissionDecision, 'allow');
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /cc-gpt-5\.4/);
  assert.equal(output.hookSpecificOutput.updatedInput.model, 'cc-gpt-5.4');
});

test('pre-agent-model injects lightweight explore model', () => {
  const output = run(
    'pre-agent-model',
    {
      tool_name: 'Agent',
      tool_input: {
        subagent_type: 'Explore',
      },
    },
    {
      CLAUDE_PLUGIN_OPTION_EXPLORE_MODEL: 'cc-gpt-5.3-codex-medium',
    },
  );

  assert.equal(output.hookSpecificOutput.updatedInput.model, 'cc-gpt-5.3-codex-medium');
});

test('pre-agent-model injects team model when only team_name is present', () => {
  const output = run(
    'pre-agent-model',
    {
      tool_name: 'Agent',
      tool_input: {
        team_name: 'delivery-squad',
      },
    },
    {
      CLAUDE_PLUGIN_OPTION_TEAM_MODEL: 'cc-gpt-5.4',
    },
  );

  assert.equal(output.hookSpecificOutput.updatedInput.model, 'cc-gpt-5.4');
});

test('pre-agent-model respects explicit model input', () => {
  const output = run('pre-agent-model', {
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'Plan',
      model: 'custom-model',
    },
  });

  assert.deepEqual(output, { suppressOutput: true });
});
