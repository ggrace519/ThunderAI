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
});
