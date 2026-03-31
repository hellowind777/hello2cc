import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
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

test('session-start stays native-first and skill-free', () => {
  const env = isolatedEnv();
  const output = run('session-start', {
    session_id: 'session-1',
    model: 'opus',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /ToolSearch/);
  assert.match(context, /Output style bootstrap/);
  assert.match(context, /mirror_session_model/);
  assert.doesNotMatch(context, /Skill\(/);
  assert.doesNotMatch(context, /skills?/i);
});

test('route promotes native guide flow without skill references', () => {
  const env = isolatedEnv();
  run('session-start', {
    session_id: 'route-guide',
    model: 'opus',
  }, env);
  const output = run('route', {
    session_id: 'route-guide',
    prompt: 'How do Claude Code hooks and MCP permissions work?',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /Claude Code Guide/);
  assert.match(context, /ToolSearch/);
  assert.doesNotMatch(context, /Skill\(/);
  assert.doesNotMatch(context, /skills?/i);
});

test('route extracts prompt text from structured payloads', () => {
  const env = isolatedEnv();
  run('session-start', {
    session_id: 'route-structured',
    model: 'opus',
  }, env);
  const output = run('route', {
    session_id: 'route-structured',
    prompt: {
      role: 'user',
      content: [
        { type: 'text', text: 'Research this repo, implement the change, and verify the result.' },
      ],
    },
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /TeamCreate/);
  assert.match(context, /TaskCreate/);
});

test('route promotes TeamCreate plus Task tracking for multi-track work', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-team',
    prompt: 'Research this repo, implement the change, and verify the result without making edits yet.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /TeamCreate/);
  assert.match(context, /TaskCreate/);
  assert.match(context, /research/);
  assert.match(context, /verification/);
});

test('route promotes General-Purpose for bounded implementation slices', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-general',
    prompt: 'Implement a focused one-file fix and validate it.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /General-Purpose/);
});

test('route promotes ToolSearch for MCP-backed work', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-mcp',
    prompt: 'Use MCP or connected tools to inspect external systems if available.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /ToolSearch/);
  assert.match(context, /MCP/);
});

test('route skips explicit slash commands', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-slash',
    prompt: '/config',
  }, env);

  assert.deepEqual(output, { suppressOutput: true });
});

test('pre-agent-model injects guide model using official permission fields', () => {
  const env = isolatedEnv();
  const output = run(
    'pre-agent-model',
    {
      session_id: 'guide-model',
      tool_name: 'Agent',
      tool_input: {
        subagent_type: 'Claude Code Guide',
      },
    },
    {
      ...env,
      CLAUDE_PLUGIN_OPTION_GUIDE_MODEL: 'cc-gpt-5.4',
    },
  );

  assert.equal(output.hookSpecificOutput.permissionDecision, 'allow');
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /cc-gpt-5\.4/);
  assert.equal(output.hookSpecificOutput.updatedInput.model, 'cc-gpt-5.4');
});

test('pre-agent-model injects lightweight explore model', () => {
  const env = isolatedEnv();
  const output = run(
    'pre-agent-model',
    {
      session_id: 'explore-model',
      tool_name: 'Agent',
      tool_input: {
        subagent_type: 'Explore',
      },
    },
    {
      ...env,
      CLAUDE_PLUGIN_OPTION_EXPLORE_MODEL: 'cc-gpt-5.3-codex-medium',
    },
  );

  assert.equal(output.hookSpecificOutput.updatedInput.model, 'cc-gpt-5.3-codex-medium');
});

test('pre-agent-model injects team model when only team_name is present', () => {
  const env = isolatedEnv();
  const output = run(
    'pre-agent-model',
    {
      session_id: 'team-model',
      tool_name: 'Agent',
      tool_input: {
        team_name: 'delivery-squad',
      },
    },
    {
      ...env,
      CLAUDE_PLUGIN_OPTION_TEAM_MODEL: 'cc-gpt-5.4',
    },
  );

  assert.equal(output.hookSpecificOutput.updatedInput.model, 'cc-gpt-5.4');
});

test('pre-agent-model respects explicit model input', () => {
  const env = isolatedEnv();
  const output = run('pre-agent-model', {
    session_id: 'explicit-model',
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'Plan',
      model: 'custom-model',
    },
  }, env);

  assert.deepEqual(output, { suppressOutput: true });
});

test('pre-agent-model mirrors the current session model alias by default', () => {
  const env = isolatedEnv();

  run('session-start', {
    session_id: 'mirror-session',
    model: 'opus',
  }, env);

  const output = run('pre-agent-model', {
    session_id: 'mirror-session',
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'Plan',
    },
  }, env);

  assert.equal(output.hookSpecificOutput.updatedInput.model, 'opus');
});

test('session-start bootstraps managed output style into user settings once', () => {
  const env = isolatedEnv();
  run('session-start', {
    session_id: 'bootstrap-style',
    model: 'opus',
  }, env);

  const settingsPath = join(env.HOME, '.claude', 'settings.json');
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));

  assert.equal(settings.outputStyle, 'hello2cc Native');
});
