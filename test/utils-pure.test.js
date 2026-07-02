import { describe, it, expect } from 'vitest';
import {
  cleanupNewlines,
  convertNewlinesToBr,
  convertNewlinesToParagraphs,
  normalizeStringList,
  sanitizeHtml,
  stripHtmlKeepLines,
  checkIfTagLabelExists,
  checkAPIIntegration,
  hasSpecificIntegration,
  getConnectionType,
  isAPIKeyValue,
  extractJsonObject,
  sanitizeChatGPTModelData,
  getLanguageDisplayName,
} from '../js/mzta-utils.js';

describe('cleanupNewlines', () => {
  it('normalizes CRLF, collapses blank lines and trims', () => {
    expect(cleanupNewlines('a\r\n\r\n\r\nb')).toBe('a\nb');
  });
  it('collapses runs of spaces/tabs and trailing space before newline', () => {
    expect(cleanupNewlines('a   \t b')).toBe('a b');
    expect(cleanupNewlines('a \t\nb')).toBe('a\nb');
  });
  it('replaces &nbsp; with a space', () => {
    expect(cleanupNewlines('a&nbsp;b')).toBe('a b');
  });
});

describe('convertNewlinesToBr', () => {
  it('converts newlines to <br>', () => {
    expect(convertNewlinesToBr('a\nb')).toBe('a<br>b');
    expect(convertNewlinesToBr('a\r\nb')).toBe('a<br>b');
  });
});

describe('convertNewlinesToParagraphs', () => {
  it('wraps each line in a <p>', () => {
    expect(convertNewlinesToParagraphs('a\nb')).toBe('<p>a</p><p>b</p>');
  });
});

describe('normalizeStringList', () => {
  it('dedupes, lowercases, sorts and joins with comma by default', () => {
    expect(normalizeStringList('B, a, b')).toBe('a, b');
  });
  it('splits on commas and newlines', () => {
    expect(normalizeStringList('a\nb,c')).toBe('a, b, c');
  });
  it('returns newline-joined for returnType 1 and array for returnType 2', () => {
    expect(normalizeStringList('b,a', 1)).toBe('a\nb');
    expect(normalizeStringList('b,a', 2)).toEqual(['a', 'b']);
  });
});

describe('sanitizeHtml', () => {
  it('strips non-br tags but keeps <br>', () => {
    expect(sanitizeHtml('<b>hi</b><br>there')).toBe('hi<br>there');
  });
});

describe('stripHtmlKeepLines', () => {
  it('converts <br> and </p> to newlines and drops other tags', () => {
    expect(stripHtmlKeepLines('<p>one</p><p>two</p>')).toBe('one\ntwo');
    expect(stripHtmlKeepLines('a<br>b')).toBe('a\nb');
  });
});

describe('checkIfTagLabelExists', () => {
  const tags = { k1: { tag: 'Work' }, k2: { tag: 'Personal' } };
  it('matches case-insensitively', () => {
    expect(checkIfTagLabelExists('work', tags)).toBe(true);
    expect(checkIfTagLabelExists('WORK', tags)).toBe(true);
  });
  it('returns false when absent', () => {
    expect(checkIfTagLabelExists('missing', tags)).toBe(false);
  });
});

describe('checkAPIIntegration', () => {
  it('is true for any non chatgpt_web connection', () => {
    expect(checkAPIIntegration('anthropic_api', false, '')).toBe(true);
  });
  it('for chatgpt_web requires a specific integration', () => {
    expect(checkAPIIntegration('chatgpt_web', false, '')).toBe(false);
    expect(checkAPIIntegration('chatgpt_web', true, 'openai_comp_api')).toBe(true);
    expect(checkAPIIntegration('chatgpt_web', true, '')).toBe(false);
  });
});

describe('hasSpecificIntegration', () => {
  it('requires use flag and a non-empty conntype', () => {
    expect(hasSpecificIntegration(true, 'openai_comp_api')).toBe(true);
    expect(hasSpecificIntegration(false, 'openai_comp_api')).toBe(false);
    expect(hasSpecificIntegration(true, '')).toBe(false);
    expect(hasSpecificIntegration(true, null)).toBe(false);
  });
});

describe('getConnectionType', () => {
  it('returns the default connection type from prefs', () => {
    expect(getConnectionType({ connection_type: 'anthropic_api' }, {})).toBe('anthropic_api');
    expect(getConnectionType({ connection_type: 'anthropic_api' }, { api_type: '' })).toBe('anthropic_api');
  });
  it("uses the prompt's api_type when set", () => {
    expect(getConnectionType({ connection_type: 'anthropic_api' }, { api_type: 'openai_comp_api' })).toBe('openai_comp_api');
  });
  it('prefers the feature-specific integration when enabled via prefix', () => {
    const prefs = {
      connection_type: 'anthropic_api',
      add_tags_use_specific_integration: true,
      add_tags_connection_type: 'ollama_api',
    };
    expect(getConnectionType(prefs, { api_type: 'openai_comp_api' }, 'add_tags')).toBe('ollama_api');
  });
  it('ignores the prefix when the specific integration is disabled', () => {
    const prefs = {
      connection_type: 'anthropic_api',
      add_tags_use_specific_integration: false,
      add_tags_connection_type: 'ollama_api',
    };
    expect(getConnectionType(prefs, {}, 'add_tags')).toBe('anthropic_api');
  });
});

describe('isAPIKeyValue', () => {
  it('recognizes the API key preference ids', () => {
    expect(isAPIKeyValue('anthropic_api_key')).toBe(true);
    expect(isAPIKeyValue('chatgpt_api_key')).toBe(true);
    expect(isAPIKeyValue('something_else')).toBe(false);
  });
});

describe('extractJsonObject', () => {
  it('extracts an embedded JSON object', () => {
    expect(extractJsonObject('noise {"a":1,"b":[2,3]} trailing')).toEqual({ a: 1, b: [2, 3] });
  });
  it('throws when no JSON object is present', () => {
    expect(() => extractJsonObject('no json here')).toThrow();
  });
});

describe('sanitizeChatGPTModelData', () => {
  it('returns empty string for falsy input', () => {
    expect(sanitizeChatGPTModelData('')).toBe('');
    expect(sanitizeChatGPTModelData(undefined)).toBe('');
  });
  it('url-encodes and lowercases', () => {
    expect(sanitizeChatGPTModelData('GPT 5')).toBe('gpt%205');
  });
});

describe('getLanguageDisplayName', () => {
  it('returns a capitalized display name', () => {
    expect(getLanguageDisplayName('en')).toBe('English');
  });
});
