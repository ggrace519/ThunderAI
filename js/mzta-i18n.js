/*
 * This file is provided by the addon-developer-support repository at
 * https://github.com/thundernest/addon-developer-support
 *
 * For usage descriptions, please check:
 * https://github.com/thundernest/addon-developer-support/tree/master/scripts/i18n
 *
 * Version 1.1
 *
 * Derived from:
 * http://github.com/piroor/webextensions-lib-l10n
 *
 * Original license:
 * The MIT License, Copyright (c) 2016-2019 YUKI "Piro" Hiroshi
 *
 */

var i18n = {
  updateString(string) {
    let re = new RegExp(this.keyPrefix + "(.+?)__", "g");
    return string.replace(re, (matched) => {
      const key = matched.slice(this.keyPrefix.length, -2);
      let rv = this.extension
        ? this.extension.localeData.localizeMessage(key)
        : messenger.i18n.getMessage(key);
      return rv || matched;
    });
  },

  updateSubtree(node) {
    const texts = document.evaluate(
      'descendant::text()[contains(self::text(), "' + this.keyPrefix + '")]',
      node,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    for (let i = 0, maxi = texts.snapshotLength; i < maxi; i++) {
      const text = texts.snapshotItem(i);
      if (text.nodeValue.includes(this.keyPrefix))
        text.nodeValue = this.updateString(text.nodeValue);
    }

    const attributes = document.evaluate(
      'descendant::*/attribute::*[contains(., "' + this.keyPrefix + '")]',
      node,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    for (let i = 0, maxi = attributes.snapshotLength; i < maxi; i++) {
      const attribute = attributes.snapshotItem(i);
      if (attribute.value.includes(this.keyPrefix))
        attribute.value = this.updateString(attribute.value);
    }
  },

  updateDocument(options = {}) {
    this.extension = null;
    this.keyPrefix = "__MSG_";
    if (options) {
      if (options.extension) this.extension = options.extension;
      if (options.keyPrefix) this.keyPrefix = options.keyPrefix;
    }
    this.updateSubtree(document);

    // a11y (ThunderAI local enhancement): declare the document language so
    // assistive technologies announce content in the right language. Reflects
    // the actual UI locale and never overrides a lang already set in the page.
    try {
      const i18nApi = globalThis.messenger?.i18n || globalThis.browser?.i18n;
      const uiLang = i18nApi?.getUILanguage?.();
      const docEl = document.documentElement;
      if (uiLang && docEl && !docEl.getAttribute("lang")) {
        docEl.setAttribute("lang", uiLang);
      }
    } catch (e) {
      // non-fatal: language declaration is a progressive enhancement
    }
  },
};
