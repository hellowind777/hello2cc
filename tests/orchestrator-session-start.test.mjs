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

  assert.equal(state.protocol_adapters.semantic_routing, 'host_guarded_model_decides');
  assert.equal(state.protocol_adapters.workflow_owner_arbitration, 'style_and_tool_semantics_always_on_defer_main_workflow_to_visible_host_skill_owner');
  assert.equal(state.protocol_adapters.explicit_tool_input_wins, true);
  assert.equal(state.protocol_adapters.agent_model, 'fill_safe_claude_slot_if_missing');
  assert.equal(state.protocol_adapters.send_message_summary, 'fill_if_missing');
  assert.equal(state.operator_profile, 'opus-compatible-claude-code');
  assert.equal(state.session.model, 'opus');
  assert.match(context, /Opus-compatible/i);
});

test('session-start surfaces host tools and native agents as structured state', () => {
  const env = isolatedEnv();
  const output = run('session-start', {
    session_id: 'session-capabilities',
    model: 'opus',
    tools: [
      'Task',
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
  const context = output.hookSpecificOutput.additionalContext;
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.ok(state.host.tools.includes('AskUserQuestion'));
  assert.ok(state.host.tools.includes('Task'));
  assert.ok(state.host.tools.includes('SendMessage'));
  assert.ok(state.host.tools.includes('EnterWorktree'));
  assert.ok(state.host.tools.includes('PowerShell'));
  assert.ok(state.host.agents.some((agent) => agent.name === 'Explore' && agent.role === '只读搜索'));
  assert.ok(state.host.agents.some((agent) => agent.name === 'Plan' && agent.role === '只读规划'));
  assert.ok(state.host.agents.some((agent) => agent.name === 'General-Purpose' && agent.role === '通用执行'));
  assert.ok(state.host.agents.some((agent) => agent.name === 'Claude Code Guide'));
  assert.match(context, /Plan.*Explore.*只读 helper|只读 helper.*EnterPlanMode/i);
  assert.match(context, /路径清晰的实现|clear bug fix|默认直接执行/i);
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

test('session-start surfaces transcript attachment deltas reminders and team context as host state', () => {
  const env = isolatedEnv();
  const sessionId = 'session-attachment-signals';
  const transcriptPath = writeTranscript(env.HOME, sessionId, {
    model: 'opus',
    tools: ['Agent'],
    agents: ['Explore', 'Plan', 'general-purpose'],
  }, [
    {
      type: 'assistant',
      session_id: sessionId,
      attachments: [
        {
          type: 'agent_listing_delta',
          addedTypes: ['Explore', 'general-purpose'],
          addedLines: ['Explore', 'General-Purpose'],
          removedTypes: [],
          isInitial: true,
        },
        {
          type: 'output_style',
          style: 'executive-summary',
        },
        {
          type: 'critical_system_reminder',
          content: 'Always obey the latest host-side output contract and permission boundary.',
        },
        {
          type: 'team_context',
          teamName: 'delivery-squad',
          agentName: 'frontend-dev',
          teamConfigPath: '/tmp/teams/delivery-squad/config.json',
          taskListPath: '/tmp/tasks/delivery-squad',
        },
      ],
    },
  ]);

  const output = run('session-start', {
    session_id: sessionId,
    transcript_path: transcriptPath,
    tools: ['Agent'],
    agents: ['Explore', 'Plan', 'general-purpose'],
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.host.active_team, 'delivery-squad');
  assert.deepEqual(state.host.delta_surfaces.agents, [
    {
      name: 'Explore',
      role: '只读搜索',
      tool_surface: ['Glob/Grep/Read', 'Bash(只读)'],
    },
    {
      name: 'General-Purpose',
      role: '通用执行',
      tool_surface: ['*'],
    },
  ]);
  assert.equal(state.host.attachments.output_style, 'executive-summary');
  assert.equal(state.host.attachments.critical_system_reminder.active, true);
  assert.match(state.host.attachments.critical_system_reminder.preview, /output contract/i);
  assert.deepEqual(state.host.attachments.team_context, {
    team: 'delivery-squad',
    agent: 'frontend-dev',
    team_config_path: '/tmp/teams/delivery-squad/config.json',
    task_list_path: '/tmp/tasks/delivery-squad',
  });
});

test('session-start surfaces mailbox memories skill listings and MCP instructions from transcript attachments', () => {
  const env = isolatedEnv();
  const sessionId = 'session-rich-attachments';
  const transcriptPath = writeTranscript(env.HOME, sessionId, {
    model: 'opus',
    tools: ['Agent', 'ListMcpResources', 'ReadMcpResource'],
  }, [
    {
      type: 'assistant',
      session_id: sessionId,
      attachments: [
        {
          type: 'skill_listing',
          content: '- brainstorm: Help ideate directions\n- release: Ship and publish changes',
          skillCount: 2,
          isInitial: true,
        },
        {
          type: 'relevant_memories',
          memories: [
            {
              path: '/repo/.claude/memory.md',
              header: 'Saved memory from /repo/.claude/memory.md',
              content: 'Prefer surfaced capability boundaries before ToolSearch fallback.',
              mtimeMs: 0,
            },
          ],
        },
        {
          type: 'mcp_instructions_delta',
          addedNames: ['github'],
          addedBlocks: ['Use github issue and comment tools for issue workflows.'],
          removedNames: [],
        },
        {
          type: 'teammate_mailbox',
          messages: [
            {
              from: 'backend-owner',
              text: 'Blocked on task #7; please review the API contract before I continue.',
              timestamp: '2026-04-05T12:00:00.000Z',
              summary: 'blocked on task #7',
            },
          ],
        },
      ],
    },
  ]);

  const output = run('session-start', {
    session_id: sessionId,
    transcript_path: transcriptPath,
    tools: ['Agent', 'ListMcpResources', 'ReadMcpResource'],
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.deepEqual(state.host.attachments.skill_listing.names, ['brainstorm', 'release']);
  assert.equal(state.host.attachments.skill_listing.skill_count, 2);
  assert.equal(state.host.attachments.relevant_memories.count, 1);
  assert.equal(state.host.attachments.relevant_memories.items[0].path, '/repo/.claude/memory.md');
  assert.deepEqual(state.host.attachments.mcp_instructions.server_names, ['github']);
  assert.equal(state.host.attachments.teammate_mailbox.message_count, 1);
  assert.equal(state.host.attachments.teammate_mailbox.messages[0].from, 'backend-owner');
  assert.equal(state.host.attachments.teammate_mailbox.messages[0].summary, 'blocked on task #7');
});

test('session-start surfaces bootstrap skill documents injected at session start as host skill workflows', () => {
  const env = isolatedEnv();
  const sessionId = 'session-bootstrap-skill-doc';
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
            text: [
              '---',
              'name: using-superpowers',
              'description: Use when starting any conversation - establishes how to find and use skills',
              '---',
              '',
              '# Using Superpowers',
              '',
              'Use the `Skill` tool before any response when a skill may apply.',
            ].join('\n'),
          },
        ],
      },
    },
  ]);

  const output = run('session-start', {
    session_id: sessionId,
    transcript_path: transcriptPath,
    tools: ['Skill', 'DiscoverSkills'],
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.deepEqual(state.host.surfaced_skills, ['using-superpowers']);
});
