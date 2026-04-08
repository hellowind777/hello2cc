import test from 'node:test';
import assert from 'node:assert/strict';
import {
  changelogSectionForTag,
  extractIssueRefs,
  tagLookupVariants,
  renderAcknowledgements,
  renderReleaseNotes,
} from '../scripts/lib/release-notes.mjs';

const SAMPLE_CHANGELOG = `# Changelog

## 1.2.3 - 2026-04-02

- Fixed issue #7 and tightened routing
- Followed up on #9 with regression coverage

## 1.2.2 - 2026-04-01

- Previous release
`;

test('finds the exact changelog section for a tag', () => {
  const section = changelogSectionForTag(SAMPLE_CHANGELOG, 'v1.2.3');

  assert.deepEqual(section, {
    heading: '## 1.2.3 - 2026-04-02',
    version: '1.2.3',
    date: '2026-04-02',
    body: '- Fixed issue #7 and tightened routing\n- Followed up on #9 with regression coverage',
  });
});

test('finds the base changelog section for beta tags without a v prefix', () => {
  const section = changelogSectionForTag(SAMPLE_CHANGELOG, '1.2.3beta1');

  assert.deepEqual(section, {
    heading: '## 1.2.3 - 2026-04-02',
    version: '1.2.3',
    date: '2026-04-02',
    body: '- Fixed issue #7 and tightened routing\n- Followed up on #9 with regression coverage',
  });
});

test('computes lookup variants for stable and beta tags', () => {
  assert.deepEqual(tagLookupVariants('0.4.7beta'), ['0.4.7beta', 'v0.4.7beta']);
  assert.deepEqual(tagLookupVariants('v0.4.3'), ['v0.4.3', '0.4.3']);
});

test('extracts unique issue refs in numeric order', () => {
  assert.deepEqual(
    extractIssueRefs('touches #9 and #7', 'follow-up #9'),
    [7, 9],
  );
});

test('renders acknowledgement lines with issue and pr labels', () => {
  const text = renderAcknowledgements([
    {
      number: 7,
      kind: 'issue',
      login: 'alice',
      title: 'Report broken routing',
      html_url: 'https://github.com/example/repo/issues/7',
    },
    {
      number: 12,
      kind: 'pr',
      login: 'bob',
      title: 'Fix routing',
      html_url: 'https://github.com/example/repo/pull/12',
    },
  ]);

  assert.match(text, /致谢/);
  assert.match(text, /感谢 @alice 对 issue #7/);
  assert.match(text, /感谢 @bob 对 PR #12/);
});

test('renders full release notes with compare link', () => {
  const notes = renderReleaseNotes({
    section: changelogSectionForTag(SAMPLE_CHANGELOG, 'v1.2.3'),
    acknowledgements: renderAcknowledgements([
      {
        number: 7,
        kind: 'issue',
        login: 'alice',
        title: 'Report broken routing',
        html_url: 'https://github.com/example/repo/issues/7',
      },
    ]),
    compareUrl: 'https://github.com/example/repo/compare/v1.2.2...v1.2.3',
  });

  assert.match(notes, /^## 1\.2\.3 - 2026-04-02/m);
  assert.match(notes, /Fixed issue #7/);
  assert.match(notes, /## 致谢/);
  assert.match(notes, /\*\*完整变更对比\*\*/);
});
