// The fork release helpers (.github/scripts/fork-release.mjs) used by prepare-release.yml
// and release.yml. See DECISIONS.md "Fork release channel".
import { describe, it, expect } from 'vitest';
import {
  splitVersion,
  toVersion,
  toTag,
  toManifest,
  nextForkNumber,
  rollChangelog,
  releaseNotes,
  updatesJson,
  assetLink,
  xpiName,
  ADDON_ID,
} from '../.github/scripts/fork-release.mjs';

const CHANGELOG = `# Fork changelog

Intro.

## [Unreleased]

### Added
- New thing.

### Fixed
- A bug.

## [5.0.2-fork.1] - 2026-09-26

### Changed
- Old change.
`;

describe('version mapping', () => {
  it('splits a plain upstream version and a fork version', () => {
    expect(splitVersion('5.1.1')).toEqual({ upstream: '5.1.1', fork: null });
    expect(splitVersion('5.1.1.2')).toEqual({ upstream: '5.1.1', fork: 2 });
  });

  it('rejects versions that are not 3 or 4 integers', () => {
    for (const v of ['5.1', '5.1.1.1.1', '5.1.1-fork.1', '5.1.1a']) {
      expect(() => splitVersion(v)).toThrow();
    }
  });

  it('maps fork number n to the tag, the changelog version and the manifest version', () => {
    expect(toVersion('5.1.1', 1)).toBe('5.1.1-fork.1');
    expect(toTag('5.1.1', 1)).toBe('v5.1.1-fork.1');
    expect(toManifest('5.1.1', 1)).toBe('5.1.1.1');
  });
});

describe('nextForkNumber', () => {
  it('starts at 1 for a new upstream version', () => {
    expect(nextForkNumber('5.1.1', [])).toBe(1);
    expect(nextForkNumber('5.1.2', ['v5.1.1-fork.1', 'v5.1.1-fork.2'])).toBe(1);
  });

  it('continues after the highest tag of the same upstream version, gaps included', () => {
    expect(nextForkNumber('5.1.1', ['v5.1.1-fork.1', 'v5.1.1-fork.3', 'v5.1.0-fork.9'])).toBe(4);
  });

  it('ignores tags that only look similar', () => {
    expect(nextForkNumber('5.1.1', ['v5.1.1', 'v5.1.10-fork.4', 'v5.1.1-fork.x'])).toBe(1);
  });
});

describe('rollChangelog', () => {
  it('moves [Unreleased] under the version heading and leaves it empty', () => {
    const out = rollChangelog(CHANGELOG, '5.1.1-fork.1', '2026-11-01');
    expect(out).toContain('## [Unreleased]\n\n## [5.1.1-fork.1] - 2026-11-01\n\n### Added\n- New thing.');
    expect(out).toContain('- A bug.\n\n## [5.0.2-fork.1] - 2026-09-26');
    expect(out.startsWith('# Fork changelog\n\nIntro.\n\n## [Unreleased]')).toBe(true);
  });

  it('refuses an empty [Unreleased]', () => {
    const empty = CHANGELOG.replace(/## \[Unreleased\][\s\S]*?(?=## \[5\.0\.2)/, '## [Unreleased]\n\n### Added\n\n');
    expect(() => rollChangelog(empty, '5.1.1-fork.1', '2026-11-01')).toThrow(/no entries/);
  });

  it('refuses a version that already has a heading', () => {
    expect(() => rollChangelog(CHANGELOG, '5.0.2-fork.1', '2026-11-01')).toThrow(/already/);
  });
});

describe('releaseNotes', () => {
  it('returns the body of a version section', () => {
    expect(releaseNotes(CHANGELOG, '5.0.2-fork.1')).toBe('### Changed\n- Old change.');
  });

  it('works on a freshly rolled changelog', () => {
    const rolled = rollChangelog(CHANGELOG, '5.1.1-fork.1', '2026-11-01');
    expect(releaseNotes(rolled, '5.1.1-fork.1')).toBe('### Added\n- New thing.\n\n### Fixed\n- A bug.');
  });

  it('throws when the heading is missing', () => {
    expect(() => releaseNotes(CHANGELOG, '9.9.9-fork.1')).toThrow(/no \[9\.9\.9-fork\.1\]/);
  });
});

describe('updatesJson', () => {
  const sha = 'a'.repeat(64);
  const link = assetLink('v5.1.1-fork.1', xpiName('5.1.1-fork.1'));

  it('follows the documented update manifest schema', () => {
    expect(updatesJson({ version: '5.1.1.1', link, sha256: sha, minVersion: '140.0' })).toEqual({
      addons: {
        [ADDON_ID]: {
          updates: [{
            version: '5.1.1.1',
            update_link: 'https://github.com/ggrace519/ThunderAI/releases/download/v5.1.1-fork.1/thunderai-5.1.1-fork.1.xpi',
            update_hash: 'sha256:' + sha,
            applications: { gecko: { strict_min_version: '140.0' } },
          }],
        },
      },
    });
  });

  it('rejects a non-https link and a malformed hash', () => {
    expect(() => updatesJson({ version: '5.1.1.1', link: 'http://x/y.xpi', sha256: sha })).toThrow(/https/);
    expect(() => updatesJson({ version: '5.1.1.1', link, sha256: 'xyz' })).toThrow(/sha256/);
  });
});
