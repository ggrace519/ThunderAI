// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The spam badge in the message display pane picks its layout from a
// ResizeObserver: "branding + ⋯ menu" when the explanation fits, "▼" when it
// doesn't [#13]. happy-dom has no layout engine, so the widths are faked below
// with the one geometry that matters: the explanation fits beside the narrow ▼
// but not beside the wide branding + menu. The old code flipped forever there.

const TEXT_WIDTH = 300;
const WIDE_EXTRAS = 150;   // "Antispam by ThunderAI" + ⋯ menu
const NARROW_EXTRAS = 10;  // ▼
let paneWidth = 0;

let listener;
let observers;

function badgeParts() {
  const badge = document.getElementById('mzta-toolbar-spam');
  const [score, text, chevron, branding, menu] = badge.firstChild.children;
  return { badge, score, text, chevron, branding, menu };
}

function isShown(el) {
  return el.style.display !== 'none';
}

// clientWidth of the explanation: the pane minus whatever else shares its row.
function fakeLayout() {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get() { return this.dataset.fakeText ? TEXT_WIDTH : 0; },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      if (!this.dataset.fakeText) return 0;
      const { chevron, branding } = badgeParts();
      let taken = 0;
      if (isShown(branding)) taken += WIDE_EXTRAS;
      if (isShown(chevron)) taken += NARROW_EXTRAS;
      return paneWidth - taken;
    },
  });
}

function showSpamReport() {
  listener({
    command: 'showSpamReport',
    data: { spamValue: 10, SpamThreshold: 50, explanation: 'x', headerMessageId: 'id' },
  });
  badgeParts().text.dataset.fakeText = '1';
}

// Deliver a resize notification to the live observer, as the browser would.
function resize(width, height = 20) {
  const live = observers.filter(o => !o.disconnected);
  for (const o of live) o.cb([{ contentRect: { width, height } }]);
}

beforeAll(() => {
  globalThis.browser = {
    runtime: {
      onMessage: { addListener: f => { listener = f; } },
      sendMessage: () => Promise.resolve(),
      getURL: p => p,
    },
    i18n: { getMessage: k => k },
  };
  globalThis.requestAnimationFrame = cb => cb();
  globalThis.ResizeObserver = class {
    constructor(cb) { this.cb = cb; this.disconnected = false; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  };
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../js/mzta-compose-script.js'), 'utf8');
  new Function(src)();
  fakeLayout();
});

beforeEach(() => {
  document.body.innerHTML = '';
  observers = [];
  // Inside the band that used to flip: 300 fits in 311 - 10, not in 311 - 150.
  paneWidth = TEXT_WIDTH + NARROW_EXTRAS + 1;
});

describe('spam badge layout', () => {
  it('shows the chevron when the text only fits beside it', () => {
    showSpamReport();
    resize(paneWidth);
    const { chevron, branding, menu } = badgeParts();
    expect(isShown(chevron)).toBe(true);
    expect(isShown(branding)).toBe(false);
    expect(isShown(menu)).toBe(false);
  });

  it('gives the same answer whichever layout it starts from', () => {
    showSpamReport();
    const { chevron, branding } = badgeParts();
    // Start from the chevron layout, then from the branding layout: the old code
    // measured the current layout and answered differently each time.
    let width = paneWidth;
    for (const start of ['chevron', 'branding', 'chevron', 'branding']) {
      chevron.style.display = start === 'chevron' ? 'inline' : 'none';
      branding.style.display = start === 'branding' ? '' : 'none';
      resize(width += 0.1); // a new width, so the observer re-decides
      expect(isShown(chevron)).toBe(true);
      expect(isShown(branding)).toBe(false);
    }
  });

  it('ignores height-only changes', () => {
    showSpamReport();
    resize(paneWidth, 20);
    const { chevron } = badgeParts();
    chevron.style.display = 'table';
    resize(paneWidth, 25);
    expect(chevron.style.display).toBe('table');
  });

  it('shows branding and menu when there is room for them', () => {
    paneWidth = TEXT_WIDTH + WIDE_EXTRAS;
    showSpamReport();
    resize(paneWidth);
    const { chevron, branding, menu } = badgeParts();
    expect(isShown(chevron)).toBe(false);
    expect(isShown(branding)).toBe(true);
    expect(isShown(menu)).toBe(true);
  });

  it('disconnects the replaced badge observer', () => {
    showSpamReport();
    showSpamReport();
    expect(observers).toHaveLength(2);
    expect(observers.filter(o => !o.disconnected)).toHaveLength(1);
  });

  it('disconnects the observer when the report is removed', () => {
    showSpamReport();
    listener({ command: 'showSpamCheckInProgress' });
    expect(observers.every(o => o.disconnected)).toBe(true);
  });
});
