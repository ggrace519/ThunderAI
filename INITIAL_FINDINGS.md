# INITIAL_FINDINGS.md

## Project Overview
ThunderAI is a Thunderbird WebExtension (Manifest V2, min TB 115) that integrates multiple AI backends — ChatGPT Web, OpenAI API, Google Gemini, Anthropic Claude, Ollama, and OpenAI-compatible APIs — to help users analyse, write, reply to, and tag emails. It is a pure JavaScript addon with no build step; packaging is done by zipping the source into a `.xpi`.

## Stack
| Component     | Details |
|---------------|---------|
| Language      | Vanilla JavaScript (ES Modules) |
| Runtime       | Thunderbird 115+ WebExtension (browser.*  + messenger.* APIs) |
| Framework     | None — plain Web APIs + Web Components (api_webchat) |
| Test Runner   | None detected |
| Build System  | None — `package.ps1` zips sources into `thunderai.xpi` |
| Container     | None |
| Deploy Target | addons.thunderbird.net (.xpi upload) |

## Entry Points
- `mzta-background.js`: Background page — main orchestrator for all extension logic
- `popup/mzta-popup.html`: Toolbar button popup (compose + message display)
- `options/mzta-options.html`: Settings page
- `api_webchat/index.html`: Interactive AI chat window (opened per-request as a popup)

## Configuration
- `manifest.json`: Extension metadata, permissions, entry points, keyboard shortcut
- `options/mzta-options-default.js`: Canonical source of all user-configurable settings with defaults
- `browser.storage.sync`: Runtime storage for all preferences

## Issues Found
### Critical
- None

### Warnings
- No test suite exists — no unit or integration tests of any kind
- `mzta-background.js` uses top-level `await` (valid in background ES modules but worth noting)
- The `rand_call_id5` variable name is reused for both `google_gemini_api` and `anthropic_api` cases in `openChatGPT()` — shadowing issue (line ~548 and ~712 of `mzta-background.js`)

### Suggestions
- `openChatGPT()` has 6 near-identical `switch` branches (one per LLM) — could be unified via a config map
- `options/mzta-options-default.js` is the single source of truth for preferences; keep it synchronized with `options/mzta-options.html` and storage reads throughout the codebase

## Missing
- No test framework or test files
- No `.gitignore` (`.git`, `thunderai.xpi`, `*.zip` should be ignored)
- No linting config (ESLint or similar)
