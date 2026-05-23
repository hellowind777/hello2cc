function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeHookEventName(value) {
  const normalized = normalizeText(value);
  return normalized || 'TaskCompleted';
}

function normalizeStatus(value) {
  return normalizeText(value).toLowerCase();
}

function visibleCharCount(text) {
  return Array.from(String(text || '').replace(/\s+/g, '')).length;
}

function lines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => String(line || '').trim())
    .filter(Boolean);
}

function lineCount(text) {
  return lines(text).length;
}

function hasDescriptionStructure(text) {
  return hasStructuredList(text) || hasLabeledSections(text) || lineCount(text) >= 2 || clauseCount(text) >= 2;
}

function clauseCount(text) {
  return String(text || '')
    .split(/[.!?;:。！？；：,，、\n]+/u)
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .length;
}

function wordCount(text) {
  return normalizeText(text)
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function hasStructuredList(text) {
  return /(^|\n)(\d+\. |- |\* )/.test(String(text || ''));
}

function structuredListItemCount(text) {
  return String(text || '')
    .split(/\r?\n/)
    .filter((line) => /^(\d+\. |- |\* )/.test(String(line || '').trim()))
    .length;
}

function hasLabeledSections(text) {
  return /(^|\n)[\p{L}\p{N}_./# -]{2,24}[：:]\s*\S/gu.test(String(text || ''));
}

function labeledSectionCount(text) {
  const matches = String(text || '').match(/(^|\n)[\p{L}\p{N}_./# -]{2,24}[：:]\s*\S/gu);
  return Array.isArray(matches) ? matches.length : 0;
}

function hasPathOrCommandEvidence(text) {
  return /```[\s\S]*?```|`[^`]+`|[A-Za-z]:\\[^ \n]+|(?:^|[\s(])[./~]?[\w./-]+\.[A-Za-z0-9]+|(?:^|[\s(])(?:npm|pnpm|yarn|bun|node|python|pytest|vitest|jest|cargo|go|gradle|mvn)\b/iu.test(String(text || ''));
}

function subjectHasStructuralSpecificity(text) {
  return /`[^`]+`|[#@][\w.-]+|\b[A-Z][A-Za-z0-9_-]{2,}\b|[A-Za-z]:\\|(?:^|[\s(])[./~]?[\w./-]+\.[A-Za-z0-9]+/u.test(String(text || ''));
}

export function taskSubjectTooVague(taskSubject) {
  const subject = normalizeText(taskSubject);
  const chars = visibleCharCount(subject);
  if (chars < 4) return true;
  if (subjectHasStructuralSpecificity(subject)) return false;

  const spaced = /\s/u.test(subject);
  if (spaced) {
    return wordCount(subject) <= 2 && chars < 18;
  }

  return chars < 6;
}

export function taskDescriptionTooThin(taskDescription, hookEventName) {
  const description = normalizeText(taskDescription);
  if (visibleCharCount(description) >= 28) {
    return false;
  }

  if (!taskRequiresCompletionEvidence(hookEventName)) {
    return !hasDescriptionStructure(taskDescription);
  }

  return true;
}

export function taskDescriptionHasDeliverable(taskDescription) {
  const text = String(taskDescription || '');
  return hasPathOrCommandEvidence(text) || hasDescriptionStructure(text);
}

export function taskDescriptionHasEvidence(taskDescription) {
  const text = String(taskDescription || '');
  return (
    hasPathOrCommandEvidence(text) ||
    structuredListItemCount(text) >= 2 ||
    labeledSectionCount(text) >= 2 ||
    lineCount(text) >= 3 ||
    clauseCount(text) >= 3
  );
}

export function taskRequiresCompletionEvidence(hookEventName) {
  return normalizeHookEventName(hookEventName) !== 'TaskCreated';
}

export function getTaskValidationStage(payload = {}) {
  return taskRequiresCompletionEvidence(payload?.hook_event_name) ? 'completion' : 'creation';
}

export function completionValidationSeverity(payload = {}) {
  const hookEventName = normalizeHookEventName(payload?.hook_event_name);
  if (hookEventName === 'TaskCreated') {
    return 'none';
  }

  if (hookEventName === 'TaskCompleted' || normalizeStatus(payload?.task_status) === 'completed') {
    return 'warn';
  }

  return 'block';
}

export function validateTaskDefinition({
  task_subject: taskSubject,
  task_description: taskDescription,
  hook_event_name: hookEventName,
} = {}) {
  const requiresCompletionEvidence = taskRequiresCompletionEvidence(hookEventName);

  if (!requiresCompletionEvidence) {
    return '';
  }

  if (taskSubjectTooVague(taskSubject)) {
    return 'Task subject is too vague. Rename it to a concrete slice such as “inspect routing for MCP tools” or “verify TeamCreate task flow”.';
  }

  if (taskDescriptionTooThin(taskDescription, hookEventName)) {
    return requiresCompletionEvidence
      ? 'Task description is too short. Include the intended deliverable, scope, and completion evidence.'
      : 'Task description is too short. Include the concrete action and scope.';
  }

  if (!taskDescriptionHasDeliverable(taskDescription)) {
    return 'Task description should name the deliverable or action, not just the topic.';
  }

  if (requiresCompletionEvidence && !taskDescriptionHasEvidence(taskDescription)) {
    return 'Task description should include completion evidence such as tests, validation, exact paths, or another acceptance check.';
  }

  return '';
}

export function taskValidationFeedback(payload = {}) {
  const message = validateTaskDefinition(payload);
  const severity = message ? completionValidationSeverity(payload) : 'none';

  return {
    message,
    severity,
    stage: getTaskValidationStage(payload),
  };
}
