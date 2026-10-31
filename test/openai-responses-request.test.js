import { describe, it, expect, vi, afterEach } from 'vitest';
import { OpenAI } from '../js/api/openai_responses.js';
import { getSpecialPromptSchema } from '../js/api/response-schemas.js';

afterEach(() => {
  vi.restoreAllMocks();
});

const schema = getSpecialPromptSchema('prompt_add_tags');

async function sentBody(config) {
  global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
  const client = new OpenAI({ apiKey: 'k', model: 'gpt-5', ...config });
  await client.fetchResponse([{ role: 'user', content: 'hi' }], null, { maxRetries: 0 });
  return JSON.parse(global.fetch.mock.calls[0][1].body);
}

describe('OpenAI Responses structured output request', () => {
  it("replaces the user's output format with the command schema but keeps verbosity", async () => {
    const body = await sentBody({
      response_schema: schema,
      verbosity: 'low',
      text_format: 'json_object',
    });
    expect(body.text).toEqual({
      verbosity: 'low',
      format: { type: 'json_schema', name: schema.name, strict: true, schema: schema.schema },
    });
  });

  it("leaves the user's output format alone without a schema", async () => {
    const body = await sentBody({ text_format: 'json_object' });
    expect(body.text).toEqual({ format: { type: 'json_object' } });
  });
});
