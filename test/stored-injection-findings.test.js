// The prompt-injection guard's findings must survive the per-message cache, so the
// warning banner is shown again when a stored summary or translation is reopened [#19].
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeBrowserStub } from './helpers/browser-stub.js';

// An in-memory storage.local with the real get/set/remove semantics the stores use.
function memoryArea() {
  const data = {};
  return {
    data,
    get: async (key) => {
      if (key === null) return structuredClone(data);
      const keys = typeof key === 'string' ? [key] : Object.keys(key);
      return Object.fromEntries(keys.filter(k => k in data).map(k => [k, structuredClone(data[k])]));
    },
    set: async (obj) => { Object.assign(data, structuredClone(obj)); },
    remove: async (key) => { delete data[key]; },
  };
}

const FINDINGS = [{ id: 'override_attempt', excerpt: 'Ignore all previous instructions' }];
let local;

beforeEach(() => {
  local = memoryArea();
  const stub = makeBrowserStub();
  stub.storage.local = local;
  vi.stubGlobal('browser', stub);
  vi.stubGlobal('messenger', stub);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function stores() {
  const { taSummaryStore } = await import('../js/mzta-summarystore.js');
  const { taTranslationStore } = await import('../js/mzta-translationstore.js');
  return { summary: new taSummaryStore(), translation: new taTranslationStore() };
}

describe('stored injection findings', () => {
  it('a summary keeps its findings through save and load', async () => {
    const { summary } = await stores();
    await summary.saveSummary({ summary: 's', summary_html: '<p>s</p>', summary_date: new Date(), injection_findings: FINDINGS }, '<a@x>');
    expect((await summary.loadSummary('<a@x>')).injection_findings).toEqual(FINDINGS);
  });

  it('a translation keeps its findings through save and load', async () => {
    const { translation } = await stores();
    await translation.saveTranslation({ translated_text: 't', lang: 'German', injection_findings: FINDINGS }, '<b@x>');
    expect((await translation.loadTranslation('<b@x>')).injection_findings).toEqual(FINDINGS);
  });

  it('clean mail stores and loads no findings field (upstream record shape)', async () => {
    const { summary, translation } = await stores();
    await summary.saveSummary({ summary: 's', summary_date: new Date(), injection_findings: [] }, '<c@x>');
    await translation.saveTranslation({ translated_text: 't', lang: 'German' }, '<c@x>');
    const record = Object.values(local.data)[0];
    expect('injection_findings' in record.summary).toBe(false);
    expect('injection_findings' in record.translation).toBe(false);
    expect('injection_findings' in await summary.loadSummary('<c@x>')).toBe(false);
    expect('injection_findings' in await translation.loadTranslation('<c@x>')).toBe(false);
  });
});
