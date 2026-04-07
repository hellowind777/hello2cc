import { normalizeIntentText, promptMentionsAny } from './intent-slots.mjs';

function trimmed(value) {
  return String(value || '').trim();
}

function uniqueStrings(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => trimmed(value))
      .filter(Boolean),
  )];
}

function visibleCharCount(value) {
  return Array.from(String(value || '').replace(/\s+/g, '')).length;
}

function lineCount(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => trimmed(line))
    .filter(Boolean)
    .length;
}

function clauseCount(value) {
  const clauses = String(value || '')
    .split(/[.!?;:。！？；：,，、\n]+/u)
    .map((item) => trimmed(item))
    .filter(Boolean);

  return clauses.length;
}

function listLike(value) {
  return /(^|\n)(\d+\. |- |\* )/u.test(String(value || ''));
}

function windowsOrUnixPathPattern() {
  return /(?:[A-Za-z]:[\\/]|(?:^|[\s(`])[./~]?[\w./-]+\.[A-Za-z0-9]+(?::\d+(?::\d+)?)?)/u;
}

function structuredArtifact(value) {
  const pattern = [
    '`[^`]+`',
    windowsOrUnixPathPattern().source,
    '[#@][\\w.-]+',
    '\\b\\d+(?:\\.\\d+){1,}\\b',
  ].join('|');
  return new RegExp(pattern, 'u').test(String(value || ''));
}

function questionLike(value) {
  return /[?？]/u.test(String(value || ''));
}

function pathArtifactCount(value) {
  const matches = String(value || '').match(new RegExp(windowsOrUnixPathPattern().source, 'ug'));
  return Array.isArray(matches) ? matches.length : 0;
}

function lineReferenceLike(value) {
  return /:\d+(?::\d+)?\b|#L\d+(?:C\d+)?\b/u.test(String(value || ''));
}

function codeFenceLike(value) {
  return /```[\s\S]*?```/u.test(String(value || ''));
}

function diffLike(value) {
  return /(^|\n)(diff --git|@@ |--- [^\n]+|\+\+\+ [^\n]+)/u.test(String(value || ''));
}

function optionPairLike(value) {
  return /(?<![:\\])[\p{L}\p{N}][\p{L}\p{N}#+._-]{1,40}\/[\p{L}\p{N}][\p{L}\p{N}#+._-]{1,40}(?![\\/])/u.test(String(value || ''));
}

function surfacedNames(sessionContext = {}) {
  return uniqueStrings([
    ...(Array.isArray(sessionContext?.loadedCommandNames) ? sessionContext.loadedCommandNames : []),
    ...(Array.isArray(sessionContext?.workflowNames) ? sessionContext.workflowNames : []),
    ...(Array.isArray(sessionContext?.surfacedSkillNames) ? sessionContext.surfacedSkillNames : []),
    ...(Array.isArray(sessionContext?.availableDeferredToolNames) ? sessionContext.availableDeferredToolNames : []),
    ...(Array.isArray(sessionContext?.loadedDeferredToolNames) ? sessionContext.loadedDeferredToolNames : []),
  ]);
}

export function analyzePromptEnvelope(prompt, sessionContext = {}) {
  const rawText = String(prompt || '');
  const normalizedText = normalizeIntentText(rawText);
  const chars = visibleCharCount(rawText);
  const lines = lineCount(rawText);
  const clauses = clauseCount(rawText);
  const hasStructuredArtifact = structuredArtifact(rawText);
  const knownSurfaceMentioned = promptMentionsAny(normalizedText, surfacedNames(sessionContext));
  const hasQuestionMark = questionLike(rawText);
  const hasListShape = listLike(rawText);
  const pathArtifacts = pathArtifactCount(rawText);
  const lineReference = lineReferenceLike(rawText);
  const codeFence = codeFenceLike(rawText);
  const diffArtifact = diffLike(rawText);
  const optionPair = optionPairLike(rawText);
  const reviewArtifact = Boolean(
    diffArtifact ||
    (codeFence && (lineReference || pathArtifacts > 0)),
  );
  const broadArtifactQuestion = Boolean(
    hasQuestionMark &&
    !reviewArtifact &&
    !lineReference &&
    !diffArtifact &&
    (
      pathArtifacts >= 2 ||
      (hasStructuredArtifact && (hasListShape || lines >= 2 || clauses >= 3))
    ),
  );
  const targetedArtifactQuestion = Boolean(
    hasQuestionMark &&
    !reviewArtifact &&
    (
      lineReference ||
      diffArtifact ||
      ((hasStructuredArtifact || pathArtifacts > 0) && !broadArtifactQuestion)
    ),
  );
  const repoArtifactHeavy = Boolean(
    hasStructuredArtifact &&
    (pathArtifacts >= 2 || lineReference || diffArtifact),
  );
  const structuralComplexity = Boolean(
    chars >= 48
    || lines >= 2
    || clauses >= 3
    || hasStructuredArtifact
    || hasListShape
  );

  return {
    charCount: chars,
    lineCount: lines,
    clauseCount: clauses,
    questionLike: hasQuestionMark,
    listLike: hasListShape,
    structuredArtifact: hasStructuredArtifact,
    knownSurfaceMentioned,
    structuralComplexity,
    pathArtifactCount: pathArtifacts,
    targetedArtifactQuestion,
    broadArtifactQuestion,
    reviewArtifact,
    repoArtifactHeavy,
    optionPairLike: optionPair,
  };
}

export function summarizePromptEnvelope(envelope = {}) {
  return {
    question_like: envelope?.questionLike || undefined,
    structured_artifact: envelope?.structuredArtifact || undefined,
    known_surface_mention: envelope?.knownSurfaceMentioned || undefined,
    structural_complexity: envelope?.structuralComplexity || undefined,
    path_artifact_count: Number(envelope?.pathArtifactCount) || undefined,
    multi_line: envelope?.lineCount > 1 || undefined,
    multi_clause: envelope?.clauseCount > 1 || undefined,
    list_like: envelope?.listLike || undefined,
    targeted_artifact_question: envelope?.targetedArtifactQuestion || undefined,
    broad_artifact_question: envelope?.broadArtifactQuestion || undefined,
    review_artifact: envelope?.reviewArtifact || undefined,
    repo_artifact_heavy: envelope?.repoArtifactHeavy || undefined,
    option_pair_like: envelope?.optionPairLike || undefined,
  };
}
