import { structuredApproveFieldValue } from './send-message-helpers.mjs';
import { sessionContextFromPayload } from './session-state-context.mjs';
import { realTeamNameOrEmpty } from './team-name.mjs';
import { taskIdFromInput } from './tool-policy-state.mjs';
import {
  collapseWhitespace,
  readToolTeamName,
  trimmed,
  truncateText,
} from './session-state-basic-helpers.mjs';
import {
  normalizeNames,
  normalizeTaskIds,
} from './session-state-task-storage.mjs';

export function openSharedTaskStatus(status) {
  const normalized = trimmed(status).toLowerCase();
  return Boolean(normalized) && !['completed', 'deleted'].includes(normalized);
}

export function isTeamLeadTarget(value) {
  return trimmed(value).toLowerCase() === 'team-lead';
}

export function toolResponse(payload = {}) {
  return payload?.tool_response || payload?.tool_result || payload?.result || {};
}

export function readTaskId(payload = {}) {
  const response = toolResponse(payload);
  const responseTask = response?.task && typeof response.task === 'object'
    ? response.task
    : {};

  return [
    taskIdFromInput(payload?.tool_input || {}),
    response?.taskId,
    responseTask?.id,
    response?.data?.taskId,
    response?.data?.task?.id,
  ]
    .map((value) => String(value || '').trim())
    .find(Boolean) || '';
}

export function readTaskStatus(payload = {}) {
  const response = toolResponse(payload);
  return [
    payload?.tool_input?.status,
    response?.statusChange?.to,
    response?.data?.statusChange?.to,
  ]
    .map((value) => String(value || '').trim())
    .find(Boolean) || '';
}

export function readTaskSubject(payload = {}) {
  const response = toolResponse(payload);
  return [
    payload?.tool_input?.subject,
    response?.task?.subject,
    response?.data?.task?.subject,
  ]
    .map((value) => String(value || '').trim())
    .find(Boolean) || '';
}

export function readTaskDescription(payload = {}) {
  const response = toolResponse(payload);
  return [
    payload?.tool_input?.description,
    response?.task?.description,
    response?.data?.task?.description,
  ]
    .map((value) => String(value || '').trim())
    .find(Boolean) || '';
}

export function readTaskOwner(payload = {}) {
  const response = toolResponse(payload);
  return [
    payload?.tool_input?.owner,
    response?.task?.owner,
    response?.data?.task?.owner,
  ]
    .map((value) => String(value || '').trim())
    .find(Boolean) || '';
}

export function readTaskListIds(payload = {}) {
  const response = toolResponse(payload);
  const tasks = Array.isArray(response?.tasks)
    ? response.tasks
    : Array.isArray(response?.data?.tasks)
      ? response.data.tasks
      : [];

  return normalizeTaskIds(tasks.map((task) => task?.id));
}

export function readTaskListEntries(payload = {}) {
  const response = toolResponse(payload);
  const tasks = Array.isArray(response?.tasks)
    ? response.tasks
    : Array.isArray(response?.data?.tasks)
      ? response.data.tasks
      : [];

  return tasks
    .map((task) => ({
      id: String(task?.id || '').trim(),
      subject: String(task?.subject || '').trim(),
      status: String(task?.status || '').trim(),
      owner: String(task?.owner || '').trim(),
      blocks: normalizeTaskIds(task?.blocks),
      blockedBy: normalizeTaskIds(task?.blockedBy),
    }))
    .filter((task) => task.id);
}

export function readTaskBlocks(payload = {}) {
  const response = toolResponse(payload);
  return normalizeTaskIds(
    response?.task?.blocks
    || response?.data?.task?.blocks
    || payload?.tool_input?.addBlocks,
  );
}

export function readTaskBlockedBy(payload = {}) {
  const response = toolResponse(payload);
  return normalizeTaskIds(
    response?.task?.blockedBy
    || response?.data?.task?.blockedBy
    || payload?.tool_input?.addBlockedBy,
  );
}

export function readToolSearchQuery(payload = {}) {
  const response = toolResponse(payload);
  return [
    payload?.tool_input?.query,
    response?.query,
    response?.data?.query,
  ]
    .map((value) => String(value || '').trim())
    .find(Boolean) || '';
}

export function readToolSearchMatchCount(payload = {}) {
  const response = toolResponse(payload);
  const matches = Array.isArray(response?.matches)
    ? response.matches
    : Array.isArray(response?.data?.matches)
      ? response.data.matches
      : [];

  return matches.length;
}

export function readAgentWorkerName(payload = {}) {
  return String(payload?.tool_input?.name || '').trim();
}

export function readAgentTeamName(payload = {}) {
  return realTeamNameOrEmpty(readToolTeamName(payload) || String(payload?.tool_input?.team_name || '').trim());
}

export function readSendMessageTarget(payload = {}) {
  return String(payload?.tool_input?.to || '').trim();
}

export function readStructuredMessageType(payload = {}) {
  const message = payload?.tool_input?.message;
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return '';
  }

  return String(message?.type || '').trim();
}

export function readStructuredMessageApproval(payload = {}) {
  const message = payload?.tool_input?.message;
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return null;
  }

  return structuredApproveFieldValue(message);
}

export function readStructuredMessageRequestId(payload = {}) {
  const message = payload?.tool_input?.message;
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return '';
  }

  return String(message.requestId || message.request_id || '').trim();
}

export function readStructuredMessagePlanFilePath(payload = {}) {
  const message = payload?.tool_input?.message;
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return '';
  }

  return String(message.planFilePath || message.plan_file_path || '').trim();
}

export function readSendMessageSummary(payload = {}) {
  const explicitSummary = trimmed(payload?.tool_input?.summary);
  if (explicitSummary) {
    return explicitSummary;
  }

  const message = payload?.tool_input?.message;
  if (typeof message === 'string') {
    return truncateText(collapseWhitespace(message), 96);
  }

  return '';
}

export function payloadTeamSnapshot(payload = {}) {
  return sessionContextFromPayload(payload);
}

export function resolvedTeamName(payload = {}, previous = {}, next = {}) {
  const snapshot = payloadTeamSnapshot(payload);
  return realTeamNameOrEmpty(readToolTeamName(payload))
    || realTeamNameOrEmpty(snapshot.teamName)
    || realTeamNameOrEmpty(previous?.teamName)
    || realTeamNameOrEmpty(next?.teamName);
}

export function resolvedAgentName(payload = {}, previous = {}, next = {}) {
  const snapshot = payloadTeamSnapshot(payload);
  return trimmed(snapshot.agentName)
    || readAgentWorkerName(payload)
    || trimmed(previous?.agentName)
    || trimmed(next?.agentName);
}

export function sessionActorName(payload = {}, previous = {}, next = {}) {
  const snapshot = payloadTeamSnapshot(payload);
  return trimmed(snapshot.agentName)
    || trimmed(previous?.agentName)
    || trimmed(next?.agentName);
}

export function shouldTrackSharedTeam(teamName) {
  return Boolean(realTeamNameOrEmpty(teamName));
}

export function isReservedSharedOwner(name) {
  const normalized = trimmed(name).toLowerCase();
  return !normalized || ['team-lead', 'main', 'default'].includes(normalized);
}

export {
  normalizeNames,
  normalizeTaskIds,
};
