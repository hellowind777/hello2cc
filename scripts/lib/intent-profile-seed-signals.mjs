import { analyzePromptEnvelope } from './prompt-envelope.mjs';
import { extractIntentSlots } from './intent-slots.mjs';
import {
  hasApprovedPlanExecutionBoundary,
  hasLoadedSurfaceNamed,
  hasSoloTrackedExecutionBoundary,
  isThinNeutralPrompt,
  knownSurfaceMentioned,
} from './intent-profile-shared.mjs';

/**
 * Builds the normalized seed shared by the intent derivation stages.
 */
export function buildIntentProfileSeed(prompt, sessionContext = {}) {
  const slots = extractIntentSlots(prompt);
  const promptEnvelope = analyzePromptEnvelope(prompt, sessionContext);
  const actions = new Set(slots.actions);
  const topics = new Set(slots.topics);
  const collaboration = new Set(slots.collaboration);
  const structure = new Set(slots.structure);
  const lexicalStructure = slots.structure.filter((concept) => concept !== 'capability_query');
  const guideTopic =
    !promptEnvelope.repoArtifactHeavy &&
    (
      topics.has('claude_code') ||
      topics.has('hooks') ||
      topics.has('api_sdk') ||
      topics.has('settings')
    );

  return {
    slots,
    promptEnvelope,
    actions,
    topics,
    collaboration,
    structure,
    lexiconGuided: Boolean(
      slots.actions.length ||
      slots.topics.length ||
      slots.collaboration.length ||
      lexicalStructure.length,
    ),
    questionIntent: slots.questionIntent || promptEnvelope.questionLike,
    planRequest: actions.has('plan'),
    compare: actions.has('compare') || (
      promptEnvelope.optionPairLike &&
      !promptEnvelope.structuredArtifact &&
      !promptEnvelope.repoArtifactHeavy &&
      Number(promptEnvelope.pathArtifactCount || 0) === 0
    ),
    verify: actions.has('verify'),
    mcp: topics.has('mcp'),
    skillSurface: topics.has('skills'),
    explicitHostFeature: topics.has('tools'),
    guideTopic,
    frontend: topics.has('frontend'),
    backend: topics.has('backend'),
    collaborationMentioned: collaboration.has('team') || collaboration.has('task_board'),
    coordinationHeavy: collaboration.has('task_board') || collaboration.has('owner_handoff'),
    handoff: collaboration.has('owner_handoff'),
    activeTeam: String(sessionContext?.teamName || '').trim(),
    parallelRequested: collaboration.has('parallel'),
  };
}

/**
 * Derives artifact-shaped action signals before workflow or capability routing.
 */
export function deriveArtifactSignals(seed) {
  const reviewFromPromptArtifacts = Boolean(
    !seed.actions.has('review') &&
    seed.questionIntent &&
    seed.promptEnvelope.reviewArtifact &&
    !seed.planRequest &&
    !seed.compare &&
    !seed.mcp &&
    !seed.skillSurface &&
    !seed.explicitHostFeature &&
    !seed.guideTopic &&
    !seed.collaboration.size,
  );
  const researchFromPromptArtifacts = Boolean(
    !seed.actions.has('research') &&
    seed.promptEnvelope.broadArtifactQuestion &&
    !seed.compare &&
    !seed.planRequest &&
    !reviewFromPromptArtifacts &&
    !seed.mcp &&
    !seed.skillSurface &&
    !seed.explicitHostFeature &&
    !seed.guideTopic &&
    !seed.collaboration.size,
  );

  return {
    reviewFromPromptArtifacts,
    review: seed.actions.has('review') || reviewFromPromptArtifacts,
    researchFromPromptArtifacts,
    research: seed.actions.has('research') || researchFromPromptArtifacts,
  };
}

function buildReleaseContinuationSignals(seed, sessionContext) {
  const releaseSurfaceVisible = hasLoadedSurfaceNamed(sessionContext, 'release');
  const hostBoundaryRelease = Boolean(
    !seed.actions.has('release') &&
    releaseSurfaceVisible &&
    !seed.promptEnvelope.structuredArtifact &&
    !seed.promptEnvelope.questionLike &&
    !seed.topics.has('tools') &&
    !seed.topics.has('mcp') &&
    !seed.collaboration.size &&
    (seed.promptEnvelope.knownSurfaceMentioned || isThinNeutralPrompt(seed.promptEnvelope)),
  );

  return {
    hostBoundaryRelease,
    workflowContinuation:
      seed.structure.has('continuation') ||
      seed.promptEnvelope.knownSurfaceMentioned ||
      knownSurfaceMentioned(seed.slots.text, sessionContext) ||
      hostBoundaryRelease,
  };
}

function buildImplementationSignals(seed, sessionContext, artifactSignals, releaseSignals) {
  const continuityDrivenImplement = Boolean(
    !seed.actions.has('implement') &&
    !seed.actions.has('release') &&
    !seed.questionIntent &&
    !seed.compare &&
    !seed.planRequest &&
    !artifactSignals.review &&
    !releaseSignals.hostBoundaryRelease &&
    !seed.mcp &&
    !seed.skillSurface &&
    !seed.explicitHostFeature &&
    !seed.guideTopic &&
    !seed.collaboration.size &&
    (hasApprovedPlanExecutionBoundary(sessionContext) || hasSoloTrackedExecutionBoundary(sessionContext)) &&
    (releaseSignals.workflowContinuation || isThinNeutralPrompt(seed.promptEnvelope)),
  );
  const boundedArtifactExecution = Boolean(
    !seed.actions.has('implement') &&
    !seed.actions.has('release') &&
    !seed.questionIntent &&
    !seed.compare &&
    !seed.planRequest &&
    !artifactSignals.review &&
    !artifactSignals.research &&
    !releaseSignals.hostBoundaryRelease &&
    !seed.mcp &&
    !seed.skillSurface &&
    !seed.explicitHostFeature &&
    !seed.guideTopic &&
    !seed.collaboration.size &&
    (
      seed.promptEnvelope.repoArtifactHeavy ||
      (
        seed.promptEnvelope.structuredArtifact &&
        (Number(seed.promptEnvelope?.pathArtifactCount || 0) > 0 || seed.promptEnvelope.structuralComplexity)
      )
    ),
  );

  return {
    boundedArtifactExecution,
    implement: seed.actions.has('implement') || continuityDrivenImplement || boundedArtifactExecution,
  };
}

/**
 * Derives workflow-continuity signals that control release and implementation routing.
 */
export function deriveWorkflowSignals(seed, sessionContext = {}, artifactSignals = {}) {
  const releaseSignals = buildReleaseContinuationSignals(seed, sessionContext);
  const implementationSignals = buildImplementationSignals(
    seed,
    sessionContext,
    artifactSignals,
    releaseSignals,
  );

  return {
    ...releaseSignals,
    ...implementationSignals,
    release: seed.actions.has('release') || releaseSignals.hostBoundaryRelease,
  };
}
