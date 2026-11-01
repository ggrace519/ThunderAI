# Fork changelog

Changes carried by this fork (`ggrace519/ThunderAI`) on top of upstream
ThunderAI. Upstream's own release notes stay in `CHANGELOG.md`, which is left
untouched so upstream syncs merge cleanly.

## [Unreleased]

### Added
- **Fork releases you can install.** Each fork release is published on this
  repository's Releases page as `thunderai-<version>.xpi`, installable with
  "Install Add-on From File". Installed copies update themselves from those
  releases instead of the Thunderbird add-on site, which would otherwise
  replace the fork with upstream's build. Fork versions show in Thunderbird
  as `<upstream>.<n>` (e.g. 5.1.1.1).
- The README explains what the fork adds, how to install it and where to
  report issues.

### Changed
- Updated to upstream ThunderAI **5.1.1** (from 5.0.2). Brings the redesigned
  Custom Prompts page, Thunderbird Enterprise Policies, settings stored in
  Thunderbird's local storage (migrated automatically at first start),
  automatic retries when a provider is temporarily unavailable, parallel
  processing of incoming mail, token usage in the chat window, many new
  per-provider options (Claude Top P/K and stop sequences, OpenAI output
  format and verbosity, Gemini max tokens/Top P/K, Ollama reasoning level and
  keep-alive), domain skip/block lists for the spam filter, and the 5.0.3/5.0.4
  ChatGPT Web fixes. See upstream's `CHANGELOG.md` for the full list.
- The fork's fixes that upstream has since made in its own way now use
  upstream's version: the spam badge jitter (upstream #929, sent from this
  fork), Claude Opus 5.5 handling, thinking combined with temperature, Ollama
  context size with temperature, "Update models" on OpenAI-compatible servers,
  and the HTML sanitizing of the inline summary/translation panels.
- Claude: a selected Effort level is now always sent, even when it matches
  the model's default (upstream's rule). Before, the fork left it out.
- The fork's request timeouts are replaced by upstream's retry layer, which
  times out a connection that never answers and retries temporary failures.
- "Don't send the email body" is now a switch in the redesigned Custom Prompts
  editor, with a "No body" chip in the table view.
- Auto-tagging and the spam filter's structured outputs keep working with
  upstream's new options. On OpenAI, the command's schema replaces any
  *Output format* the user set for that request but keeps *Verbosity*.
- Auto-tagging and the spam filter keep the long wait for slow models under
  upstream's retry layer: their requests (non-streaming) get a 10-minute
  limit instead of upstream's 60 s, which would have cut slow models off and
  re-run the request up to 5 times. `special_command_timeout` still bounds
  the wait.
- A Claude request rejected for its Effort level is retried without the
  Effort but with the JSON schema kept, so the retry still returns the
  structured reply auto-tagging and the spam filter expect.

### Fixed
- The prompt-injection warning above the inline summary and translation no
  longer disappears when you leave the message and come back. The warning
  was never stored with the cached result, so it showed only the first time
  (#19).
- Adding tags from the message context menu now asks the AI for the same
  structured JSON reply as automatic tagging, and logs the prompt-injection
  guard's warning. Before, that path still scraped the tags out of free text,
  and since the menu and an incoming batch now share one tagging job, the
  reply format depended on which one started first.
- `{%mail_raw_source%}` was the only built-in placeholder without the
  "dynamic" attribute, so the placeholder autocomplete described it
  inconsistently; found by upstream's placeholder tests.
- An alert in the message pane no longer fails when the safe-formatting
  helper was not loaded first; it falls back to plain text.

### Infrastructure
- The `develop` → `main` promotion PR is now opened and kept up to date
  automatically once CI passes on `develop` (shared `promote` workflow). The
  fork's CI workflow is renamed `CI` and also runs on pushes to `develop`.
- The packaging scripts leave upstream's new `tests/` folder out of the XPI.
- Upstream's own GitHub automation (retargeting PRs to its `dev` branch,
  vendor-library update PRs, bug-report validation) is limited to the
  upstream repository, so it never acts on this fork's promotion PRs and
  issues.
- Upstream's test suite (`tests/`, `node:test` + jsdom) runs alongside the
  fork's Vitest suite: `npm test` runs both, `npm run test:upstream` and
  `npm run test:fork` run one. Upstream's tests run with the fork's
  features on; where a fork feature changes what they assert, they were
  adapted (each change marked `fork:`). CI runs on Node 24, which upstream's
  suite requires. Dev dependencies are pinned to exact versions,
  and Vitest and happy-dom were bumped to releases that fix their published
  security advisories.

### Docs
- The testing guides now warn that removing a temporary ThunderAI in
  `about:debugging` deletes all of its saved settings, API keys and custom
  prompts, even when a normal copy is installed underneath (Thunderbird treats
  it as an uninstall). Test only in a separate Thunderbird profile.

## [5.0.2-fork.1] - 2026-09-26

### Changed
- Updated to upstream ThunderAI **5.0.2** (from 4.1.1). Brings the settings
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
- The message preview pane no longer jitters when a spam report is shown.
  At some pane widths the Antispam badge kept switching between its two
  layouts many times a second, moving the whole email up and down. It was
  most visible while the "Get AI Summary" button was also on the toolbar,
  because that button narrows the badge. Replacing a spam report also no
  longer leaves its old resize watcher running (#13).
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
- Ollama: setting a temperature no longer silently discards the configured
  context length (`num_ctx`).
- `{%mail_raw_source%}` no longer mistakes an attached text or HTML file for
  the message body, which could hide the real (e.g. phishing) body from the
  analysis.
- "Don't send the email body" now also applies to the "body or selected text"
  placeholders when nothing is selected.
- Inline translations and summaries are sanitized before they are shown in
  the message pane. A translated email could previously inject styles that
  hid ThunderAI's panels, including the injection warning.
- A summary saved from the chat window keeps the prompt-injection warning when
  it is shown above the message.
- Proofread and rewrite in the compose window no longer treat your own
  selected draft text as untrusted email data (upstream 5.0 moved these prompts
  to the selection). This avoided false injection warnings and the risk of the
  guard's markers ending up in the rewritten mail.
- The injection guard now also fences `{%mail_headers:...%}` values and the
  sender, To and Cc names.
- `{%mail_plain_text_part%}` (new upstream) is now fenced by the
  prompt-injection guard like the other email-derived placeholders.
- "Update models" for OpenAI-compatible servers no longer fails silently on
  network errors or servers that return a bare model list.
