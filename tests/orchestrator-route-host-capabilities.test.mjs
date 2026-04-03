import {
  test,
  assert,
  parseAdditionalContextJson,
  run,
  isolatedEnv,
  writeTranscript,
} from './helpers/orchestrator-test-helpers.mjs';

test('route emits proxy WebSearch state after repeated zero-search degradation', () => {
  const env = isolatedEnv({
    ANTHROPIC_BASE_URL: 'https://proxy.example.com/v1',
  });

  run('post-tool-use', {
    session_id: 'route-websearch-proxy',
    model: 'opus',
    tool_name: 'WebSearch',
    tool_response: {
      results: [],
    },
  }, env);
  run('post-tool-use', {
    session_id: 'route-websearch-proxy',
    model: 'opus',
    tool_name: 'WebSearch',
    tool_response: {
      results: [],
    },
  }, env);

  const output = run('route', {
    session_id: 'route-websearch-proxy',
    tools: ['WebSearch'],
    prompt: '帮我查下今天 AI 新闻',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.websearch.tool, 'WebSearch');
  assert.equal(state.websearch.mode, 'proxy-cooldown');
  assert.equal(state.websearch.degraded, true);
});

test('route emits MCP resource state when the host already surfaced it', () => {
  const env = isolatedEnv();
  const sessionId = 'route-mcp';
  const transcriptPath = writeTranscript(env.HOME, sessionId, {
    model: 'opus',
    tools: ['ListMcpResources', 'ReadMcpResource'],
  }, [
    {
      type: 'assistant',
      session_id: sessionId,
      attachments: [
        {
          type: 'mcp_resource',
          server: 'github',
          uri: 'repo://issues/9',
          name: 'Issue #9',
          description: 'Issue resource',
          content: {},
        },
      ],
    },
  ]);

  const output = run('route', {
    session_id: sessionId,
    transcript_path: transcriptPath,
    tools: ['ListMcpResources', 'ReadMcpResource'],
    prompt: 'Use MCP or connected tools to inspect external systems if available.',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.deepEqual(state.host.mcp_resources, ['github:repo://issues/9']);
});

test('route keeps straightforward multi-file implementation free of semantic routing text', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-cached-upstream-degraded',
    prompt: 'Implement a multi-file change and verify the result.',
  }, env);

  assert.deepEqual(output, { suppressOutput: true });
});
