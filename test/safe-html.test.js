// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// mzta-safe-html.js is a classic content script (no exports): evaluate it and
// hand back the global it defines.
let appendSafe;
beforeAll(() => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../js/mzta-safe-html.js'), 'utf8');
  appendSafe = new Function(`${src}\nreturn mztaAppendSafeAlertHtml;`)();
});

function render(html) {
  const div = document.createElement('div');
  appendSafe(div, html);
  return div;
}

describe('mztaAppendSafeAlertHtml', () => {
  it('keeps the allowed formatting tags', () => {
    expect(render('Too long.<br><br>Reduce <b>Max prompt length</b>').innerHTML)
      .toBe('Too long.<br><br>Reduce <b>Max prompt length</b>');
  });

  it('drops attributes from allowed tags', () => {
    expect(render('<b onclick="x()" style="color:red">bold</b>').innerHTML).toBe('<b>bold</b>');
  });

  it('reduces disallowed elements to their text', () => {
    const div = render('Error: <img src=x onerror="alert(1)"><a href="https://evil">click</a><script>bad()</script>');
    expect(div.querySelector('img, a, script')).toBeNull();
    expect(div.textContent).toBe('Error: clickbad()');
  });

  it('flattens allowed tags nested inside disallowed ones', () => {
    const div = render('<div><b>x</b></div>');
    expect(div.innerHTML).toBe('x');
  });

  it('renders plain text and empty input unchanged', () => {
    expect(render('plain message').textContent).toBe('plain message');
    expect(render(undefined).childNodes.length).toBe(0);
  });
});
