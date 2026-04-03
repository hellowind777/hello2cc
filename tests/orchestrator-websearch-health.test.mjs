import {
  test,
  assert,
  run,
  isolatedEnv,
} from './helpers/orchestrator-test-helpers.mjs';

test('route cools down proxy WebSearch guidance after repeated zero-search runs', () => {
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
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /最近连续返回 `Did 0 searches` 或错误/);
  assert.match(context, /不要在同一条件下机械重试/);
});

test('route allows one probe retry for proxy WebSearch after explicit retry intent', () => {
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
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /可以先做一次探测性 `WebSearch`/);
  assert.match(context, /不要连续重试/);
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
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /优先尝试原生 `WebSearch`/);
  assert.doesNotMatch(context, /探测性 `WebSearch`/);
  assert.doesNotMatch(context, /机械重试/);
});
