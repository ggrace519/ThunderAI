# Fork changelog

Changes carried by this fork (`ggrace519/ThunderAI`) on top of upstream
ThunderAI. Upstream's own release notes stay in `CHANGELOG.md`, which is left
untouched so upstream syncs merge cleanly.

## [Unreleased]

### Changed
- Rebased onto upstream ThunderAI **5.0.2** (from 4.1.1). Brings the settings
  redesign, the setup wizard, the redesigned AI chat window, the interactive
  "Show differences" picker, the new HTML engine, `{%mail_plain_text_part%}`,
  the Claude "Effort" option and "Extra body data".
- The fork's "Test API Connection" button is replaced by upstream's
  connection test (setup wizard and settings page).
- The fork's chat auto-scroll fix is replaced by upstream's rewritten
  scroll-following in the chat window.
- The "Enforce structured outputs" and "Prompt-injection guard" toggles now
  live in the settings page's Advanced options section.

### Added
- **Prompt-injection guard** (on by default): email content is fenced as data
  before it reaches the AI, and a warning is shown when an email tries to
  instruct the AI — in the chat window, and in the inline summary and
  translation panels.
- **Structured outputs** for auto-tagging and the spam filter (on by default):
  the provider is asked for a JSON reply that matches a schema instead of
  having it scraped out of free text.
- `{%mail_raw_source%}` placeholder: headers, decoded body and attachment
  list for phishing/safety checks, without the attachment payloads.
- Per-prompt "Don't send the email body" option.
- Request timeouts for every AI provider, so a hung connection reports an
  error instead of spinning forever.
- Alert dialogs can use bold text and line breaks to point at the setting to
  change.

### Fixed
- Auto-tagging and the spam filter no longer fail on newer Claude models
  (Fable 5.1, Mythos 5.1, Opus 5.5), which reject the forced tool call the fork
  used to get JSON back, and no longer conflict with thinking on Opus 5,
  Sonnet 5 and Fable 5. Those models now use Anthropic's native structured
  outputs, which also keep the user's Effort and thinking settings; older
  Claude models keep the previous method.
- Claude Opus 5.5 requests no longer fail: it cannot turn thinking off, and
  choosing Effort "high" on it is now sent (its default is "medium").
- Claude requests with a custom temperature and an extended-thinking budget
  (e.g. Haiku 4.5) no longer fail; the temperature is left out while thinking
  is on.
- Gemini auto-tagging and spam filtering read the model's answer instead of
  its reasoning.
- Auto-tagging and the spam filter no longer time out after 30 seconds on
  slow (e.g. local) models; the "special command timeout" setting is the limit
  again.
- The injection guard now also fences `{%mail_headers:...%}` values and the
  sender, To and Cc names.
- `{%mail_plain_text_part%}` (new upstream) is now fenced by the
  prompt-injection guard like the other email-derived placeholders.
- "Update models" for OpenAI-compatible servers no longer fails silently on
  network errors or servers that return a bare model list.
