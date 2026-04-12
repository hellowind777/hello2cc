import {
  normalizeDescription,
  normalizeName,
} from './transcript-context-utils.mjs';
import { realTeamNameOrEmpty } from './team-name.mjs';

export function truncatePreview(value, limit = 180) {
  const normalized = normalizeDescription(value).replace(/\s+/g, ' ');
  if (!normalized) return '';
  return normalized.length > limit ? `${normalized.slice(0, limit - 3)}...` : normalized;
}

export function extractAttachments(record) {
  const directAttachments = Array.isArray(record?.attachments) ? record.attachments : [];
  const messageAttachments = Array.isArray(record?.message?.attachments) ? record.message.attachments : [];
  const contentAttachments = Array.isArray(record?.message?.content)
    ? record.message.content.filter((item) => item && typeof item === 'object' && 'type' in item)
    : [];

  return [...directAttachments, ...messageAttachments, ...contentAttachments];
}

export function latestAttachmentOfType(record, type) {
  const attachments = extractAttachments(record)
    .filter((attachment) => attachment?.type === type);
  return attachments.length ? attachments[attachments.length - 1] : null;
}

export function normalizeAttachmentTeamContext(attachment) {
  if (!attachment || typeof attachment !== 'object') return null;

  const teamName = realTeamNameOrEmpty(normalizeName(attachment?.teamName));
  const agentName = normalizeName(attachment?.agentName);
  const teamConfigPath = normalizeDescription(attachment?.teamConfigPath);
  const taskListPath = normalizeDescription(attachment?.taskListPath);

  if (!teamName && !agentName && !teamConfigPath && !taskListPath) {
    return null;
  }

  return {
    ...(teamName ? { teamName } : {}),
    ...(agentName ? { agentName } : {}),
    ...(teamConfigPath ? { teamConfigPath } : {}),
    ...(taskListPath ? { taskListPath } : {}),
  };
}
