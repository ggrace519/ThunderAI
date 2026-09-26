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