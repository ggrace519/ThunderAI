import { describe, it, expect, vi, afterEach } from 'vitest';
import { OpenAIComp } from '../js/api/openai_comp.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OpenAIComp.fetchModels', () => {
  it('returns an error object (not a rejection) when the request throws', async () => {
    // Regression: a thrown fetch used to reject with no .catch in the UI,
    // leaving the "Update models" spinner stuck and no error shown.
    global.fetch = vi.fn(() => Promise.reject(new Error('CORS / network blocked')));
    const client = new OpenAIComp({ host: 'https://api.example.test', use_v1: true });
    const out = await client.fetchModels();
    expect(out.ok).toBe(false);
    expect(out.is_exception).toBe(true);
    expect(out.error).toContain('CORS / network blocked');
  });

  it('returns ok:false with detail on a non-ok HTTP response', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => '{"error":{"message":"bad key"}}',
    }));
    const client = new OpenAIComp({ host: 'https://api.example.test', apiKey: 'k' });
    const out = await client.fetchModels();
    expect(out.ok).toBe(false);
    expect(out.error).toContain('bad key');
  });

  it('normalizes the standard { data: [...] } shape to an array', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: async () => ({ data: [{ id: 'm1' }, { id: 'm2' }] }),
    }));
    const client = new OpenAIComp({ host: 'https://api.example.test' });
    const out = await client.fetchModels();
    expect(out.ok).toBe(true);
    expect(out.response.map(m => m.id)).toEqual(['m1', 'm2']);
  });

  it('normalizes a bare array response to an array', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: async () => ([{ id: 'a' }]),
    }));
    const client = new OpenAIComp({ host: 'https://api.example.test' });
    const out = await client.fetchModels();
    expect(out.ok).toBe(true);
    expect(out.response).toEqual([{ id: 'a' }]);
  });

  it('falls back to an empty array on an unexpected shape (no crash downstream)', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: async () => ({ unexpected: true }),
    }));
    const client = new OpenAIComp({ host: 'https://api.example.test' });
    const out = await client.fetchModels();
    expect(out.ok).toBe(true);
    expect(out.response).toEqual([]);
  });

  it('sends an Authorization header only when an API key is set', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ data: [] }) }));

    const withKey = new OpenAIComp({ host: 'https://api.example.test', apiKey: 'secret', use_v1: true });
    await withKey.fetchModels();
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer secret');
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.example.test/v1/models');

    global.fetch.mockClear();
    const noKey = new OpenAIComp({ host: 'https://api.example.test', use_v1: false });
    await noKey.fetchModels();
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.example.test/models');
  });
});
