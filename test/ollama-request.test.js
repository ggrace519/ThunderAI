import { describe, it, expect, vi, afterEach } from 'vitest';
import { Ollama } from '../js/api/ollama.js';

afterEach(() => {
  vi.restoreAllMocks();
});

async function sentBody(config) {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
  const client = new Ollama({ host: 'http://127.0.0.1:11434', model: 'm', ...config });
  await client.fetchResponse([{ role: 'user', content: 'hi' }]);
  return JSON.parse(global.fetch.mock.calls[0][1].body);
}

describe('Ollama request options', () => {
  it('sends num_ctx and temperature together', async () => {
    const body = await sentBody({ num_ctx: 8192, temperature: '0.3' });
    expect(body.options).toEqual({ num_ctx: 8192, temperature: 0.3 });
  });

  it('sends only what is set, and no options key when nothing is', async () => {
    expect((await sentBody({ num_ctx: 4096 })).options).toEqual({ num_ctx: 4096 });
    expect((await sentBody({ temperature: '0.7' })).options).toEqual({ temperature: 0.7 });
    expect((await sentBody({})).options).toBeUndefined();
  });
});
