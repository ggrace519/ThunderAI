#!/usr/bin/env node
/*
 *  Fork release helpers, used by .github/workflows/prepare-release.yml and release.yml.
 *
 *  Version scheme: fork release `<upstream>-fork.<n>` (tag `v<upstream>-fork.<n>`) is
 *  shipped with manifest version `<upstream>.<n>`, e.g. 5.1.1-fork.1 <-> 5.1.1.1. A plain
 *  3-part manifest version means "no fork release prepared yet" (fresh upstream sync).
 *  The fork's own update channel (manifest update_url) serves the updates.json built here.
 *  See DECISIONS.md "Fork release channel".
 *
 *  Pure functions are exported for test/fork-release.test.js; the CLI at the bottom only
 *  reads/writes files and git, and prints `key=value` lines (also appended to
 *  $GITHUB_OUTPUT when set).
 */

import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ADDON_ID = 'thunderai@micz.it';
export const REPO = 'ggrace519/ThunderAI';

const UNRELEASED = '## [Unreleased]';

/** '5.1.1' -> {upstream: '5.1.1', fork: null}; '5.1.1.2' -> {upstream: '5.1.1', fork: 2}. */
export function splitVersion(manifestVersion) {
    const m = /^(\d+\.\d+\.\d+)(?:\.(\d+))?$/.exec(String(manifestVersion).trim());
    if (!m) throw new Error(`manifest version "${manifestVersion}" is not <major>.<minor>.<patch>[.<fork>]`);
    return { upstream: m[1], fork: m[2] === undefined ? null : Number(m[2]) };
}

export const toVersion = (upstream, n) => `${upstream}-fork.${n}`;
export const toTag = (upstream, n) => `v${toVersion(upstream, n)}`;
export const toManifest = (upstream, n) => `${upstream}.${n}`;

/** 1 + the highest existing `v<upstream>-fork.N` tag, or 1 when there is none. */
export function nextForkNumber(upstream, tags) {
    const prefix = `v${upstream}-fork.`;
    const taken = tags
        .filter(t => t.startsWith(prefix) && /^\d+$/.test(t.slice(prefix.length)))
        .map(t => Number(t.slice(prefix.length)));
    return taken.length ? Math.max(...taken) + 1 : 1;
}

/** Index range [start, end) of a `## ...` section's body, or null. */
function sectionBody(text, heading) {
    const lines = text.split('\n');
    const at = lines.findIndex(l => l === heading || l.startsWith(heading + ' '));
    if (at === -1) return null;
    let end = lines.findIndex((l, i) => i > at && l.startsWith('## '));
    if (end === -1) end = lines.length;
    return { lines, at, end };
}

/** True when the [Unreleased] section has at least one `- ` entry. */
export function hasUnreleasedEntries(text) {
    const s = sectionBody(text, UNRELEASED);
    return !!s && s.lines.slice(s.at + 1, s.end).some(l => /^\s*- /.test(l));
}

/**
 * Move the [Unreleased] body under `## [<version>] - <isoDate>`, leaving an empty [Unreleased].
 * Throws when [Unreleased] is missing or has no entry, or the version heading already exists.
 */
export function rollChangelog(text, version, isoDate) {
    if (text.includes(`## [${version}]`)) throw new Error(`FORK_CHANGELOG.md already has a [${version}] heading`);
    const s = sectionBody(text, UNRELEASED);
    if (!s) throw new Error('FORK_CHANGELOG.md has no "## [Unreleased]" heading');
    const body = s.lines.slice(s.at + 1, s.end);
    if (!hasUnreleasedEntries(text)) throw new Error('[Unreleased] has no entries: nothing to release');
    const trimmed = body.join('\n').replace(/^\n+|\n+$/g, '');
    const out = [
        ...s.lines.slice(0, s.at),
        UNRELEASED,
        '',
        `## [${version}] - ${isoDate}`,
        '',
        trimmed,
        '',
        ...s.lines.slice(s.end),
    ];
    return out.join('\n');
}

/** The body of the `## [<version>]` section, trimmed. Throws when it is missing or empty. */
export function releaseNotes(text, version) {
    const s = sectionBody(text, `## [${version}]`);
    if (!s) throw new Error(`FORK_CHANGELOG.md has no [${version}] heading`);
    const body = s.lines.slice(s.at + 1, s.end).join('\n').trim();
    if (!body) throw new Error(`the [${version}] section of FORK_CHANGELOG.md is empty`);
    return body;
}

/** The self-hosted update manifest (extensionworkshop "Updating your extension"). */
export function updatesJson({ id = ADDON_ID, version, link, sha256, minVersion }) {
    if (!/^https:\/\//.test(link)) throw new Error(`update_link must be https: ${link}`);
    if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error('sha256 must be 64 hex characters');
    const update = { version, update_link: link, update_hash: `sha256:${sha256}` };
    if (minVersion) update.applications = { gecko: { strict_min_version: minVersion } };
    return { addons: { [id]: { updates: [update] } } };
}

/** Where release.yml uploads the XPI for a tag. */
export const assetLink = (tag, fileName) => `https://github.com/${REPO}/releases/download/${tag}/${fileName}`;
export const xpiName = (version) => `thunderai-${version}.xpi`;

// --- CLI -----------------------------------------------------------------------------------

function emit(pairs) {
    const lines = Object.entries(pairs).map(([k, v]) => `${k}=${v}`);
    console.log(lines.join('\n'));
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n');
}

const readJson = p => JSON.parse(readFileSync(p, 'utf8'));
const forkTags = () => execFileSync('git', ['tag', '-l', 'v*-fork.*'], { encoding: 'utf8' }).split('\n').filter(Boolean);

/**
 * pending: should prepare-release open (or refresh) a release PR for this develop commit?
 * `prepare` when [Unreleased] has entries and no prepared fork version is waiting for release.
 */
function cmdPending() {
    const manifest = readJson('manifest.json');
    const { upstream, fork } = splitVersion(manifest.version);
    if (fork !== null && !forkTags().includes(toTag(upstream, fork))) {
        emit({ action: 'skip', reason: `${toTag(upstream, fork)} is prepared and waits for its promotion; new entries go into the next release` });
        return;
    }
    if (!hasUnreleasedEntries(readFileSync('FORK_CHANGELOG.md', 'utf8'))) {
        emit({ action: 'skip', reason: '[Unreleased] has no entries' });
        return;
    }
    emit({ action: 'prepare' });
}

/** prepare: roll [Unreleased] into the next fork version and set the manifest version. */
function cmdPrepare(isoDate) {
    const manifest = readJson('manifest.json');
    const { upstream } = splitVersion(manifest.version);
    const n = nextForkNumber(upstream, forkTags());
    const version = toVersion(upstream, n);
    writeFileSync('FORK_CHANGELOG.md', rollChangelog(readFileSync('FORK_CHANGELOG.md', 'utf8'), version, isoDate));
    // Only the version line changes, so the manifest's own formatting is kept.
    const raw = readFileSync('manifest.json', 'utf8');
    const bumped = raw.replace(/("version"\s*:\s*")[^"]+(")/, `$1${toManifest(upstream, n)}$2`);
    if (bumped === raw) throw new Error('could not set the manifest version');
    writeFileSync('manifest.json', bumped);
    emit({ version, tag: toTag(upstream, n), manifest_version: toManifest(upstream, n), branch: `docs/release-${version}` });
}

/** release-info: decide whether this commit is a fork release, and write its notes. */
function cmdReleaseInfo(notesPath) {
    const manifest = readJson('manifest.json');
    const { upstream, fork } = splitVersion(manifest.version);
    if (fork === null) {
        emit({ action: 'skip', reason: `manifest version ${manifest.version} has no fork part: no fork release prepared` });
        return;
    }
    const tag = toTag(upstream, fork);
    const version = toVersion(upstream, fork);
    if (forkTags().includes(tag)) {
        emit({ action: 'skip', reason: `${tag} already exists` });
        return;
    }
    writeFileSync(notesPath, releaseNotes(readFileSync('FORK_CHANGELOG.md', 'utf8'), version) + '\n');
    emit({
        action: 'release', tag, version, manifest_version: manifest.version,
        min_version: manifest.browser_specific_settings?.gecko?.strict_min_version ?? '',
        xpi: xpiName(version),
    });
}

/** updates-json: write the update manifest for a built XPI. */
function cmdUpdatesJson(tag, manifestVersion, xpi, sha256, minVersion, outPath) {
    const json = updatesJson({ version: manifestVersion, link: assetLink(tag, xpi), sha256, minVersion });
    writeFileSync(outPath, JSON.stringify(json, null, 2) + '\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const [cmd, ...args] = process.argv.slice(2);
    try {
        if (cmd === 'pending') cmdPending();
        else if (cmd === 'prepare') cmdPrepare(args[0] || new Date().toISOString().slice(0, 10));
        else if (cmd === 'release-info') cmdReleaseInfo(args[0] || 'release-notes.md');
        else if (cmd === 'updates-json') cmdUpdatesJson(...args);
        else throw new Error('usage: fork-release.mjs pending | prepare [date] | release-info [notes.md] | updates-json <tag> <manifestVersion> <xpi> <sha256> <minVersion> <out>');
    } catch (e) {
        console.error(`::error::${e.message}`);
        process.exit(1);
    }
}
