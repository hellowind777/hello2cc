function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function appendTrack(tracks, value) {
  if (!tracks.includes(value)) {
    tracks.push(value);
  }
}

export function hasQuestionIntent(text) {
  return hasAny(text, [
    /\?/,
    /^(can|does|do|how|why|what|which|when|where)\b/,
    /\b(can|does|do|how|why|what|which|when|where)\b/,
    /能不能/,
    /如何/,
    /怎么/,
    /为什么/,
    /是什么/,
    /是否/,
    /区别/,
    /边界/,
    /支持哪些/,
  ]);
}

/**
 * Builds the minimal track list needed for native worker routing.
 */
export function buildTracks({ frontend, backend, research, implement, review, verify }) {
  const tracks = [];

  if (frontend) appendTrack(tracks, 'frontend');
  if (backend) appendTrack(tracks, 'backend');
  if (research && (implement || review || verify) && !tracks.includes('research')) {
    tracks.unshift('research');
  }
  if (implement && (research || verify || review)) {
    appendTrack(tracks, 'implementation');
  }
  if (review && !verify) {
    appendTrack(tracks, 'review');
  }
  if (verify) {
    appendTrack(tracks, 'verification');
  }

  return tracks;
}

/**
 * Computes team-oriented routing signals while keeping the classifier itself small.
 */
export function deriveTeamSignals({
  text,
  frontend,
  backend,
  research,
  implement,
  verify,
  planningIntent,
  explicitTeamWorkflow,
  coordinationPatterns,
}) {
  const coordinationHeavy = hasAny(text, coordinationPatterns);
  const fullStackProject = frontend && backend && (implement || research || verify);
  const multiPhaseProject = research && implement && planningIntent;
  const refactorProject = verify && hasAny(text, [
    /refactor/,
    /rewrite/,
    /migrate/,
    /重构/,
    /重写/,
    /迁移/,
  ]);
  const proactiveTeamWorkflow =
    !explicitTeamWorkflow &&
    coordinationHeavy &&
    (fullStackProject || multiPhaseProject || refactorProject || implement || research || verify);

  return {
    coordinationHeavy,
    proactiveTeamWorkflow,
    teamSemantics: explicitTeamWorkflow || proactiveTeamWorkflow,
  };
}
