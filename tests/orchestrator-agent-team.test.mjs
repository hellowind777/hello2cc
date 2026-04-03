import {
  test,
  assert,
  run,
  isolatedEnv,
} from './helpers/orchestrator-test-helpers.mjs';

test('pre-agent-model strips implicit teammate fields for plain workers', () => {
  const env = isolatedEnv();
  const output = run('pre-agent-model', {
    session_id: 'plain-subagent',
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'Explore',
      name: 'module-reader',
    },
  }, env);

  assert.equal(output.hookSpecificOutput.updatedInput.name, undefined);
  assert.equal(output.hookSpecificOutput.updatedInput.team_name, undefined);
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /plain workers should omit name\/team_name/i);
});

test('pre-agent-model preserves explicit real team_name and can inject team model', () => {
  const env = isolatedEnv({
    CLAUDE_PLUGIN_OPTION_TEAM_MODEL: 'sonnet',
  });
  const output = run('pre-agent-model', {
    session_id: 'explicit-team',
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'general-purpose',
      name: 'frontend-owner',
      team_name: 'delivery-squad',
    },
  }, env);

  assert.equal(output.hookSpecificOutput.updatedInput.name, 'frontend-owner');
  assert.equal(output.hookSpecificOutput.updatedInput.team_name, 'delivery-squad');
  assert.equal(output.hookSpecificOutput.updatedInput.model, 'sonnet');
});

test('pre-agent-model strips reserved assistant team placeholders', () => {
  const env = isolatedEnv();
  const output = run('pre-agent-model', {
    session_id: 'reserved-team-name',
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'general-purpose',
      name: 'explore-export-page',
      team_name: 'main',
    },
  }, env);

  assert.equal(output.hookSpecificOutput.updatedInput.name, undefined);
  assert.equal(output.hookSpecificOutput.updatedInput.team_name, undefined);
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /reserved assistant team placeholders/i);
});
