/*
 *  ThunderAI [https://micz.it/thunderbird-addon-thunderai/]
 *  Copyright (C) 2024 - 2025  Mic (m@micz.it)

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

// Per-request timeout overrides for js/api/api-retry.js fetchWithRetry().
//
// fetchWithRetry() times out the wait for the response HEADERS (60 s by
// default) and retries a timeout. A streaming request sends its headers at
// once, so that suits it. A non-streaming generation -- the fork's structured
// output path (special commands with a JSON schema) -- sends no headers until
// the whole reply is written, so a slow model would be cut off and the full
// generation re-run on every retry. Those requests get a long deadline instead:
// the caller's own special_command_timeout bounds the real wait, and this is
// only a backstop against a hung connection.
export const TA_NONSTREAM_TIMEOUT_MS = 600000;

/**
 * retryConfig fields a generation request needs on top of the provider's own.
 * Only the fork's structured-output requests are non-streaming in practice
 * (the workers stream everything else), so the long deadline is applied to a
 * request that is both non-streaming AND carries a schema; any other request
 * keeps the provider's timeout exactly as upstream sets it.
 * Spread it after the provider defaults and before the caller's retryConfig, so
 * an explicit caller timeout (e.g. the connection test) still wins:
 *   { label, timeoutMs: X, ...generationRetryConfig(this.stream, this.response_schema), ...retryConfig }
 *
 * @param {boolean} stream whether the request streams its reply
 * @param {object|null} response_schema the structured-output schema, if any
 * @returns {{timeoutMs?: number}}
 */
export function generationRetryConfig(stream, response_schema) {
    return (!stream && response_schema) ? { timeoutMs: TA_NONSTREAM_TIMEOUT_MS } : {};
}
