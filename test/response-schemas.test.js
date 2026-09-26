import { describe, it, expect } from 'vitest';
import {
  SPECIAL_PROMPT_SCHEMAS,
  getSpecialPromptSchema,
  toOpenAIResponsesFormat,
  toOpenAICompFormat,
  toOllamaFormat,
  toGeminiSchema,
  toAnthropicTools,
  toAnthropicOutputFormat,
  anthropicUsesForcedTool,
  extractStructuredText,
} from '../js/api/response-schemas.js';

describe('getSpecialPromptSchema', () => {
  it('maps the special prompts to their schemas', () => {
    expect(getSpecialPromptSchema('prompt_add_tags')).toBe(SPECIAL_PROMPT_SCHEMAS.prompt_add_tags);
    expect(getSpecialPromptSchema('prompt_spamfilter')).toBe(SPECIAL_PROMPT_SCHEMAS.prompt_spamfilter);
  });
  it('returns null for prompts without a schema', () => {
    expect(getSpecialPromptSchema('prompt_reply')).toBeNull();
    expect(getSpecialPromptSchema(undefined)).toBeNull();
  });
  it('schemas satisfy OpenAI strict-mode requirements', () => {
    for (const { schema } of Object.values(SPECIAL_PROMPT_SCHEMAS)) {
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required).toEqual(Object.keys(schema.properties));
    }
  });
});

describe('dialect adapters', () => {
  const rs = SPECIAL_PROMPT_SCHEMAS.prompt_spamfilter;

  it('OpenAI Responses: text.format json_schema', () => {
    const fmt = toOpenAIResponsesFormat(rs);
    expect(fmt.format.type).toBe('json_schema');
    expect(fmt.format.name).toBe('spam_verdict');
    expect(fmt.format.strict).toBe(true);
    expect(fmt.format.schema).toBe(rs.schema);
  });

  it('OpenAI-compatible: response_format json_schema', () => {
    const fmt = toOpenAICompFormat(rs);
    expect(fmt.type).toBe('json_schema');
    expect(fmt.json_schema.name).toBe('spam_verdict');
    expect(fmt.json_schema.strict).toBe(true);
    expect(fmt.json_schema.schema).toBe(rs.schema);
  });

  it('Ollama: the schema itself', () => {
    expect(toOllamaFormat(rs)).toBe(rs.schema);
  });

  it('Gemini: strips additionalProperties recursively', () => {
    const gem = toGeminiSchema({
      type: 'object',
      additionalProperties: false,
      properties: {
        nested: { type: 'object', additionalProperties: false, properties: { x: { type: 'string' } } },
        list: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {} } },
      },
      required: ['nested'],
    });
    expect(JSON.stringify(gem)).not.toContain('additionalProperties');
    expect(gem.properties.nested.properties.x.type).toBe('string');
    expect(gem.required).toEqual(['nested']);
  });

  it('Anthropic: forced tool use with the schema as input_schema', () => {
    const tools = toAnthropicTools(rs);
    expect(tools.tools).toHaveLength(1);
    expect(tools.tools[0].name).toBe('spam_verdict');
    expect(tools.tools[0].input_schema).toBe(rs.schema);
    expect(tools.tool_choice).toEqual({ type: 'tool', name: 'spam_verdict' });
  });

  it('Anthropic: native output_config.format json_schema', () => {
    expect(toAnthropicOutputFormat(rs)).toEqual({ type: 'json_schema', schema: rs.schema });
  });
});

describe('extractStructuredText', () => {
  it('OpenAI Responses: output message output_text', () => {
    const data = {
      output: [
        { type: 'reasoning', summary: [] },
        { type: 'message', content: [{ type: 'output_text', text: '{"spamValue":85,"explanation":"phishing"}' }] },
      ],
    };
    expect(extractStructuredText('chatgpt_api', data)).toBe('{"spamValue":85,"explanation":"phishing"}');
  });

  it('OpenAI-compatible: choices message content', () => {
    const data = { choices: [{ message: { content: '{"tags":["Work"]}' } }] };
    expect(extractStructuredText('openai_comp_api', data)).toBe('{"tags":["Work"]}');
  });

  it('Gemini: candidates content parts text', () => {
    const data = { candidates: [{ content: { parts: [{ text: '{"tags":["Invoices"]}' }] } }] };
    expect(extractStructuredText('google_gemini_api', data)).toBe('{"tags":["Invoices"]}');
  });

  it('Ollama: message content', () => {
    const data = { message: { role: 'assistant', content: '{"spamValue":10,"explanation":"newsletter"}' } };
    expect(extractStructuredText('ollama_api', data)).toBe('{"spamValue":10,"explanation":"newsletter"}');
  });

  it('Anthropic: tool_use input serialized to JSON', () => {
    const data = { content: [{ type: 'tool_use', name: 'spam_verdict', input: { spamValue: 95, explanation: 'scam' } }] };
    expect(JSON.parse(extractStructuredText('anthropic_api', data))).toEqual({ spamValue: 95, explanation: 'scam' });
  });

  it('Anthropic native: skips a leading thinking block and returns the text JSON', () => {
    const data = { content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"tags":["a"]}' }] };
    expect(extractStructuredText('anthropic_api', data)).toBe('{"tags":["a"]}');
  });

  it('Anthropic: falls back to a text block when no tool_use is present', () => {
    const data = { content: [{ type: 'text', text: '{"spamValue":5}' }] };
    expect(extractStructuredText('anthropic_api', data)).toBe('{"spamValue":5}');
  });

  it('returns empty string on malformed or unknown data', () => {
    expect(extractStructuredText('chatgpt_api', {})).toBe('');
    expect(extractStructuredText('ollama_api', null)).toBe('');
    expect(extractStructuredText('nope_api', { any: 'thing' })).toBe('');
  });

  it('round-trips with the legacy parsers downstream', () => {
    // The structured text feeds the existing extractJsonObject-based
    // parsing (getTagsFromResponse, spam verdict decode) — plain JSON in,
    // plain JSON out means those parsers hit their happy path.
    const text = extractStructuredText('openai_comp_api', { choices: [{ message: { content: '{"tags":["A","B"]}' } }] });
    expect(JSON.parse(text).tags).toEqual(['A', 'B']);
  });
});

describe('anthropicUsesForcedTool', () => {
  it('keeps forced tool use only for models that predate native structured outputs', () => {
    for (const m of ['claude-sonnet-4-6', 'claude-sonnet-4-5-20250929', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-opus-4-20250514', 'claude-3-5-haiku-latest']) {
      expect(anthropicUsesForcedTool(m)).toBe(true);
    }
  });

  it('uses the native dialect for supported and unknown (newer) models', () => {
    for (const m of ['claude-opus-5', 'claude-opus-5-5', 'claude-fable-5-1', 'claude-sonnet-5', 'claude-opus-4-8', 'claude-haiku-4-5', 'claude-opus-4-5', 'claude-opus-4-1', 'claude-future-9', '']) {
      expect(anthropicUsesForcedTool(m)).toBe(false);
    }
  });
});
