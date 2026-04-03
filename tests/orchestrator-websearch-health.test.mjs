import {
  test,
  assert,
  parseAdditionalContextJson,
  run,
  isolatedEnv,
} from './helpers/orchestrator-test-helpers.mjs';

test('route reports proxy WebSearch cooldown as structured state after repeated zero-search runs', () => {
  const env = isolatedEnv({
    ANTHROPIC_BASE_URL: 'https://proxy.example.com/v1',
  });
  const sessionId = 'websearch-cooldown';

  run('post-tool-use', {
    session_id: sessionId,
    tool_name: 'WebSearch',
    tool_response: {
      query: 'today ai news',
      results: [],
      durationSeconds: 1,
    },
    model: 'opus',
  }, env);

  run('post-tool-use', {
    session_id: sessionId,
    tool_name: 'WebSearch',
    tool_response: {
      query: 'today ai news',
      results: [],
      durationSeconds: 1,
    },
    model: 'opus',
  }, env);

  const output = run('route', {
    session_id: sessionId,
    tools: ['WebSearch'],
    model: 'opus',
    prompt: '帮我查一下今天 AI 新闻',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.websearch.mode, 'proxy-cooldown');
  assert.equal(state.websearch.degraded, true);
});

test('route reports one-shot probe eligibility when proxy WebSearch conditions recover', () => {
  const env = isolatedEnv({
    ANTHROPIC_BASE_URL: 'https://proxy.example.com/v1',
  });
  const sessionId = 'websearch-probe';

  run('post-tool-use', {
    session_id: sessionId,
    tool_name: 'WebSearch',
    tool_response: {
      query: 'today ai news',
      results: [],
      durationSeconds: 1,
    },
    model: 'opus',
  }, env);

  run('post-tool-use', {
    session_id: sessionId,
    tool_name: 'WebSearch',
    tool_response: {
      query: 'today ai news',
      results: [],
      durationSeconds: 1,
    },
    model: 'opus',
  }, env);

  const output = run('route', {
    session_id: sessionId,
    tools: ['WebSearch'],
    model: 'opus',
    prompt: '请重试一下，再查今天 AI 新闻',
  }, {
    ...env,
    ANTHROPIC_BASE_URL: 'https://proxy-2.example.com/v1',
  });
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.websearch.mode, 'proxy-probe');
  assert.equal(state.websearch.probe_allowed, true);
  assert.equal(state.websearch.transport_changed, true);
});

test('successful proxy WebSearch clears degraded session memory', () => {
  const env = isolatedEnv({
    ANTHROPIC_BASE_URL: 'https://proxy.example.com/v1',
  });
  const sessionId = 'websearch-recovered';

  run('post-tool-use', {
    session_id: sessionId,
    tool_name: 'WebSearch',
    tool_response: {
      query: 'today ai news',
      results: [],
      durationSeconds: 1,
    },
    model: 'opus',
  }, env);

  run('post-tool-use', {
    session_id: sessionId,
    tool_name: 'WebSearch',
    tool_response: {
      query: 'today ai news',
      results: [],
      durationSeconds: 1,
    },
    model: 'opus',
  }, env);

  run('post-tool-use', {
    session_id: sessionId,
    tool_name: 'WebSearch',
    tool_response: {
      query: 'today ai news',
      results: [
        {
          tool_use_id: 'web-search-1',
          content: [
            { title: 'AI News', url: 'https://example.com/news' },
          ],
        },
      ],
      durationSeconds: 1,
    },
    model: 'opus',
  }, env);

  const output = run('route', {
    session_id: sessionId,
    tools: ['WebSearch'],
    model: 'opus',
    prompt: '帮我查一下今天 AI 新闻',
  }, env);

  assert.deepEqual(output, { suppressOutput: true });
});
