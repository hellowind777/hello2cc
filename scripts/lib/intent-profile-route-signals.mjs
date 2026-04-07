import { resolveWebSearchGuidanceState } from './api-topology.mjs';
import { promptMentionsAny } from './intent-slots.mjs';
import {
  hasCapabilityDiscoverySurface,
  hasObservedWebSearchBoundary,
  isThinNeutralPrompt,
} from './intent-profile-shared.mjs';

/**
 * Derives current-info signals from visible WebSearch boundaries instead of free-form wording.
 */
export function deriveCurrentInfoSignals(seed, sessionContext = {}, artifactSignals = {}, workflowSignals = {}) {
  const webSearchGuidance = resolveWebSearchGuidanceState(sessionContext, {
    retryRequested: seed.structure.has('retry'),
  });
  const explicitWebSearchSurface = promptMentionsAny(seed.slots.text, ['WebSearch']);
  const nonLexiconExternalCompare = Boolean(
    !seed.actions.has('current_info') &&
    !seed.lexiconGuided &&
    seed.compare &&
    sessionContext?.webSearchAvailable &&
    !seed.promptEnvelope.structuredArtifact &&
    !seed.promptEnvelope.repoArtifactHeavy &&
    !seed.promptEnvelope.knownSurfaceMentioned &&
    !artifactSignals.research &&
    !workflowSignals.implement &&
    !seed.verify &&
    !artifactSignals.review &&
    !seed.planRequest &&
    !seed.topics.has('tools') &&
    !seed.topics.has('skills') &&
    !seed.topics.has('mcp') &&
    !seed.guideTopic &&
    !seed.frontend &&
    !seed.backend &&
    !seed.collaboration.size &&
    (
      Number(seed.promptEnvelope?.clauseCount || 0) >= 2 ||
      Number(seed.promptEnvelope?.charCount || 0) >= 24
    )
  );
  const hostBoundaryCurrentInfo = Boolean(
    !seed.actions.has('current_info') &&
    sessionContext?.webSearchAvailable &&
    !seed.promptEnvelope.structuredArtifact &&
    (!seed.promptEnvelope.knownSurfaceMentioned || explicitWebSearchSurface) &&
    !artifactSignals.research &&
    !workflowSignals.implement &&
    !seed.verify &&
    !artifactSignals.review &&
    (!seed.compare || nonLexiconExternalCompare) &&
    !seed.planRequest &&
    !seed.topics.has('tools') &&
    !seed.topics.has('skills') &&
    !seed.topics.has('mcp') &&
    !seed.collaboration.size &&
    (
      explicitWebSearchSurface ||
      hasObservedWebSearchBoundary(sessionContext) ||
      ['proxy-cooldown', 'proxy-probe'].includes(webSearchGuidance.mode) ||
      nonLexiconExternalCompare
    ) &&
    (
      seed.promptEnvelope.questionLike ||
      isThinNeutralPrompt(seed.promptEnvelope) ||
      nonLexiconExternalCompare
    ),
  );

  return {
    hostBoundaryCurrentInfo,
    currentInfo: seed.actions.has('current_info') || hostBoundaryCurrentInfo,
  };
}

/**
 * Derives explanation signals after artifact and host-boundary routing has been resolved.
 */
export function deriveExplainSignals(seed, artifactSignals = {}, workflowSignals = {}, currentInfoSignals = {}) {
  const explainFromPromptArtifacts = Boolean(
    !seed.actions.has('explain') &&
    !artifactSignals.review &&
    seed.questionIntent &&
    seed.promptEnvelope.targetedArtifactQuestion &&
    !seed.compare &&
    !currentInfoSignals.currentInfo &&
    !seed.planRequest &&
    !workflowSignals.release &&
    !seed.mcp &&
    !seed.skillSurface &&
    !seed.explicitHostFeature &&
    !seed.guideTopic &&
    !seed.collaboration.size,
  );
  const explainFromGuideTopic = Boolean(
    !seed.actions.has('explain') &&
    seed.guideTopic &&
    seed.questionIntent &&
    !seed.compare &&
    !currentInfoSignals.currentInfo &&
    !seed.planRequest &&
    !workflowSignals.release &&
    !seed.verify &&
    !artifactSignals.review &&
    !artifactSignals.research &&
    !seed.collaboration.size,
  );

  return {
    explainFromPromptArtifacts,
    explainFromGuideTopic,
    explain: seed.actions.has('explain') || explainFromPromptArtifacts || explainFromGuideTopic,
  };
}

/**
 * Derives planning-heavy signals that shape plan-mode and design responses.
 */
export function derivePlanningSignals(
  seed,
  artifactSignals = {},
  workflowSignals = {},
  currentInfoSignals = {},
) {
  const planningProbeShape = Boolean(
    !seed.actions.has('plan') &&
    !seed.compare &&
    !currentInfoSignals.currentInfo &&
    !artifactSignals.review &&
    !workflowSignals.release &&
    !seed.verify &&
    !seed.mcp &&
    !seed.skillSurface &&
    !seed.explicitHostFeature &&
    !seed.guideTopic &&
    !seed.collaboration.size &&
    !workflowSignals.workflowContinuation &&
    !seed.promptEnvelope.structuredArtifact &&
    !seed.promptEnvelope.targetedArtifactQuestion &&
    !seed.promptEnvelope.broadArtifactQuestion &&
    seed.questionIntent &&
    !artifactSignals.research &&
    !workflowSignals.implement &&
    (seed.promptEnvelope.listLike || Number(seed.promptEnvelope?.lineCount || 0) >= 2 || Number(seed.promptEnvelope?.clauseCount || 0) >= 3),
  );
  const architectureHeavy = seed.structure.has('architecture');
  const plan = seed.planRequest || planningProbeShape || (
    architectureHeavy &&
    !seed.questionIntent &&
    !seed.compare &&
    (artifactSignals.research || workflowSignals.implement || seed.verify || artifactSignals.review || seed.structure.has('scope_heavy'))
  );

  return {
    planningProbeShape,
    decisionHeavy: seed.questionIntent && (seed.compare || seed.structure.has('decision') || architectureHeavy),
    plan,
    complex:
      seed.structure.has('scope_heavy') ||
      architectureHeavy ||
      seed.promptEnvelope.structuralComplexity ||
      (seed.frontend && seed.backend && (artifactSignals.research || workflowSignals.implement || seed.verify || artifactSignals.review)),
    claudeGuide: seed.guideTopic && (seed.questionIntent || artifactSignals.research || seed.compare || seed.planRequest),
  };
}

/**
 * Derives capability-discovery signals from question shape and visible host surfaces.
 */
export function deriveCapabilitySignals(seed, sessionContext = {}, signals = {}) {
  return {
    capabilityProbeShape: Boolean(
      seed.questionIntent &&
      !seed.promptEnvelope.structuredArtifact &&
      !seed.promptEnvelope.repoArtifactHeavy &&
      !seed.promptEnvelope.targetedArtifactQuestion &&
      !seed.promptEnvelope.broadArtifactQuestion &&
      !seed.compare &&
      !signals.currentInfo &&
      !signals.plan &&
      !signals.review &&
      !signals.research &&
      !signals.explain &&
      !signals.implement &&
      !signals.release &&
      !seed.verify &&
      !seed.mcp &&
      !seed.skillSurface &&
      !seed.explicitHostFeature &&
      !seed.guideTopic &&
      !seed.collaboration.size &&
      !seed.frontend &&
      !seed.backend &&
      !signals.workflowContinuation &&
      hasCapabilityDiscoverySurface(sessionContext)
    ),
    capabilityQuery: Boolean(
      seed.questionIntent &&
      !signals.explain &&
      (seed.explicitHostFeature || seed.mcp || seed.skillSurface || seed.collaboration.has('worktree'))
    ),
  };
}
