/*
 *  ThunderAI [https://micz.it/thunderbird-addon-thunderai/]
 *  Copyright (C) 2024 - 2026  Mic (m@micz.it)

 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.

 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.

 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// Structured outputs for background (special) commands.
//
// The special prompts (auto tagging, spam filter) ask the model to "reply
// in JSON" and then scrape the first {...} out of free text — which breaks
// on markdown fences, thinking-model preambles and chatty models. Every
// supported provider now offers schema-constrained decoding, so when a
// schema is set the response IS the object. This module holds the schemas
// (one canonical JSON-Schema shape) plus the per-provider dialect adapters
// and the per-provider extraction of the resulting JSON text from a
// non-streaming response.
//
// Everything here is pure (no browser.* usage) so it is unit-testable.

// Canonical JSON Schemas. additionalProperties:false + all properties
// required is what OpenAI strict mode demands; the other dialects accept
// or ignore it (Gemini gets a sanitized copy).
export const SPECIAL_PROMPT_SCHEMAS = {
    prompt_add_tags: {
        name: 'email_tags',
        schema: {
            type: 'object',
            properties: {
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Tags describing the email content',
                },
            },
            required: ['tags'],
            additionalProperties: false,
        },
    },
    prompt_spamfilter: {
        name: 'spam_verdict',
        schema: {
            type: 'object',
            properties: {
                spamValue: {
                    type: 'integer',
                    description: 'Spam likelihood from 0 (legitimate) to 100 (certainly spam)',
                },
                explanation: {
                    type: 'string',
                    description: 'Short explanation of the verdict',
                },
            },
            required: ['spamValue', 'explanation'],
            additionalProperties: false,
        },
    },
};

// The schema to enforce for a given special prompt, or null.
export function getSpecialPromptSchema(prompt_id) {
    return SPECIAL_PROMPT_SCHEMAS[prompt_id] ?? null;
}

// ---- Provider dialect adapters -------------------------------------------

// OpenAI Responses API: request_body.text
export function toOpenAIResponsesFormat(response_schema) {
    return {
        format: {
            type: 'json_schema',
            name: response_schema.name,
            strict: true,
            schema: response_schema.schema,
        },
    };
}

// OpenAI-compatible chat/completions: request_body.response_format
export function toOpenAICompFormat(response_schema) {
    return {
        type: 'json_schema',
        json_schema: {
            name: response_schema.name,
            strict: true,
            schema: response_schema.schema,
        },
    };
}

// Ollama: request_body.format takes the JSON schema directly.
export function toOllamaFormat(response_schema) {
    return response_schema.schema;
}

// Gemini: generationConfig.responseSchema takes an OpenAPI-style subset;
// unsupported keywords like additionalProperties are rejected, so strip
// them recursively.
export function toGeminiSchema(schema) {
    if (Array.isArray(schema)) {
        return schema.map(toGeminiSchema);
    }
    if (schema === null || typeof schema !== 'object') {
        return schema;
    }
    const out = {};
    for (const [key, value] of Object.entries(schema)) {
        if (key === 'additionalProperties' || key === '$schema') {
            continue;
        }
        out[key] = toGeminiSchema(value);
    }
    return out;
}

// Anthropic has two dialects. Native structured outputs
// (output_config.format) work alongside thinking and effort, and are the only
// option on models that reject forced tool_choice (Claude Fable 5.1, Mythos
// 5.1, Opus 5.5) or cannot turn thinking off (Fable 5). The older models below
// predate native support, so they keep forced tool use with thinking off.
// Every model not listed, including ones released later, takes the native
// dialect. Source: Anthropic structured-outputs model list, 2026-09.
const ANTHROPIC_FORCED_TOOL_MODEL_PREFIXES = [
    'claude-3',
    'claude-sonnet-4',          // Sonnet 4, 4.5 and 4.6
    'claude-opus-4-2',          // dated Opus 4 ids (claude-opus-4-2025...)
    'claude-opus-4-6',
    'claude-opus-4-7',
];

export function anthropicUsesForcedTool(model) {
    const id = String(model || '').trim().toLowerCase();
    return ANTHROPIC_FORCED_TOOL_MODEL_PREFIXES.some(prefix => id.startsWith(prefix));
}

// Anthropic native dialect: the value of output_config.format. The reply
// arrives as a text block holding the JSON object.
export function toAnthropicOutputFormat(response_schema) {
    return { type: 'json_schema', schema: response_schema.schema };
}

// Anthropic legacy dialect: forced tool use; the model must "call" a tool
// whose input_schema is our schema, and the structured result arrives as the
// tool_use block's input.
export function toAnthropicTools(response_schema) {
    return {
        tools: [{
            name: response_schema.name,
            description: 'Return the structured result of the analysis.',
            input_schema: response_schema.schema,
        }],
        tool_choice: { type: 'tool', name: response_schema.name },
    };
}

// ---- Non-streaming response extraction ------------------------------------

// Extract the structured JSON text from a parsed non-streaming response.
// Returns '' when the expected shape is missing (caller falls back to the
// legacy free-text parsing, which then reports its own error).
export function extractStructuredText(llm, responseData) {
    if (responseData === null || typeof responseData !== 'object') {
        return '';
    }
    switch (llm) {
        case 'chatgpt_api': {
            const msgOutput = responseData.output?.find(o => o.type === 'message');
            return msgOutput?.content?.find(c => c.type === 'output_text')?.text ?? '';
        }
        case 'openai_comp_api':
            return responseData.choices?.[0]?.message?.content ?? '';
        case 'google_gemini_api': {
            // Parts flagged thought: true carry the model's reasoning (returned
            // because includeThoughts is requested); the answer is the rest.
            const parts = responseData.candidates?.[0]?.content?.parts ?? [];
            return parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('');
        }
        case 'ollama_api':
            return responseData.message?.content ?? '';
        case 'anthropic_api': {
            const toolUse = responseData.content?.find(c => c.type === 'tool_use');
            if (toolUse && toolUse.input !== undefined) {
                return JSON.stringify(toolUse.input);
            }
            return responseData.content?.find(c => c.type === 'text')?.text ?? '';
        }
        default:
            return '';
    }
}
