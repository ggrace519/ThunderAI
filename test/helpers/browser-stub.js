// Minimal WebExtension `browser` stub for the fork's Vitest suite.
//
// Since upstream 5.1.0 every preference read goes through js/mzta-prefs.js,
// which reads browser.storage.local and registers a storage.onChanged
// listener at import time, and js/mzta-utils.js imports it. So any test that
// (transitively) imports those modules needs this stub in place first.
// vitest.config.mjs installs it globally via test/setup-browser.js; a test that
// needs different behavior builds its own with makeBrowserStub(overrides) and
// vi.stubGlobal('browser', ...) BEFORE importing the module under test.
//
// storage.*.get(keys) mirrors the real API's object form: it returns the
// defaults it was given (an empty store), so every preference resolves to
// prefs_default.

function makeArea() {
    return {
        get: async (keys) => (keys && typeof keys === 'object' && !Array.isArray(keys) ? { ...keys } : {}),
        set: async () => {},
        remove: async () => {},
    };
}

export function makeBrowserStub(overrides = {}) {
    return {
        storage: {
            local: makeArea(),
            sync: makeArea(),
            session: makeArea(),
            onChanged: { addListener: () => {}, removeListener: () => {} },
        },
        i18n: {
            getMessage: (key) => key,
            getUILanguage: () => 'en',
        },
        runtime: {
            sendMessage: async () => undefined,
            onMessage: { addListener: () => {}, removeListener: () => {} },
            getURL: (path) => path,
        },
        ...overrides,
    };
}
