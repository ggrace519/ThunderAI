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

// Default time budget for establishing a connection and receiving the
// response headers. For streaming requests `fetch` resolves as soon as the
// headers arrive, so the timer is cleared before the (potentially long-lived)
// body is consumed — the timeout guards connection setup, not streaming.
export const TA_DEFAULT_TIMEOUT_MS = 30000;

// A non-streaming generation only sends its headers once the whole reply is
// written, so the header deadline above would cut off a slow model. The
// caller's own deadline (special_command_timeout for background commands)
// bounds the real wait; this is only a backstop against a hung connection.
export const TA_NONSTREAM_TIMEOUT_MS = 600000;

// Header deadline for a generation request.
export function generationTimeoutMs(stream) {
    return stream ? TA_DEFAULT_TIMEOUT_MS : TA_NONSTREAM_TIMEOUT_MS;
}

/**
 * fetch() wrapper that aborts if the response headers do not arrive within
 * `timeoutMs`. On timeout it throws a plain Error with a clear message so the
 * existing per-client catch blocks surface it as an exception. Any other abort
 * or network error is re-thrown unchanged.
 *
 * @param {string|URL} url
 * @param {RequestInit} [options]
 * @param {number} [timeoutMs]
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = TA_DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (timedOut) {
            throw new Error("Request timed out after " + timeoutMs + " ms");
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}
