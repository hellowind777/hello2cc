import { readFileSync } from 'node:fs';

const CHANGELOG_SECTION_PATTERN = /^##\s+(.+?)\s+-\s+(\d{4}-\d{2}-\d{2})\s*$/gm;
const ISSUE_REF_PATTERN = /#(\d+)/g;

export function normalizeTag(tag) {
  const normalized = String(tag || '').trim();
  if (!normalized) {
    throw new Error('Missing release tag');
  }

  return normalized.startsWith('v') ? normalized : `v${normalized}`;
}

export function versionFromTag(tag) {
  return normalizeTag(tag).replace(/^v/, '');
}

export function parseChangelogSections(markdown) {
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
      const login = ref.login ? `@${ref.login}` : 'the reporter/contributor';
      const label = `#${ref.number}`;
      const title = ref.title ? ` — ${ref.title}` : '';
      const suffix = link ? ` (${link})` : '';
      return `- Thanks ${login} for ${kind} ${label}${title}${suffix}`;
    });

  if (lines.length === 0) {
    return '';
  }

  return [
    '## Acknowledgements / 致谢',
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
    parts.push('', `**Full Changelog**: ${compareUrl}`);
  }

  return `${parts.join('\n').trim()}\n`;
}
