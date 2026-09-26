/*
 *  ThunderAI [https://micz.it/thunderbird-addon-thunderai/]
 *  Copyright (C) 2024 - 2026  Mic (m@micz.it)

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

// Classic content script (loaded before mzta-compose-script.js), not a module.
//
// Alert messages are i18n strings that may carry light formatting (<b>, <br>),
// but callers also append raw error text that can contain API or model output.
// Only a fixed set of attribute-less inline tags is rebuilt; every other node
// is reduced to its text, so no markup from an error string reaches the page.

const MZTA_SAFE_ALERT_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'BR']);

function mztaAppendSafeAlertHtml(target, html) {
    const doc = new DOMParser().parseFromString(html || '', 'text/html');
    _mztaCopySafeNodes(doc.body, target, target.ownerDocument);
}

function _mztaCopySafeNodes(source, target, targetDoc) {
    for (const node of source.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            target.appendChild(targetDoc.createTextNode(node.textContent));
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (MZTA_SAFE_ALERT_TAGS.has(node.tagName)) {
                const clean = targetDoc.createElement(node.tagName.toLowerCase());
                _mztaCopySafeNodes(node, clean, targetDoc);
                target.appendChild(clean);
            } else {
                target.appendChild(targetDoc.createTextNode(node.textContent));
            }
        }
    }
}
