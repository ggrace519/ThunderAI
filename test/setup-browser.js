// Vitest setup file (see vitest.config.mjs): installs the default `browser`
// stub before each test file is imported. See test/helpers/browser-stub.js.
import { makeBrowserStub } from './helpers/browser-stub.js';

globalThis.browser = makeBrowserStub();
