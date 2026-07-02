# DEMO — innovation/structured-outputs

Proposal #2 from `INNOVATIONS.md`: replace JSON-scraping with schema-enforced structured outputs for the background special commands (auto-tag, spam filter).

## What was built

- **`js/api/response-schemas.js`** — pure, fully unit-tested module:
  - Canonical JSON Schemas for the special commands (`email_tags`: `{tags: string[]}`; `spam_verdict`: `{spamValue: integer, explanation: string}`), shaped to satisfy OpenAI strict mode (`additionalProperties:false`, all properties required).
  - Per-provider dialect adapters: OpenAI Responses `text.format json_schema`, OpenAI-compatible `response_format json_schema`, Ollama `format: <schema>`, Gemini `responseMimeType + responseSchema` (with recursive `additionalProperties` stripping), Anthropic forced tool-use (`tools` + `tool_choice`).
  - `extractStructuredText(llm, responseData)` — pulls the JSON text out of each provider's non-streaming response shape (including Anthropic `tool_use.input`).
- **All five API clients** accept a `response_schema` and emit the right dialect in the request body. Anthropic drops extended thinking when a schema is set (forced tool use and extended thinking are mutually exclusive).
- **All five workers**: when `response_schema` is passed at init, the client is constructed non-streaming; after the existing error handling, the whole response is parsed and emitted as a single `newToken` + `tokensDone` — so `mzta_specialCommand.sendPrompt()` works unchanged and the SSE parsing fragility disappears for these calls.
- **`mzta_specialCommand`** takes a `schema` argument, gated centrally on the new `use_structured_output` pref (default **on**); the two background call sites (spam filter, auto-tag) pass their schemas.
- The legacy free-text parsing (`extractJsonObject`, comma-split fallback) is untouched downstream — structured JSON simply hits its happy path, and turning the pref off restores the exact previous behavior.

## How to try it

1. Load the branch in Thunderbird (`about:debugging` → Load Temporary Add-on → `manifest.json`), configure any API provider.
2. Enable the spam filter (Settings → AntiSpam filter) with a thinking-heavy or chatty model — the classic failure case where the old regex scraping picked up preamble text.
3. Receive/select an email → context menu → "Analyze for spam".
4. Expected: the spam report shows a clean numeric verdict; with `do_debug` on, the worker log shows `Using structured output schema: spam_verdict` and the raw response is pure JSON.
5. Same for auto-tagging ("Add tags"): tags arrive as `{"tags":[...]}` with no fence-stripping.
6. Toggle "Use structured AI responses" off in Settings → requests revert to the previous free-text behavior (for OpenAI-compatible servers that reject `response_format`).

`npm test` → 84 tests pass (16 new in `test/response-schemas.test.js`).

## What's stubbed / not covered

- Nothing is stubbed.
- Calendar-event and task extraction still use free-text JSON parsing — their schemas (dates, times, attendee shapes) deserve their own slice with the date-format prefs taken into account.
- No automatic fallback retry when an OpenAI-compatible server rejects `response_format` — the error surfaces as before and the pref is the escape hatch.

## Next increment

- Schemas for `prompt_get_calendar_event` / `prompt_get_task`.
- Feature-detect `response_format` rejection for OpenAI-compatible servers and retry once without the schema.
- Reuse the same plumbing for proposal #5 (AI Filters), whose rule verdicts need exactly this reliability.
