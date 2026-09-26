// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { sanitizePanelPayload } from '../js/mzta-richtext.js';

describe('sanitizePanelPayload', () => {
  it('neutralizes a <style> in a translation that would hide the ThunderAI panels', () => {
    const payload = { command: 'showTranslation', data: {
      translated_text: '<p>Hello</p><style>#mzta-container{display:none!important}</style><img src=x onerror="alert(1)">',
      maxDisplayLength: 0,
    } };
    const out = sanitizePanelPayload(payload);
    const div = document.createElement('div');
    div.innerHTML = out.data.translated_text;
    expect(div.querySelector('style, img, [onerror]')).toBeNull();
    expect(div.querySelector('p').textContent).toBe('Hello');
    expect(out.data.maxDisplayLength).toBe(0);
    expect(payload.data.translated_text).toContain('<style>'); // input not mutated
  });

  it('keeps safe formatting and links, drops attributes and unsafe hrefs', () => {
    const out = sanitizePanelPayload({ command: 'showSummary', data: {
      summary_html: '<ul><li><b style="color:red">a</b> <a href="https://ok.test">ok</a> <a href="javascript:alert(1)">bad</a></li></ul>',
    } });
    const div = document.createElement('div');
    div.innerHTML = out.data.summary_html;
    expect(div.querySelector('ul li b').getAttribute('style')).toBeNull();
    const links = div.querySelectorAll('a');
    expect(links[0].getAttribute('href')).toBe('https://ok.test');
    expect(links[1].getAttribute('href')).toBeNull();
  });

  it('leaves plain-text translations and other payloads untouched', () => {
    const plain = { command: 'showTranslation', data: { translated_text: 'a < b & c' } };
    expect(sanitizePanelPayload(plain).data.translated_text).toBe('a < b & c');
    const other = { command: 'showTranslationGenerating' };
    expect(sanitizePanelPayload(other)).toBe(other);
    const err = { command: 'showSummary', data: { error: true, message: 'x' } };
    expect(sanitizePanelPayload(err).data).toEqual({ error: true, message: 'x' });
  });
});
