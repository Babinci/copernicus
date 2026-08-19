"use strict";

const {
  escapeRegExp,
  findMatchingBrace,
} = require("../../scripts/patches/lib/minified-js.js");

const MARKER = "/*codexLinuxBrowserOauthPopups*/";
const BROWSER_WEBVIEW_SETUP_PATTERN =
  /function ([A-Za-z_$][\w$]*)\(\{configureBrowserSession:([A-Za-z_$][\w$]*),params:([A-Za-z_$][\w$]*),preloadPath:([A-Za-z_$][\w$]*),webPreferences:([A-Za-z_$][\w$]*)\}\)\{\3\.partition=([A-Za-z_$][\w$]*)\(`app`\),\5\.session=\2\(\),\5\.preload=\4,([A-Za-z_$][\w$]*)\(\3,\5\)\}/gu;
const RESTRICTED_HANDLER_ANCHOR = ".setWindowOpenHandler(({disposition:";

function warn(reason) {
  console.warn(`WARN: ${reason} - skipping built-in browser OAuth popup patch`);
}

function hasRestrictedBrowserPopupHandler(source) {
  let matches = 0;
  let start = -1;
  while ((start = source.indexOf(RESTRICTED_HANDLER_ANCHOR, start + 1)) >= 0) {
    const handler = source.slice(start, start + 2_500);
    if (
      handler.includes(".openBrowserSidebarExternalUrl({initiatorUrl:") &&
      handler.includes(".isRestrictedBrowserSidebarNavigation(")
    ) {
      matches += 1;
    }
  }
  return matches === 1;
}

function hasCurrentWebviewHardener(source, helperName) {
  const signature = new RegExp(
    `function ${escapeRegExp(helperName)}\\(([A-Za-z_$][\\w$]*),([A-Za-z_$][\\w$]*)\\)\\{`,
    "gu",
  );
  const matches = [...source.matchAll(signature)];
  if (matches.length !== 1 || matches[0].index == null) return false;

  const openBrace = source.indexOf("{", matches[0].index);
  const closeBrace = findMatchingBrace(source, openBrace);
  if (closeBrace < 0) return false;

  const params = matches[0][1];
  const preferences = matches[0][2];
  const hardener = source.slice(matches[0].index, closeBrace + 1);
  return [
    `delete ${params}.allowpopups`,
    `delete ${params}.disablewebsecurity`,
    `delete ${params}.webpreferences`,
    `${preferences}.sandbox=!0`,
    `${preferences}.contextIsolation=!0`,
    `${preferences}.nodeIntegration=!1`,
    `${preferences}.webSecurity=!0`,
    `Object.assign(${preferences},{disablePopups:!0})`,
  ].every((needle) => hardener.includes(needle));
}

function applyBrowserOauthPopupsPatch(source) {
  if (typeof source !== "string") {
    warn("Main bundle source is not a string");
    return source;
  }
  if (source.includes(MARKER)) return source;
  if (!hasRestrictedBrowserPopupHandler(source)) {
    warn("Could not prove the restricted built-in-browser popup handler");
    return source;
  }

  const matches = [...source.matchAll(BROWSER_WEBVIEW_SETUP_PATTERN)];
  if (matches.length !== 1) {
    warn(`Expected one current built-in-browser webview setup, found ${matches.length}`);
    return source;
  }

  const match = matches[0];
  const params = match[3];
  const preferences = match[5];
  const hardener = match[7];
  if (!hasCurrentWebviewHardener(source, hardener)) {
    warn("Could not prove the current hardened webview preferences");
    return source;
  }

  const hardenerCall = `${hardener}(${params},${preferences})`;
  const replacement = match[0].replace(
    hardenerCall,
    `${hardenerCall},${params}.allowpopups=\`\`,Object.assign(${preferences},{disablePopups:!1})${MARKER}`,
  );
  if (replacement === match[0]) {
    warn("Could not find the built-in-browser hardener call");
    return source;
  }
  return source.slice(0, match.index) + replacement + source.slice(match.index + match[0].length);
}

const descriptors = [
  {
    id: "main-process-browser-oauth-popups",
    phase: "main-bundle",
    order: 146,
    ciPolicy: "optional",
    apply: applyBrowserOauthPopupsPatch,
  },
];

module.exports = {
  MARKER,
  applyBrowserOauthPopupsPatch,
  descriptors,
};
