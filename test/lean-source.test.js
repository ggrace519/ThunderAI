import { describe, it, expect } from 'vitest';
import { buildLeanSource, headersObjectToBlock, trimHeadersBlock, cleanHtmlForAnalysis } from '../js/mzta-utils.js';

const HEADERS = [
  'Received: from mx.evil.test by mail.example.test',
  'From: "Bank" <noreply@evil.test>',
  'Reply-To: attacker@evil.test',
  'Authentication-Results: spf=fail',
  'Subject: Urgent: verify your account',
].join('\n');

describe('buildLeanSource', () => {
  it('keeps the header block intact', () => {
    const out = buildLeanSource(HEADERS, { parts: [] });
    expect(out).toContain('Authentication-Results: spf=fail');
    expect(out).toContain('Reply-To: attacker@evil.test');
  });

  it('includes only the HTML body when both alternatives exist (no duplication)', () => {
    const full = {
      contentType: 'multipart/alternative',
      parts: [
        { contentType: 'text/plain', body: 'Click http://evil.test to verify' },
        { contentType: 'text/html', body: '<a href="http://evil.test">verify</a>' },
      ],
    };
    const out = buildLeanSource(HEADERS, full);
    // HTML is preferred (exposes the real link target)...
    expect(out).toContain('--- body (text/html) ---');
    expect(out).toContain('href="http://evil.test"');
    // ...and the redundant plain-text alternative is NOT included.
    expect(out).not.toContain('--- body (text/plain) ---');
    expect(out).not.toContain('Click http://evil.test to verify');
  });

  it('falls back to plain text when there is no HTML part', () => {
    const full = {
      contentType: 'multipart/mixed',
      parts: [
        { contentType: 'text/plain', body: 'plain only body' },
      ],
    };
    const out = buildLeanSource(HEADERS, full);
    expect(out).toContain('--- body (text/plain) ---');
    expect(out).toContain('plain only body');
  });

  it('lists attachments as metadata only and omits their payload', () => {
    const full = {
      contentType: 'multipart/mixed',
      parts: [
        { contentType: 'text/plain', body: 'see attached' },
        { contentType: 'image/png', name: 'logo.png', size: 204800, body: 'iVBORw0KGgoAAAA...BASE64...' },
      ],
    };
    const out = buildLeanSource(HEADERS, full);
    expect(out).toContain('--- attachments (content omitted) ---');
    expect(out).toContain('logo.png [image/png] (200 KB)');
    // The base64 payload must NOT be present.
    expect(out).not.toContain('iVBORw0KGgo');
  });

  it('treats attached text files as attachments, not as the body', () => {
    const full = {
      contentType: 'multipart/mixed',
      parts: [
        { contentType: 'text/plain', body: 'Please pay the invoice at http://evil.test' },
        { contentType: 'text/html', name: 'harmless.html', size: 2048, body: '<p>nice cat pictures</p>' },
        { contentType: 'text/plain', headers: { 'content-disposition': ['attachment; filename="notes.txt"'] }, body: 'attached notes' },
      ],
    };
    const out = buildLeanSource(HEADERS, full);
    expect(out).toContain('--- body (text/plain) ---\nPlease pay the invoice at http://evil.test');
    expect(out).not.toContain('nice cat pictures');
    expect(out).not.toContain('attached notes');
    expect(out).toContain('- harmless.html [text/html] (2 KB)');
    expect(out).toContain('- (unnamed) [text/plain]');
  });

  it('handles a simple non-multipart text message (body at the root)', () => {
    const full = { contentType: 'text/plain', body: 'just a plain note' };
    const out = buildLeanSource(HEADERS, full);
    expect(out).toContain('just a plain note');
  });

  it('recurses nested multipart trees', () => {
    const full = {
      contentType: 'multipart/mixed',
      parts: [
        {
          contentType: 'multipart/alternative',
          parts: [
            { contentType: 'text/plain', body: 'nested text' },
          ],
        },
        { contentType: 'application/pdf', name: 'invoice.pdf', size: 51200, body: 'JVBERi0xLjc=...' },
      ],
    };
    const out = buildLeanSource(HEADERS, full);
    expect(out).toContain('nested text');
    expect(out).toContain('invoice.pdf [application/pdf] (50 KB)');
    expect(out).not.toContain('JVBERi0xLjc=');
  });

  it('returns just the headers when there are no parts', () => {
    const out = buildLeanSource(HEADERS, {});
    expect(out.trim()).toBe(HEADERS);
  });

  it('appends the decoded body inline (no "--- body ---" label) when inlineBody is set', () => {
    const full = {
      contentType: 'multipart/alternative',
      parts: [
        { contentType: 'text/plain', body: 'plain alt' },
        { contentType: 'text/html', body: '<a href="http://x.test">x</a>' },
      ],
    };
    const out = buildLeanSource(HEADERS, full, { inlineBody: true });
    // Headers preserved, decoded HTML body present, but no labelled section.
    expect(out).toContain('Reply-To: attacker@evil.test');
    expect(out).toContain('<a href="http://x.test">x</a>');
    expect(out).not.toContain('--- body (');
    // The plain-text alternative is still not duplicated.
    expect(out).not.toContain('plain alt');
  });

  it('inlineBody still lists attachments as metadata only', () => {
    const full = {
      contentType: 'multipart/mixed',
      parts: [
        { contentType: 'text/html', body: '<p>hi</p>' },
        { contentType: 'application/pdf', name: 'invoice.pdf', size: 51200, body: 'JVBERi0xLjc=' },
      ],
    };
    const out = buildLeanSource(HEADERS, full, { inlineBody: true });
    expect(out).toContain('<p>hi</p>');
    expect(out).not.toContain('--- body (');
    expect(out).toContain('--- attachments (content omitted) ---');
    expect(out).toContain('invoice.pdf [application/pdf] (50 KB)');
    expect(out).not.toContain('JVBERi0xLjc=');
  });
});

describe('headersObjectToBlock', () => {
  it('rebuilds a header block from getFull().headers', () => {
    const headers = {
      from: ['"Bank" <noreply@evil.test>'],
      'reply-to': ['attacker@evil.test'],
      subject: ['Urgent: verify your account'],
    };
    const out = headersObjectToBlock(headers);
    expect(out).toContain('from: "Bank" <noreply@evil.test>');
    expect(out).toContain('reply-to: attacker@evil.test');
    expect(out).toContain('subject: Urgent: verify your account');
  });

  it('expands a header that appears multiple times (e.g. Received chain)', () => {
    const headers = { received: ['from hop1', 'from hop2'] };
    const out = headersObjectToBlock(headers);
    expect(out).toBe('received: from hop1\nreceived: from hop2');
  });

  it('tolerates a non-array value', () => {
    expect(headersObjectToBlock({ subject: 'hi' })).toBe('subject: hi');
  });

  it('returns empty string for missing headers', () => {
    expect(headersObjectToBlock(null)).toBe('');
    expect(headersObjectToBlock(undefined)).toBe('');
  });

  it('feeds buildLeanSource when getRaw is unavailable', () => {
    const full = {
      headers: { from: ['a@b.test'], subject: ['hi'] },
      contentType: 'text/plain',
      body: 'message body',
    };
    const out = buildLeanSource(headersObjectToBlock(full.headers), full);
    expect(out).toContain('from: a@b.test');
    expect(out).toContain('message body');
  });
});

describe('trimHeadersBlock', () => {
  const RAW = [
    'Return-Path: n8n@gracepc.net',
    'Authentication-Results: dkim=pass; dmarc=pass; spf=pass',
    'DKIM-Signature: v=1; a=rsa-sha256; b=axsc5YBeWn1QCDMXZH0n0Mg',
    ' iKkJCKU8NIcR3HqVkqcontinuationblob',
    'X-HE-Meta: U2FsdGVkX18mSJqkdG04Wa5tMWcQ5bVvfREwwczT0',
    'From: n8n@gracepc.net',
    'Subject: Anthropic API Digest',
    ' continued subject',
    'X-Gm-Message-State: AOJu0YxiKi1+HpLeGErLUwjm',
    'To: ggrace@519lab.com',
  ].join('\n');

  it('keeps security headers and drops signature/meta blobs', () => {
    const out = trimHeadersBlock(RAW);
    expect(out).toContain('Authentication-Results: dkim=pass; dmarc=pass; spf=pass');
    expect(out).toContain('From: n8n@gracepc.net');
    expect(out).toContain('To: ggrace@519lab.com');
    expect(out).toContain('Return-Path: n8n@gracepc.net');
    expect(out).not.toContain('DKIM-Signature');
    expect(out).not.toContain('axsc5YBeWn1QCDMXZH0n0Mg');
    expect(out).not.toContain('continuationblob');   // dropped header's fold line gone too
    expect(out).not.toContain('X-HE-Meta');
    expect(out).not.toContain('X-Gm-Message-State');
  });

  it('preserves folded continuation lines of kept headers', () => {
    const out = trimHeadersBlock(RAW);
    expect(out).toContain('Subject: Anthropic API Digest');
    expect(out).toContain(' continued subject');
  });
});

describe('cleanHtmlForAnalysis', () => {
  it('strips inline style/class but keeps tags, text and links', () => {
    const html = '<table style="background:#f0f0f0" class="x"><tr><td style="padding:8px">' +
      '<a href="https://n8n.io/?utm_source=x" style="color:#e94560">n8n</a></td></tr></table>';
    const out = cleanHtmlForAnalysis(html);
    expect(out).toContain('<a href="https://n8n.io/?utm_source=x">n8n</a>');
    expect(out).toContain('<table>');
    expect(out).toContain('<td>');
    expect(out).not.toContain('style=');
    expect(out).not.toContain('class=');
    expect(out).toContain('n8n');
  });

  it('drops <style> blocks, comments, and keeps img src/alt', () => {
    const html = '<style>.a{color:red}</style><!-- hi --><img src="https://t.test/px.gif" alt="pixel" width="1" height="1">';
    const out = cleanHtmlForAnalysis(html);
    expect(out).not.toContain('<style>');
    expect(out).not.toContain('color:red');
    expect(out).not.toContain('<!--');
    expect(out).toContain('src="https://t.test/px.gif"');
    expect(out).toContain('alt="pixel"');
    expect(out).not.toContain('width=');
  });
});

describe('buildLeanSource clean mode', () => {
  const HDRS = [
    'From: a@b.test',
    'Authentication-Results: spf=pass',
    'X-HE-Meta: bigblob',
    'Subject: hi',
  ].join('\n');

  it('trims headers and cleans the html body when clean+inlineBody are set', () => {
    const full = {
      contentType: 'text/html',
      body: '<div style="font-size:99px"><a href="http://evil.test">click</a></div>',
    };
    const out = buildLeanSource(HDRS, full, { inlineBody: true, clean: true });
    expect(out).toContain('Authentication-Results: spf=pass');
    expect(out).not.toContain('X-HE-Meta');
    expect(out).toContain('<a href="http://evil.test">click</a>');
    expect(out).not.toContain('style=');
    expect(out).not.toContain('--- body (');
  });
});
