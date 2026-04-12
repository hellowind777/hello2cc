import {
  deriveAgentCapabilities,
  deriveToolCapabilities,
  normalizeAgentTypes,
  normalizeToolNames,
} from './session-capabilities.mjs';
import {
  collectStrings,
  extractAgentListingDelta,
  extractAttachmentSignals,
  extractAttachments,
  extractCommandEntries,
  extractDeferredToolDelta,
  extractBootstrapSkillEntriesFromText,
  extractMcpInstructionDelta,
  extractMcpResources,
  extractSkillEntriesFromText,
  extractSkillListingAttachment,
  extractToolReferenceNames,
  latestAttachmentOfType,
  normalizeAttachmentTeamContext,
  normalizeDescription,
  normalizeName,
  uniq,
  uniqBy,
} from './transcript-record-extractors.mjs';
import { realTeamNameOrEmpty } from './team-name.mjs';
import { extractWorkflowEntries } from './transcript-workflow-extractors.mjs';

/**
 * Extracts interaction-scoped host surface and attachment state from a transcript record.
 */
export function interactionSnapshotFromRecord(record) {
  if (!record || typeof record !== 'object') return {};

  const textBlocks = collectStrings(record);
  const attachments = extractAttachments(record);
  const skillListingAttachment = extractSkillListingAttachment(record);
  const bootstrapSkillEntries = String(record?.type || '').trim().toLowerCase() === 'user'
    ? []
    : textBlocks.flatMap((text) => extractBootstrapSkillEntriesFromText(text));
  const surfacedSkillEntries = uniqBy([
    ...attachments
      .filter((attachment) => attachment?.type === 'skill_discovery')
      .flatMap((attachment) => Array.isArray(attachment.skills)
        ? attachment.skills.map((skill) => ({
          name: normalizeName(skill?.name),
          description: normalizeDescription(skill?.description),
        }))
      : []),
    ...skillListingAttachment.skills,
    ...bootstrapSkillEntries,
    ...textBlocks.flatMap((text) => extractSkillEntriesFromText(text).skills),
  ], (entry) => entry.name.toLowerCase());
  const loadedCommands = uniqBy(
    textBlocks.flatMap(extractCommandEntries),
    (entry) => `${entry.name.toLowerCase()}|${entry.args}|${entry.isSkillFormat ? 'skill' : 'slash'}`,
  );
  const workflowEntries = uniqBy(
    extractWorkflowEntries(record),
    (entry) => entry.name.toLowerCase(),
  );
  const deferredToolDelta = extractDeferredToolDelta(record);
  const agentListingDelta = extractAgentListingDelta(record);
  const loadedDeferredToolNames = extractToolReferenceNames(record);
  const mcpResources = extractMcpResources(record, textBlocks);
  const mcpInstructionDelta = extractMcpInstructionDelta(record);
  const attachmentSignals = extractAttachmentSignals(record);

  return {
    ...(surfacedSkillEntries.length ? {
      surfacedSkills: surfacedSkillEntries,
      surfacedSkillNames: surfacedSkillEntries.map((entry) => entry.name),
    } : {}),
    ...(loadedCommands.length ? {
      loadedCommands,
      loadedCommandNames: uniq(loadedCommands.map((entry) => entry.name)),
    } : {}),
    ...(workflowEntries.length ? {
      workflowEntries,
      workflowNames: uniq(workflowEntries.map((entry) => entry.name)),
    } : {}),
    ...(deferredToolDelta.addedNames.length ? { availableDeferredToolNames: deferredToolDelta.addedNames } : {}),
    ...(deferredToolDelta.removedNames.length ? { removedDeferredToolNames: deferredToolDelta.removedNames } : {}),
    ...(agentListingDelta.addedTypes.length ? { surfacedAgentTypes: normalizeAgentTypes(agentListingDelta.addedTypes) } : {}),
    ...(agentListingDelta.removedTypes.length ? { removedSurfacedAgentTypes: normalizeAgentTypes(agentListingDelta.removedTypes) } : {}),
    ...(loadedDeferredToolNames.length ? { loadedDeferredToolNames } : {}),
    ...(mcpResources.length ? { mcpResources } : {}),
    ...(mcpInstructionDelta.entries.length ? { mcpInstructionEntries: mcpInstructionDelta.entries } : {}),
    ...(mcpInstructionDelta.removedNames.length ? { removedMcpInstructionNames: mcpInstructionDelta.removedNames } : {}),
    ...attachmentSignals,
  };
}

/**
 * Extracts session-scoped tool, agent, and interaction capabilities from a transcript record.
 */
export function sessionSnapshotFromRecord(record) {
  if (!record || typeof record !== 'object') return {};

  const mainModel = String(record.model || '').trim();
  const outputStyle = String(record.output_style || '').trim();
  const toolNames = normalizeToolNames(record.tools);
  const agentTypes = normalizeAgentTypes(record.agents);

  return {
    ...(mainModel ? { mainModel } : {}),
    ...(outputStyle ? { outputStyle } : {}),
    ...(toolNames.length ? { toolNames } : {}),
    ...(agentTypes.length ? { agentTypes } : {}),
    ...(toolNames.length ? deriveToolCapabilities(toolNames) : {}),
    ...(agentTypes.length ? deriveAgentCapabilities(agentTypes) : {}),
    ...interactionSnapshotFromRecord(record),
  };
}

/**
 * Extracts team identity hints from transcript records and team-context attachments.
 */
export function teamSnapshotFromRecord(record) {
  if (!record || typeof record !== 'object') return {};

  const attachmentTeamContext = normalizeAttachmentTeamContext(latestAttachmentOfType(record, 'team_context'));
  const teamName = realTeamNameOrEmpty(record.teamName || record.team_name || attachmentTeamContext?.teamName);
  const agentName = String(record.agentName || record.agent_name || attachmentTeamContext?.agentName || '').trim();

  return {
    ...(teamName ? { teamName } : {}),
    ...(agentName ? { agentName } : {}),
    ...(attachmentTeamContext?.teamConfigPath ? { teamConfigPath: attachmentTeamContext.teamConfigPath } : {}),
    ...(attachmentTeamContext?.taskListPath ? { taskListPath: attachmentTeamContext.taskListPath } : {}),
  };
}
