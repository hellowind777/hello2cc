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

  assert.equal(state.decision_model, 'host_defined_capability_policies');
  assert.equal(state.host.active_team, 'delivery-squad');
  assert.deepEqual(state.host.surfaced_skills, ['release']);
  assert.deepEqual(state.host.loaded_commands, ['release']);
  assert.deepEqual(state.host.workflows, ['release']);
  assert.equal(state.policy.engine, 'host_defined_capability_policies');
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

test('route adds native team guidance for explicit team workflow requests', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-team-guidance',
    prompt: 'Use TeamCreate and teammates with a shared task board to coordinate research and implementation.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;
  const state = parseAdditionalContextJson(context);

  assert.match(context, /TeamCreate/);
  assert.match(context, /TaskList/);
  assert.match(context, /team 语义|持续协作型 team/i);
  assert.equal(state.intent.collaboration.team_workflow, true);
  assert.equal(state.intent.collaboration.task_board, true);
  assert.equal(state.policy.engine, 'host_defined_capability_policies');
});

test('route prefers markdown tables for comparison prompts', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-compare-table',
    prompt: 'Compare TeamCreate with plain Agent workers and present it as a table.',
  }, env);
  const context = output.hookSpecificOutput.additionalContext;
  const state = parseAdditionalContextJson(context);

  assert.match(context, /Markdown (?:表格|对比表)|Markdown tables?/);
  assert.match(context, /比较 \/ 选型 \/ 能力边界问题|直接回答/);
  assert.equal(state.intent.actions.compare, true);
  assert.equal(state.intent.output.table, true);
  assert.equal(state.intent.output.structured, true);
  assert.equal(state.response_contract.specialization, 'compare');
  assert.equal(state.response_contract.selection_basis, 'weak_request_shape');
  assert.equal(state.response_contract.selection_strength, 'weak');
  assert.equal(state.response_contract.preferred_shape, 'one_sentence_judgment_then_markdown_table_then_recommendation');
  assert.deepEqual(state.response_contract.required_sections, ['judgment', 'compact_table', 'recommendation']);
  assert.equal(state.renderer_contract.style_name, 'hello2cc:hello2cc Native');
  assert.equal(state.renderer_contract.style_source, 'plugin_default');
  assert.equal(state.renderer_contract.opening, 'judgment_first');
  assert.deepEqual(state.renderer_contract.section_order, ['judgment', 'compact_table', 'recommendation']);
  assert.equal(state.renderer_contract.table_mode, 'compact_markdown');
  assert.deepEqual(state.renderer_contract.table_columns, ['option', 'fit', 'tradeoffs', 'recommended_when']);
  assert.equal(state.renderer_contract.prefer_markdown, true);
  assert.ok(state.renderer_contract.avoid.includes('recommendation_before_judgment'));
  assert.equal(state.execution_playbook.role, 'direct_decider');
  assert.deepEqual(state.execution_playbook.ordered_steps, [
    'state_judgment_first',
    'compare_options_in_compact_table',
    'give_recommendation_and_boundary',
  ]);
  assert.ok(state.recovery_playbook.recipes.some((recipe) => recipe.guard === 'decision_answer_first'));
  assert.ok(state.decision_tie_breakers.items.some((item) => item.id === 'judgment_and_table_before_long_prose'));
  assert.equal(state.intent.output.diagram, undefined);
  assert.equal(state.intent.actions.plan, undefined);
  assert.equal(state.policy.requested_output_shape, 'one_sentence_judgment_then_markdown_table_then_recommendation');
  assert.ok(state.specialization_candidates.items.some((item) => item.id === 'compare' && item.selection_strength === 'weak'));
});

test('route derives non-lexicon targeted artifact questions into explanation guidance', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-explain-non-lexicon',
    prompt: 'scripts/lib/route-guidance.mjs:51 这里为什么要这样处理？',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.intent.analysis.lexicon_guided, undefined);
  assert.equal(state.intent.analysis.artifact_shape_guided, true);
  assert.equal(state.intent.analysis.prompt_shape.targeted_artifact_question, true);
  assert.equal(state.response_contract.specialization, 'explanation');
  assert.equal(state.response_contract.selection_basis, 'artifact_question_shape');
  assert.equal(state.response_contract.selection_strength, 'medium');
  assert.equal(state.response_contract.preferred_shape, 'direct_explanation_then_key_points_and_references');
});

test('route derives non-lexicon bounded implementation from artifact shape', () => {
  const env = isolatedEnv();
  run('session-start', {
    session_id: 'route-implement-artifact',
    model: 'opus',
    tools: ['TaskCreate', 'TaskUpdate'],
  }, env);

  const output = run('route', {
    session_id: 'route-implement-artifact',
    tools: ['TaskCreate', 'TaskUpdate'],
    prompt: '请修改 scripts/lib/route-guidance.mjs:247 的 current-info 边界，并同步 tests/orchestrator-route-execution.test.mjs。',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.intent.analysis.lexicon_guided, undefined);
  assert.equal(state.intent.analysis.artifact_shape_guided, true);
  assert.equal(state.intent.actions.implement, true);
  assert.equal(state.response_contract.preferred_shape, 'brief_status_then_changes_validation_and_risks');
});

test('route keeps protocol explanation prompts out of capability and team-status routing', () => {
  const env = isolatedEnv();
  const cases = [
    {
      session_id: 'route-explain-tools-protocol',
      tools: ['ToolSearch', 'DiscoverSkills'],
      prompt: 'Explain how the router decides which tools to use.',
    },
    {
      session_id: 'route-explain-skills-protocol',
      tools: ['Skill', 'DiscoverSkills', 'ToolSearch'],
      prompt: 'Explain how skill discovery works in this repo.',
    },
    {
      session_id: 'route-explain-taskboard-protocol',
      tools: ['TaskList', 'TaskGet', 'TaskUpdate', 'SendMessage'],
      prompt: 'Explain why the task board is required here.',
    },
    {
      session_id: 'route-explain-toolsearch-fixed',
      tools: ['ToolSearch'],
      prompt: 'Explain how ToolSearch works here.',
    },
    {
      session_id: 'route-explain-hooks-guide',
      tools: ['ClaudeCodeGuide', 'ToolSearch'],
      prompt: 'Explain how Claude Code hooks work.',
    },
    {
      session_id: 'route-explain-settings-guide',
      tools: ['ClaudeCodeGuide', 'ToolSearch'],
      prompt: 'Explain how Claude Code settings work here.',
    },
    {
      session_id: 'route-explain-websearch-fixed',
      tools: ['WebSearch'],
      prompt: 'Explain why WebSearch is required here.',
    },
  ];

  for (const testCase of cases) {
    const output = run('route', testCase, env);

    if (!output.hookSpecificOutput?.additionalContext) {
      assert.deepEqual(output, { suppressOutput: true });
      continue;
    }

    const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

    assert.equal(state.intent.actions.explain, true);
    assert.equal(state.intent.routing?.capability_query, undefined);
    assert.equal(state.intent.collaboration?.team_workflow, undefined);
    assert.equal(state.intent.collaboration?.task_board, undefined);
    assert.equal(state.intent.collaboration?.team_semantics, undefined);
    assert.equal(state.intent.collaboration?.team_status, undefined);
    assert.equal(state.response_contract.specialization, 'explanation');
    assert.equal(state.response_contract.preferred_shape, 'direct_explanation_then_key_points_and_references');
    assert.ok(state.decision_tie_breakers.items.some((item) => item.id === 'direct_answer_before_background'));

    if (testCase.session_id === 'route-explain-skills-protocol') {
      assert.equal(state.intent.analysis.prompt_shape?.known_surface_mention, undefined);
      assert.equal(state.intent.routing?.workflow_continuation, undefined);
    }

    if (testCase.session_id === 'route-explain-hooks-guide' || testCase.session_id === 'route-explain-settings-guide') {
      assert.equal(state.intent.routing?.claude_guide, true);
      assert.ok(state.policy.policies.some((item) => item.id === 'claude-code-guide'));
      assert.ok(!state.policy.policies.some((item) => item.id === 'skills-workflows'));
      assert.ok(!state.policy.policies.some((item) => item.id === 'tool-discovery'));
    }
  }
});

test('route keeps Claude Code guide difference questions on explanation instead of capability discovery', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-guide-difference-question',
    tools: ['ClaudeCodeGuide', 'ToolSearch', 'DiscoverSkills', 'Skill'],
    prompt: 'How do Claude Code hooks differ from settings?',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.intent.question, true);
  assert.equal(state.intent.actions.explain, true);
  assert.equal(state.intent.routing?.claude_guide, true);
  assert.equal(state.intent.routing?.capability_query, undefined);
  assert.equal(state.response_contract.specialization, 'explanation');
  assert.equal(state.response_contract.preferred_shape, 'direct_explanation_then_key_points_and_references');
  assert.equal(state.policy.requested_output_shape, 'direct_explanation_then_key_points_and_references');
  assert.ok(state.policy.policies.some((item) => item.id === 'claude-code-guide'));
  assert.ok(!state.policy.policies.some((item) => item.id === 'skills-workflows'));
  assert.ok(!state.policy.policies.some((item) => item.id === 'tool-discovery'));
});

test('route keeps repo config explanations out of Claude Code guide routing', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-repo-config-explanation',
    tools: ['ClaudeCodeGuide', 'ToolSearch'],
    prompt: 'config/index.mjs:12 这里为什么这样加载配置？',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.intent.actions.explain, true);
  assert.equal(state.intent.routing?.claude_guide, undefined);
  assert.equal(state.response_contract.specialization, 'explanation');
  assert.equal(state.response_contract.preferred_shape, 'direct_explanation_then_key_points_and_references');
  assert.ok(!state.policy?.policies?.some((item) => item.id === 'claude-code-guide'));
});

test('route keeps active-team guide explanations out of team-status while preserving explicit team-state prompts', () => {
  const env = isolatedEnv();
  const sessionId = 'route-guide-team-status-guard';
  const transcriptPath = writeTranscript(env.HOME, sessionId, {
    model: 'opus',
    tools: ['ClaudeCodeGuide', 'TaskList', 'TaskGet', 'TaskUpdate', 'SendMessage'],
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
            text: 'team active',
          },
        ],
      },
    },
  ]);

  const guideOutput = run('route', {
    session_id: sessionId,
    transcript_path: transcriptPath,
    tools: ['ClaudeCodeGuide', 'TaskList', 'TaskGet', 'TaskUpdate', 'SendMessage'],
    prompt: 'Explain how Claude Code hooks work.',
  }, env);
  const guideState = parseAdditionalContextJson(guideOutput.hookSpecificOutput.additionalContext);

  assert.equal(guideState.intent.collaboration?.team_status, undefined);
  assert.equal(guideState.intent.routing?.claude_guide, true);
  assert.equal(guideState.response_contract.specialization, 'explanation');
  assert.ok(guideState.policy.policies.some((item) => item.id === 'claude-code-guide'));

  const teamStateOutput = run('route', {
    session_id: sessionId,
    transcript_path: transcriptPath,
    tools: ['TaskList', 'TaskGet', 'TaskUpdate', 'SendMessage'],
    prompt: 'Summarize the team state and tell me what to do next.',
  }, env);
  const teamState = parseAdditionalContextJson(teamStateOutput.hookSpecificOutput.additionalContext);

  assert.equal(teamState.intent.collaboration.team_status, true);
  assert.equal(teamState.response_contract.specialization, 'team_status');
  assert.equal(teamState.response_contract.selection_basis, 'team_continuity');
  assert.equal(teamState.response_contract.selection_strength, 'strong');
});

test('route keeps active-team continuity from hijacking non-team-owned specialization roles and playbooks', () => {
  const env = isolatedEnv();
  const sessionId = 'route-active-team-specialization-role-guard';
  const transcriptPath = writeTranscript(env.HOME, sessionId, {
    model: 'opus',
    tools: ['ClaudeCodeGuide', 'WebSearch', 'ToolSearch', 'DiscoverSkills', 'ListMcpResources', 'ReadMcpResource', 'Skill', 'TaskList', 'TaskGet', 'TaskUpdate', 'SendMessage', 'AskUserQuestion', 'ExitPlanMode'],
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
            text: 'team active',
          },
        ],
      },
    },
  ]);

  const cases = [
    {
      prompt: '利用できる外部連携はありますか？',
      specialization: 'capability',
      role: 'general_operator',
      orderedSteps: [
        'inspect_visible_capability_surfaces',
        'answer_from_visible_surface_or_state_gap',
        'run_only_the_narrowest_needed_discovery',
      ],
      tieBreakerId: 'visible_surface_answer_before_discovery_fallback',
    },
    {
      prompt: 'Compare Claude Code hooks with settings in a table.',
      specialization: 'compare',
      role: 'direct_decider',
      orderedSteps: [
        'state_judgment_first',
        'compare_options_in_compact_table',
        'give_recommendation_and_boundary',
      ],
    },
    {
      prompt: [
        '`src/a.ts`',
        '`src/b.ts`',
        'How are these connected?',
      ].join('\n'),
      specialization: 'research',
      role: 'researcher',
      orderedSteps: [
        'search_targeted_surfaces',
        'read_specific_context',
        'return_paths_and_unknowns',
      ],
    },
    {
      prompt: [
        '这个改造应该怎么拆分？',
        '1. 先做哪些',
        '2. 风险是什么',
        '3. 每一步怎么验证',
      ].join('\n'),
      specialization: 'planning',
      role: 'planner',
      orderedSteps: [
        'gather_constraints',
        'ask_only_real_blocking_questions',
        'emit_executable_plan',
        'submit_via_ExitPlanMode',
      ],
    },
    {
      prompt: 'Explain how Claude Code hooks work.',
      specialization: 'explanation',
      role: 'general_operator',
      orderedSteps: [
        'answer_the_question_directly',
        'anchor_to_concrete_paths_or_symbols',
        'add_background_only_if_needed',
      ],
    },
    {
      prompt: 'What changed in Claude Code recently?',
      specialization: 'current_info',
      role: 'general_operator',
      orderedSteps: [
        'check_websearch_surface_or_cooldown',
        'run_or_reuse_real_search_results',
        'report_sources_and_uncertainty',
      ],
    },
    {
      prompt: [
        '```diff',
        'diff --git a/src/app.ts b/src/app.ts',
        '@@ -1,3 +1,4 @@',
        '-const enabled = false;',
        '+const enabled = true;',
        '```',
        '',
        '这个改动有问题吗？',
      ].join('\n'),
      specialization: 'review',
      role: 'general_operator',
      orderedSteps: [
        'collect_findings_with_paths',
        'rank_by_severity_or_regression_risk',
        'state_open_questions_after_findings',
      ],
    },
    {
      prompt: 'Verify the auth change and tell me if it passed.',
      specialization: 'verification',
      role: 'direct_executor',
      orderedSteps: [
        'choose_narrowest_relevant_validation',
        'capture_evidence_or_not_run_status',
        'state_remaining_gaps',
      ],
    },
    {
      prompt: 'Prepare the 0.4.4 release and summarize status first.',
      specialization: 'release',
      role: 'general_operator',
      orderedSteps: [
        'continue_loaded_release_surface_if_any',
        'check_version_tag_notes_inputs',
        'validate_publish_path_or_report_gap',
        'summarize_status_checklist_and_notes',
      ],
      tieBreakerId: 'loaded_release_workflow_before_manual_reinvention',
    },
  ];

  for (const testCase of cases) {
    const output = run('route', {
      session_id: sessionId,
      transcript_path: transcriptPath,
      tools: ['ClaudeCodeGuide', 'WebSearch', 'ToolSearch', 'DiscoverSkills', 'ListMcpResources', 'ReadMcpResource', 'Skill', 'TaskList', 'TaskGet', 'TaskUpdate', 'SendMessage', 'AskUserQuestion', 'ExitPlanMode'],
      prompt: testCase.prompt,
    }, env);
    const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

    assert.equal(state.response_contract.specialization, testCase.specialization);
    assert.equal(state.response_contract.role, testCase.role);
    assert.equal(state.execution_playbook.specialization, testCase.specialization);
    assert.equal(state.execution_playbook.role, testCase.role);
    assert.deepEqual(state.execution_playbook.ordered_steps, testCase.orderedSteps);
    assert.ok(!state.execution_playbook.ordered_steps.includes('inspect_task_board_continuity'));
    assert.ok(!state.execution_playbook.ordered_steps.includes('advance_or_reassign_tasks'));
    assert.ok(!state.execution_playbook.ordered_steps.includes('use_SendMessage_for_real_team_coordination'));
    if (testCase.tieBreakerId) {
      assert.ok(state.decision_tie_breakers.items.some((item) => item.id === testCase.tieBreakerId));
    }
  }
});

test('route derives non-lexicon broad artifact questions into research guidance', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-research-non-lexicon',
    prompt: [
      '`src/auth.ts`',
      '`server/session.ts`',
      '`routes/login.ts`',
      '这几处现在是怎么串起来的？',
    ].join('\n'),
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.intent.analysis.lexicon_guided, undefined);
  assert.equal(state.intent.analysis.artifact_shape_guided, true);
  assert.equal(state.intent.analysis.prompt_shape.broad_artifact_question, true);
  assert.equal(state.intent.analysis.prompt_shape.path_artifact_count, 3);
  assert.equal(state.response_contract.specialization, 'research');
  assert.equal(state.response_contract.selection_basis, 'artifact_probe_shape');
  assert.equal(state.response_contract.selection_strength, 'medium');
  assert.equal(state.response_contract.preferred_shape, 'direct_findings_with_paths_and_unknowns');
  assert.ok(state.decision_tie_breakers.items.some((item) => item.id === 'targeted_paths_before_conclusion'));
});

test('route derives non-lexicon diff questions into review guidance', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-review-non-lexicon',
    prompt: [
      '```diff',
      'diff --git a/src/app.ts b/src/app.ts',
      '@@ -1,3 +1,4 @@',
      '-const enabled = false;',
      '+const enabled = true;',
      '```',
      '',
      '这个改动有问题吗？',
    ].join('\n'),
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.intent.analysis.lexicon_guided, undefined);
  assert.equal(state.intent.analysis.artifact_shape_guided, true);
  assert.equal(state.intent.analysis.prompt_shape.review_artifact, true);
  assert.equal(state.response_contract.specialization, 'review');
  assert.equal(state.response_contract.selection_basis, 'review_artifact_shape');
  assert.equal(state.response_contract.selection_strength, 'medium');
  assert.equal(state.response_contract.preferred_shape, 'findings_first_then_open_questions_then_change_summary');
});

test('route derives non-lexicon structured planning questions into planning guidance', () => {
  const env = isolatedEnv();
  const output = run('route', {
    session_id: 'route-planning-non-lexicon',
    prompt: [
      '这个改造应该怎么拆分？',
      '1. 先做哪些',
      '2. 风险是什么',
      '3. 每一步怎么验证',
    ].join('\n'),
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.intent.analysis.lexicon_guided, undefined);
  assert.equal(state.intent.analysis.planning_probe_shape, true);
  assert.equal(state.intent.actions.plan, true);
  assert.equal(state.response_contract.specialization, 'planning');
  assert.equal(state.response_contract.selection_basis, 'planning_probe_shape');
  assert.equal(state.response_contract.selection_strength, 'medium');
  assert.equal(state.response_contract.preferred_shape, 'ordered_plan_with_validation_and_open_questions');
  assert.ok(state.recovery_playbook.recipes.some((recipe) => recipe.guard === 'plan_mode_protocol'));
  assert.ok(state.decision_tie_breakers.items.some((item) => item.id === 'constraints_before_plan_shape'));
});
