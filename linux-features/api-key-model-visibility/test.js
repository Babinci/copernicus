#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  applyWebviewAssetPatchDescriptors,
  normalizePatchDescriptors,
} = require("../../scripts/patches/engine.js");
const {
  loadLinuxFeaturePatchDescriptors,
} = require("../../scripts/lib/linux-features.js");
const {
  applyApiKeyModelVisibilityPatch,
  descriptors,
} = require("./patch.js");

function applyPatchTwice(patchFn, source) {
  const once = patchFn(source);
  assert.notEqual(once, source);
  assert.equal(patchFn(once), once);
  return once;
}

function modelCatalogFixture() {
  return [
    "function Tti({additionalAvailableModels:e,authMethod:t,availableModels:n,isCustomModelProvider:r,model:i,useHiddenModels:a}){return e?.has(i.model)===!0||i.model!==`codex-auto-review`&&(a&&!r&&t!==`amazonBedrock`?n.has(i.model):!i.hidden)}",
    "function vbe({authMethod:e,availableModels:t,defaultModel:n,models:a,useHiddenModels:o}){let s=[],c=null;return a.forEach(n=>{if(Tti({additionalAvailableModels:null,authMethod:e,availableModels:t,isCustomModelProvider:!1,model:n,useHiddenModels:o})){s.push(n),n.isDefault&&(c=n)}}),c??=s.find(e=>e.model===n)??null,{models:s,defaultModel:c}}",
  ].join("");
}

function evaluateCatalog(source, authMethod, useHiddenModels = true) {
  const catalog = Function(`${source};return vbe;`)();
  return catalog({
    authMethod,
    availableModels: new Set(["gpt-5.5"]),
    defaultModel: "gpt-5.5",
    models: [
      { model: "gpt-5.6-sol", hidden: false, isDefault: true },
      { model: "gpt-5.6-terra", hidden: false, isDefault: false },
      { model: "gpt-5.6-luna", hidden: false, isDefault: false },
      { model: "gpt-5.5", hidden: false, isDefault: false },
      { model: "codex-auto-review", hidden: true, isDefault: false },
    ],
    useHiddenModels,
  });
}

function modelNames(catalog) {
  return catalog.models.map((model) => model.model);
}

function withTempDir(callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "api-key-model-visibility-"));
  try {
    return callback(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function withFeatureConfig(enabled, callback) {
  const originalConfig = process.env.CODEX_LINUX_FEATURES_CONFIG;
  return withTempDir((tempDir) => {
    const configPath = path.join(tempDir, "features.json");
    fs.writeFileSync(configPath, `${JSON.stringify({ enabled })}\n`);
    process.env.CODEX_LINUX_FEATURES_CONFIG = configPath;
    try {
      return callback(path.resolve(__dirname, ".."));
    } finally {
      if (originalConfig == null) {
        delete process.env.CODEX_LINUX_FEATURES_CONFIG;
      } else {
        process.env.CODEX_LINUX_FEATURES_CONFIG = originalConfig;
      }
    }
  });
}

test("api-key-model-visibility stays disabled until listed in features.json", () => {
  withFeatureConfig([], (featuresRoot) => {
    assert.deepEqual(loadLinuxFeaturePatchDescriptors({ featuresRoot }), []);
  });

  withFeatureConfig(["api-key-model-visibility"], (featuresRoot) => {
    const loaded = loadLinuxFeaturePatchDescriptors({ featuresRoot });
    assert.deepEqual(
      loaded.map((descriptor) => [descriptor.id, descriptor.phase, descriptor.ciPolicy]),
      [["feature:api-key-model-visibility:api-key-model-visibility-ui", "webview-asset", "optional"]],
    );
  });
});

test("descriptor is optional and targets app main webview chunks", () => {
  assert.deepEqual(
    descriptors.map((descriptor) => [descriptor.id, descriptor.phase, descriptor.ciPolicy]),
    [["api-key-model-visibility-ui", "webview-asset", "optional"]],
  );
  assert.equal(descriptors[0].pattern.test("app-initial-BqZ9AFkF.js"), true);
  assert.equal(descriptors[0].pattern.test("settings-page-abc.js"), false);
});

test("API-key hosts use visible CLI models instead of the desktop allowlist", () => {
  const patched = applyPatchTwice(applyApiKeyModelVisibilityPatch, modelCatalogFixture());
  const catalog = evaluateCatalog(patched, "apikey");

  assert.match(patched, /t!==`apikey`\/\*codexLinuxApiKeyModelVisibility\*\//);
  assert.deepEqual(modelNames(catalog), [
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna",
    "gpt-5.5",
  ]);
  assert.equal(catalog.defaultModel.model, "gpt-5.6-sol");
});

test("API-key hosts still exclude models marked hidden by the CLI", () => {
  const patched = applyApiKeyModelVisibilityPatch(modelCatalogFixture());

  assert.equal(modelNames(evaluateCatalog(patched, "apikey")).includes("codex-auto-review"), false);
});

test("ChatGPT and existing no-allowlist paths keep their upstream behavior", () => {
  const patched = applyApiKeyModelVisibilityPatch(modelCatalogFixture());

  assert.deepEqual(modelNames(evaluateCatalog(patched, "chatgpt")), ["gpt-5.5"]);
  assert.deepEqual(modelNames(evaluateCatalog(patched, "chatgpt", false)), [
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna",
    "gpt-5.5",
  ]);
  assert.deepEqual(modelNames(evaluateCatalog(patched, "amazonBedrock")), [
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna",
    "gpt-5.5",
  ]);
});

test("extended upstream model gates fail soft instead of patching mid-expression", () => {
  const source = modelCatalogFixture().replace(
    "a&&!r&&t!==`amazonBedrock`?",
    "a&&!r&&t!==`amazonBedrock`&&featureGate?",
  );

  assert.equal(applyApiKeyModelVisibilityPatch(source), source);
});

test("enabled descriptor patches a matching extracted webview asset", () => {
  withFeatureConfig(["api-key-model-visibility"], (featuresRoot) => {
    withTempDir((extractedDir) => {
      const assetsDir = path.join(extractedDir, "webview", "assets");
      const assetPath = path.join(assetsDir, "app-initial-fixture.js");
      fs.mkdirSync(assetsDir, { recursive: true });
      fs.writeFileSync(assetPath, modelCatalogFixture());

      const normalized = normalizePatchDescriptors(
        loadLinuxFeaturePatchDescriptors({ featuresRoot }),
      );
      applyWebviewAssetPatchDescriptors(extractedDir, normalized, {}, null);

      assert.match(fs.readFileSync(assetPath, "utf8"), /codexLinuxApiKeyModelVisibility/);
    });
  });
});
