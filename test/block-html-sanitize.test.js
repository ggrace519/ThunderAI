// @vitest-environment happy-dom
// Model HTML reaches the message-pane summary and translation panels through
// sanitizeBlockHtml() (called by _sanitizePanelPayload() in mzta-background.js,
// whose payload routing upstream's own suite covers). These pin the two
// fork-reported cases: a <style> that hides the ThunderAI panels, and unsafe
// attributes / hrefs.
import { describe, it, expect } from 'vitest';
import { sanitizeBlockHtml } from '../js/mzta-richtext.js';

function render(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

describe('sanitizeBlockHtml for the inline panels', () => {
  it('neutralizes a <style> that would hide the ThunderAI panels', () => {
    const div = render(sanitizeBlockHtml(
      '<p>Hello</p><style>#mzta-container{display:none!important}</style><img src=x onerror="alert(1)">'));
    expect(div.querySelector('style, img, [onerror]')).toBeNull();
    expect(div.querySelector('p').textContent).toBe('Hello');
  });

  it('keeps safe formatting and links, drops attributes and unsafe hrefs', () => {
    const div = render(sanitizeBlockHtml(
      '<ul><li><b style="color:red">a</b> <a href="https://ok.test">ok</a> <a href="javascript:alert(1)">bad</a></li></ul>'));
    expect(div.querySelector('ul li b').getAttribute('style')).toBeNull();
    const links = div.querySelectorAll('a');
    expect(links[0].getAttribute('href')).toBe('https://ok.test');
    expect(links[1].getAttribute('href')).toBeNull();
  });
});
