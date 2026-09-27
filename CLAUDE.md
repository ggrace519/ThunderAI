# ThunderAI - Claude Code Guide

## Project Overview
ThunderAI is a **Thunderbird WebExtension (Manifest V2)** that integrates multiple AI providers (ChatGPT Web, OpenAI API, Google Gemini, Claude/Anthropic, Ollama, and OpenAI-compatible APIs) directly into the Thunderbird email client.

- **Extension ID:** `thunderai@micz.it`
- **Min Thunderbird:** 140.0+
- **Language:** Plain ES6+ JavaScript modules — no build tools, no transpilation, no bundler
- **License:** GPLv3

## Key Rules

1. **Localization:** Modify ONLY `_locales/en/messages.json`. All other locale files are managed via Weblate — never touch them.
2. **`LANG.md` is the release packaging allowlist, not a locale inventory.** It lists only the translations complete enough to ship, and is therefore a *deliberately partial* subset of `_locales/` — locales below the release bar are omitted on purpose. It is maintained by hand: add a locale when its translation is approved for release. Do not "fix" it to match `_locales/`.
3. **No build system:** There is no bundler or compiler. All JS files are plain ES6 modules loaded directly by the browser engine. (`package.json` exists only for this fork's dev tooling — tests — and is not part of the add-on.)
4. **Module imports:** Use relative paths with `.js` extension (e.g., `import { foo } from '../js/mzta-utils.js'`).
5. **Placeholder format:** Placeholders in prompt text use the `{%placeholder_id%}` syntax (e.g., `{%mail_text_body_or_selected%}`).
6. **Tests:** This fork carries a Vitest harness for pure logic (`npm test`, files in `test/`, config in `vitest.config.mjs`; DOM-level tests opt into happy-dom per file). It covers pure utility functions, streaming parsers, small DOM helpers, the spam badge's layout in the message-display content script (layout faked, since happy-dom has none) and the API clients' request bodies (with `fetch` mocked); UI and WebExtension behavior are still tested manually in Thunderbird (`about:debugging` → Load Temporary Add-on → `manifest.json`).
7. **Settings defaults:** All new preferences must be added to `options/mzta-options-default.js` in `prefs_default`.
8. **Keep spec files up to date:** When making code changes that affect a subsystem described in claude-spec/, update the relevant spec file to reflect the new behavior. Read the spec before modifying, update it after.

## Data flow

User triggers a prompt → `popup/mzta-popup.js` → `browser.runtime.sendMessage` → `mzta-background.js` → `openChatGPT()` dispatches to one of two paths:
1. **Interactive path** (all API types except ChatGPT Web): opens `api_webchat/index.html` as a popup window; `controller.js` spins up the matching Web Worker from `js/workers/`; the webchat sends the result back via `browser.tabs.sendMessage`.
2. **ChatGPT Web path**: opens chatgpt.com as a popup window and injects `js/mzta-chatgpt.js` via `browser.tabs.executeScript`.

**Background-only API calls** (auto-tag, spam filter, summarize): `mzta_specialCommand` (`js/mzta-special-commands.js`) spins up a Worker directly in the background page — no popup window.

## Directory Map

```
/
├── mzta-background.js      # Background script (main entry point)
├── mzta-background.html    # Loads the background script
├── manifest.json           # Extension manifest
├── js/                     # Core modules
│   ├── api/                # AI API integration modules
│   ├── workers/            # Web Workers (one per API provider)
│   ├── lib/                # Third-party libraries (diff.js)
│   └── mzta-*.js           # Core utilities, menus, prompts, placeholders
├── options/                # Settings UI
│   ├── mzta-options.html/.js/.css
│   ├── mzta-options-default.js   # ALL default preference values
│   └── mzta-release-notes.html
├── pages/                  # Feature-specific settings pages
│   ├── addtags/
│   ├── customprompts/
│   ├── customdataplaceholders/
│   ├── get-calendar-event/
│   ├── get-task/
│   ├── menu_order/         # Drag-and-drop reorder + visibility for popup/context menus
│   ├── spamfilter/
│   ├── summarize/
│   ├── translate/
│   ├── onboarding/
│   ├── setup-wizard/       # First-run guided connection setup
│   └── _lib/               # Shared libraries used by pages
├── popup/                  # Popup menu (shown on toolbar click)
│   └── mzta-popup.html/.js/.css
├── _locales/               # Localization
│   ├── en/messages.json    # ← ONLY THIS FILE is edited directly
│   └── [all other languages managed by Weblate — see `_locales/` for the current set]
├── images/                 # Icons and graphical assets
├── test/                   # Vitest unit tests (this fork; pure logic only)
└── api_webchat/            # Web chat API interface
```

## Fork & branch model

This is a fork: `origin` = `ggrace519/ThunderAI`, `upstream` = `micz/ThunderAI` (push disabled locally).

- `develop` is the integration branch and the PR target; `main` only receives promotion PRs from `develop`.
- Upstream syncs land as a merge (never a rebase) of `upstream/main` on a `chore/merge-upstream-<version>` branch, PR'd into `develop`.
- Fork changes are logged in `FORK_CHANGELOG.md`. `CHANGELOG.md` is upstream's release notes and is left untouched.

## Packaging

`package.ps1` (Windows) or `package.py` zips the sources into `thunderai.xpi`; `manifest.json` must sit at the ZIP root. See `PACKAGING.md`.

## Spec Files

For detailed documentation see [`claude-spec/`](claude-spec/):

- [01-architecture.md](claude-spec/01-architecture.md) — Module structure and data flow
- [02-prompts.md](claude-spec/02-prompts.md) — Prompt system (types, actions, properties)
- [03-placeholders.md](claude-spec/03-placeholders.md) — Placeholder system
- [04-api-integrations.md](claude-spec/04-api-integrations.md) — AI provider integrations
- [05-options.md](claude-spec/05-options.md) — Settings and preferences system
- [06-localization.md](claude-spec/06-localization.md) — i18n rules and workflow
- [07-diff-picker.md](claude-spec/07-diff-picker.md) — Interactive change picker for proofreading (hunk model, compose invariant)
- [99-thunderbird-team-spec.md](claude-spec/99-thunderbird-team-spec.md) — Thunderbird WebExtensions development guidelines (API usage, experiments, review requirements)
