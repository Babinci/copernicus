#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const {
  applyLinuxBrowserUseMediaPermissionPatch,
  descriptors,
} = require("./patch.js");

const fixture =
  '"use strict";' +
  'var handlers={},session={setPermissionRequestHandler(e){handlers.request=e},setPermissionCheckHandler(e){handlers.check=e}};' +
  'function install(){let e=session;e.setPermissionRequestHandler((e,t,n)=>{n(t===`clipboard-sanitized-write`)}),e.setPermissionCheckHandler((e,t)=>t===`clipboard-sanitized-write`)};' +
  'install();globalThis.handlers=handlers;';

test("browser media permission is opt-in and exact-origin only", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "feature.json"), "utf8"));
  assert.equal(manifest.defaultEnabled, false);
  assert.equal(descriptors.length, 1);

  const context = {
    URL,
    globalThis: {},
    process: {
      env: { CODEX_BROWSER_USE_MEDIA_ORIGINS: "https://allowed.test,http://localhost:39137" },
      platform: "linux",
    },
  };
  const patched = applyLinuxBrowserUseMediaPermissionPatch(fixture);
  vm.runInNewContext(patched, context);

  let granted;
  context.globalThis.handlers.request(
    {},
    "media",
    (value) => { granted = value; },
    { securityOrigin: "http://localhost:39137/path" },
  );
  assert.equal(granted, true);
  assert.equal(context.globalThis.handlers.check({}, "media", "https://denied.test", {}), false);
  assert.equal(
    context.globalThis.handlers.check({}, "display-capture", "http://localhost:39137", {}),
    false,
  );
  assert.equal(applyLinuxBrowserUseMediaPermissionPatch(patched), patched);
});
