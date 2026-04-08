import { readFileSync } from 'node:fs';

const CHANGELOG_SECTION_PATTERN = /^##\s+(.+?)\s+-\s+(\d{4}-\d{2}-\d{2})\s*$/gm;
const ISSUE_REF_PATTERN = /#(\d+)/g;

export function normalizeTag(tag) {
  const normalized = String(tag || '').trim();
  if (!normalized) {
    throw new Error('Missing release tag');
  }

  return normalized;
}

function versionFromTag(tag) {
  const normalized = normalizeTag(tag).replace(/^v/, '');
  const semverPrefix = normalized.match(/^\d+\.\d+\.\d+/)?.[0];
  return semverPrefix || normalized;
}

export function tagLookupVariants(tag) {
  const normalized = normalizeTag(tag);
  const bare = normalized.replace(/^v/, '');
  return [...new Set([normalized, `v${bare}`, bare])].filter(Boolean);
}

function parseChangelogSections(markdown) {
  const text = String(markdown || '');
  const matches = [...text.matchAll(CHANGELOG_SECTION_PATTERN)];

  return matches.map((match, index) => {
    const headingStart = match.index ?? 0;
    const bodyStart = headingStart + match[0].length;
    const bodyEnd = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length;
    const body = text.slice(bodyStart, bodyEnd).trim();

    return {
      heading: match[0].trim(),
      version: match[1].trim(),
      date: match[2].trim(),
      body,
    };
  });
}

export function changelogSectionForTag(markdown, tag) {
  const version = versionFromTag(tag);
  return parseChangelogSections(markdown).find((section) => section.version === version) || null;
}

export function readChangelogSection(filePath, tag) {
  const markdown = readFileSync(filePath, 'utf8');
  return changelogSectionForTag(markdown, tag);
}

export function extractIssueRefs(...texts) {
  const refs = new Set();

  for (const text of texts) {
    const source = String(text || '');
    for (const match of source.matchAll(ISSUE_REF_PATTERN)) {
      refs.add(Number(match[1]));
    }
  }

  return [...refs].sort((left, right) => left - right);
}

export function renderAcknowledgements(refs = []) {
  const lines = refs
    .map((ref) => {
      const kind = ref.kind === 'pr' ? 'PR' : 'issue';
      const link = ref.html_url || ref.url || '';
      const login = ref.login ? `@${ref.login}` : '相关反馈者 / 贡献者';
      const label = `#${ref.number}`;
      const title = ref.title ? ` — ${ref.title}` : '';
      const suffix = link ? ` (${link})` : '';
      return `- 感谢 ${login} 对 ${kind} ${label}${title} 的反馈与推动${suffix}`;
    });

  if (lines.length === 0) {
    return '';
  }

  return [
    '## 致谢',
    '',
    ...lines,
  ].join('\n');
}

export function renderReleaseNotes({ section, acknowledgements = '', compareUrl = '' }) {
  if (!section?.heading || !section?.body?.trim()) {
    throw new Error('Release notes require a changelog heading and body');
  }

  const parts = [
    section.heading,
    '',
    section.body.trim(),
  ];

  if (acknowledgements) {
    parts.push('', acknowledgements);
  }

  if (compareUrl) {
    parts.push('', `**完整变更对比**：${compareUrl}`);
  }

  return `${parts.join('\n').trim()}\n`;
}
