import { buildTracks, deriveTeamSignals, hasQuestionIntent } from './prompt-signal-derive.mjs';
import {
  BACKEND_PATTERNS,
  COMPLEX_PATTERNS,
  CONTINUATION_PATTERNS,
  CURRENT_INFO_PATTERNS,
  DECISION_PATTERNS,
  DIAGRAM_PATTERNS,
  FRONTEND_PATTERNS,
  GUIDE_PATTERNS,
  HOST_FEATURE_PATTERNS,
  HOST_TOPIC_PATTERNS,
  IMPLEMENT_PATTERNS,
  MCP_PATTERNS,
  PLAN_PATTERNS,
  RESEARCH_PATTERNS,
  RETRY_PATTERNS,
  REVIEW_PATTERNS,
  SKILL_DISCOVERY_PATTERNS,
  SKILL_SURFACE_PATTERNS,
  SWARM_PATTERNS,
  TASK_LIST_PATTERNS,
  TEAM_COORDINATION_PATTERNS,
  TEAM_WORKFLOW_PATTERNS,
  VERIFY_PATTERNS,
  WORKTREE_PATTERNS,
} from './prompt-signal-patterns.mjs';

function normalizePrompt(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

export function startsWithExplicitCommand(prompt) {
  return /^(~|\/)/.test(String(prompt || '').trim());
}

export function isSubagentPrompt(prompt) {
  return /^\[(?:子代理任务|subagent task|agent task|teammate task)\]/i.test(String(prompt || '').trim());
}

export function classifyPrompt(prompt) {
  const text = normalizePrompt(prompt);
  const questionIntent = hasQuestionIntent(text);
  const research = hasAny(text, RESEARCH_PATTERNS);
  const currentInfo = hasAny(text, CURRENT_INFO_PATTERNS);
  const explicitHostFeature = hasAny(text, HOST_FEATURE_PATTERNS);
  const claudeGuide = questionIntent && hasAny(text, GUIDE_PATTERNS);
  const implement = hasAny(text, IMPLEMENT_PATTERNS);
  const review = hasAny(text, REVIEW_PATTERNS);
  const mcp = hasAny(text, MCP_PATTERNS);
  const frontend = hasAny(text, FRONTEND_PATTERNS);
  const backend = hasAny(text, BACKEND_PATTERNS);
  const complex = hasAny(text, COMPLEX_PATTERNS);
  const verify = hasAny(text, VERIFY_PATTERNS);
  const planningIntent = hasAny(text, PLAN_PATTERNS);
  const scopeHeavy = hasAny(text, [
    /multi[\s-]?file/,
    /cross[\s-]?file/,
    /多文件/,
    /跨文件/,
  ]);
  const multiTrackByStructure =
    (research && implement) ||
    (research && verify) ||
    (implement && verify) ||
    (frontend && backend);
  const explicitTeamWorkflow = hasAny(text, TEAM_WORKFLOW_PATTERNS);
  const decisionHeavy = questionIntent && hasAny(text, DECISION_PATTERNS);
  const highImpactRestructure =
    hasAny(text, [
      /refactor/,
      /rewrite/,
      /migrate/,
      /redesign/,
      /重构/,
      /重写/,
      /迁移/,
      /重做/,
    ]) &&
    (verify || planningIntent || questionIntent);
  const { proactiveTeamWorkflow, teamSemantics } = deriveTeamSignals({
    text,
    frontend,
    backend,
    research,
    implement,
    verify,
    planningIntent,
    explicitTeamWorkflow,
    coordinationPatterns: TEAM_COORDINATION_PATTERNS,
  });
  const explicitParallelIntent = hasAny(text, SWARM_PATTERNS) || explicitTeamWorkflow;
  const plan =
    planningIntent ||
    decisionHeavy ||
    (questionIntent && research && implement) ||
    (questionIntent && scopeHeavy) ||
    highImpactRestructure;
  const swarm =
    explicitParallelIntent ||
    (multiTrackByStructure && Boolean(proactiveTeamWorkflow));
  const teamWorkflow = explicitTeamWorkflow;
  const capabilityQuery = explicitHostFeature || (questionIntent && hasAny(text, HOST_TOPIC_PATTERNS)) || mcp;
  const codeResearch = research && !capabilityQuery;
  const skillSurface = hasAny(text, SKILL_SURFACE_PATTERNS);
  const skillWorkflowLike = skillSurface || hasAny(text, SKILL_DISCOVERY_PATTERNS);
  const workflowContinuation = hasAny(text, CONTINUATION_PATTERNS);
  const tracks = buildTracks({ frontend, backend, research, implement, review, verify });

  const boundedImplementation = implement && !research && !swarm && tracks.length <= 1 && !frontend && !backend;

  return {
    diagram: hasAny(text, DIAGRAM_PATTERNS),
    research,
    currentInfo,
    swarm,
    teamWorkflow,
    proactiveTeamWorkflow,
    teamSemantics,
    verify,
    complex,
    tools: explicitHostFeature,
    claudeGuide,
    plan,
    taskList: plan || hasAny(text, TASK_LIST_PATTERNS),
    implement,
    review,
    mcp,
    frontend,
    backend,
    decisionHeavy,
    capabilityQuery,
    codeResearch,
    skillSurface,
    skillWorkflowLike,
    workflowContinuation,
    tracks,
    boundedImplementation,
    toolSearchFirst: capabilityQuery,
    wantsWorktree: hasAny(text, WORKTREE_PATTERNS),
    webSearchRetry: currentInfo && hasAny(text, RETRY_PATTERNS),
  };
}
