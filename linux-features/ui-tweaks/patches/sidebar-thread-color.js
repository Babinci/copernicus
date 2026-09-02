"use strict";

const INITIAL_ASSET_PATTERN = /^app-initial-[^.]+\.js$/;
const PRIMARY_ASSET_PATTERN = /^app-primary-[^.]+\.js$/;
const STATE_MARKER = "codexLinuxSetSidebarThreadColor";
const UI_MARKER = "/*codexLinuxSidebarThreadColorUi*/";

const SELECTOR_PATTERN =
  /([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)\(([A-Za-z_$][\w$]*),\(e,\{get:t\}\)=>e==null\?null:([A-Za-z_$][\w$]*)\(t,([A-Za-z_$][\w$]*)\.SIDEBAR_THREAD_METADATA\)\?\.\[e\]\?\.labelColor\?\?null\)/u;
const WRITER_PATTERN =
  /async function ([A-Za-z_$][\w$]*)\(([A-Za-z_$][\w$]*),([A-Za-z_$][\w$]*),([A-Za-z_$][\w$]*),([A-Za-z_$][\w$]*)\)\{[\s\S]{0,900}?`set-global-state`,\{params:\{key:\3,value:\4\}\}/u;

function threadColorConfig(context) {
  const defaults = context?.feature?.manifest?.tweaks?.sidebar?.threadColor;
  const settings = context?.feature?.settings?.tweaks?.sidebar?.threadColor;
  return {
    ...(defaults != null && typeof defaults === "object" && !Array.isArray(defaults) ? defaults : {}),
    ...(settings != null && typeof settings === "object" && !Array.isArray(settings) ? settings : {}),
  };
}

function enabled(context) {
  return threadColorConfig(context).enabled === true;
}

function warn(message) {
  console.warn(`WARN: ${message} - skipping ui-tweaks sidebar thread color patch`);
}

function initialContract(source) {
  return source.includes(STATE_MARKER) ||
    (SELECTOR_PATTERN.test(source) && WRITER_PATTERN.test(source));
}

function primaryContract(source) {
  return source.includes(UI_MARKER) ||
    (source.includes("labelColor:null,modelProvider:") &&
      source.includes("initialColor:null,showColorPicker:!1") &&
      source.includes("function vwn("));
}

function applySidebarThreadColorStatePatch(source, context = {}) {
  if (!enabled(context) || source.includes(STATE_MARKER)) return source;
  const selector = source.match(SELECTOR_PATTERN);
  const writer = source.match(WRITER_PATTERN);
  if (selector == null || writer == null) {
    if (context.warnOnMissingMarkers === true) warn("Could not identify sidebar metadata helpers");
    return source;
  }

  const read = selector[4];
  const keys = selector[5];
  const write = writer[1];
  return `${source};globalThis.${STATE_MARKER}=async function(scope,threadId,color){try{if(color!=null&&typeof color!==\`string\`)return;let raw=${read}(scope.get,${keys}.SIDEBAR_THREAD_METADATA),metadata=raw&&typeof raw===\`object\`&&!Array.isArray(raw)?{...raw}:{},rawEntry=metadata[threadId],entry=rawEntry&&typeof rawEntry===\`object\`&&!Array.isArray(rawEntry)?{...rawEntry}:{};if(color==null){if(!Object.hasOwn(entry,\`labelColor\`))return;delete entry.labelColor}else{if(entry.labelColor===color)return;entry.labelColor=color}Object.keys(entry).length===0?delete metadata[threadId]:metadata[threadId]=entry;await ${write}(scope,${keys}.SIDEBAR_THREAD_METADATA,Object.keys(metadata).length===0?void 0:metadata,{throwOnFailure:!0})}catch(error){console.error(\`Could not update chat color\`,error)}}`;
}

function applySidebarThreadColorUiPatch(source, context = {}) {
  if (!enabled(context) || source.includes(UI_MARKER)) return source;
  if (!primaryContract(source)) {
    if (context.warnOnMissingMarkers === true) warn("Could not identify current sidebar row and rename dialog");
    return source;
  }

  const colorSelector = source.match(/([A-Za-z_$][\w$]*)=pE\(_Pe,([A-Za-z_$][\w$]*)\),/u)?.[1];
  const cache = colorSelector == null
    ? null
    : source.match(new RegExp(`t\\[(\\d+)\\]!==${colorSelector}\\|\\|t\\[(\\d+)\\]!==null`, "u"));
  const menu = /O=([A-Za-z_$][\w$]*)!==`sidebar`\|\|([A-Za-z_$][\w$]*)\?\[\]:\[\.\.\.UCn/u.exec(source);
  const formatMessage = /message:([A-Za-z_$][\w$]*)\(\{id:`threadHeader\.openSideChat`/u.exec(source)?.[1];
  if (colorSelector == null || cache == null || menu == null || formatMessage == null) {
    if (context.warnOnMissingMarkers === true) warn("Could not identify current sidebar color bindings");
    return source;
  }

  const [, firstCache, colorCache] = cache;
  const colorAssignment = `t[${firstCache}]=${colorSelector},t[${colorCache}]=null`;
  if (!source.includes(colorAssignment)) {
    if (context.warnOnMissingMarkers === true) warn("Could not identify current sidebar color cache");
    return source;
  }

  let patched = source
    .replace("labelColor:null,modelProvider:", `labelColor:${colorSelector},modelProvider:`)
    .replace(cache[0], `t[${firstCache}]!==${colorSelector}||t[${colorCache}]!==${colorSelector}`)
    .replace(colorAssignment, `t[${firstCache}]=${colorSelector},t[${colorCache}]=${colorSelector}`)
    .replace(
      "initialColor:null,showColorPicker:!1,onSave:(e,t)=>{ie({conversationId:n,hostId:w?.hostId,previousTitle:U??void 0,title:e})}",
      `initialColor:C,showColorPicker:!0,onSave:(e,t)=>{ie({conversationId:n,hostId:w?.hostId,previousTitle:U??void 0,title:e}),globalThis.${STATE_MARKER}?.(T,n,t)}`,
    );
  patched = patched.replace(
    menu[0],
    `O=${menu[1]}!==\`sidebar\`||${menu[2]}?[]:[{id:\`change-thread-color\`,message:${formatMessage}({id:\`codexLinux.sidebarThreadColor.menuItem\`,defaultMessage:\`Change chat color…\`,description:\`Menu item that changes a local chat color\`}),onSelect:r},...UCn`,
  );
  if (patched === source || patched.includes("initialColor:null,showColorPicker:!1")) {
    if (context.warnOnMissingMarkers === true) warn("Could not apply current sidebar color bindings");
    return source;
  }
  return `${UI_MARKER}${patched}`;
}

const descriptors = [
  {
    id: "sidebar-thread-color-state",
    phase: "webview-asset",
    order: 20_792,
    ciPolicy: "optional",
    pattern: INITIAL_ASSET_PATTERN,
    enabled: (context) => enabled(context),
    assetMatch: initialContract,
    missingDescription: "sidebar thread metadata bundle",
    skipDescription: "ui-tweaks sidebar thread color state patch",
    apply: (source, context = {}) =>
      applySidebarThreadColorStatePatch(source, { ...context, warnOnMissingMarkers: true }),
  },
  {
    id: "sidebar-thread-color-ui",
    phase: "webview-asset",
    order: 20_793,
    ciPolicy: "optional",
    pattern: PRIMARY_ASSET_PATTERN,
    enabled: (context) => enabled(context),
    assetMatch: primaryContract,
    missingDescription: "local thread sidebar bundle",
    skipDescription: "ui-tweaks sidebar thread color UI patch",
    apply: (source, context = {}) =>
      applySidebarThreadColorUiPatch(source, { ...context, warnOnMissingMarkers: true }),
  },
];

module.exports = {
  INITIAL_ASSET_PATTERN,
  PRIMARY_ASSET_PATTERN,
  STATE_MARKER,
  UI_MARKER,
  applySidebarThreadColorStatePatch,
  applySidebarThreadColorUiPatch,
  descriptors,
};
