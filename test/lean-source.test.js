import { describe, it, expect } from 'vitest';
import { buildLeanSource } from '../js/mzta-utils.js';

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

  it('includes decoded text and html body parts', () => {
    const full = {
      contentType: 'multipart/alternative',
      parts: [
        { contentType: 'text/plain', body: 'Click http://evil.test to verify' },
        { contentType: 'text/html', body: '<a href="http://evil.test">verify</a>' },
      ],
    };
    const out = buildLeanSource(HEADERS, full);
    expect(out).toContain('--- body (text/plain) ---');
    expect(out).toContain('Click http://evil.test to verify');
    expect(out).toContain('--- body (text/html) ---');
    expect(out).toContain('href="http://evil.test"');
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
});
