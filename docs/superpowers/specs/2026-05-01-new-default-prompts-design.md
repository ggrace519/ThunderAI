# Design: New Default Prompts

**Date:** 2026-05-01  
**Status:** Approved  

---

## Overview

Add four new default prompts to ThunderAI that cover high-frequency use cases missing from the existing set. The existing prompts cover reply, formal/polite rewrite, classify, summarize, proofread, translate, and a generic compose helper. The gaps are brevity, casual tone, action-item extraction, and AI-assisted drafting.

Also fix a latent bug in `savePrompt()` where a missing `await` caused default prompt saves to silently fail (already applied).

---

## New Prompts

### 1. Shorten (`prompt_shorten`)

| Property | Value |
|---|---|
| Context | Composing (`type: "2"`) |
| Action | Substitute text (`action: "2"`) |
| Selection required | No — whole compose body (`need_selected: "0"`) |
| Diff viewer | Yes (`use_diff_viewer: "1"`) |
| Custom text | No |
| Language directive | Yes (`define_response_lang: "1"`) |

**Prompt text:**
```
Shorten the following email to make it more concise, removing unnecessary words while preserving the key message and tone. Reply with only the shortened text and with no extra comments or other text.

"{%mail_typed_text%}"
```

---

### 2. Casual Rewrite (`prompt_rewrite_casual`)

| Property | Value |
|---|---|
| Context | Composing (`type: "2"`) |
| Action | Substitute text (`action: "2"`) |
| Selection required | No — whole compose body (`need_selected: "0"`) |
| Diff viewer | Yes (`use_diff_viewer: "1"`) |
| Custom text | No |
| Language directive | Yes (`define_response_lang: "1"`) |

**Prompt text:**
```
Rewrite the following text to be more casual and conversational in tone. Reply with only the re-written text and with no extra comments or other text.

"{%mail_typed_text%}"
```

---

### 3. Extract Action Items (`prompt_extract_action_items`)

| Property | Value |
|---|---|
| Context | Reading only (`type: "1"`) |
| Action | Show in chat / close (`action: "0"`) |
| Selection required | No — whole email (`need_selected: "0"`) |
| Diff viewer | No |
| Custom text | No |
| Language directive | Yes (`define_response_lang: "1"`) |

**Prompt text:**
```
Extract all action items, tasks, and follow-ups from the following email. Present them as a concise numbered list, each starting with a verb. Include any deadlines or responsible parties if mentioned.
```

---

### 4. Draft from Topic (`prompt_draft_topic`)

| Property | Value |
|---|---|
| Context | Composing (`type: "2"`) |
| Action | Show in chat / conversation (`action: "0"`) |
| Selection required | No (`need_selected: "0"`) |
| Diff viewer | No |
| Custom text | Yes — user provides topic/instruction (`need_custom_text: "1"`) |
| Signature | Yes (`need_signature: "1"`) |
| Language directive | Yes (`define_response_lang: "1"`) |

**Prompt text:**
```
Write a professional email about the following topic or instruction: {%additional_text%}. Reply with only the email text and with no extra comments or other text.
```

The conversation action (`action: "0"`) opens the interactive chat popup, letting the user iterate on the draft before manually inserting it into the compose window.

---

## Files to Change

| File | Change |
|---|---|
| `js/mzta-prompts.js` | Add 4 entries to `defaultPrompts` array |
| `_locales/en/messages.json` | Add 8 i18n strings (name + full_text for each prompt) |

No changes needed to `mzta-utils-prompt.js`, `mzta-menus.js`, or options pages — new default prompts are picked up automatically by `getPrompts()`.

---

## i18n Key Naming Convention

Following the existing pattern:
- Menu label key: `prompt_<id>` → `__MSG_prompt_<id>__`
- Prompt body key: `prompt_<id>_full_text`

New keys:
```
prompt_shorten
prompt_shorten_full_text
prompt_rewrite_casual
prompt_rewrite_casual_full_text
prompt_extract_action_items
prompt_extract_action_items_full_text
prompt_draft_topic
prompt_draft_topic_full_text
```

---

## Out of Scope

- Translations for other locales (Weblate handles those asynchronously)
- Options page changes (default prompts surface automatically)
- Prompt position/ordering preferences (user controls via existing settings UI)
