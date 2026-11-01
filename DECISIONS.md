# Architecture Decision Log

This file records significant architectural and design decisions made during development.
Each entry is appended by the plan-architect agent or by hand.

---

## ADR - Activate agent packs (2026-05-01)

**Date:** 2026-05-01
**Status:** Accepted
**Phase:** Initialize

### Context
Project requires archetype-specific agent specialists in addition to the seven generalists shipped by the playbook. Library at `C:\Users\grace\.claude\playbook` provides 105 reusable agents; this project does not need all of them.

### Decision
Activate the following packs: `ext-`, `ai-`, `common-` (plus generalists).

Sync mechanism: Copy (managed by `Sync-AgentPacks.ps1`; see `.claude\agents\.pack-manifest.json`).

### Consequences
- 24 agent files installed under `.claude\agents\`.
- Re-running the script with a different pack list adds/removes agents accordingly; files not listed in the manifest are left untouched.
- Library updates are picked up by re-running the sync (Copy mode) or automatically (Symlink mode).
---

## ADR - Keep upstream's test suite and the fork's side by side (2026-10-31)

**Date:** 2026-10-31
**Status:** Accepted
**Phase:** Upstream sync 5.1.1

### Context
Upstream ThunderAI 5.1.0 added its own automated suite in `tests/` (Node's built-in
`node:test` runner plus jsdom). This fork already carried a Vitest suite in `test/` for its own
features (prompt-injection guard, structured outputs, `{%mail_raw_source%}`, `dont_send_body`,
the API clients' request bodies). Both claimed `npm test`, and `package.json` conflicted on the
sync. On the merged tree, upstream's suite failed only where the fork's features change what
upstream asserts exactly: the guard (on by default) rewrites every email-derived prompt with a
preamble and random markers, and the fork adds a placeholder, a prompt flag and two prefs that
upstream counts. Proven by switching the two fork prefs off: the background and compose areas
then passed completely.

### Decision
- Keep both suites: `npm test` runs upstream's (`test:upstream`), then the fork's (`test:fork`).
  Every dev dependency is pinned to an exact version (upstream's rule).
- Upstream's tests run with the fork's defaults ON and are **edited to the fork's expectations**,
  so they cover the fork as shipped. Edits stay minimal and each is marked `fork:`:
  - guard-aware assertions go through the fork-owned `tests/helpers/fork-guard.mjs`
    (`assertGuardShape()` checks the preamble and markers, `unguard()` gives the text upstream's
    golden fixtures describe), so upstream's fixture files stay untouched;
  - counts and lists gain the fork's additions (31 placeholders, 6 flags, 140 of 149 prefs).
- A failing upstream test is first checked for a real fork bug (it found two in this sync:
  `mail_raw_source` lacked `is_dynamic`, and alerts broke when `mzta-safe-html.js` was not
  loaded); only an intended divergence becomes a `fork:` edit.

Rejected: running upstream's suite with fork features off plus a skip list (never exercises the
guard-on paths upstream covers), and leaving the failures visible (hides new regressions).

### Consequences
- Upstream syncs can conflict on the `fork:` lines in `tests/`; resolve by keeping upstream's
  change and re-applying the marked fork line (`grep -rn 'fork:' tests/`).
- Two runners and two DOM libraries (jsdom, happy-dom) in dev tooling; neither ships (both
  packaging scripts exclude `test/` and `tests/`).

---

## ADR - Fork release channel (2026-11-01)

**Date:** 2026-11-01
**Status:** Accepted
**Phase:** Release automation

### Context
The fork had never published a release, and it reuses upstream's add-on ID (`thunderai@micz.it`).
Thunderbird picks an add-on's update URL from an enterprise policy, else the add-on's own
`browser_specific_settings.gecko.update_url`, else the Thunderbird add-on site's version check
(verified in Thunderbird 159's `XPIInstall.sys.mjs`). So a fork XPI installed from a file would be
silently replaced by upstream's next release from the add-on site. Thunderbird does not require
Mozilla's signature for file installs (`xpinstall.signatures.required = false`), so a self-built XPI
can be distributed directly.

### Decision
- **Own update channel.** `manifest.json` sets `update_url` to
  `https://github.com/ggrace519/ThunderAI/releases/latest/download/updates.json`; every release
  uploads an `updates.json` pointing at its XPI with a `sha256:` hash.
- **Version scheme.** Fork release `<upstream>-fork.<n>` (tag `v<upstream>-fork.<n>`) ships with
  manifest version `<upstream>.<n>`, which orders between upstream releases (`5.1.1 < 5.1.1.1 < 5.1.2`).
  A plain 3-part version means no fork release is prepared. The code only checks
  `previousVersion` prefixes, so a 4-part version is safe.
- **Automation.** `prepare-release.yml` (manual) rolls `FORK_CHANGELOG.md` and sets the manifest
  version in a PR into `develop`; `release.yml` runs on every `main` push and, when the manifest
  carries an untagged fork version, tags `main` and publishes the release. Tagging and releasing are
  one workflow because a tag pushed with `GITHUB_TOKEN` starts no other workflow. The logic is in
  `.github/scripts/fork-release.mjs`, unit-tested in `test/fork-release.test.js`.
- Releases are published, not drafts: merging the promotion PR is the maintainer's approval.

Rejected: telling users to turn off automatic updates. It leaves them on manual updates, and one
missed step brings back upstream's build without the fork's features.

### Consequences
- Installed copies keep using the `update_url` of the installed version, so it must not move. If it
  ever has to, only an enterprise policy (`ExtensionSettings.update_url`) can redirect old installs.
- Every upstream sync conflicts on the manifest `"version"` line; take upstream's 3-part version.
- `[5.0.2-fork.1]` in `FORK_CHANGELOG.md` stays a historical heading: it never reached `main`.
