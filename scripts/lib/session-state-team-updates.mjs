import { clearTeamEntry, mutateTeamEntry } from './team-state-store.mjs';
import {
  normalizeNames,
  resolvedTeamName,
  sessionActorName,
  shouldTrackSharedTeam,
  isReservedSharedOwner,
} from './session-state-task-readers.mjs';
import {
  prunePendingTaskAssignments,
  prunePendingTerminationNotifications,
  withoutIdleNotification,
} from './session-state-team-helpers.mjs';
import {
  handleAgentTeamUpdate,
  handleSendMessageTeamUpdate,
  handleTaskGetTeamUpdate,
  handleTaskListTeamUpdate,
  handleTaskUpdateTeamUpdate,
} from './session-state-team-tool-updates.mjs';
import { isAgentToolName } from './tool-name-aliases.mjs';

/**
 * Mirrors successful team-scoped tool calls into the shared team state store.
 */
export function rememberSharedTeamToolSuccess({ toolName = '', payload = {}, previous = {}, next = {} } = {}) {
  const teamName = resolvedTeamName(payload, previous, next);
  if (!shouldTrackSharedTeam(teamName)) {
    return {};
  }

  if (toolName === 'TeamDelete') {
    clearTeamEntry(teamName);
    return {};
  }

  return mutateTeamEntry(teamName, (currentTeam = {}) => {
    const now = new Date().toISOString();
    const knownTeammates = normalizeNames(currentTeam.knownTeammates || []);
    const shutdownRequestedTargets = normalizeNames(currentTeam.shutdownRequestedTargets || []);
    const shutdownApprovedTargets = normalizeNames(currentTeam.shutdownApprovedTargets || []);
    let taskAssignments = currentTeam.taskAssignments && typeof currentTeam.taskAssignments === 'object'
      ? { ...currentTeam.taskAssignments }
      : {};
    let pendingPlanApprovals = currentTeam.pendingPlanApprovals && typeof currentTeam.pendingPlanApprovals === 'object'
      ? { ...currentTeam.pendingPlanApprovals }
      : {};
    let pendingIdleNotifications = currentTeam.pendingIdleNotifications && typeof currentTeam.pendingIdleNotifications === 'object'
      ? { ...currentTeam.pendingIdleNotifications }
      : {};
    let pendingTaskAssignments = currentTeam.pendingTaskAssignments && typeof currentTeam.pendingTaskAssignments === 'object'
      ? { ...currentTeam.pendingTaskAssignments }
      : {};
    let pendingTerminationNotifications = currentTeam.pendingTerminationNotifications && typeof currentTeam.pendingTerminationNotifications === 'object'
      ? { ...currentTeam.pendingTerminationNotifications }
      : {};
    let shutdownRejectedTargets = currentTeam.shutdownRejectedTargets && typeof currentTeam.shutdownRejectedTargets === 'object'
      ? { ...currentTeam.shutdownRejectedTargets }
      : {};
    const actorName = sessionActorName(payload, previous, next);

    if (!isReservedSharedOwner(actorName)) {
      pendingIdleNotifications = withoutIdleNotification(pendingIdleNotifications, actorName);
    }

    const mutableState = {
      teamName,
      currentTeam,
      now,
      knownTeammates,
      shutdownRequestedTargets,
      shutdownApprovedTargets,
      taskAssignments,
      pendingPlanApprovals,
      pendingIdleNotifications,
      pendingTaskAssignments,
      pendingTerminationNotifications,
      shutdownRejectedTargets,
      actorName,
    };

    const finalizeTeamState = (extra = {}) => {
      const finalizedAssignments = extra.taskAssignments && typeof extra.taskAssignments === 'object'
        ? extra.taskAssignments
        : mutableState.taskAssignments;
      const finalizedTaskNotifications = extra.pendingTaskAssignments && typeof extra.pendingTaskAssignments === 'object'
        ? extra.pendingTaskAssignments
        : mutableState.pendingTaskAssignments;
      const finalizedTerminationNotifications = extra.pendingTerminationNotifications && typeof extra.pendingTerminationNotifications === 'object'
        ? extra.pendingTerminationNotifications
        : mutableState.pendingTerminationNotifications;

      return {
        ...currentTeam,
        teamName,
        ...extra,
        pendingIdleNotifications: extra.pendingIdleNotifications ?? mutableState.pendingIdleNotifications,
        pendingTaskAssignments: prunePendingTaskAssignments(
          finalizedTaskNotifications,
          finalizedAssignments,
          actorName,
          toolName,
          previous,
          next,
        ),
        pendingTerminationNotifications: prunePendingTerminationNotifications(
          finalizedTerminationNotifications,
          finalizedAssignments,
          previous,
          next,
        ),
      };
    };

    if (toolName === 'TeamCreate') {
      return {
        teamName,
        knownTeammates: [],
        shutdownRequestedTargets: [],
        shutdownApprovedTargets: [],
        shutdownRejectedTargets: {},
        pendingPlanApprovals: {},
        taskAssignments: {},
        pendingIdleNotifications: {},
        pendingTaskAssignments: {},
        pendingTerminationNotifications: {},
      };
    }

    if (isAgentToolName(toolName)) {
      return handleAgentTeamUpdate(payload, mutableState, finalizeTeamState);
    }

    if (toolName === 'TaskList') {
      return handleTaskListTeamUpdate(payload, mutableState, finalizeTeamState);
    }

    if (toolName === 'TaskGet') {
      return handleTaskGetTeamUpdate(payload, previous, next, mutableState, finalizeTeamState);
    }

    if (toolName === 'TaskUpdate') {
      return handleTaskUpdateTeamUpdate(payload, previous, next, mutableState, finalizeTeamState);
    }

    if (toolName === 'SendMessage') {
      return handleSendMessageTeamUpdate(payload, previous, next, mutableState, finalizeTeamState);
    }

    return finalizeTeamState();
  });
}
