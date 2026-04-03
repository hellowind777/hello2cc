import {
  test,
  assert,
  parseAdditionalContextJson,
  run,
  isolatedEnv,
  writeTranscript,
} from './helpers/orchestrator-test-helpers.mjs';

test('route suppresses output for ordinary prompts when there is no dynamic host update', () => {
  const env = isolatedEnv();
  run('session-start', {
    session_id: 'route-minimal',
    model: 'opus',
    tools: ['Agent', 'ToolSearch'],
  }, env);

  const output = run('route', {
    session_id: 'route-minimal',
    prompt: 'Implement a focused one-file fix and verify it.',
  }, env);

  assert.deepEqual(output, { suppressOutput: true });
});

test('route emits dynamic host state when transcript surfaces skills workflows or team state', () => {
  const env = isolatedEnv();
  const sessionId = 'route-dynamic-state';
  const transcriptPath = writeTranscript(env.HOME, sessionId, {
    model: 'opus',
    tools: ['Skill', 'DiscoverSkills', 'ToolSearch'],
  }, [
    {
      type: 'assistant',
      session_id: sessionId,
      teamName: 'delivery-squad',
      agentName: 'team-lead',
      message: {
        content: [
          {
            type: 'text',
            text: '<command-name>release</command-name>\n<skill-format>true</skill-format>',
          },
        ],
      },
      attachments: [
        {
          type: 'skill_discovery',
          skills: [
            { name: 'release', description: 'Ship and publish changes' },
          ],
        },
      ],
    },
    {
      type: 'system',
      subtype: 'task_started',
      session_id: sessionId,
      task_type: 'local_workflow',
      workflow_name: 'release',
      description: 'Run release workflow',
    },
  ]);

  const output = run('route', {
    session_id: sessionId,
    transcript_path: transcriptPath,
    tools: ['Skill', 'DiscoverSkills', 'ToolSearch'],
    prompt: '继续刚才的发布流程并协调团队状态。',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.host.active_team, 'delivery-squad');
  assert.deepEqual(state.host.surfaced_skills, ['release']);
  assert.deepEqual(state.host.loaded_commands, ['release']);
  assert.deepEqual(state.host.workflows, ['release']);
});

test('route only emits a prompt-state snapshot when it changes', () => {
  const env = isolatedEnv({
    ANTHROPIC_BASE_URL: 'https://proxy.example.com/v1',
  });

  run('post-tool-use', {
    session_id: 'route-dedupe',
    model: 'opus',
    tool_name: 'WebSearch',
    tool_response: {
      results: [],
    },
  }, env);
  run('post-tool-use', {
    session_id: 'route-dedupe',
    model: 'opus',
    tool_name: 'WebSearch',
    tool_response: {
      results: [],
    },
  }, env);

  const first = run('route', {
    session_id: 'route-dedupe',
    tools: ['WebSearch'],
    prompt: '帮我查一下今天 AI 新闻',
  }, env);
  const state = parseAdditionalContextJson(first.hookSpecificOutput.additionalContext);
  assert.equal(state.websearch.mode, 'proxy-cooldown');

  const second = run('route', {
    session_id: 'route-dedupe',
    tools: ['WebSearch'],
    prompt: '再看一下今天 AI 新闻',
  }, env);
  assert.deepEqual(second, { suppressOutput: true });

  run('post-tool-use', {
    session_id: 'route-dedupe',
    tool_name: 'WebSearch',
    tool_response: {
      results: [{ content: [{ title: 'ok' }] }],
    },
  }, env);

  const third = run('route', {
    session_id: 'route-dedupe',
    tools: ['WebSearch'],
    prompt: '再看一下今天 AI 新闻',
  }, env);
  assert.deepEqual(third, { suppressOutput: true });
});

test('route skips explicit slash commands', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-slash',
    prompt: '/config',
  }, env);

  assert.deepEqual(output, { suppressOutput: true });
});
