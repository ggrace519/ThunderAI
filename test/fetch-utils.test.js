import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchWithTimeout, generationTimeoutMs, TA_DEFAULT_TIMEOUT_MS, TA_NONSTREAM_TIMEOUT_MS } from '../js/api/fetch-utils.js';
import { Ollama } from '../js/api/ollama.js';

// A mock fetch that resolves immediately with the given value, ignoring the signal.
function resolvingFetch(value) {
  return vi.fn((_url, _opts) => Promise.resolve(value));
}

// A mock fetch that never resolves on its own but rejects with an AbortError
// when its signal is aborted — mirroring how the real fetch reacts to abort().
function abortAwareFetch() {
  return vi.fn((_url, opts) => new Promise((_resolve, reject) => {
    opts.signal.addEventListener('abort', () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      reject(err);
    });
  }));
}

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns the response when fetch resolves before the timeout', async () => {
    const fakeResponse = { ok: true, status: 200 };
    global.fetch = resolvingFetch(fakeResponse);
    const res = await fetchWithTimeout('https://example.test', { method: 'GET' });
    expect(res).toBe(fakeResponse);
  });

  it('passes options through and attaches an AbortSignal', async () => {
    global.fetch = resolvingFetch({ ok: true });
    await fetchWithTimeout('https://example.test', { method: 'POST', body: 'x' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://example.test');
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe('x');
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it('throws a timeout error when headers do not arrive in time', async () => {
    vi.useFakeTimers();
    global.fetch = abortAwareFetch();
    const promise = fetchWithTimeout('https://slow.test', {}, 1000);
    // Prevent an unhandled rejection while we advance the clock.
    const assertion = expect(promise).rejects.toThrow('Request timed out after 1000 ms');
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it('re-throws non-timeout errors unchanged', async () => {
    const networkErr = new Error('network down');
    global.fetch = vi.fn(() => Promise.reject(networkErr));
    await expect(fetchWithTimeout('https://example.test')).rejects.toBe(networkErr);
  });

  it('exposes a sane default timeout', () => {
    expect(TA_DEFAULT_TIMEOUT_MS).toBeGreaterThan(0);
    expect(typeof TA_DEFAULT_TIMEOUT_MS).toBe('number');
  });

  it('does not leave the abort timer pending after a successful fetch', async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    global.fetch = resolvingFetch({ ok: true });
    await fetchWithTimeout('https://example.test', {}, 5000);
    expect(clearSpy).toHaveBeenCalled();
  });
});

describe('generation header deadline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('allows longer for non-streaming requests', () => {
    expect(generationTimeoutMs(true)).toBe(TA_DEFAULT_TIMEOUT_MS);
    expect(generationTimeoutMs(false)).toBe(TA_NONSTREAM_TIMEOUT_MS);
    expect(TA_NONSTREAM_TIMEOUT_MS).toBeGreaterThan(TA_DEFAULT_TIMEOUT_MS);
  });

  it('does not cut off a slow non-streaming (structured) generation at 30s', async () => {
    vi.useFakeTimers();
    global.fetch = abortAwareFetch();
    const client = new Ollama({ host: 'http://127.0.0.1:11434', model: 'm', stream: false });
    let settled = false;
    const pending = client.fetchResponse([{ role: 'user', content: 'hi' }]).then((r) => { settled = true; return r; });
    await vi.advanceTimersByTimeAsync(45000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(TA_NONSTREAM_TIMEOUT_MS);
    const out = await pending;
    expect(out.is_exception).toBe(true);
    expect(out.error).toContain('timed out');
  });

  it('still times out a streaming request that sends no headers', async () => {
    vi.useFakeTimers();
    global.fetch = abortAwareFetch();
    const client = new Ollama({ host: 'http://127.0.0.1:11434', model: 'm', stream: true });
    const pending = client.fetchResponse([{ role: 'user', content: 'hi' }]);
    await vi.advanceTimersByTimeAsync(TA_DEFAULT_TIMEOUT_MS + 1);
    const out = await pending;
    expect(out.is_exception).toBe(true);
  });
});
