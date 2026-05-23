import { normalizeWorkflowState } from './tool-policy-state.mjs';
import {
  mergedTaskIds,
  normalizeNames,
  normalizeTaskIds,
  readAgentTeamName,
  readAgentWorkerName,
  readSendMessageSummary,
  readSendMessageTarget,
  readStructuredMessageApproval,
  readStructuredMessageType,
  readTaskId,
  readTaskListEntries,
  readTaskListIds,
  readTaskOwner,
  readTaskStatus,
  readTaskSubject,
  readToolSearchMatchCount,
  readToolSearchQuery,
  toolResponse,
  taskSummariesFromList,
  withTaskReadGuard,
  withTaskSummary,
  withoutTaskReadGuard,
  withoutTaskSummary,
} from './session-state-task-readers.mjs';
import {
  resolvedTaskBlockedBy,
  resolvedTaskBlocks,
} from './session-state-team-helpers.mjs';
import { isAgentToolName } from './tool-name-aliases.mjs';

function sendMessageKind(target, currentState = {}, structuredType = '') {
  if (structuredType) {
    return `protocol:${structuredType}`;
  }

  if (target === '*') {
    return 'broadcast';
  }

  if ((Array.isArray(currentState.knownTeammates) ? currentState.knownTeammates : []).includes(target)) {
    return 'teammate';
  }

  return 'peer';
}

/**
 * Mirrors successful tool calls into the per-session workflow continuity state.
 */
export function rememberWorkflowToolSuccess(current = {}, payload = {}) {
  const toolName = String(payload?.tool_name || '').trim();
  if (!toolName) {
    return current.workflowState;
  }

  const currentState = normalizeWorkflowState(current.workflowState);
  const nextState = {
    ...currentState,
    taskReadGuards: { ...currentState.taskReadGuards },
    taskSummaries: { ...currentState.taskSummaries },
    knownTeammates: [...currentState.knownTeammates],
    shutdownRequestedTargets: [...currentState.shutdownRequestedTargets],
    toolSearch: {
      ...currentState.toolSearch,
      zeroResultQueries: { ...currentState.toolSearch.zeroResultQueries },
    },
  };
  let changed = false;

  if (toolName === 'TaskCreate') {
    changed = true;
    const taskId = readTaskId(payload);
    nextState.activeTaskBoard = true;
    nextState.taskBoardSource = 'task_create';
    nextState.lastTaskCreatedId = taskId;
    nextState.lastKnownTaskIds = mergedTaskIds(currentState.lastKnownTaskIds, taskId ? [taskId] : []);
    nextState.taskReadGuards = withTaskReadGuard(nextState.taskReadGuards, taskId, 'task_create');
    nextState.taskSummaries = withTaskSummary(nextState.taskSummaries, taskId, {
      subject: readTaskSubject(payload),
      status: 'pending',
      owner: '',
      blocks: [],
      blockedBy: [],
    });
  }

  if (toolName === 'TaskList') {
    changed = true;
    const entries = readTaskListEntries(payload);
    nextState.activeTaskBoard = true;
    nextState.taskBoardSource = currentState.taskBoardSource || 'task_list';
    nextState.lastKnownTaskIds = entries.length ? normalizeTaskIds(entries.map((task) => task.id)) : readTaskListIds(payload);
    nextState.taskSummaries = entries.length ? taskSummariesFromList(entries) : {};
  }

  if (toolName === 'TaskGet') {
    changed = true;
    const taskId = readTaskId(payload);
    const response = toolResponse(payload);
    const task = response?.task || response?.data?.task || {};
    nextState.activeTaskBoard = true;
    nextState.taskBoardSource = currentState.taskBoardSource || 'task_get';
    nextState.lastTaskReadId = taskId;
    nextState.lastKnownTaskIds = mergedTaskIds(currentState.lastKnownTaskIds, taskId ? [taskId] : []);
    nextState.taskReadGuards = withTaskReadGuard(nextState.taskReadGuards, taskId, 'task_get');
    nextState.taskSummaries = withTaskSummary(nextState.taskSummaries, taskId, {
      subject: String(task?.subject || '').trim(),
      status: String(task?.status || '').trim(),
      owner: String(task?.owner || '').trim(),
      blocks: normalizeTaskIds(task?.blocks),
      blockedBy: normalizeTaskIds(task?.blockedBy),
    });
  }

  if (toolName === 'TaskUpdate') {
    changed = true;
    const taskId = readTaskId(payload);
    const status = readTaskStatus(payload);
    nextState.activeTaskBoard = true;
    nextState.taskBoardSource = currentState.taskBoardSource || 'task_update';
    nextState.lastTaskUpdatedId = taskId;
    nextState.lastTaskUpdatedStatus = status;
    nextState.lastTaskOwner = readTaskOwner(payload);

    if (status === 'deleted') {
      nextState.lastKnownTaskIds = currentState.lastKnownTaskIds.filter((id) => id !== taskId);
      nextState.taskReadGuards = withoutTaskReadGuard(nextState.taskReadGuards, taskId);
      nextState.taskSummaries = withoutTaskSummary(nextState.taskSummaries, taskId);
    } else {
      nextState.lastKnownTaskIds = mergedTaskIds(currentState.lastKnownTaskIds, taskId ? [taskId] : []);
      nextState.taskReadGuards = withTaskReadGuard(nextState.taskReadGuards, taskId, 'task_update');
      nextState.taskSummaries = withTaskSummary(nextState.taskSummaries, taskId, {
        subject: readTaskSubject(payload) || nextState.taskSummaries[taskId]?.subject || '',
        status: status || nextState.taskSummaries[taskId]?.status || '',
        owner: nextState.lastTaskOwner || nextState.taskSummaries[taskId]?.owner || '',
        blocks: resolvedTaskBlocks(payload, current, { workflowState: nextState }, taskId),
        blockedBy: resolvedTaskBlockedBy(payload, current, { workflowState: nextState }, taskId),
      });
      if (nextState.lastTaskOwner) {
        nextState.knownTeammates = normalizeNames([
          nextState.lastTaskOwner,
          ...nextState.knownTeammates,
        ]);
      }
    }
  }

  if (toolName === 'TeamCreate') {
    changed = true;
    nextState.activeTaskBoard = false;
    nextState.taskBoardSource = '';
    nextState.lastKnownTaskIds = [];
    nextState.taskReadGuards = {};
    nextState.taskSummaries = {};
    nextState.lastTaskCreatedId = '';
    nextState.lastTaskReadId = '';
    nextState.lastTaskUpdatedId = '';
    nextState.lastTaskUpdatedStatus = '';
    nextState.lastTaskOwner = '';
    nextState.knownTeammates = [];
    nextState.shutdownRequestedTargets = [];
    nextState.shutdownBroadcastRequested = false;
    nextState.lastMessageTarget = '';
    nextState.lastMessageKind = '';
    nextState.lastMessageSummary = '';
    nextState.planModeEntered = false;
    nextState.planModeExited = false;
    nextState.awaitingPlanApproval = false;
    nextState.lastPlanApprovalTarget = '';
  }

  if (toolName === 'TeamDelete') {
    changed = true;
    nextState.activeTaskBoard = false;
    nextState.taskBoardSource = '';
    nextState.lastKnownTaskIds = [];
    nextState.taskReadGuards = {};
    nextState.taskSummaries = {};
    nextState.lastTaskCreatedId = '';
    nextState.lastTaskReadId = '';
    nextState.lastTaskUpdatedId = '';
    nextState.lastTaskUpdatedStatus = '';
    nextState.lastTaskOwner = '';
    nextState.knownTeammates = [];
    nextState.shutdownRequestedTargets = [];
    nextState.shutdownBroadcastRequested = false;
    nextState.lastMessageTarget = '';
    nextState.lastMessageKind = '';
    nextState.lastMessageSummary = '';
    nextState.awaitingPlanApproval = false;
    nextState.lastPlanApprovalTarget = '';
  }

  if (isAgentToolName(toolName)) {
    const teammateName = readAgentWorkerName(payload);
    const teamName = readAgentTeamName(payload);
    if (teammateName && teamName) {
      changed = true;
      nextState.knownTeammates = normalizeNames([
        teammateName,
        ...nextState.knownTeammates,
      ]);
    }
  }

  if (toolName === 'SendMessage') {
    changed = true;
    const target = readSendMessageTarget(payload);
    const structuredType = readStructuredMessageType(payload);
    const approval = readStructuredMessageApproval(payload);
    nextState.lastMessageTarget = target;
    nextState.lastMessageKind = sendMessageKind(target, nextState, structuredType);
    nextState.lastMessageSummary = readSendMessageSummary(payload);

    if (structuredType === 'shutdown_request') {
      if (target === '*') {
        nextState.shutdownBroadcastRequested = true;
        nextState.shutdownRequestedTargets = normalizeNames([
          ...nextState.shutdownRequestedTargets,
          ...nextState.knownTeammates,
        ]);
      } else if (target) {
        nextState.shutdownRequestedTargets = normalizeNames([
          target,
          ...nextState.shutdownRequestedTargets,
        ]);
      }
    }

    if (structuredType === 'plan_approval_request') {
      nextState.awaitingPlanApproval = true;
      nextState.lastPlanApprovalTarget = target;
    }

    if (structuredType === 'plan_approval_response') {
      nextState.awaitingPlanApproval = false;
      nextState.lastPlanApprovalTarget = '';
    }

    if (structuredType === 'shutdown_response' && approval === true) {
      nextState.awaitingPlanApproval = false;
    }
  }

  if (toolName === 'EnterPlanMode') {
    changed = true;
    nextState.planModeEntered = true;
    nextState.planModeExited = false;
    nextState.awaitingPlanApproval = false;
    nextState.lastPlanApprovalTarget = '';
  }

  if (toolName === 'ExitPlanMode') {
    changed = true;
    nextState.planModeEntered = false;
    nextState.planModeExited = true;
    nextState.awaitingPlanApproval = false;
  }

  if (toolName === 'AskUserQuestion') {
    changed = true;
    nextState.askUserQuestionUsed = true;
  }

  if (toolName === 'ToolSearch') {
    changed = true;
    const query = readToolSearchQuery(payload);
    const matchCount = readToolSearchMatchCount(payload);
    const key = query.toLowerCase();

    nextState.toolSearch.lastQuery = query;
    nextState.toolSearch.lastMatchCount = matchCount;

    if (query) {
      if (matchCount > 0) {
        delete nextState.toolSearch.zeroResultQueries[key];
      } else {
        nextState.toolSearch.zeroResultQueries[key] = {
          query,
          recordedAt: new Date().toISOString(),
        };
      }
    }
  }

  return changed ? normalizeWorkflowState(nextState) : current.workflowState;
}
