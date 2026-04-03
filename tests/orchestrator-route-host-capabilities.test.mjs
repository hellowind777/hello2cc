import {
  test,
  assert,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  join,
  run,
  isolatedEnv,
  writeTranscript,
} from './helpers/orchestrator-test-helpers.mjs';

test('route prefers native WebSearch for real-time questions when the host exposes it', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-websearch',
    tools: ['WebSearch'],
    prompt: '帮我查一下 OpenAI Codex 最近的新闻',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /最新\/实时信息任务/);
  assert.match(context, /优先原生 `WebSearch`/);
});

test('route keeps proxy WebSearch guidance focused on authenticity rather than blocking', () => {
  const env = isolatedEnv({
    ANTHROPIC_BASE_URL: 'https://proxy.example.com/v1',
  });
  const output = run('route', {
    session_id: 'route-websearch-proxy',
    tools: ['WebSearch'],
    prompt: '帮我查下今天 AI 新闻',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /优先尝试原生 `WebSearch`/);
  assert.match(context, /Did 0 searches/);
  assert.match(context, /未完成真实搜索/);
});

test('route keeps ToolSearch-first intent optimistic on proxy sessions without host proof either way', () => {
  const env = isolatedEnv({
    ANTHROPIC_BASE_URL: 'https://proxy.example.com/v1',
    ENABLE_TOOL_SEARCH: '',
  });
  const output = run('route', {
    session_id: 'route-no-toolsearch',
    prompt: 'Use ToolSearch to discover MCP tools and plugin capabilities.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /先 `ToolSearch` 确认/);
  assert.doesNotMatch(context, /没有暴露原生 `ToolSearch`/);
});

test('route keeps ToolSearch-first guidance even after transcript records beta proxy incompatibility', () => {
  const env = isolatedEnv();
  const sessionId = 'route-toolsearch-degraded';
  const transcriptPath = writeTranscript(env.HOME, sessionId, {
    model: 'opus',
    tools: ['ToolSearch', 'ListMcpResources', 'ReadMcpResource'],
  }, [
    {
      type: 'assistant',
      session_id: sessionId,
      error: 'invalid_request',
      message: {
        content: [
          {
            type: 'text',
            text: 'tool_reference blocks with a 400. Extra inputs are not permitted because defer_loading is unsupported.',
          },
        ],
      },
    },
  ]);
  const output = run('route', {
    session_id: sessionId,
    transcript_path: transcriptPath,
    tools: ['ToolSearch', 'ListMcpResources', 'ReadMcpResource'],
    prompt: 'Use ToolSearch to discover MCP tools and plugin capabilities.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /先 `ToolSearch` 确认/);
  assert.doesNotMatch(context, /兼容/);
  assert.doesNotMatch(context, /tool_reference/);
});

test('route keeps straightforward multi-file implementation out of plan mode even after transcript noise', () => {
  const env = isolatedEnv();
  const sessionId = 'route-cached-upstream-degraded';
  const transcriptPath = writeTranscript(env.HOME, sessionId, {
    model: 'opus',
    tools: ['EnterPlanMode', 'TodoWrite', 'Agent'],
  }, [
    {
      type: 'assistant',
      session_id: sessionId,
      error: 'request_failed',
      message: {
        content: [
          {
            type: 'text',
            text: 'Connection error. Request timed out.',
          },
        ],
      },
    },
  ]);

  run('session-start', {
    session_id: sessionId,
    transcript_path: transcriptPath,
    model: 'opus',
    tools: ['EnterPlanMode', 'TodoWrite', 'Agent'],
  }, env);

  const output = run('route', {
    session_id: sessionId,
    prompt: 'Implement a multi-file change and verify the result.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.doesNotMatch(context, /EnterPlanMode\(\)/);
  assert.doesNotMatch(context, /连接 \/ 鉴权 \/ 上游账号异常/);
  assert.doesNotMatch(context, /上游代理问题/);
});

test('route keeps Claude Code Guide guidance for capability questions even without host proof', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-no-guide',
    prompt: 'How do Claude Code hooks and MCP permissions work?',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /Claude Code Guide/);
});

test('route only recommends EnterWorktree when the user explicitly asks', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-worktree',
    prompt: 'Use a git worktree for an isolated worktree while changing this feature.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /EnterWorktree/);
});

test('route skips explicit slash commands', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-slash',
    prompt: '/config',
  }, env);

  assert.deepEqual(output, { suppressOutput: true });
});
