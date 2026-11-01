import { describe, it, expect, vi, afterEach } from 'vitest';
import { generationRetryConfig, TA_NONSTREAM_TIMEOUT_MS } from '../js/api/fetch-utils.js';
import { RETRY_DEFAULTS } from '../js/api/api-retry.js';
import { getSpecialPromptSchema } from '../js/api/response-schemas.js';
import { Anthropic } from '../js/api/anthropic.js';
import { Ollama } from '../js/api/ollama.js';

// A mock fetch that never resolves on its own but rejects with an AbortError
// when its signal is aborted — mirroring how the real fetch reacts to abort().
// It stands for a server that has not sent the response headers yet.
function abortAwareFetch() {
  return vi.fn((_url, opts) => new Promise((_resolve, reject) => {
    opts.signal.addEventListener('abort', () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      reject(err);
    });
  }));
}

const messages = [{ role: 'user', content: 'hi' }];
// One attempt: the header timeout, not the retry schedule, is under test.
const noRetry = { maxRetries: 0 };
const schema = getSpecialPromptSchema('prompt_spamfilter');

describe('generationRetryConfig', () => {
  it('leaves streaming requests on the provider default', () => {
    expect(generationRetryConfig(true, schema)).toEqual({});
    expect(generationRetryConfig(true, null)).toEqual({});
  });

  it('leaves a plain non-streaming request on the provider default (upstream behavior)', () => {
    expect(generationRetryConfig(false, null)).toEqual({});
  });

  it('gives a non-streaming structured request the long header deadline', () => {
    expect(generationRetryConfig(false, schema)).toEqual({ timeoutMs: TA_NONSTREAM_TIMEOUT_MS });
    expect(TA_NONSTREAM_TIMEOUT_MS).toBeGreaterThan(RETRY_DEFAULTS.timeoutMs);
  });
});

// cf2a727c: a non-streaming generation (the fork's structured-output path)
// sends its headers only once the whole reply is written, so the per-attempt
// header timeout of fetchWithRetry() must not cut a slow model off.
describe('generation header deadline through fetchWithRetry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('does not cut off a slow non-streaming (structured) generation at the 60 s default', async () => {
    vi.useFakeTimers();
    global.fetch = abortAwareFetch();
    const client = new Anthropic({ apiKey: 'k', version: '2023-06-01', model: 'claude-opus-5-5', stream: false, response_schema: schema });
    let settled = false;
    const pending = client.fetchResponse(messages, noRetry).then((r) => { settled = true; return r; });
    await vi.advanceTimersByTimeAsync(RETRY_DEFAULTS.timeoutMs * 2);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(TA_NONSTREAM_TIMEOUT_MS);
    const out = await pending;
    expect(out.is_exception).toBe(true);
    expect(out.error).toContain('timed out');
  });

  it('keeps the provider default for a streaming request that sends no headers', async () => {
    vi.useFakeTimers();
    global.fetch = abortAwareFetch();
    const client = new Anthropic({ apiKey: 'k', version: '2023-06-01', model: 'claude-opus-5-5', stream: true });
    const pending = client.fetchResponse(messages, noRetry);
    await vi.advanceTimersByTimeAsync(RETRY_DEFAULTS.timeoutMs + 1);
    const out = await pending;
    expect(out.is_exception).toBe(true);
    expect(out.error).toContain('timed out');
  });

  it("lets an explicit caller timeout win (the connection test's)", async () => {
    vi.useFakeTimers();
    global.fetch = abortAwareFetch();
    const client = new Ollama({ host: 'http://127.0.0.1:11434', model: 'm', stream: false, response_schema: schema });
    const pending = client.fetchResponse(messages, { ...noRetry, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1001);
    const out = await pending;
    expect(out.is_exception).toBe(true);
  });
});
