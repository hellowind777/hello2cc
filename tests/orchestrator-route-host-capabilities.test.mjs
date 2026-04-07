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
  assert.equal(state.intent.analysis.lexicon_guided, undefined);
  assert.equal(state.intent.analysis.host_boundary_guided, true);
  assert.equal(state.response_contract.specialization, 'current_info');
  assert.equal(state.response_contract.selection_basis, 'current_info_boundary');
  assert.equal(state.response_contract.selection_strength, 'strong');
  assert.equal(state.response_contract.preferred_shape, 'current_info_status_then_sources_then_uncertainty');
  assert.ok(state.recovery_playbook.recipes.some((recipe) => recipe.guard === 'websearch_real_source_required'));
  assert.ok(state.recovery_playbook.recipes.some((recipe) => recipe.guard === 'websearch_retry_cooldown'));
  assert.equal(state.specialization_candidates.active, 'current_info');
  assert.ok(state.specialization_candidates.items.some((item) => item.id === 'current_info' && item.selected));
  assert.ok(state.specialization_candidates.items.some((item) => item.id === 'current_info' && item.selection_strength === 'strong'));
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
        {
          type: 'mcp_instructions_delta',
          addedNames: ['github'],
          addedBlocks: ['Use github issue tools for issue workflows.'],
          removedNames: [],
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
  assert.deepEqual(state.host.attachments.mcp_instructions.server_names, ['github']);
  assert.ok(state.policy.policies.some((policy) => policy.id === 'mcp-resources' && Array.isArray(policy.instruction_servers) && policy.instruction_servers.includes('github')));
});

test('route derives language-agnostic capability probes from question shape', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-capability-probe',
    tools: ['ToolSearch', 'DiscoverSkills', 'ListMcpResources', 'ReadMcpResource'],
    prompt: '利用できる外部連携はありますか？',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;
  const state = parseAdditionalContextJson(context);

  assert.equal(state.intent.analysis.lexicon_guided, undefined);
  assert.equal(state.intent.analysis.capability_probe_shape, true);
  assert.equal(state.intent.routing?.capability_query, undefined);
  assert.equal(state.response_contract.specialization, 'capability');
  assert.equal(state.response_contract.selection_basis, 'capability_probe_shape');
  assert.equal(state.response_contract.selection_strength, 'medium');
  assert.equal(state.response_contract.preferred_shape, 'direct_answer_then_visible_capabilities_then_gap_or_next_step');
  assert.deepEqual(state.response_contract.required_sections, ['direct_answer', 'visible_capabilities_or_surfaces', 'gap_or_next_step']);
  assert.equal(state.execution_playbook.specialization, 'capability');
  assert.deepEqual(state.execution_playbook.ordered_steps, [
    'inspect_visible_capability_surfaces',
    'answer_from_visible_surface_or_state_gap',
    'run_only_the_narrowest_needed_discovery',
  ]);
  assert.equal(state.policy.requested_output_shape, 'direct_answer_then_visible_capabilities_then_gap_or_next_step');
  assert.ok(state.recovery_playbook.recipes.some((recipe) => recipe.guard === 'visible_capability_surface_first'));
  assert.ok(state.recovery_playbook.recipes.some((recipe) => recipe.guard === 'narrow_discovery_for_real_gap_only'));
  assert.ok(state.decision_tie_breakers.items.some((item) => item.id === 'visible_surface_answer_before_discovery_fallback'));
  assert.ok(state.policy.policies.some((policy) => policy.id === 'tool-discovery'));
  assert.equal(state.specialization_candidates.active, 'capability');
  assert.ok(state.specialization_candidates.items.some((item) => item.id === 'capability' && item.selected));
  assert.ok(state.specialization_candidates.items.some((item) => item.id === 'capability' && item.selection_basis === 'capability_probe_shape'));
  assert.match(context, /宿主可用能力、workflow、tool、MCP、agent 或权限边界/);
});

test('route keeps lexicon-only current-info requests on visible WebSearch surface instead of a strong boundary', () => {
  const env = isolatedEnv();
  const sessionId = 'route-current-info-visible-surface';
  const transcriptPath = writeTranscript(env.HOME, sessionId, {
    model: 'opus',
    tools: ['WebSearch'],
  }, [
    {
      type: 'assistant',
      session_id: sessionId,
      attachments: [
        {
          type: 'output_style',
          style: 'compact-native',
        },
      ],
    },
  ]);
  const output = run('route', {
    session_id: sessionId,
    transcript_path: transcriptPath,
    tools: ['WebSearch'],
    prompt: 'What are the latest AI news updates?',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.intent.analysis.host_boundary_guided, undefined);
  assert.equal(state.intent.analysis.lexicon_guided, true);
  assert.equal(state.response_contract.specialization, 'current_info');
  assert.equal(state.response_contract.selection_basis, 'visible_websearch_surface');
  assert.equal(state.response_contract.selection_strength, 'medium');
  assert.equal(state.response_contract.preferred_shape, 'current_info_status_then_sources_then_uncertainty');
});

test('route derives slash-pair current-info comparisons into WebSearch query hygiene guidance', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-zh-compare-current-info',
    tools: ['WebSearch'],
    prompt: '帮我搜索最新新闻，并对比下Codex/claude最新的技术',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;
  const state = parseAdditionalContextJson(context);

  assert.equal(state.intent.analysis.lexicon_guided, undefined);
  assert.equal(state.intent.analysis.host_boundary_guided, true);
  assert.equal(state.intent.analysis.prompt_shape.option_pair_like, true);
  assert.equal(state.intent.actions.compare, true);
  assert.equal(state.intent.actions.current_info, true);
  assert.equal(state.intent.output.table, true);
  assert.equal(state.response_contract.specialization, 'compare');
  assert.equal(state.response_contract.selection_basis, 'weak_request_shape');
  assert.ok(state.policy.policies.some((policy) => policy.id === 'websearch' && policy.current_info_request));
  assert.ok(state.specialization_candidates.items.some((item) => item.id === 'current_info'));
  assert.match(context, /先拆成多次短 `WebSearch` 获取真实来源/);
  assert.match(context, /allowed_domains/);
  assert.match(context, /Did 0 searches/);
});

test('route exposes transcript attachment reminders and surfaced agent deltas in host state', () => {
  const env = isolatedEnv();
  const sessionId = 'route-attachment-signals';
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
          addedTypes: ['Explore'],
          addedLines: ['Explore'],
          removedTypes: [],
          isInitial: true,
        },
        {
          type: 'critical_system_reminder',
          content: 'Stay inside the host-defined workflow boundary.',
        },
        {
          type: 'output_style',
          style: 'compact-native',
        },
      ],
    },
  ]);

  const output = run('route', {
    session_id: sessionId,
    transcript_path: transcriptPath,
    tools: ['Agent'],
    agents: ['Explore', 'Plan', 'general-purpose'],
    prompt: '继续。',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.deepEqual(state.host.delta_surfaces.agents, [
    {
      name: 'Explore',
      role: '只读搜索',
      tool_surface: ['Glob/Grep/Read', 'Bash(只读)'],
    },
  ]);
  assert.equal(state.host.attachments.output_style, 'compact-native');
  assert.equal(state.renderer_contract.style_name, 'compact-native');
  assert.equal(state.renderer_contract.style_source, 'attachment');
  assert.equal(state.host.attachments.critical_system_reminder.active, true);
  assert.match(state.host.attachments.critical_system_reminder.preview, /workflow boundary/i);
});

test('route keeps straightforward multi-file implementation free of semantic routing text', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-cached-upstream-degraded',
    prompt: 'Implement a multi-file change and verify the result.',
  }, env);

  assert.deepEqual(output, { suppressOutput: true });
});
