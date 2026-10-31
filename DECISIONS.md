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
