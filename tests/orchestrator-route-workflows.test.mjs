import {
  test,
  assert,
  parseAdditionalContextJson,
  run,
  isolatedEnv,
  writeTranscript,
} from './helpers/orchestrator-test-helpers.mjs';

test('route surfaces already discovered skills as host state instead of imperative workflow text', () => {
  const env = isolatedEnv();
  const sessionId = 'route-surfaced-skills';
  const transcriptPath = writeTranscript(env.HOME, sessionId, {
    model: 'opus',
    tools: ['Skill', 'DiscoverSkills', 'ToolSearch'],
  }, [
    {
      type: 'assistant',
      session_id: sessionId,
      message: {
        content: [
          {
            type: 'text',
            text: 'Skills relevant to your task:\n\n- brainstorm: Help ideate directions\n- release: Ship and publish changes\n\nThese skills encode project-specific conventions. Invoke via Skill(\"<name>\") for complete instructions.',
          },
        ],
      },
    },
  ]);

  const output = run('route', {
    session_id: sessionId,
    transcript_path: transcriptPath,
    tools: ['Skill', 'DiscoverSkills', 'ToolSearch'],
    prompt: '帮我做一轮头脑风暴，看看接下来怎么推进',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.deepEqual(state.host.surfaced_skills, ['brainstorm', 'release']);
  assert.equal(state.host.loaded_commands, undefined);
  assert.equal(state.host.workflows, undefined);
});

test('route surfaces loaded workflows deferred tools and MCP resources together', () => {
  const env = isolatedEnv();
  const sessionId = 'route-specificity';
  const transcriptPath = writeTranscript(env.HOME, sessionId, {
    model: 'opus',
    tools: ['Skill', 'DiscoverSkills', 'ToolSearch', 'ListMcpResources', 'ReadMcpResource'],
  }, [
    {
      type: 'assistant',
      session_id: sessionId,
      message: {
        content: [
          {
            type: 'text',
            text: '<command-name>release</command-name>\n<command-args>--notes zh</command-args>\n<skill-format>true</skill-format>',
          },
        ],
      },
      attachments: [
        {
          type: 'deferred_tools_delta',
          addedNames: ['mcp__github__add_issue_comment'],
          addedLines: ['mcp__github__add_issue_comment'],
          removedNames: [],
        },
        {
          type: 'mcp_resource',
          server: 'github',
          uri: 'repo://issues/8',
          name: 'Issue #8',
          description: 'Issue resource',
          content: {},
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
    {
      type: 'user',
      session_id: sessionId,
      message: {
        content: [
          {
            type: 'tool_result',
            content: [
              {
                type: 'tool_reference',
                tool_name: 'mcp__github__add_issue_comment',
              },
            ],
          },
        ],
      },
    },
  ]);

  const output = run('route', {
    session_id: sessionId,
    transcript_path: transcriptPath,
    tools: ['Skill', 'DiscoverSkills', 'ToolSearch', 'ListMcpResources', 'ReadMcpResource'],
    prompt: '继续这个 release 流程，并基于已有 MCP resource 处理 issue，再用已经加载的 github 工具完成跟进。',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.deepEqual(state.host.loaded_commands, ['release']);
  assert.deepEqual(state.host.workflows, ['release']);
  assert.deepEqual(state.host.deferred_tools.available, ['mcp__github__add_issue_comment']);
  assert.deepEqual(state.host.deferred_tools.loaded, ['mcp__github__add_issue_comment']);
  assert.deepEqual(state.host.mcp_resources, ['github:repo://issues/8']);
});

test('route extracts prompt text from structured payloads but only emits state when state exists', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-structured',
    prompt: {
      role: 'user',
      content: [
        { type: 'text', text: 'Research this repo, implement the change, and verify the result.' },
      ],
    },
  }, env);

  assert.deepEqual(output, { suppressOutput: true });
});
