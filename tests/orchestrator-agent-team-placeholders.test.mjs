import {
  test,
  assert,
  run,
  isolatedEnv,
  writeTranscript,
} from './helpers/orchestrator-test-helpers.mjs';

test('pre-agent-model strips omitted placeholder team_name values before native Agent routing', () => {
  const env = isolatedEnv();
  const sessionId = 'placeholder-team-name';

  run('route', {
    session_id: sessionId,
    prompt: 'Coordinate research and implementation with teammates on a shared task board.',
  }, env);

  const output = run('pre-agent-model', {
    session_id: sessionId,
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'general-purpose',
      name: 'implement',
      team_name: '__omit__',
    },
  }, env);

  assert.equal(output.hookSpecificOutput.updatedInput.name, undefined);
  assert.equal(output.hookSpecificOutput.updatedInput.team_name, undefined);
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /placeholder Agent\.team_name/i);
});

test('pre-agent-model replaces placeholder team_name with verified active team context', () => {
  const env = isolatedEnv();
  const sessionId = 'placeholder-team-name-active-team';

  run('post-tool-use', {
    session_id: sessionId,
    tool_name: 'TeamCreate',
    tool_input: {
      team_name: 'delivery-squad',
    },
    tool_response: {
      team_name: 'delivery-squad',
    },
  }, env);

  run('post-tool-use', {
    session_id: sessionId,
    tool_name: 'TaskCreate',
    tool_input: {
      subject: 'Implement frontend slice',
      description: 'Real team continuity exists now',
    },
    tool_response: {
      task: {
        id: '1',
        subject: 'Implement frontend slice',
      },
    },
  }, env);

  run('route', {
    session_id: sessionId,
    prompt: 'Continue coordinating teammates on the shared task board for this implementation.',
  }, env);

  const output = run('pre-agent-model', {
    session_id: sessionId,
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'general-purpose',
      name: 'frontend-owner',
      team_name: 'none',
    },
  }, env);

  assert.equal(output.hookSpecificOutput.updatedInput.name, 'frontend-owner');
  assert.equal(output.hookSpecificOutput.updatedInput.team_name, 'delivery-squad');
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /verified active team context/i);
});

test('transcript placeholder team names do not poison active team autofill', () => {
  const env = isolatedEnv();
  const sessionId = 'transcript-placeholder-team';
  const transcriptPath = writeTranscript(env.HOME, sessionId, {
    team_name: '__omit__',
  });

  run('route', {
    session_id: sessionId,
    prompt: 'Continue coordinating teammates on the shared task board for this implementation.',
    transcript_path: transcriptPath,
  }, env);

  run('post-tool-use', {
    session_id: sessionId,
    tool_name: 'TaskCreate',
    tool_input: {
      subject: 'Implement frontend slice',
      description: 'Task board exists but transcript team placeholder should be ignored',
    },
    tool_response: {
      task: {
        id: '1',
        subject: 'Implement frontend slice',
      },
    },
    transcript_path: transcriptPath,
  }, env);

  const output = run('pre-agent-model', {
    session_id: sessionId,
    tool_name: 'Agent',
    tool_input: {
      subagent_type: 'general-purpose',
      name: 'frontend-owner',
    },
    transcript_path: transcriptPath,
  }, env);

  assert.equal(output.hookSpecificOutput.updatedInput.name, undefined);
  assert.equal(output.hookSpecificOutput.updatedInput.team_name, undefined);
});
