import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// getPlaceholdersValues reads custom placeholders from storage and names from
// i18n; stub just those two browser APIs.
beforeAll(() => {
  vi.stubGlobal('browser', {
    storage: { local: { get: async (defaults) => ({ ...defaults }) }, sync: { get: async (defaults) => ({ ...defaults }) } },
    i18n: { getMessage: (key) => key },
  });
});
afterAll(() => {
  vi.unstubAllGlobals();
});

async function resolve(args) {
  const { placeholdersUtils } = await import('../js/mzta-placeholders.js');
  return placeholdersUtils.getPlaceholdersValues(args);
}

const base = {
  prompt_text: 'A {%mail_text_body_or_selected%} B {%mail_html_body_or_selected%}',
  body_text: 'FULL BODY',
  msg_text: { html: '<p>FULL BODY</p>' },
};

describe('dont_send_body with the _or_selected placeholders', () => {
  it('falls back to the body when the flag is off', async () => {
    const subs = await resolve({ ...base });
    expect(subs.mail_text_body_or_selected).toBe('FULL BODY');
    expect(subs.mail_html_body_or_selected).toBe('<p>FULL BODY</p>');
  });

  it('drops the body fallback when the flag is on', async () => {
    const subs = await resolve({ ...base, dont_send_body: true });
    expect(subs.mail_text_body_or_selected).toBe('');
    expect(subs.mail_html_body_or_selected).toBe('');
  });

  it('still uses the selection when the flag is on', async () => {
    const subs = await resolve({ ...base, dont_send_body: true, selection_text: 'SEL', selection_html: '<b>SEL</b>' });
    expect(subs.mail_text_body_or_selected).toBe('SEL');
    expect(subs.mail_html_body_or_selected).toBe('<b>SEL</b>');
  });
});
