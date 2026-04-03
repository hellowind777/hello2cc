import {
  test,
  assert,
  parseAdditionalContextJson,
  run,
  isolatedEnv,
  writeTranscript,
} from './helpers/orchestrator-test-helpers.mjs';

test('session-start exposes hello2cc as host-state and adapter only', () => {
  const env = isolatedEnv();
  const output = run('session-start', {
    session_id: 'session-1',
    model: 'opus',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;
  const state = parseAdditionalContextJson(context);

  assert.equal(state.protocol_adapters.semantic_routing, 'model_decides');
  assert.equal(state.protocol_adapters.explicit_tool_input_wins, true);
  assert.equal(state.protocol_adapters.agent_model, 'fill_safe_claude_slot_if_missing');
  assert.equal(state.protocol_adapters.send_message_summary, 'fill_if_missing');
  assert.equal(state.session.model, 'opus');
  assert.match(context, /host state only/i);
});

test('session-start surfaces host tools and native agents as structured state', () => {
  const env = isolatedEnv();
  const output = run('session-start', {
    session_id: 'session-capabilities',
    model: 'opus',
    tools: [
      'ToolSearch',
      'AskUserQuestion',
      'SendMessage',
      'TeamDelete',
      'ListMcpResources',
      'ReadMcpResource',
      'EnterWorktree',
      'LSP',
      'NotebookEdit',
      'PowerShell',
    ],
    agents: ['Claude Code Guide', 'Explore', 'Plan', 'general-purpose'],
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.ok(state.host.tools.includes('AskUserQuestion'));
  assert.ok(state.host.tools.includes('SendMessage'));
  assert.ok(state.host.tools.includes('EnterWorktree'));
  assert.ok(state.host.tools.includes('PowerShell'));
  assert.ok(state.host.agents.some((agent) => agent.name === 'Explore' && agent.role === '只读搜索'));
  assert.ok(state.host.agents.some((agent) => agent.name === 'Plan' && agent.role === '只读规划'));
  assert.ok(state.host.agents.some((agent) => agent.name === 'General-Purpose' && agent.role === '通用执行'));
  assert.ok(state.host.agents.some((agent) => agent.name === 'Claude Code Guide'));
});

test('session-start surfaces transcript-derived skills workflows deferred tools and MCP resources', () => {
  const env = isolatedEnv();
  const sessionId = 'session-capability-graph';
  const transcriptPath = writeTranscript(env.HOME, sessionId, {
    model: 'opus',
    tools: ['Skill', 'DiscoverSkills', 'ToolSearch', 'ListMcpResources', 'ReadMcpResource', 'Agent'],
    agents: ['Explore', 'Plan', 'general-purpose', 'claude-code-guide'],
  }, [
    {
      type: 'assistant',
      session_id: sessionId,
      message: {
        content: [
          {
            type: 'text',
            text: '<command-name>brainstorm</command-name>\n<command-args>--focus host-surface</command-args>\n<skill-format>true</skill-format>',
          },
        ],
      },
      attachments: [
        {
          type: 'skill_discovery',
          skills: [
            { name: 'brainstorm', description: 'Help ideate directions' },
            { name: 'release', description: 'Ship and publish changes' },
          ],
        },
        {
          type: 'deferred_tools_delta',
          addedNames: ['mcp__github__add_issue_comment'],
          addedLines: ['mcp__github__add_issue_comment'],
          removedNames: [],
        },
        {
          type: 'mcp_resource',
          server: 'github',
          uri: 'repo://issues/7',
          name: 'Issue #7',
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

  const output = run('session-start', {
    session_id: sessionId,
    transcript_path: transcriptPath,
    tools: ['Skill', 'DiscoverSkills', 'ToolSearch', 'ListMcpResources', 'ReadMcpResource', 'Agent'],
    agents: ['Explore', 'Plan', 'general-purpose', 'claude-code-guide'],
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.deepEqual(state.host.surfaced_skills, ['brainstorm', 'release']);
  assert.deepEqual(state.host.loaded_commands, ['brainstorm']);
  assert.deepEqual(state.host.workflows, ['release']);
  assert.deepEqual(state.host.deferred_tools.available, ['mcp__github__add_issue_comment']);
  assert.deepEqual(state.host.deferred_tools.loaded, ['mcp__github__add_issue_comment']);
  assert.deepEqual(state.host.mcp_resources, ['github:repo://issues/7']);
});

test('session-start exposes proxy WebSearch mode as state instead of prose routing', () => {
  const env = isolatedEnv({
    ANTHROPIC_BASE_URL: 'https://proxy.example.com/v1',
  });
  const output = run('session-start', {
    session_id: 'session-websearch-proxy',
    model: 'opus',
    tools: ['WebSearch'],
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.websearch.tool, 'WebSearch');
  assert.equal(state.websearch.mode, 'proxy-conditional');
  assert.equal(state.websearch.degraded, undefined);
});
