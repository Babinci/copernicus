#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

require("./dock-icon.test.js");
require("./suggested-prompts.test.js");

const {
  discoverLinuxFeatureManifests,
  loadLinuxFeaturePatchDescriptors,
} = require("../../scripts/lib/linux-features.js");
const {
  ADVANCED_MENU_VIEW_PATTERN,
  DYNAMIC_POWER_EFFORTS_RUNTIME_MARKER,
  INLINE_MODEL_LIST_RUNTIME_MARKER,
  MODEL_PICKER_EFFORT_ASSET_PATTERN,
  MODEL_PICKER_INLINE_ASSET_PATTERN,
  MODEL_PICKER_STATE_ASSET_PATTERN,
  SIMPLE_MENU_VIEW_PATTERN,
  applyDefaultAdvancedViewPatch,
  applyDynamicSupportedReasoningEffortsPatch,
  applyInlineModelListPatch,
} = require("./patches/model-picker-model-list.js");
const {
  DEFAULT_PROJECT_NAME_STYLE,
  PROJECTS_SIDEBAR_ASSET_PATTERN,
  PROJECT_NAME_SELECTOR,
  RUNTIME_MARKER,
  STYLE_ID,
  applySidebarProjectNameStylePatch,
  descriptors: patches,
  sidebarProjectNameCss,
} = require("./patches/sidebar-project-name.js");
const {
  ENGLISH_REASONING_LABELS,
  ZH_CN_LOCALE_ASSET_PATTERN,
  applyEnglishReasoningLabels,
} = require("./patches/reasoning-effort-labels.js");
const {
  COLOR_ATTRIBUTE: THREAD_COLOR_ATTRIBUTE,
  RUNTIME_MARKER: THREAD_COLOR_RUNTIME_MARKER,
  STYLE_ID: THREAD_COLOR_STYLE_ID,
  THREAD_COLORS,
  applySidebarThreadColorPatch,
  sidebarThreadColorCss,
  sidebarThreadColorRuntimeSource,
} = require("./patches/sidebar-thread-color.js");
const {
  RUNTIME_MARKER: FILE_TREE_FOLDER_ACTIONS_RUNTIME_MARKER,
  applyFileTreeFolderActionsPatch,
  runtimeSource: fileTreeFolderActionsRuntimeSource,
} = require("./patches/file-tree-folder-actions.js");

function projectBundleFixture() {
  return [
    "function row(){let j=Pn(`group/folder-row group relative flex h-[var(--height-token-row)] text-sm text-token-foreground`);",
    "let V=(0,Iy.jsx)(`span`,{className:`text-fade-truncate pe-1`,children:p});return [j,V]}",
  ].join("");
}

function modelPickerStateBundleFixture() {
  return [
    "function picker(){",
    "vz=wu(`composer-model-picker-menu-view-v1`,`simple`);",
    "}",
  ].join("");
}

function sidebarThreadColorBundleFixture() {
  return [
    "Pan=ro(Q,(e,{get:t})=>e==null?null:im(t,tu.SIDEBAR_THREAD_METADATA)?.[e]?.labelColor??null);",
    "async function rm(e,t,n,r){return fetch(`set-global-state`,{params:{key:t,value:n}})}",
    "function toast(e,t){e.get(ov).danger(e.get(qb).formatMessage(t))}",
    "function GLc({scope:e,target:t,actions:n,onRename:r,onArchive:i,executeRouteAction:a,surface:o,isUnread:s,isWorktreeThread:c,canOpenSideChat:l,canPin:u,getConversationMarkdown:d}){let{conversationId:f,hostId:p,cwd:m}=t,x=1;let D=uLc({pin:null,rename:{id:`rename-thread`,onSelect:r},readState:null,archive:{id:`archive-thread`,onSelect:i}}),O=o!==`sidebar`?[]:[{id:`open-side-chat`,message:wd({id:`threadHeader.openSideChat`})}];return[D,O]}",
    "function pxl(){",
    "return jsx(Row,{labelColor:null,modelProvider:n.modelProvider,",
    "dataAttributes:Dp.sidebarThreadRow({active:c,hostId:m,id:u,kind:`local`,pinned:r,selected:i,title:k})})}",
    "function WSl(){let ce=n.conversationId,Te=bs(Pan,ce),it;",
    "t[135]!==Te||t[136]!==null?(it=()=>pxl(),",
    "t[135]=Te,t[136]=null,t[158]=it):it=t[158];return it}",
  ].join("");
}

function enabledThreadColorContext() {
  return {
    feature: {
      manifest: { tweaks: { sidebar: { threadColor: { enabled: false } } } },
      settings: { tweaks: { sidebar: { threadColor: { enabled: true } } } },
    },
  };
}

function fileTreeBundleFixture() {
  return [
    "function Sno(){let U={current:null},z=new Map,N={},F={},o=`local`,A={},M=`linux`;",
    "let De;De=()=>{let e=Xso({cwd:n,isWindowsHost:M===`windows`,itemPath:U.current,targetPathByDisplayPath:z});return Kso({...pco({scope:A,cwd:n,fallbackOpenTargets:F,hostId:o,targetPath:e}),onAddToChat:o==null?void 0:e=>{N.mutateAsync({hostId:o,path:e})},onCopyPath:xR,targetPath:e})};",
    "let Oe;Oe=()=>mco({scope:A,cwd:n,hostId:o,targetPath:Xso({cwd:n,isWindowsHost:M===`windows`,itemPath:U.current,targetPathByDisplayPath:z})});",
    "let ke;ke=e=>{U.current=Qso(e.nativeEvent)};return[De,Oe,ke]}",
  ].join("");
}

function modelPickerMenuBundleFixture() {
  return [
    "function menu(){",
    "id:`composer.intelligenceDropdown.model.title`;",
    "let ue=fragment,ie=ue;let fe;",
    "id:`composer.intelligenceDropdown.model.rowLabel`;",
    "id:`composer.intelligenceDropdown.effort.title`;",
    "we=(0,c6.jsxs)(c6.Fragment,{children:[ye,effort]});",
    "}",
  ].join("");
}

function modelPickerPowerBundleFixture() {
  return [
    "function ARe(e,{includeUltraInSlider:t=!1,removeXHigh:n=!1}={}){let r=PRe((t?[...FRe,URe]:FRe).filter(({reasoningEffort:e})=>!n||e!==`xhigh`),e);if(r.length>=3)return r;let i=PRe(IRe.filter(({reasoningEffort:e})=>!n||e!==`xhigh`),e);return i.length>=3?i:[]}",
    "function MRe(e){return e?.flatMap(({displayName:e,model:t,supportedReasoningEfforts:n})=>{let r=e==null?`Custom`:e,i=n.flatMap(({reasoningEffort:e})=>[e]);return(i.length>0?i:[`medium`]).map(e=>({id:`${t}:${e}`,model:t,modelLabel:r,reasoningEffort:e}))})??[]}",
    "function PRe(e,t){return e.flatMap((e,n)=>t?.some(t=>t.model===e.model&&t.supportedReasoningEfforts.some(({reasoningEffort:t})=>t===e.reasoningEffort))?[{...e,powerSettingIndex:n}]:[])}",
    "var FRe=[{id:`gpt-5.6-terra:low`,model:`gpt-5.6-terra`,modelLabel:`5.6 Terra`,reasoningEffort:`low`},{id:`gpt-5.6-sol:low`,model:`gpt-5.6-sol`,modelLabel:`5.6 Sol`,reasoningEffort:`low`},{id:`gpt-5.6-sol:medium`,model:`gpt-5.6-sol`,modelLabel:`5.6 Sol`,reasoningEffort:`medium`},{id:`gpt-5.6-sol:high`,model:`gpt-5.6-sol`,modelLabel:`5.6 Sol`,reasoningEffort:`high`},{id:`gpt-5.6-sol:xhigh`,model:`gpt-5.6-sol`,modelLabel:`5.6 Sol`,reasoningEffort:`xhigh`}];",
    "var URe={id:`gpt-5.6-sol:ultra`,model:`gpt-5.6-sol`,modelLabel:`5.6 Sol`,reasoningEffort:`ultra`};",
    "var IRe=[{id:`gpt-5.6-terra:low`,model:`gpt-5.6-terra`,modelLabel:`5.6 Terra`,reasoningEffort:`low`},{id:`gpt-5.6-terra:medium`,model:`gpt-5.6-terra`,modelLabel:`5.6 Terra`,reasoningEffort:`medium`},{id:`gpt-5.6-terra:high`,model:`gpt-5.6-terra`,modelLabel:`5.6 Terra`,reasoningEffort:`high`},{id:`gpt-5.6-terra:xhigh`,model:`gpt-5.6-terra`,modelLabel:`5.6 Terra`,reasoningEffort:`xhigh`}];",
  ].join("");
}

function filteredGpt56Models(enabledReasoningEfforts) {
  const enabled = new Set(enabledReasoningEfforts);
  return [
    {
      displayName: "GPT-5.6-Terra",
      model: "gpt-5.6-terra",
      supportedReasoningEfforts: ["low", "medium", "high", "xhigh"]
        .filter((reasoningEffort) => enabled.has(reasoningEffort))
        .map((reasoningEffort) => ({ reasoningEffort })),
    },
    {
      displayName: "GPT-5.6-Sol",
      model: "gpt-5.6-sol",
      supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max", "ultra"]
        .filter((reasoningEffort) => enabled.has(reasoningEffort))
        .map((reasoningEffort) => ({ reasoningEffort })),
    },
  ];
}

function simplifiedChineseLocaleFixture() {
  const labels = {
    "composer.mode.local.reasoning.none.label": "无",
    "composer.mode.local.reasoning.minimal.label": "极低",
    "composer.mode.local.reasoning.low.label.v2": "轻度",
    "composer.mode.local.reasoning.medium.label": "中",
    "composer.mode.local.reasoning.high.label": "高",
    "composer.mode.local.reasoning.xhigh.label": "极高",
    "composer.mode.local.reasoning.max.label": "最高",
    "composer.mode.local.reasoning.ultra.label": "极高",
  };
  return Object.entries(labels)
    .map(([key, value]) => `"${key}":\`${value}\``)
    .join(",");
}

function applyPatchTwice(source, context) {
  const patched = applySidebarProjectNameStylePatch(source, context);
  assert.equal(applySidebarProjectNameStylePatch(patched, context), patched);
  return patched;
}

function copyFeatureTo(featuresRoot) {
  const featureDir = path.join(featuresRoot, "ui-tweaks");
  fs.mkdirSync(featureDir, { recursive: true });
  for (const name of ["feature.json", "README.md", "patch.js"]) {
    fs.copyFileSync(path.join(__dirname, name), path.join(featureDir, name));
  }
  fs.cpSync(path.join(__dirname, "patches"), path.join(featureDir, "patches"), { recursive: true });
}

function withCapturedWarns(fn) {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(String(message));
  try {
    return { value: fn(), warnings };
  } finally {
    console.warn = originalWarn;
  }
}

test("ui-tweaks is discoverable and disabled until listed in features.json", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-tweaks-feature-"));
  try {
    const featuresRoot = path.join(tempDir, "linux-features");
    fs.mkdirSync(featuresRoot, { recursive: true });
    copyFeatureTo(featuresRoot);
    fs.writeFileSync(path.join(featuresRoot, "features.example.json"), '{"enabled":[]}\n');

    const manifests = discoverLinuxFeatureManifests({ featuresRoot });
    assert.equal(manifests.length, 1);
    assert.equal(manifests[0].id, "ui-tweaks");
    assert.equal(manifests[0].manifest.defaultEnabled, false);
    assert.deepEqual(loadLinuxFeaturePatchDescriptors({ featuresRoot }), []);

    fs.writeFileSync(path.join(featuresRoot, "features.json"), '{"enabled":["ui-tweaks"]}\n');
    const descriptors = loadLinuxFeaturePatchDescriptors({ featuresRoot });
    assert.deepEqual(
      descriptors.map((descriptor) => [descriptor.id, descriptor.phase, descriptor.ciPolicy]),
      [
        ["feature:ui-tweaks:sidebar-project-name-style", "webview-asset", "optional"],
        ["feature:ui-tweaks:sidebar-thread-color", "webview-asset", "optional"],
        ["feature:ui-tweaks:file-tree-folder-actions", "webview-asset", "optional"],
        ["feature:ui-tweaks:model-picker-default-advanced-view", "webview-asset", "optional"],
        ["feature:ui-tweaks:model-picker-inline-model-list", "webview-asset", "optional"],
        [
          "feature:ui-tweaks:model-picker-dynamic-supported-reasoning-efforts",
          "webview-asset",
          "optional",
        ],
        ["feature:ui-tweaks:reasoning-effort-labels-english", "webview-asset", "optional"],
        ["feature:ui-tweaks:appearance-dock-icon-main-process", "main-bundle", "optional"],
        ["feature:ui-tweaks:appearance-dock-icon-settings-row", "webview-asset", "optional"],
        ["feature:ui-tweaks:appearance-dock-icon-settings-search", "webview-asset", "optional"],
        ["feature:ui-tweaks:home-suggested-prompts-main-process", "main-bundle", "optional"],
        ["feature:ui-tweaks:home-suggested-prompts-app-page", "webview-asset", "optional"],
        ["feature:ui-tweaks:home-suggested-prompts-settings-row", "webview-asset", "optional"],
        ["feature:ui-tweaks:home-suggested-prompts-content", "webview-asset", "optional"],
      ],
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("model picker descriptors target the current state and menu bundles", () => {
  const stateAsset = "app-initial-BTphDPeq.js";
  const effortAsset = stateAsset;

  assert.match(stateAsset, MODEL_PICKER_STATE_ASSET_PATTERN);
  assert.match(stateAsset, MODEL_PICKER_INLINE_ASSET_PATTERN);
  assert.match(effortAsset, MODEL_PICKER_EFFORT_ASSET_PATTERN);

  // Current-DMG-only targeting must not retain previous chunks as fallbacks.
  assert.doesNotMatch(
    "app-initial~app-main~page-CMpPiY3-.js",
    MODEL_PICKER_STATE_ASSET_PATTERN,
  );
});

test("workspace file tree exposes existing path actions for folders", () => {
  const context = {
    feature: { settings: { tweaks: { fileTree: { folderActions: { enabled: true } } } } },
  };
  const patched = applyFileTreeFolderActionsPatch(fileTreeBundleFixture(), context);
  assert.match(patched, new RegExp(FILE_TREE_FOLDER_ACTIONS_RUNTIME_MARKER));
  assert.match(patched, /U\.current\?\.type!==`file`\?void 0/);
  assert.equal(applyFileTreeFolderActionsPatch(patched, context), patched);

  class FakeElement {
    constructor(type, path) { this.attributes = { "data-item-type": type, "data-item-path": path }; }
    getAttribute(name) { return this.attributes[name] ?? null; }
  }
  const runtime = Function(
    "Element",
    "Sp",
    `${fileTreeFolderActionsRuntimeSource()};return {target:codexLinuxFileTreeContextTarget,path:codexLinuxFileTreeContextPath};`,
  )(FakeElement, (cwd, path) => `${cwd}/${path}`);
  const folder = runtime.target({ composedPath: () => [new FakeElement("folder", "docs")] });
  assert.deepEqual(folder, { path: "docs", type: "folder" });
  assert.equal(runtime.path(new Map(), folder, "/tmp/project", false), "/tmp/project/docs");
});

test("model picker opens advanced view and renders model choices inline", () => {
  const stateSource = modelPickerStateBundleFixture();
  const menuSource = modelPickerMenuBundleFixture();
  const patchedState = applyDefaultAdvancedViewPatch(stateSource);
  const patchedMenu = applyInlineModelListPatch(menuSource);

  assert.match(patchedState, ADVANCED_MENU_VIEW_PATTERN);
  assert.doesNotMatch(patchedState, SIMPLE_MENU_VIEW_PATTERN);
  assert.match(patchedMenu, new RegExp(INLINE_MODEL_LIST_RUNTIME_MARKER));
  assert.match(patchedMenu, /children:\[ie,\/\*codex-linux-inline-model-list\*\//);
  assert.equal(applyDefaultAdvancedViewPatch(patchedState), patchedState);
  assert.equal(applyInlineModelListPatch(patchedMenu), patchedMenu);
});

test("GPT-5.6 Power slider follows reasoning efforts enabled in settings", () => {
  const source = modelPickerPowerBundleFixture();
  const patched = applyDynamicSupportedReasoningEffortsPatch(source);
  const resolvePowerSelections = Function(`${patched};return ARe;`)();

  assert.match(patched, new RegExp(DYNAMIC_POWER_EFFORTS_RUNTIME_MARKER));
  assert.equal(applyDynamicSupportedReasoningEffortsPatch(patched), patched);
  assert.deepEqual(
    resolvePowerSelections(filteredGpt56Models(["low", "medium", "high", "xhigh", "max"]))
      .map(({ id }) => id),
    [
      "gpt-5.6-terra:low",
      "gpt-5.6-sol:low",
      "gpt-5.6-sol:medium",
      "gpt-5.6-sol:high",
      "gpt-5.6-sol:xhigh",
      "gpt-5.6-sol:max",
    ],
  );
  assert.deepEqual(
    resolvePowerSelections(filteredGpt56Models(["low", "medium", "high", "xhigh"]))
      .map(({ id }) => id),
    [
      "gpt-5.6-terra:low",
      "gpt-5.6-sol:low",
      "gpt-5.6-sol:medium",
      "gpt-5.6-sol:high",
      "gpt-5.6-sol:xhigh",
    ],
  );
  assert.deepEqual(
    resolvePowerSelections(
      filteredGpt56Models(["low", "medium", "high", "xhigh", "ultra"]),
      { includeUltraInSlider: true },
    ).map(({ id }) => id),
    [
      "gpt-5.6-terra:low",
      "gpt-5.6-sol:low",
      "gpt-5.6-sol:medium",
      "gpt-5.6-sol:high",
      "gpt-5.6-sol:xhigh",
      "gpt-5.6-sol:ultra",
    ],
  );
});

test("GPT-5.6 Power slider effort patch fails soft when upstream markers drift", () => {
  const source = "function modelPickerPowerSelections(){return []}";
  const { value, warnings } = withCapturedWarns(() =>
    applyDynamicSupportedReasoningEffortsPatch(source, { warnOnMissingMarkers: true }),
  );

  assert.equal(value, source);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Could not find the supported reasoning effort mapper/);
});

test("model picker tweak can be disabled through feature settings", () => {
  const stateSource = modelPickerStateBundleFixture();
  const menuSource = modelPickerMenuBundleFixture();
  const context = {
    feature: {
      settings: {
        tweaks: {
          modelPicker: {
            showModelsByDefault: {
              enabled: false,
            },
          },
        },
      },
    },
  };

  assert.equal(applyDefaultAdvancedViewPatch(stateSource, context), stateSource);
  assert.equal(applyInlineModelListPatch(menuSource, context), menuSource);
  assert.equal(
    applyDynamicSupportedReasoningEffortsPatch(modelPickerPowerBundleFixture(), context),
    modelPickerPowerBundleFixture(),
  );
});

test("model picker drift warns and leaves the asset unchanged", () => {
  const source = "console.log('model picker drifted');";
  const { value, warnings } = withCapturedWarns(() =>
    applyDefaultAdvancedViewPatch(source, { warnOnMissingMarkers: true }),
  );

  assert.equal(value, source);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^WARN: Could not find the persisted model picker view marker/);
});

test("reasoning effort labels stay in English in the Simplified Chinese locale", () => {
  const source = simplifiedChineseLocaleFixture();
  const patched = applyEnglishReasoningLabels(source);

  for (const [key, label] of Object.entries(ENGLISH_REASONING_LABELS)) {
    assert.match(patched, new RegExp(`"${key.replaceAll(".", "\\.")}":\\\`${label}\\\``));
  }
  assert.equal(applyEnglishReasoningLabels(patched), patched);
  assert.match("zh-CN-BPHwMaw8.js", ZH_CN_LOCALE_ASSET_PATTERN);
  assert.doesNotMatch("zh-TW-rBlCyjlT.js", ZH_CN_LOCALE_ASSET_PATTERN);
});

test("reasoning effort label drift warns and leaves the asset unchanged", () => {
  const source = simplifiedChineseLocaleFixture().replace(
    '"composer.mode.local.reasoning.ultra.label":`极高`',
    '"composer.mode.local.reasoning.ultra.missing":`极高`',
  );
  const { value, warnings } = withCapturedWarns(() =>
    applyEnglishReasoningLabels(source, { warnOnMissingMarkers: true }),
  );

  assert.equal(value, source);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /composer\.mode\.local\.reasoning\.ultra\.label/);
});

test("mixed reasoning effort label markers warn and remain byte-identical", () => {
  const source = simplifiedChineseLocaleFixture().replace(
    '"composer.mode.local.reasoning.medium.label":`中`',
    '"composer.mode.local.reasoning.medium.label":`Medium`',
  );
  const { value, warnings } = withCapturedWarns(() =>
    applyEnglishReasoningLabels(source, { warnOnMissingMarkers: true }),
  );

  assert.equal(value, source);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /mixed applied and untranslated reasoning label markers/i);
});

test("English reasoning effort labels can be disabled", () => {
  const source = simplifiedChineseLocaleFixture();
  const context = {
    feature: {
      settings: {
        tweaks: {
          reasoning: {
            keepEffortLabelsEnglish: {
              enabled: false,
            },
          },
        },
      },
    },
  };

  assert.equal(applyEnglishReasoningLabels(source, context), source);
});

test("sidebar project descriptor targets only the current project sidebar asset", () => {
  assert.match("app-initial-BTphDPeq.js", PROJECTS_SIDEBAR_ASSET_PATTERN);
  assert.doesNotMatch(
    "app-initial~app-main~page-kMhXWEru.js",
    PROJECTS_SIDEBAR_ASSET_PATTERN,
  );
  assert.doesNotMatch(
    "app-initial~app-main~automations-page-BcHjEK7e.js",
    PROJECTS_SIDEBAR_ASSET_PATTERN,
  );
  assert.doesNotMatch("projects-index-page-TFjtVwC4.js", PROJECTS_SIDEBAR_ASSET_PATTERN);
  assert.doesNotMatch(
    "app-initial~app-main~remote-conversation-page~projects-index-page-By2_tGIM.js",
    PROJECTS_SIDEBAR_ASSET_PATTERN,
  );
});

test("sidebar thread colors are opt-in and patch the complete current contract once", () => {
  const source = sidebarThreadColorBundleFixture();
  assert.equal(applySidebarThreadColorPatch(source), source);

  const context = enabledThreadColorContext();
  const patched = applySidebarThreadColorPatch(source, context);

  assert.match(patched, new RegExp(THREAD_COLOR_RUNTIME_MARKER));
  assert.match(patched, new RegExp(THREAD_COLOR_STYLE_ID));
  assert.match(patched, new RegExp(THREAD_COLOR_ATTRIBUTE));
  assert.match(patched, /labelColor:Te/);
  assert.match(patched, /change-thread-color/);
  assert.match(patched, /o===`sidebar`&&D\.push\(\{id:`change-thread-color`/);
  assert.match(patched, /t\[135\]!==Te\|\|t\[136\]!==Te/);
  assert.match(patched, /t\[135\]=Te,t\[136\]=Te/);
  assert.match(patched, /dataAttributes:\{\.\.\.Dp\.sidebarThreadRow/);
  assert.match(patched, /defaultMessage:`Change chat color…`/);
  assert.doesNotMatch(patched, /Change pin color/);
  assert.match(patched, /tu\.SIDEBAR_THREAD_METADATA/);
  assert.doesNotMatch(patched, /labelColor:null/);
  assert.equal(applySidebarThreadColorPatch(patched, context), patched);
});

test("sidebar thread colors tolerate upstream minifier alias changes", () => {
  const source = sidebarThreadColorBundleFixture().replace(
    "dataAttributes:Dp.sidebarThreadRow",
    "dataAttributes:Ep.sidebarThreadRow",
  );
  const patched = applySidebarThreadColorPatch(source, enabledThreadColorContext());

  assert.match(patched, /dataAttributes:\{\.\.\.Ep\.sidebarThreadRow/);
  assert.match(patched, new RegExp(THREAD_COLOR_RUNTIME_MARKER));
});

test("sidebar thread color runtime is dependency-free valid JavaScript", () => {
  const runtime = sidebarThreadColorRuntimeSource();
  assert.doesNotThrow(() => Function(runtime)());
  assert.match(runtime, /background-color:#ef444424!important/);
  assert.match(runtime, /:hover\{background-color:#ef444438!important/);
  assert.doesNotMatch(runtime, /::before/);
  for (const { label, value } of THREAD_COLORS) {
    assert.match(runtime, new RegExp(label));
    assert.match(runtime, new RegExp(value));
  }
});

test("sidebar thread color patch upgrades an existing marker runtime to the full-row tint", () => {
  const context = enabledThreadColorContext();
  const current = applySidebarThreadColorPatch(sidebarThreadColorBundleFixture(), context);
  const legacy = current.replace(
    JSON.stringify(sidebarThreadColorCss()),
    JSON.stringify(`[${THREAD_COLOR_ATTRIBUTE}]{position:relative;}`),
  );

  assert.notEqual(legacy, current);
  assert.equal(applySidebarThreadColorPatch(legacy, context), current);
});

test("sidebar thread color runtime merges, clears, validates, and reports failures", async () => {
  let persisted = {
    "thread-one": { labelColor: "#ef4444", futureField: true },
    "thread-two": { labelColor: "#22c55e" },
  };
  let writes = 0;
  const toasts = [];
  const toastKey = Symbol("toast");
  const scope = { get: (key) => (key === toastKey ? { danger: (message) => toasts.push(message) } : null) };
  let failWrite = false;
  const runtime = Function(
    "im",
    "tu",
    "rm",
    "wd",
    "ov",
    "document",
    `${sidebarThreadColorRuntimeSource({
      errorToastAtom: "ov",
      formatMessage: "wd",
      globalStateKeys: "tu",
      readGlobalState: "im",
      writeGlobalState: "rm",
    })};return {` +
      `setColor:codexLinuxSetSidebarThreadColor,menu:codexLinuxSidebarThreadColorMenu};`,
  )(
    () => persisted,
    { SIDEBAR_THREAD_METADATA: "sidebar-thread-metadata" },
    async (_scope, _key, value) => {
      writes += 1;
      if (failWrite) throw new Error("write failed");
      persisted = value;
    },
    (message) => message,
    toastKey,
    undefined,
  );

  assert.deepEqual(runtime.menu(scope, "thread-one").map((item) => item.message.defaultMessage), [
    ...THREAD_COLORS.map(({ label }) => label),
    "No color",
  ]);

  await runtime.setColor(scope, "thread-one", "#3b82f6");
  assert.deepEqual(persisted, {
    "thread-one": { labelColor: "#3b82f6", futureField: true },
    "thread-two": { labelColor: "#22c55e" },
  });

  await runtime.setColor(scope, "thread-one", null);
  assert.deepEqual(persisted, {
    "thread-one": { futureField: true },
    "thread-two": { labelColor: "#22c55e" },
  });

  const writesBeforeInvalid = writes;
  await runtime.setColor(scope, "thread-one", "red");
  assert.equal(writes, writesBeforeInvalid);

  failWrite = true;
  await runtime.setColor(scope, "thread-two", "#a855f7");
  assert.deepEqual(toasts, ["Could not update chat color"]);
  assert.deepEqual(persisted["thread-two"], { labelColor: "#22c55e" });
});

test("sidebar thread color drift warns and remains byte-identical", () => {
  const source = sidebarThreadColorBundleFixture().replace(
    "labelColor:null,modelProvider:",
    "labelColor:void 0,modelProvider:",
  );
  const { value, warnings } = withCapturedWarns(() =>
    applySidebarThreadColorPatch(source, {
      ...enabledThreadColorContext(),
      warnOnMissingMarkers: true,
    }),
  );

  assert.equal(value, source);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Expected exactly one current sidebar marker/);
});

test("patch injects sidebar project-name stylesheet runtime once", () => {
  const context = {
    feature: {
      manifest: {
        tweaks: {
          sidebar: {
            projectName: {
              style: DEFAULT_PROJECT_NAME_STYLE,
            },
          },
        },
      },
      settings: {
        tweaks: {
          sidebar: {
            projectName: {
              style: "font-weight: 800 !important; color: red;",
            },
          },
        },
      },
    },
  };

  const patched = applyPatchTwice(projectBundleFixture(), context);

  assert.match(patched, new RegExp(STYLE_ID));
  assert.match(patched, new RegExp(RUNTIME_MARKER));
  assert.match(patched, /font-weight: 800 !important; color: red;/);
  assert.ok(
    patched.includes(JSON.stringify(sidebarProjectNameCss("font-weight: 800 !important; color: red;"))),
  );
  assert.equal((patched.match(new RegExp(STYLE_ID, "g")) ?? []).length, 1);
});

test("feature manifest defaults reach descriptor context through the feature loader", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-tweaks-manifest-defaults-"));
  try {
    const featuresRoot = path.join(tempDir, "linux-features");
    fs.mkdirSync(featuresRoot, { recursive: true });
    copyFeatureTo(featuresRoot);
    fs.writeFileSync(path.join(featuresRoot, "features.json"), '{"enabled":["ui-tweaks"]}\n');

    const [descriptor] = loadLinuxFeaturePatchDescriptors({ featuresRoot });
    const patched = descriptor.apply(projectBundleFixture(), {});

    assert.match(patched, /font-weight: 700 !important;/);
    assert.doesNotMatch(patched, /padding-top/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("default project name style is bold without changing fixed row geometry", () => {
  const featureJson = JSON.parse(fs.readFileSync(path.join(__dirname, "feature.json"), "utf8"));
  assert.equal(featureJson.tweaks.sidebar.projectName.style, DEFAULT_PROJECT_NAME_STYLE);
  assert.match(DEFAULT_PROJECT_NAME_STYLE, /font-weight:\s*700\s*!important/);
  assert.doesNotMatch(DEFAULT_PROJECT_NAME_STYLE, /(?:padding|margin|height)/i);
  assert.doesNotMatch(DEFAULT_PROJECT_NAME_STYLE, /color/i);
  assert.doesNotMatch(sidebarProjectNameCss(DEFAULT_PROJECT_NAME_STYLE), /#000|black/i);
});

test("feature settings override the tracked defaults through features.json", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-tweaks-settings-"));
  try {
    const featuresRoot = path.join(tempDir, "linux-features");
    fs.mkdirSync(featuresRoot, { recursive: true });
    copyFeatureTo(featuresRoot);
    fs.writeFileSync(
      path.join(featuresRoot, "features.json"),
      `${JSON.stringify(
        {
          enabled: ["ui-tweaks"],
          settings: {
            "ui-tweaks": {
              tweaks: {
                sidebar: {
                  projectName: {
                    style: "font-weight: 800 !important; color: red;",
                  },
                },
              },
            },
          },
        },
        null,
        2,
      )}\n`,
    );

    const [descriptor] = loadLinuxFeaturePatchDescriptors({ featuresRoot });
    const patched = descriptor.apply(projectBundleFixture(), {});

    assert.match(patched, /font-weight: 800 !important; color: red;/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("invalid feature settings warn and fall back to defaults", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-tweaks-invalid-settings-"));
  try {
    const featuresRoot = path.join(tempDir, "linux-features");
    fs.mkdirSync(featuresRoot, { recursive: true });
    copyFeatureTo(featuresRoot);
    fs.writeFileSync(
      path.join(featuresRoot, "features.json"),
      '{"enabled":["ui-tweaks"],"settings":{"ui-tweaks":false}}\n',
    );

    const { value: descriptors, warnings } = withCapturedWarns(() =>
      loadLinuxFeaturePatchDescriptors({ featuresRoot }),
    );
    const patched = descriptors[0].apply(projectBundleFixture(), {});

    assert.match(warnings.join("\n"), /WARN: Linux feature 'ui-tweaks' settings/);
    assert.match(patched, /font-weight: 700 !important;/);
    assert.doesNotMatch(patched, /padding-top/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("patch skips unrelated assets", () => {
  const source = "console.log('not the sidebar');";
  const { value, warnings } = withCapturedWarns(() => applySidebarProjectNameStylePatch(source));

  assert.equal(value, source);
  assert.deepEqual(warnings, []);
});

test("drift warning returns source unchanged", () => {
  const source = [
    "function Hd(){return {id:`sidebarElectron.projectsNavLink`,defaultMessage:`Projects`}}",
    "function row(){let j=Pn(`group/folder-row group relative flex`);return j}",
  ].join("");

  const { value, warnings } = withCapturedWarns(() => applySidebarProjectNameStylePatch(source));

  assert.equal(value, source);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^WARN: Could not find current sidebar project name markers/);
});

test("target asset drift warning returns source unchanged when all markers are missing", () => {
  const source = "console.log('projects sidebar bundle drifted');";

  const { value, warnings } = withCapturedWarns(() => patches[0].apply(source, {}));

  assert.equal(value, source);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^WARN: Could not find current sidebar project name markers/);
});

test("invalid and empty styles warn and fall back without throwing", () => {
  for (const badStyle of [42, "   "]) {
    const { value, warnings } = withCapturedWarns(() =>
      applySidebarProjectNameStylePatch(projectBundleFixture(), {
        feature: {
          manifest: {
            tweaks: {
              sidebar: {
                projectName: {
                  style: DEFAULT_PROJECT_NAME_STYLE,
                },
              },
            },
          },
          settings: {
            tweaks: {
              sidebar: {
                projectName: {
                  style: badStyle,
                },
              },
            },
          },
        },
      }),
    );

    assert.match(value, new RegExp(STYLE_ID));
    assert.match(value, /font-weight: 700 !important;/);
    assert.doesNotMatch(value, /padding-top/);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /^WARN: ui-tweaks sidebar project name style/);
  }
});

test("unsafe styles warn, stay scoped, and fall back to the default", () => {
  const unsafeStyle = "font-weight:700;} body{display:none} /*";
  const { value, warnings } = withCapturedWarns(() =>
    applySidebarProjectNameStylePatch(projectBundleFixture(), {
      feature: {
        settings: {
          tweaks: {
            sidebar: {
              projectName: {
                style: unsafeStyle,
              },
            },
          },
        },
      },
    }),
  );

  assert.match(value, new RegExp(STYLE_ID));
  assert.match(value, /font-weight: 700 !important;/);
  assert.doesNotMatch(value, /padding-top/);
  assert.doesNotMatch(value, /body\{display:none\}/);
  assert.equal(value.includes(unsafeStyle), false);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^WARN: ui-tweaks sidebar project name style must be a safe CSS declaration list/);
});
