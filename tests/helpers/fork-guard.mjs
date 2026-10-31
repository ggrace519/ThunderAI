/*
 *  fork: helpers for this fork's prompt-injection guard (js/mzta-prompt-guard.js), which is ON
 *  by default and changes every prompt built from an email:
 *
 *    [SECURITY] <hardening preamble>
 *
 *    <prompt text> [BEGIN EMAIL DATA 1a2b3c4d5e6f]
 *    <email content>
 *    [END EMAIL DATA 1a2b3c4d5e6f] <rest of the prompt>
 *
 *  The marker is random per prompt, so upstream's exact-string assertions cannot match it as
 *  is. Upstream test files that assert on a prompt call these helpers (each call is marked
 *  "fork:"), which keeps the fork edits inside tests/ to one line per site.
 *
 *  Not part of upstream: this file never conflicts on a sync.
 */

import { hardeningPreamble } from '../../js/mzta-prompt-guard.js';

const PREAMBLE = hardeningPreamble() + '\n\n';
const REGION_RE = /\[BEGIN EMAIL DATA ([0-9a-f]{12})\]\n([\s\S]*?)\n\[END EMAIL DATA \1\]/g;

/**
 * The prompt as the guard-off path builds it: the preamble removed and every wrapped region
 * reduced to its content. `quote`: a prompt with no placeholder appends its content in quotes
 * when the guard is off (the markers replace the quotes when it is on), so put them back.
 */
export function unguard(prompt, { quote = false } = {}) {
    let p = String(prompt);
    if (p.startsWith(PREAMBLE)) p = p.slice(PREAMBLE.length);
    return p.replace(REGION_RE, (_m, _marker, content) => (quote ? '"' + content + '"' : content));
}

/**
 * Throws unless `prompt` has the guard's shape: when it holds a wrapped region, it opens with
 * the preamble and every BEGIN marker is closed by its own END; with no region, no preamble.
 */
export function assertGuardShape(prompt) {
    const p = String(prompt);
    const regions = [...p.matchAll(REGION_RE)].length;
    const begins = (p.match(/\[BEGIN EMAIL DATA [0-9a-f]{12}\]/g) || []).length;
    const ends = (p.match(/\[END EMAIL DATA [0-9a-f]{12}\]/g) || []).length;
    if (begins !== regions || ends !== regions) {
        throw new Error('fork-guard: unbalanced markers (' + begins + ' BEGIN, ' + ends + ' END, ' + regions + ' regions): ' + p);
    }
    if (regions > 0 && !p.startsWith(PREAMBLE)) throw new Error('fork-guard: wrapped content without the preamble: ' + p);
    if (regions === 0 && p.startsWith(PREAMBLE)) throw new Error('fork-guard: a preamble with nothing wrapped: ' + p);
    return regions;
}

/** The prompt with its random markers replaced by the fixed MARKER, for exact comparisons. */
export function fixMarkers(prompt) {
    return String(prompt).replace(/(\[(?:BEGIN|END) EMAIL DATA )[0-9a-f]{12}\]/g, '$1MARKER]');
}

/** The guarded form of `content`, with the fixed marker (pair with fixMarkers()). */
export function wrapped(content) {
    return '[BEGIN EMAIL DATA MARKER]\n' + content + '\n[END EMAIL DATA MARKER]';
}

/** `body` with the preamble the guard prepends to a prompt holding wrapped content. */
export function withPreamble(body) {
    return PREAMBLE + body;
}
