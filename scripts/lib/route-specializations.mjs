import { compactState } from './host-state-context.mjs';

export function preferredRouteResponseShape(signals = {}, role = '', specialization = '', continuity = {}, actionSummary = {}) {
  return actionSummary.recommended_response_shape
    || (signals.compare
      ? 'one_sentence_judgment_then_markdown_table_then_recommendation'
      : specialization === 'current_info'
        ? 'current_info_status_then_sources_then_uncertainty'
        : specialization === 'capability'
          ? 'direct_answer_then_visible_capabilities_then_gap_or_next_step'
        : specialization === 'team_approval'
          ? 'approval_status_then_compact_table_then_response_action'
          : specialization === 'release_follow_up'
            ? 'release_follow_up_status_then_checklist_then_open_items'
            : specialization === 'blocked_verification'
              ? 'verification_blocker_status_then_evidence_then_unblock_path'
      : specialization === 'handoff'
        ? 'handoff_status_then_compact_table_then_reassignment_or_follow_up'
        : specialization === 'team_status'
          ? 'team_status_then_compact_table_then_next_actions'
          : specialization === 'planning'
            ? 'ordered_plan_with_validation_and_open_questions'
            : specialization === 'research'
              ? 'direct_findings_with_paths_and_unknowns'
              : specialization === 'review_verification'
                ? 'findings_first_then_verification_evidence_then_risk_call'
                : specialization === 'review'
                  ? 'findings_first_then_open_questions_then_change_summary'
                  : specialization === 'verification'
                    ? 'verification_status_then_evidence_then_gaps'
                    : specialization === 'explanation'
                      ? 'direct_explanation_then_key_points_and_references'
                      : specialization === 'release'
                        ? 'release_status_then_checklist_then_notes'
                        : continuity.plan_mode_entered
                          ? 'ordered_plan_with_validation_and_open_questions'
                          : role === 'researcher'
                            ? 'direct_findings_with_paths_and_unknowns'
                            : role === 'direct_executor'
                              ? 'brief_status_then_changes_validation_and_risks'
                              : 'direct_answer_then_next_step');
}

export function requiredSectionsForResponseShape(preferredShape = '') {
  if (preferredShape === 'one_sentence_judgment_then_markdown_table_then_recommendation') {
    return ['judgment', 'compact_table', 'recommendation'];
  }

  if (preferredShape === 'one_line_plus_compact_markdown_table') {
    return ['one_line_judgment', 'compact_table', 'next_step'];
  }

  if (preferredShape === 'team_status_then_compact_table_then_next_actions') {
    return ['team_status', 'compact_table', 'next_actions'];
  }

  if (preferredShape === 'approval_status_then_compact_table_then_response_action') {
    return ['approval_status', 'compact_table', 'response_action'];
  }

  if (preferredShape === 'release_follow_up_status_then_checklist_then_open_items') {
    return ['release_follow_up_status', 'checklist', 'open_items'];
  }

  if (preferredShape === 'current_info_status_then_sources_then_uncertainty') {
    return ['current_status_or_answer', 'sources_or_search_status', 'uncertainty_or_next_step'];
  }

  if (preferredShape === 'direct_answer_then_visible_capabilities_then_gap_or_next_step') {
    return ['direct_answer', 'visible_capabilities_or_surfaces', 'gap_or_next_step'];
  }

  if (preferredShape === 'verification_blocker_status_then_evidence_then_unblock_path') {
    return ['blocker_status', 'evidence_or_not_run', 'unblock_path'];
  }

  if (preferredShape === 'handoff_status_then_compact_table_then_reassignment_or_follow_up') {
    return ['handoff_status', 'compact_table', 'reassignment_or_follow_up'];
  }

  if (preferredShape === 'ordered_plan_with_validation_and_open_questions') {
    return ['goal', 'ordered_phases', 'validation', 'open_questions_or_risks'];
  }

  if (preferredShape === 'ordered_plan_with_validation_and_risks') {
    return ['goal', 'ordered_phases', 'validation', 'risks'];
  }

  if (preferredShape === 'brief_status_then_changes_validation_and_risks') {
    return ['status', 'changes', 'validation', 'risks'];
  }

  if (preferredShape === 'verification_status_then_evidence_then_gaps') {
    return ['verification_status', 'evidence', 'gaps'];
  }

  if (preferredShape === 'findings_first_then_open_questions_then_change_summary') {
    return ['findings', 'open_questions', 'change_summary'];
  }

  if (preferredShape === 'findings_first_then_verification_evidence_then_risk_call') {
    return ['findings', 'verification_evidence', 'risk_call'];
  }

  if (preferredShape === 'direct_explanation_then_key_points_and_references') {
    return ['direct_answer', 'key_points', 'references'];
  }

  if (preferredShape === 'release_status_then_checklist_then_notes') {
    return ['release_status', 'checklist', 'notes'];
  }

  if (preferredShape === 'direct_findings_with_paths_and_unknowns') {
    return ['findings', 'paths_or_symbols', 'unknowns'];
  }

  return ['answer', 'next_step'];
}

export function requiredSectionsForRouteShape(preferredShape = '') {
  return requiredSectionsForResponseShape(preferredShape);
}

export function specializedRoutePlaybook(role, specialization = '', continuity = {}) {
  if (specialization === 'compare') {
    return compactState({
      role,
      specialization,
      ordered_steps: ['state_judgment_first', 'compare_options_in_compact_table', 'give_recommendation_and_boundary'],
      avoid_shortcuts: ['long_preamble_before_answer', 'implementation_before_decision'],
    });
  }

  if (specialization === 'current_info') {
    return compactState({
      role,
      specialization,
      ordered_steps: ['check_websearch_surface_or_cooldown', 'shape_first_websearch_query', 'run_or_reuse_real_search_results', 'report_sources_and_uncertainty'],
      avoid_shortcuts: ['memory_presented_as_current_fact', 'overloaded_query_before_real_search'],
    });
  }

  if (specialization === 'research') {
    return compactState({
      role,
      specialization,
      ordered_steps: ['search_targeted_surfaces', 'read_specific_context', 'return_paths_and_unknowns'],
      avoid_shortcuts: ['broad_conclusion_without_paths'],
    });
  }

  if (specialization === 'capability') {
    return compactState({
      role,
      specialization,
      ordered_steps: ['inspect_visible_capability_surfaces', 'answer_from_visible_surface_or_state_gap', 'run_only_the_narrowest_needed_discovery'],
      avoid_shortcuts: ['inventing_hidden_capabilities', 'broad_discovery_before_surface_check'],
    });
  }

  if (specialization === 'planning') {
    return compactState({
      role,
      specialization,
      ordered_steps: ['gather_constraints', 'ask_only_real_blocking_questions', 'emit_executable_plan', 'submit_via_ExitPlanMode_or_handoff'],
      continuation_rule: continuity.plan_mode_exited ? 'continue_from_last_approved_plan' : undefined,
      avoid_shortcuts: ['implementation_before_plan_is_approved', 'weak_confirmation_loops'],
    });
  }

  if (specialization === 'team_approval') {
    return compactState({
      role,
      specialization,
      ordered_steps: ['inspect_pending_plan_approvals', 'review_top_request_and_context', 'respond_via_structured_SendMessage', 'summarize_remaining_approvals'],
      avoid_shortcuts: ['plain_text_approval_or_rejection'],
    });
  }

  if (specialization === 'review_verification') {
    return compactState({
      role,
      specialization,
      ordered_steps: ['collect_findings_with_paths', 'run_or_collect_validation_evidence', 'state_risks_and_remaining_gaps'],
      avoid_shortcuts: ['summary_first', 'verification_claims_without_evidence'],
    });
  }

  if (specialization === 'review') {
    return compactState({
      role,
      specialization,
      ordered_steps: ['collect_findings_with_paths', 'rank_by_severity_or_regression_risk', 'state_open_questions_after_findings'],
      avoid_shortcuts: ['summary_first_review'],
    });
  }

  if (specialization === 'verification') {
    return compactState({
      role,
      specialization,
      ordered_steps: ['choose_narrowest_relevant_validation', 'capture_evidence_or_not_run_status', 'state_remaining_gaps'],
      avoid_shortcuts: ['broad_suite_before_targeted_checks', 'claiming_verified_without_evidence'],
    });
  }

  if (specialization === 'explanation') {
    return compactState({
      role,
      specialization,
      ordered_steps: ['answer_the_question_directly', 'anchor_to_concrete_paths_or_symbols', 'add_background_only_if_needed'],
      avoid_shortcuts: ['meta_preface_before_answer'],
    });
  }

  if (specialization === 'release') {
    return compactState({
      role,
      specialization,
      ordered_steps: ['continue_loaded_release_surface_if_any', 'check_version_tag_notes_inputs', 'validate_publish_path_or_report_gap', 'summarize_status_checklist_and_notes'],
      continuation_rule: continuity.plan_mode_exited ? 'continue_from_last_approved_plan' : undefined,
      avoid_shortcuts: ['manual_release_reinvention', 'notes_without_status'],
    });
  }

  if (specialization === 'release_follow_up') {
    return compactState({
      role,
      specialization,
      ordered_steps: ['resume_loaded_release_surface', 'advance_remaining_release_follow_up_items', 'report_status_checklist_and_open_items'],
      continuation_rule: continuity.plan_mode_exited ? 'continue_from_last_approved_plan' : undefined,
      avoid_shortcuts: ['starting_a_fresh_release_path', 'notes_without_follow_up_status'],
    });
  }

  if (specialization === 'blocked_verification') {
    return compactState({
      role,
      specialization,
      ordered_steps: ['inspect_current_blocker', 'state_validation_evidence_or_not_run_boundary', 'name_the_unblock_path'],
      avoid_shortcuts: ['claiming_verification_while_blocked'],
    });
  }

  return null;
}
