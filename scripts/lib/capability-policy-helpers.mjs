import { configuredModels } from './config.mjs';

function trimmed(value) {
  return String(value || '').trim();
}

export function uniqueStrings(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => trimmed(value))
      .filter(Boolean),
  )];
}

export function activeTeamName(sessionContext = {}) {
  const teamName = trimmed(sessionContext?.teamName);
  if (!teamName || ['main', 'default'].includes(teamName.toLowerCase())) {
    return '';
  }

  return teamName;
}

export function visibleTaskBoardTools(sessionContext = {}) {
  return uniqueStrings([
    sessionContext?.taskCreateAvailable ? 'TaskCreate' : '',
    sessionContext?.taskListAvailable ? 'TaskList' : '',
    sessionContext?.taskGetAvailable ? 'TaskGet' : '',
    sessionContext?.taskUpdateAvailable ? 'TaskUpdate' : '',
  ]);
}

export function hasVisibleTeamWorkflowSurface(sessionContext = {}) {
  return Boolean(
    activeTeamName(sessionContext) ||
    sessionContext?.teamCreateAvailable ||
    sessionContext?.sendMessageAvailable ||
    visibleTaskBoardTools(sessionContext).length,
  );
}

export function hasBootstrappableTeamWorkflowSurface(sessionContext = {}) {
  return Boolean(
    sessionContext?.teamCreateAvailable &&
    sessionContext?.sendMessageAvailable &&
    visibleTaskBoardTools(sessionContext).length,
  );
}

export function requestOutputShape(requestProfile = {}) {
  if (requestProfile?.compare) {
    return 'one_sentence_judgment_then_markdown_table_then_recommendation';
  }

  if (requestProfile?.handoff) {
    return 'handoff_status_then_compact_table_then_reassignment_or_follow_up';
  }

  if (requestProfile?.teamStatus) {
    return 'team_status_then_compact_table_then_next_actions';
  }

  if (requestProfile?.plan) {
    return 'ordered_plan_with_validation_and_open_questions';
  }

  if (requestProfile?.currentInfo) {
    return 'current_info_status_then_sources_then_uncertainty';
  }

  if (requestProfile?.capabilityQuery || requestProfile?.capabilityProbeShape) {
    return 'direct_answer_then_visible_capabilities_then_gap_or_next_step';
  }

  if (requestProfile?.review && requestProfile?.verify) {
    return 'findings_first_then_verification_evidence_then_risk_call';
  }

  if (requestProfile?.review) {
    return 'findings_first_then_open_questions_then_change_summary';
  }

  if (requestProfile?.verify) {
    return 'verification_status_then_evidence_then_gaps';
  }

  if (requestProfile?.explain || requestProfile?.claudeGuide) {
    return 'direct_explanation_then_key_points_and_references';
  }

  if (requestProfile?.release) {
    return 'release_status_then_checklist_then_notes';
  }

  if (requestProfile?.codeResearch || requestProfile?.research) {
    return 'direct_findings_with_paths_and_unknowns';
  }

  if (requestProfile?.wantsStructuredOutput) {
    return 'prefer_markdown_structure_then_ascii_if_needed';
  }

  return 'plain_native_prose';
}

export function trackList(requestProfile = {}) {
  return uniqueStrings(requestProfile?.tracks);
}

export function requestNeedsTeamWorkflow(requestProfile = {}) {
  return Boolean(
    requestProfile?.teamSemantics ||
    requestProfile?.teamWorkflow ||
    requestProfile?.proactiveTeamWorkflow,
  );
}

export function requestNeedsParallelWorkers(requestProfile = {}) {
  return Boolean(
    requestProfile?.swarm ||
    requestProfile?.parallelRequested,
  );
}

export function requestNeedsCapabilityDiscovery(requestProfile = {}) {
  const explicitDiscoveryTopic = Boolean(
    requestProfile?.tools ||
    requestProfile?.mcp ||
    (requestProfile?.skillSurface && !requestProfile?.workflowContinuation),
  );

  return Boolean(
    explicitDiscoveryTopic ||
    (requestProfile?.capabilityQuery && !requestProfile?.workflowContinuation) ||
    (requestProfile?.capabilityProbeShape && !requestProfile?.workflowContinuation),
  );
}

export function requestNeedsGuideSurface(requestProfile = {}) {
  return Boolean(requestProfile?.claudeGuide);
}

export function requestNeedsWorkflowRouting(requestProfile = {}) {
  return Boolean(
    requestProfile?.workflowContinuation ||
    requestProfile?.skillSurface,
  );
}

export function requestNeedsPlanning(requestProfile = {}) {
  return Boolean(requestProfile?.plan);
}

/**
 * Prefers native task tracking for complex multi-step work without conflating it with team workflow.
 */
export function requestNeedsTaskTracking(requestProfile = {}) {
  const trackedComplexExecution = Boolean(
    requestProfile?.complex &&
    (
      requestProfile?.codeResearch ||
      requestProfile?.research ||
      requestProfile?.review ||
      requestProfile?.release ||
      requestNeedsParallelWorkers(requestProfile) ||
      (
        requestProfile?.artifactShapeGuided &&
        (requestProfile?.implement || requestProfile?.verify)
      )
    )
  );

  return Boolean(
    requestProfile?.taskList ||
    requestNeedsPlanning(requestProfile) ||
    requestNeedsTeamWorkflow(requestProfile) ||
    trackedComplexExecution
  );
}

export function requestNeedsDecisionHelp(requestProfile = {}) {
  return Boolean(requestProfile?.decisionHeavy);
}

export function baseDecisionLadder() {
  return [
    '已加载 workflow / skill 连续体',
    '已 surfaced 的 skill / workflow',
    '已知 MCP resource',
    '已加载或已 surfaced 的 deferred tool',
    'ToolSearch / DiscoverSkills',
    '更宽的 Agent / Plan / team 路径',
  ];
}

export function sessionModelLine(sessionContext = {}) {
  const config = configuredModels(sessionContext);
  if (config.sessionModel) {
    return `当前会话模型别名：\`${config.sessionModel}\`。`;
  }

  const mainModel = trimmed(sessionContext?.mainModel);
  return mainModel ? `当前会话模型：\`${mainModel}\`。` : '';
}
