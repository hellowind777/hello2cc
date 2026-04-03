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

test('route promotes native guide flow without suppressing skill usage', () => {
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
  assert.match(context, /WebFetch/);
  assert.match(context, /WebSearch/);
  assert.match(context, /ToolSearch/);
});

test('route tells the model to prefer surfaced skills and DiscoverSkills for workflow-like tasks', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-skills',
    tools: ['Skill', 'DiscoverSkills', 'ToolSearch'],
    prompt: '帮我做一次头脑风暴，看看有没有合适的 workflow 或 skill 可以用',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /优先调用 `Skill`/);
  assert.match(context, /先用 `DiscoverSkills`/);
  assert.match(context, /`ToolSearch` 主要用于工具 \/ MCP \/ 权限边界发现/);
});

test('route prefers already surfaced skills before broader discovery', () => {
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
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /当前会话已 surfaced 的 skills：`brainstorm`, `release`/);
  assert.match(context, /优先直接调用对应 `Skill`/);
});

test('route remembers already loaded skill workflows from command-name tags', () => {
  const env = isolatedEnv();
  const sessionId = 'route-loaded-skill';
  const transcriptPath = writeTranscript(env.HOME, sessionId, {
    model: 'opus',
    tools: ['Skill', 'DiscoverSkills'],
  }, [
    {
      type: 'assistant',
      session_id: sessionId,
      message: {
        content: [
          {
            type: 'text',
            text: '<command-name>brainstorm</command-name>\n<skill-format>true</skill-format>',
          },
        ],
      },
    },
  ]);

  const output = run('route', {
    session_id: sessionId,
    transcript_path: transcriptPath,
    tools: ['Skill', 'DiscoverSkills'],
    prompt: '继续这个头脑风暴流程，收敛成三个备选方案',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /已加载过的 skill \/ workflow：`brainstorm`/);
  assert.match(context, /不要重复发现或重写/);
});

test('route applies specificity routing across workflows, MCP resources, and deferred tools', () => {
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
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /已加载过的 skill \/ workflow：`release --notes zh`/);
  assert.match(context, /已出现过 workflow：`release`/);
  assert.match(context, /已观测到的 MCP resources：`github:repo:\/\/issues\/8`/);
  assert.match(context, /MCP specificity 顺序：已知 resource URI/);
  assert.match(context, /这些 deferred tools 已经通过 ToolSearch 加载过：`mcp__github__add_issue_comment`/);
  assert.match(context, /只有当更具体的 workflow \/ skill \/ MCP resource \/ deferred tool 线索都不覆盖时，再 `ToolSearch`/);
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

  assert.match(context, /默认跟随用户当前语言/);
  assert.match(context, /代码库研究/);
  assert.match(context, /原生读写 \/ 搜索工具/);
  assert.match(context, /未验证不要声称已完成/);
  assert.doesNotMatch(context, /TeamCreate/);
});

test('route keeps codebase research on native search tools before agent escalation', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-code-research',
    prompt: 'Research where the router composes navigation links in this repo.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /代码库研究/);
  assert.match(context, /原生读写 \/ 搜索工具/);
  assert.match(context, /Explore/);
  assert.match(context, /Plan/);
  assert.doesNotMatch(context, /先 `ToolSearch`/);
});

test('route prefers MCP resource tools', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-mcp',
    prompt: 'Use MCP or connected tools to inspect external systems if available.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;

  assert.match(context, /ToolSearch/);
  assert.match(context, /ListMcpResources/);
  assert.match(context, /ReadMcpResource/);
});
