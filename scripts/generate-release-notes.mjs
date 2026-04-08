#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  extractIssueRefs,
  normalizeTag,
  readChangelogSection,
  renderAcknowledgements,
  renderReleaseNotes,
  tagLookupVariants,
} from './lib/release-notes.mjs';

function parseArgs(argv) {
  const args = {};

  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];

    if (!key.startsWith('--')) continue;
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${key}`);
    }

    args[key.slice(2)] = value;
    index += 1;
  }

  return args;
}

function gitLines(...args) {
  const output = execFileSync('git', args, {
    cwd: resolve('.'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function gitText(...args) {
  return execFileSync('git', args, {
    cwd: resolve('.'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function previousTag(tag, tags = []) {
  const orderedTags = tags.length > 0 ? tags : gitLines('tag', '--sort=creatordate');
  const variants = tagLookupVariants(tag);
  const resolvedTag = variants.find((candidate) => orderedTags.includes(candidate)) || tag;
  const index = orderedTags.indexOf(resolvedTag);
  if (index <= 0) return '';
  return orderedTags[index - 1];
}

function resolveExistingTag(tag, tags = []) {
  const orderedTags = tags.length > 0 ? tags : gitLines('tag', '--sort=creatordate');
  const resolvedTag = tagLookupVariants(tag).find((candidate) => orderedTags.includes(candidate));
  if (!resolvedTag) {
    throw new Error(`Tag ${tag} was not found. Checked variants: ${tagLookupVariants(tag).join(', ')}`);
  }

  return resolvedTag;
}

function compareUrl(repo, fromTag, toTag) {
  if (!repo || !fromTag || !toTag) return '';
  return `https://github.com/${repo}/compare/${fromTag}...${toTag}`;
}

async function fetchReference(repo, number, token) {
  const response = await fetch(`https://api.github.com/repos/${repo}/issues/${number}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'hello2cc-release-notes',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status} for #${number}`);
  }

  const payload = await response.json();
  return {
    number,
    kind: payload.pull_request ? 'pr' : 'issue',
    login: payload.user?.login || '',
    title: String(payload.title || '').trim(),
    html_url: String(payload.html_url || '').trim(),
  };
}

async function resolveAcknowledgementRefs(repo, numbers) {
  if (!repo || numbers.length === 0) return [];

  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
  const refs = [];

  for (const number of numbers) {
    try {
      refs.push(await fetchReference(repo, number, token));
    } catch (error) {
      process.stderr.write(`warning: ${error.message}\n`);
      refs.push({
        number,
        kind: 'issue',
        login: '',
        title: '',
        html_url: repo ? `https://github.com/${repo}/issues/${number}` : '',
      });
    }
  }

  return refs;
}

async function main() {
  const args = parseArgs(process.argv);
  const requestedTag = normalizeTag(args.tag || process.env.TAG_NAME || process.env.GITHUB_REF_NAME || '');
  const repo = String(args.repo || process.env.GITHUB_REPOSITORY || '').trim();
  const outputFile = String(args.output || '').trim();
  const changelogPath = resolve(args.changelog || 'CHANGELOG.md');
  const orderedTags = gitLines('tag', '--sort=creatordate');
  const tag = resolveExistingTag(requestedTag, orderedTags);

  const section = readChangelogSection(changelogPath, requestedTag);
  if (!section?.body?.trim()) {
    throw new Error(`Missing CHANGELOG section for ${requestedTag}. Add "## ${requestedTag.replace(/^v/, '').match(/^\d+\.\d+\.\d+/)?.[0] || requestedTag.replace(/^v/, '')} - YYYY-MM-DD" with bullet points before publishing.`);
  }

  const fromTag = previousTag(tag, orderedTags);
  const commitText = fromTag ? gitText('log', '--format=%B', `${fromTag}..${tag}`) : gitText('log', '--format=%B', '-n', '1', tag);
  const issueNumbers = extractIssueRefs(section.body, commitText);
  const acknowledgementRefs = await resolveAcknowledgementRefs(repo, issueNumbers);
  const notes = renderReleaseNotes({
    section,
    acknowledgements: renderAcknowledgements(acknowledgementRefs),
    compareUrl: compareUrl(repo, fromTag, tag),
  });

  if (outputFile) {
    writeFileSync(outputFile, notes, 'utf8');
    return;
  }

  process.stdout.write(notes);
}

await main();
