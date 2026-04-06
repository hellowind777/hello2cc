import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const scriptPath = resolve('scripts/subagent-context.mjs');

function isolatedEnv(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'hello2cc-subagent-test-'));

  return {
    HOME: root,
    USERPROFILE: root,
    CLAUDE_PLUGIN_DATA: join(root, 'plugin-data'),
    CLAUDE_PLUGIN_ROOT: resolve('.'),
    ...overrides,
  };
}

function parseAdditionalContextJson(text) {
  const match = String(text || '').match(/```json\r?\n([\s\S]*?)\r?\n```/);
  assert.ok(match, 'expected a json code block in additionalContext');
  return JSON.parse(match[1]);
}

function run(mode, payload, env = {}) {
  const result = spawnSync(process.execPath, [scriptPath, mode], {
    cwd: resolve('.'),
    env: {
      ...process.env,
      ...env,
    },
    input: payload ? JSON.stringify(payload) : '',
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  return result.stdout ? JSON.parse(result.stdout) : {};
}

test('subagent-context exposes plain worker capability as structured state', () => {
  const env = isolatedEnv();
  const output = run('general', {
    session_id: 'plain-worker',
    agent_id: 'agent-1234',
    agent_type: 'general-purpose',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);
  const context = output.hookSpecificOutput.additionalContext;

  assert.equal(state.hello2cc_role, 'host-state');
  assert.equal(state.operator_profile, 'opus-compatible-claude-code');
  assert.equal(state.execution_envelope, 'host_defined_capability_policies');
  assert.equal(state.semantic_routing, 'host_guarded_model_decides');
  assert.equal(state.mode, 'General-Purpose');
  assert.equal(state.can_write, true);
  assert.equal(state.response_contract.preferred_shape, 'brief_status_then_changes_validation_and_risks');
  assert.equal(state.execution_playbook.role, 'general_executor');
  assert.equal(state.recovery_playbook.fail_closed, true);
  assert.equal(state.teammate, undefined);
  assert.match(context, /judgment first/i);
  assert.ok(context.length < 4000, `expected compact plain worker context, got ${context.length} chars`);
  assert.ok(context.split(/\r?\n/).length < 30, 'expected plain worker context to stay compact');
});

test('subagent-context exposes teammate identity and includes team workflow guidance', () => {
  const env = isolatedEnv();
  const output = run('general', {
    session_id: 'team-worker',
    agent_id: 'frontend-dev@delivery-squad',
    agent_type: 'general-purpose',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);
  const context = output.hookSpecificOutput.additionalContext;

  assert.equal(state.mode, 'General-Purpose');
  assert.equal(state.teammate.agent, 'frontend-dev');
  assert.equal(state.teammate.team, 'delivery-squad');
  assert.equal(state.teammate.coordination_channel, 'SendMessage');
  assert.equal(state.tool_choice, 'follow_visible_capability_contracts');
  assert.equal(state.coordination.task_board, true);
  assert.deepEqual(state.coordination.lifecycle, ['TaskList', 'TaskGet', 'TaskUpdate']);
  assert.match(context, /TaskList/);
  assert.match(context, /TaskUpdate/);
  assert.match(context, /SendMessage/);
  assert.match(context, /TeammateIdle/);
});

test('subagent-context keeps Explore on explicit read-only capability', () => {
  const env = isolatedEnv();
  const output = run('explore', {
    session_id: 'team-explore',
    agent_id: 'researcher@delivery-squad',
    agent_type: 'Explore',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);
  const context = output.hookSpecificOutput.additionalContext;

  assert.equal(state.mode, 'Explore');
  assert.equal(state.capability, 'read-only-search');
  assert.equal(state.can_write, false);
  assert.equal(state.execution_envelope, 'host_defined_capability_policies');
  assert.equal(state.response_contract.preferred_shape, 'direct_findings_with_paths_and_unknowns');
  assert.equal(state.execution_playbook.role, 'teammate_explorer');
  assert.match(context, /compact Markdown table/i);
});

test('subagent-context derives compare task intent into a decision contract', () => {
  const env = isolatedEnv();
  const output = run('general', {
    session_id: 'compare-worker',
    task_description: 'Compare TeamCreate with plain Agent workers and recommend one.',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.task_intent.actions.compare, true);
  assert.equal(state.response_contract.specialization, 'compare');
  assert.equal(state.response_contract.selection_basis, 'weak_parent_task_shape');
  assert.equal(state.response_contract.selection_strength, 'weak');
  assert.equal(state.response_contract.preferred_shape, 'one_sentence_judgment_then_markdown_table_then_recommendation');
  assert.deepEqual(state.execution_playbook.ordered_steps, [
    'state_judgment_first',
    'compare_options_in_compact_table',
    'give_recommendation_and_boundary',
  ]);
  assert.deepEqual(state.recovery_playbook.recipes.map((recipe) => recipe.guard), [
    'decision_answer_first',
  ]);
  assert.deepEqual(state.decision_tie_breakers.items.map((item) => item.id), [
    'visible_capability_boundary_before_improvisation',
    'judgment_and_table_before_long_prose',
  ]);
  assert.equal(state.specialization_candidates.active, 'compare');
  assert.ok(state.specialization_candidates.items.some((item) => item.id === 'compare' && item.selected));
  assert.ok(state.specialization_candidates.items.some((item) => item.id === 'compare' && item.selection_strength === 'weak'));
});

test('subagent-context marks plan mode as planning specialization', () => {
  const env = isolatedEnv();
  const output = run('plan', {
    session_id: 'plan-worker',
    task_description: 'Plan the migration with validation steps and risks.',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.task_intent.actions.plan, true);
  assert.equal(state.response_contract.specialization, 'planning');
  assert.equal(state.response_contract.selection_basis, 'mode_boundary');
  assert.equal(state.response_contract.selection_strength, 'strong');
  assert.equal(state.response_contract.preferred_shape, 'ordered_plan_with_validation_and_risks');
  assert.deepEqual(state.execution_playbook.ordered_steps, [
    'gather_constraints',
    'ask_only_real_blocking_questions',
    'produce_ordered_plan',
    'call_out_validation_and_risks',
  ]);
  assert.ok(state.recovery_playbook.recipes.some((recipe) => recipe.guard === 'read_only_capability_boundary'));
  assert.ok(state.recovery_playbook.recipes.some((recipe) => recipe.guard === 'planning_protocol'));
  assert.ok(state.decision_tie_breakers.items.some((item) => item.id === 'mode_boundary_before_write_actions'));
  assert.ok(state.decision_tie_breakers.items.some((item) => item.id === 'constraints_before_plan'));
  assert.equal(state.specialization_candidates.active, 'planning');
  assert.ok(state.specialization_candidates.items.some((item) => item.id === 'planning' && item.selected));
  assert.ok(state.specialization_candidates.items.some((item) => item.id === 'planning' && item.selection_basis === 'mode_boundary'));
});

test('subagent-context exposes current assigned tasks for a teammate from shared team state', () => {
  const env = isolatedEnv();
  const runtimeDir = join(env.CLAUDE_PLUGIN_DATA, 'runtime');
  mkdirSync(runtimeDir, { recursive: true });
  writeFileSync(join(runtimeDir, 'team-context.json'), JSON.stringify({
    'delivery-squad': {
      teamName: 'delivery-squad',
      taskAssignments: {
        '7': {
          taskId: '7',
          owner: 'frontend-dev',
          subject: 'Implement API',
          status: 'in_progress',
          blocks: [],
          blockedBy: ['3'],
          assignedBy: 'team-lead',
          recordedAt: '2026-04-04T00:00:00.000Z',
        },
      },
      pendingTaskAssignments: {
        '7': {
          taskId: '7',
          owner: 'frontend-dev',
          subject: 'Implement API',
          description: 'Implement the API slice and keep the contract in sync.',
          assignedBy: 'team-lead',
          recordedAt: '2026-04-04T00:00:01.000Z',
        },
      },
      updatedAt: '2026-04-04T00:00:00.000Z',
    },
  }), 'utf8');

  const output = run('general', {
    session_id: 'team-assigned-worker',
    agent_id: 'frontend-dev@delivery-squad',
    agent_type: 'general-purpose',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);
  const context = output.hookSpecificOutput.additionalContext;

  assert.deepEqual(state.coordination.current_assigned_tasks, [
    {
      task_id: '7',
      subject: 'Implement API',
      status: 'in_progress',
      blocked_by: ['3'],
      assigned_by: 'team-lead',
    },
  ]);
  assert.deepEqual(state.coordination.pending_assignment_notifications, [
    {
      task_id: '7',
      subject: 'Implement API',
      description: 'Implement the API slice and keep the contract in sync.',
      assigned_by: 'team-lead',
    },
  ]);
  assert.equal(state.coordination.mailbox_events, undefined);
  assert.deepEqual(state.coordination.mailbox_summary, {
    total_events: 1,
    latest_event_type: 'task_assignment',
    latest_summary: '[Task Assigned] #7 - Implement API',
    requires_task_pickup: true,
    summary_lines: ['[Task Assigned] #7 - Implement API'],
  });
  assert.equal(state.coordination.team_action_items, undefined);
  assert.deepEqual(state.coordination.team_action_summary, {
    total_actions: 2,
    top_action_type: 'pick_up_assignment',
    top_priority: 95,
    requires_immediate_response: true,
    recommended_response_shape: 'one_line_plus_compact_markdown_table',
    preferred_table_columns: ['priority', 'action', 'task', 'teammate', 'next_tool'],
    summary_lines: [
      '[Task Assigned] #7 - Implement API',
      'Task #7 Implement API is blocked by #3',
    ],
  });
  assert.equal(state.response_contract.preferred_shape, 'one_line_plus_compact_markdown_table');
  assert.equal(state.execution_playbook.role, 'teammate_executor');
  assert.ok(state.recovery_playbook.recipes.some((recipe) => recipe.guard === 'pending_assignment_mailbox'));
  assert.ok(state.recovery_playbook.recipes.some((recipe) => recipe.guard === 'blocked_task_continuity'));
  assert.equal(state.specialization_candidates.active, 'handoff');
  assert.ok(state.specialization_candidates.items.some((item) => item.id === 'handoff' && item.selected));
  assert.ok(state.specialization_candidates.items.some((item) => item.id === 'team_status'));
  assert.match(context, /action items|最该处理的动作/i);
  assert.match(context, /mailbox.*折叠|Task Assigned/i);
  assert.match(context, /#7 Implement API/);
  assert.match(context, /TaskGet/);
  assert.match(context, /#7 <- #3/);
  assert.match(context, /task assignment/i);
  assert.match(context, /recovery_playbook|pending_assignment_mailbox|blocked_task_continuity/);
  assert.ok(context.length < 6500, `expected compact teammate context, got ${context.length} chars`);
  assert.ok(context.split(/\r?\n/).length < 35, 'expected teammate context to stay compact');
});

test('subagent-context uses handoff specialization when teammate work is blocked', () => {
  const env = isolatedEnv();
  const runtimeDir = join(env.CLAUDE_PLUGIN_DATA, 'runtime');
  mkdirSync(runtimeDir, { recursive: true });
  writeFileSync(join(runtimeDir, 'team-context.json'), JSON.stringify({
    'delivery-squad': {
      teamName: 'delivery-squad',
      taskAssignments: {
        '7': {
          taskId: '7',
          owner: 'frontend-dev',
          subject: 'Implement API',
          status: 'in_progress',
          blocks: [],
          blockedBy: ['3'],
          assignedBy: 'team-lead',
          recordedAt: '2026-04-04T00:00:00.000Z',
        },
      },
      updatedAt: '2026-04-04T00:00:00.000Z',
    },
  }), 'utf8');

  const output = run('general', {
    session_id: 'handoff-worker',
    agent_id: 'frontend-dev@delivery-squad',
    task_description: 'Continue the assigned slice and hand off or follow up on blockers if needed.',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.response_contract.specialization, 'handoff');
  assert.equal(state.response_contract.selection_basis, 'blocked_task_continuity');
  assert.equal(state.response_contract.selection_strength, 'strong');
  assert.equal(state.response_contract.preferred_shape, 'handoff_status_then_compact_table_then_reassignment_or_follow_up');
  assert.deepEqual(state.execution_playbook.ordered_steps, [
    'read_current_task_state',
    'resolve_blocker_or_prepare_handoff',
    'update_task_board_or_SendMessage',
    'state_next_owner_or_follow_up',
  ]);
  assert.ok(state.recovery_playbook.recipes.some((recipe) => recipe.guard === 'blocked_task_continuity'));
  assert.ok(state.recovery_playbook.recipes.some((recipe) => recipe.guard === 'handoff_or_blocker_continuity'));
  assert.ok(state.decision_tie_breakers.items.some((item) => item.id === 'blocked_task_or_handoff_before_done_claim'));
});

test('subagent-context derives review and verification task intent into structured contracts', () => {
  const env = isolatedEnv();
  const output = run('general', {
    session_id: 'review-verify-worker',
    task_description: 'Review the current changes, verify the result, and call out any remaining risks.',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.task_intent.actions.review, true);
  assert.equal(state.task_intent.actions.verify, true);
  assert.equal(state.response_contract.specialization, 'review_verification');
  assert.equal(state.response_contract.preferred_shape, 'findings_first_then_verification_evidence_then_risk_call');
  assert.equal(state.execution_playbook.specialization, 'review_verification');
  assert.deepEqual(state.execution_playbook.ordered_steps, [
    'collect_findings_with_paths',
    'run_or_collect_validation_evidence',
    'state_risks_and_remaining_gaps',
  ]);
  assert.deepEqual(state.recovery_playbook.recipes.map((recipe) => recipe.guard), [
    'review_findings_first',
    'verification_evidence_required',
  ]);
  assert.deepEqual(state.decision_tie_breakers.items.map((item) => item.id), [
    'visible_capability_boundary_before_improvisation',
    'findings_before_summary',
    'evidence_before_claims',
  ]);
});

test('subagent-context derives explain task intent into direct-answer guidance', () => {
  const env = isolatedEnv();
  const output = run('general', {
    session_id: 'explain-worker',
    task_description: 'Explain how the routing state in this repo decides what workflow to use.',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.task_intent.actions.explain, true);
  assert.equal(state.response_contract.specialization, 'explanation');
  assert.equal(state.response_contract.preferred_shape, 'direct_explanation_then_key_points_and_references');
  assert.deepEqual(state.response_contract.required_sections, ['direct_answer', 'key_points', 'references']);
  assert.equal(state.renderer_contract.style_name, 'hello2cc:hello2cc Native');
  assert.equal(state.renderer_contract.opening, 'direct_answer_first');
  assert.deepEqual(state.renderer_contract.section_order, ['direct_answer', 'key_points', 'references']);
  assert.equal(state.renderer_contract.table_mode, 'markdown_when_helpful');
  assert.ok(state.renderer_contract.avoid.includes('background_before_direct_answer'));
  assert.deepEqual(state.execution_playbook.ordered_steps, [
    'answer_the_question_directly',
    'anchor_to_concrete_paths_or_symbols',
    'add_background_only_if_needed',
  ]);
  assert.deepEqual(state.recovery_playbook.recipes.map((recipe) => recipe.guard), [
    'direct_answer_first',
  ]);
  assert.deepEqual(state.decision_tie_breakers.items.map((item) => item.id), [
    'visible_capability_boundary_before_improvisation',
    'direct_answer_before_background',
  ]);
});

test('subagent-context keeps protocol explanation prompts out of capability routing', () => {
  const env = isolatedEnv();
  const prompts = [
    'Explain how the router decides which tools to use.',
    'Explain how skill discovery works in this repo.',
    'Explain why the task board is required here.',
    'Explain how ToolSearch works here.',
    'Explain how Claude Code hooks work.',
    'Explain how Claude Code settings work here.',
    'Explain why WebSearch is required here.',
  ];

  for (const [index, taskDescription] of prompts.entries()) {
    const output = run('general', {
      session_id: `explain-protocol-worker-${index + 1}`,
      task_description: taskDescription,
    }, env);
    const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

    assert.equal(state.task_intent.actions.explain, true);
    assert.equal(state.task_intent.routing?.capability_query, undefined);
    assert.equal(state.task_intent.collaboration?.team_workflow, undefined);
    assert.equal(state.task_intent.collaboration?.task_board, undefined);
    assert.equal(state.task_intent.collaboration?.team_semantics, undefined);
    assert.equal(state.task_intent.collaboration?.team_status, undefined);
    assert.equal(state.response_contract.specialization, 'explanation');
    assert.equal(state.response_contract.preferred_shape, 'direct_explanation_then_key_points_and_references');
    assert.deepEqual(state.decision_tie_breakers.items.map((item) => item.id), [
      'visible_capability_boundary_before_improvisation',
      'direct_answer_before_background',
    ]);

    if (taskDescription.includes('Claude Code hooks') || taskDescription.includes('Claude Code settings')) {
      assert.equal(state.task_intent.routing?.claude_guide, true);
    }
  }
});

test('subagent-context keeps Claude Code guide difference questions on explanation instead of capability routing', () => {
  const env = isolatedEnv();
  const output = run('general', {
    session_id: 'guide-difference-worker',
    task_description: 'How do Claude Code hooks differ from settings?',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.task_intent.question, true);
  assert.equal(state.task_intent.actions.explain, true);
  assert.equal(state.task_intent.routing?.claude_guide, true);
  assert.equal(state.task_intent.routing?.capability_query, undefined);
  assert.equal(state.response_contract.specialization, 'explanation');
  assert.equal(state.response_contract.preferred_shape, 'direct_explanation_then_key_points_and_references');
  assert.deepEqual(state.decision_tie_breakers.items.map((item) => item.id), [
    'visible_capability_boundary_before_improvisation',
    'direct_answer_before_background',
  ]);
});

test('subagent-context keeps team-bound guide explanations out of team-status', () => {
  const env = isolatedEnv();

  const guideOutput = run('general', {
    session_id: 'guide-team-status-worker',
    agent_id: 'frontend-dev@delivery-squad',
    agent_type: 'general-purpose',
    task_description: 'Explain how Claude Code hooks work.',
  }, env);
  const guideState = parseAdditionalContextJson(guideOutput.hookSpecificOutput.additionalContext);

  assert.equal(guideState.task_intent.collaboration?.team_status, undefined);
  assert.equal(guideState.task_intent.routing?.claude_guide, true);
  assert.equal(guideState.response_contract.specialization, 'explanation');
  assert.ok(guideState.specialization_candidates.items.some((item) => item.id === 'team_status'));
});

test('subagent-context derives non-lexicon artifact questions into explanation guidance', () => {
  const env = isolatedEnv();
  const output = run('general', {
    session_id: 'explain-worker-non-lexicon',
    task_description: 'scripts/lib/route-guidance.mjs:51 这里为什么要这样处理？',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.task_intent.actions.explain, true);
  assert.equal(state.response_contract.specialization, 'explanation');
  assert.equal(state.task_intent.analysis.artifact_shape_guided, true);
  assert.equal(state.response_contract.selection_basis, 'artifact_question_shape');
  assert.equal(state.response_contract.selection_strength, 'medium');
  assert.equal(state.task_intent.analysis.prompt_shape.targeted_artifact_question, true);
});

test('subagent-context derives non-lexicon broad artifact questions into research guidance', () => {
  const env = isolatedEnv();
  const output = run('general', {
    session_id: 'research-worker-non-lexicon',
    task_description: [
      '`src/auth.ts`',
      '`server/session.ts`',
      '`routes/login.ts`',
      '这几处现在是怎么串起来的？',
    ].join('\n'),
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.task_intent.actions.research, true);
  assert.equal(state.task_intent.analysis.artifact_shape_guided, true);
  assert.equal(state.task_intent.analysis.prompt_shape.broad_artifact_question, true);
  assert.equal(state.response_contract.specialization, 'research');
  assert.equal(state.response_contract.selection_basis, 'artifact_probe_shape');
  assert.equal(state.response_contract.selection_strength, 'medium');
  assert.equal(state.response_contract.preferred_shape, 'direct_findings_with_paths_and_unknowns');
});

test('subagent-context derives non-lexicon structured planning tasks into planning guidance', () => {
  const env = isolatedEnv();
  const output = run('general', {
    session_id: 'planning-worker-non-lexicon',
    task_description: [
      '这个改造应该怎么拆分？',
      '1. 先做哪些',
      '2. 风险是什么',
      '3. 每一步怎么验证',
    ].join('\n'),
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.task_intent.actions.plan, true);
  assert.equal(state.task_intent.analysis.planning_probe_shape, true);
  assert.equal(state.response_contract.specialization, 'planning');
  assert.equal(state.response_contract.selection_basis, 'planning_probe_shape');
  assert.equal(state.response_contract.selection_strength, 'medium');
  assert.equal(state.response_contract.preferred_shape, 'ordered_plan_with_validation_and_risks');
});

test('subagent-context derives explicit host-surface capability questions into capability guidance across languages', () => {
  const env = isolatedEnv();
  const output = run('general', {
    session_id: 'capability-worker-non-lexicon',
    task_description: 'MCP や ToolSearch で使える機能は何ですか？',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.task_intent.question, true);
  assert.equal(state.task_intent.routing.capability_query, true);
  assert.equal(state.task_intent.topics.mcp, true);
  assert.equal(state.task_intent.topics.host_capabilities, true);
  assert.equal(state.response_contract.specialization, 'capability');
  assert.equal(state.response_contract.selection_basis, 'capability_query_shape');
  assert.equal(state.response_contract.selection_strength, 'weak');
  assert.equal(state.response_contract.preferred_shape, 'direct_answer_then_visible_capabilities_then_gap_or_next_step');
  assert.deepEqual(state.response_contract.required_sections, ['direct_answer', 'visible_capabilities_or_surfaces', 'gap_or_next_step']);
  assert.equal(state.execution_playbook.specialization, 'capability');
  assert.deepEqual(state.execution_playbook.ordered_steps, [
    'inspect_visible_capability_surfaces',
    'answer_from_visible_surface_or_state_gap',
    'name_only_the_narrowest_needed_discovery',
  ]);
  assert.deepEqual(state.recovery_playbook.recipes.map((recipe) => recipe.guard), [
    'visible_capability_surface_first',
  ]);
  assert.deepEqual(state.decision_tie_breakers.items.map((item) => item.id), [
    'visible_capability_boundary_before_improvisation',
    'visible_surface_answer_before_discovery_fallback',
  ]);
  assert.equal(state.specialization_candidates.active, 'capability');
  assert.ok(state.specialization_candidates.items.some((item) => item.id === 'capability' && item.selected));
  assert.ok(state.specialization_candidates.items.some((item) => item.id === 'capability' && item.selection_basis === 'capability_query_shape'));
});

test('subagent-context derives non-lexicon diff questions into review guidance', () => {
  const env = isolatedEnv();
  const output = run('general', {
    session_id: 'review-worker-non-lexicon',
    task_description: [
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

  assert.equal(state.task_intent.actions.review, true);
  assert.equal(state.response_contract.specialization, 'review');
  assert.equal(state.task_intent.analysis.artifact_shape_guided, true);
  assert.equal(state.response_contract.selection_basis, 'review_artifact_shape');
  assert.equal(state.response_contract.selection_strength, 'medium');
  assert.equal(state.response_contract.preferred_shape, 'findings_first_then_open_questions_then_change_summary');
  assert.equal(state.task_intent.analysis.prompt_shape.review_artifact, true);
});

test('subagent-context derives release task intent into status-first guidance', () => {
  const env = isolatedEnv();
  const output = run('general', {
    session_id: 'release-worker',
    task_description: 'Prepare the release status, checklist, and notes for version 0.4.4.',
  }, env);
  const state = parseAdditionalContextJson(output.hookSpecificOutput.additionalContext);

  assert.equal(state.task_intent.actions.release, true);
  assert.equal(state.response_contract.specialization, 'release');
  assert.equal(state.response_contract.preferred_shape, 'release_status_then_checklist_then_notes');
  assert.deepEqual(state.execution_playbook.ordered_steps, [
    'report_release_status_first',
    'walk_the_checklist',
    'add_notes_and_remaining_risks',
  ]);
  assert.deepEqual(state.recovery_playbook.recipes.map((recipe) => recipe.guard), [
    'release_status_first',
  ]);
  assert.deepEqual(state.decision_tie_breakers.items.map((item) => item.id), [
    'visible_capability_boundary_before_improvisation',
    'release_status_before_notes',
  ]);
});
