#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  discoverLinuxFeatureManifests,
  loadLinuxFeaturePatchDescriptors,
} = require("../../scripts/lib/linux-features.js");
const {
  MARKER,
  applyBrowserOauthPopupsPatch,
  descriptors,
} = require("./patch.js");

function bundle({ handler = true, setups = 1, hardener = true } = {}) {
  const setup =
    "function UB({configureBrowserSession:e,params:t,preloadPath:n,webPreferences:r}){t.partition=is(`app`),r.session=e(),r.preload=n,GB(t,r)}";
  const settings =
    "function WB({configureBrowserSession:e,params:t,webPreferences:n}){t.partition=is(`app`),n.session=e(),delete n.preload,GB(t,n),t.allowpopups=``,Object.assign(n,{disablePopups:!1})}";
  const hardenerSource = hardener
    ? "function GB(e,t){delete e.allowpopups,delete e.disablewebsecurity,delete e.webpreferences,t.sandbox=!0,t.devTools=!0,t.nodeIntegration=!1,t.nodeIntegrationInSubFrames=!1,t.nodeIntegrationInWorker=!1,t.contextIsolation=!0,t.webSecurity=!0,t.allowRunningInsecureContent=!1,t.webviewTag=!1,t.plugins=!1,Object.assign(t,{disablePopups:!0})}"
    : "function GB(e,t){Object.assign(t,{disablePopups:!0})}";
  const handlerSource = handler
    ? "a.setWindowOpenHandler(({disposition:n,referrer:r,url:o})=>e.openBrowserSidebarExternalUrl({initiatorUrl:r?.url??null,pageState:i,url:o,webContents:a})||e.isRestrictedBrowserSidebarNavigation(a.id,o)?{action:`deny`}:{action:`allow`})"
    : "a.setWindowOpenHandler(({url:o})=>({action:`deny`}))";
  return `${Array.from({ length: setups }, () => setup).join("")}${settings}${hardenerSource}${handlerSource}`;
}

function captureWarnings(callback) {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    return { result: callback(), warnings };
  } finally {
    console.warn = originalWarn;
  }
}

function withFeatureConfig(enabled, callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "browser-oauth-popups-feature-"));
  const configPath = path.join(tempDir, "features.json");
  const originalConfig = process.env.CODEX_LINUX_FEATURES_CONFIG;
  try {
    fs.writeFileSync(configPath, `${JSON.stringify({ enabled })}\n`);
    process.env.CODEX_LINUX_FEATURES_CONFIG = configPath;
    return callback(path.resolve(__dirname, ".."));
  } finally {
    if (originalConfig == null) delete process.env.CODEX_LINUX_FEATURES_CONFIG;
    else process.env.CODEX_LINUX_FEATURES_CONFIG = originalConfig;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test("browser-oauth-popups stays disabled until explicitly enabled", () => {
  withFeatureConfig([], (featuresRoot) => {
    assert.deepEqual(loadLinuxFeaturePatchDescriptors({ featuresRoot }), []);
  });
  withFeatureConfig(["browser-oauth-popups"], (featuresRoot) => {
    assert.deepEqual(
      loadLinuxFeaturePatchDescriptors({ featuresRoot }).map(({ id, phase }) => [id, phase]),
      [["feature:browser-oauth-popups:main-process-browser-oauth-popups", "main-bundle"]],
    );
    const feature = discoverLinuxFeatureManifests({ featuresRoot }).find(
      ({ id }) => id === "browser-oauth-popups",
    );
    assert.equal(feature.manifest.defaultEnabled, false);
  });
});

test("patch enables popup delivery only after the hardened normal browser setup", () => {
  const source = bundle();
  const patched = applyBrowserOauthPopupsPatch(source);
  assert.notEqual(patched, source);
  assert.match(patched, new RegExp(MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(
    patched,
    /r\.preload=n,GB\(t,r\),t\.allowpopups=``,Object\.assign\(r,\{disablePopups:!1\}\)/,
  );
  assert.match(patched, /t\.sandbox=!0/);
  assert.match(patched, /t\.contextIsolation=!0/);
  assert.match(patched, /t\.nodeIntegration=!1/);
  assert.match(patched, /t\.webSecurity=!0/);
  assert.equal((patched.match(/function WB\(/g) ?? []).length, 1);
  assert.equal(applyBrowserOauthPopupsPatch(patched), patched);
});

test("patch fails closed when current setup anchors drift", () => {
  const source = bundle().replace("preloadPath:n", "preload:n");
  const { result, warnings } = captureWarnings(() => applyBrowserOauthPopupsPatch(source));
  assert.equal(result, source);
  assert.match(warnings.join("\n"), /Expected one current built-in-browser webview setup, found 0/);
});

test("patch fails closed when the browser setup is ambiguous", () => {
  const source = bundle({ setups: 2 });
  const { result, warnings } = captureWarnings(() => applyBrowserOauthPopupsPatch(source));
  assert.equal(result, source);
  assert.match(warnings.join("\n"), /found 2/);
});

test("patch fails closed when the restricted popup handler is missing", () => {
  const source = bundle({ handler: false });
  const { result, warnings } = captureWarnings(() => applyBrowserOauthPopupsPatch(source));
  assert.equal(result, source);
  assert.match(warnings.join("\n"), /restricted built-in-browser popup handler/);
});

test("patch fails closed when upstream webview hardening is incomplete", () => {
  const source = bundle({ hardener: false });
  const { result, warnings } = captureWarnings(() => applyBrowserOauthPopupsPatch(source));
  assert.equal(result, source);
  assert.match(warnings.join("\n"), /hardened webview preferences/);
});

test("descriptor is optional and targets the main bundle", () => {
  assert.deepEqual(
    descriptors.map(({ id, phase, ciPolicy }) => [id, phase, ciPolicy]),
    [["main-process-browser-oauth-popups", "main-bundle", "optional"]],
  );
});
