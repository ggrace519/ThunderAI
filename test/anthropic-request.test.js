import { describe, it, expect, vi, afterEach } from 'vitest';
import { Anthropic } from '../js/api/anthropic.js';
import { getSpecialPromptSchema } from '../js/api/response-schemas.js';

afterEach(() => {
  vi.restoreAllMocks();
});

const schema = getSpecialPromptSchema('prompt_spamfilter');

// Builds the request through the real client and returns the parsed body.
async function sentBody(config) {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
  const client = new Anthropic({ apiKey: 'k', version: '2023-06-01', ...config });
  await client.fetchResponse([{ role: 'user', content: 'hi' }]);
  return JSON.parse(global.fetch.mock.calls[0][1].body);
}

describe('Anthropic structured output request', () => {
  it('uses output_config.format and never forced tool_choice on models that reject it', async () => {
    for (const model of ['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5']) {
      const body = await sentBody({ model, response_schema: schema });
      expect(body.output_config.format).toEqual({ type: 'json_schema', schema: schema.schema });
      expect(body.tool_choice).toBeUndefined();
      expect(body.tools).toBeUndefined();
    }
  });

  it('keeps the effort setting alongside the native format', async () => {
    const body = await sentBody({ model: 'claude-opus-5', effort: 'low', response_schema: schema });
    expect(body.output_config).toEqual({ effort: 'low', format: { type: 'json_schema', schema: schema.schema } });
  });

  it('does not send thinking at all on a model where it cannot be disabled', async () => {
    const body = await sentBody({ model: 'claude-fable-5-1', response_schema: schema });
    expect(body.thinking).toBeUndefined();
  });

  it('uses forced tool use with thinking off on older models', async () => {
    const body = await sentBody({ model: 'claude-sonnet-4-6', extended_thinking_budget: 2048, response_schema: schema });
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'spam_verdict' });
    expect(body.tools[0].input_schema).toEqual(schema.schema);
    expect(body.thinking).toBeUndefined();
    expect(body.output_config?.format).toBeUndefined();
  });

  it('adds neither format nor tools without a schema', async () => {
    const body = await sentBody({ model: 'claude-opus-5' });
    expect(body.output_config?.format).toBeUndefined();
    expect(body.tools).toBeUndefined();
  });

  it('does not request thinking with the native format either', async () => {
    const body = await sentBody({ model: 'claude-haiku-4-5', temperature: '0.2', extended_thinking_budget: 2048, response_schema: schema });
    expect(body.thinking).toBeUndefined();
    expect(body.temperature).toBe(0.2);
    expect(body.output_config.format.type).toBe('json_schema');
  });
});

describe('Anthropic thinking and sampling', () => {
  it('drops temperature when extended thinking is enabled', async () => {
    const body = await sentBody({ model: 'claude-haiku-4-5', temperature: '0.2', extended_thinking_budget: 2048 });
    expect(body.thinking).toEqual({ type: 'enabled', budget_tokens: 2048 });
    expect(body.temperature).toBeUndefined();
  });

  it('keeps temperature when thinking is off', async () => {
    const body = await sentBody({ model: 'claude-haiku-4-5', temperature: '0.2' });
    expect(body.temperature).toBe(0.2);
  });

  it('never sends thinking disabled to Opus 5.5', async () => {
    const body = await sentBody({ model: 'claude-opus-5-5' });
    expect(body.thinking).toBeUndefined();
  });

  it('still disables thinking on Opus 5 when no budget is set', async () => {
    const body = await sentBody({ model: 'claude-opus-5' });
    expect(body.thinking).toEqual({ type: 'disabled' });
  });

  it('always sends an explicitly chosen effort level (upstream 5.0.4, #936)', async () => {
    // Defaults differ per model (Opus 5.5: medium) and can change, so a level the
    // user picked is sent even when it looks like the API default.
    const opus55 = await sentBody({ model: 'claude-opus-5-5', effort: 'high' });
    expect(opus55.output_config).toEqual({ effort: 'high' });
    const opus55Medium = await sentBody({ model: 'claude-opus-5-5', effort: 'medium' });
    expect(opus55Medium.output_config).toEqual({ effort: 'medium' });
    // Only the empty "Default (decided by the API)" option leaves the field out.
    const opus55Default = await sentBody({ model: 'claude-opus-5-5', effort: '' });
    expect(opus55Default.output_config).toBeUndefined();
  });
});

describe('Anthropic 400 retry with structured output', () => {
  it('keeps the schema format when the retry drops a rejected effort', async () => {
    const rejected = new Response(JSON.stringify({ error: { message: 'effort: unsupported value for this model' } }), { status: 400 });
    global.fetch = vi.fn()
      .mockResolvedValueOnce(rejected)
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const client = new Anthropic({ apiKey: 'k', version: '2023-06-01', model: 'claude-opus-5-5', effort: 'max', response_schema: schema });
    const out = await client.fetchResponse([{ role: 'user', content: 'hi' }], { maxRetries: 0 });
    expect(out.ok).toBe(true);
    const first = JSON.parse(global.fetch.mock.calls[0][1].body);
    const retry = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(first.output_config).toEqual({ effort: 'max', format: { type: 'json_schema', schema: schema.schema } });
    expect(retry.output_config).toEqual({ format: { type: 'json_schema', schema: schema.schema } });
  });

  it('drops the format too when the 400 names it', async () => {
    const rejected = new Response(JSON.stringify({ error: { message: 'output_config.format: not supported' } }), { status: 400 });
    global.fetch = vi.fn()
      .mockResolvedValueOnce(rejected)
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const client = new Anthropic({ apiKey: 'k', version: '2023-06-01', model: 'claude-opus-5-5', effort: 'max', response_schema: schema });
    await client.fetchResponse([{ role: 'user', content: 'hi' }], { maxRetries: 0 });
    const retry = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(retry.output_config).toBeUndefined();
  });
});
