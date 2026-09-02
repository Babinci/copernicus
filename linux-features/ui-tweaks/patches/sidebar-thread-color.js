"use strict";

const INITIAL_ASSET_PATTERN = /^app-initial-[^.]+\.js$/;
const PRIMARY_ASSET_PATTERN = /^app-primary-[^.]+\.js$/;
const STATE_MARKER = "codexLinuxSetSidebarThreadColor";
const UI_MARKER = "/*codexLinuxSidebarThreadColorUi*/";
const COLOR_ATTRIBUTE = "data-codex-linux-thread-label-color";
const STYLE_ID = "codex-linux-sidebar-thread-color-style";
const THREAD_COLORS = Object.freeze([
  { id: "red", label: "Red", value: "#ef4444" },
  { id: "orange", label: "Orange", value: "#f97316" },
  { id: "yellow", label: "Yellow", value: "#eab308" },
  { id: "green", label: "Green", value: "#22c55e" },
  { id: "blue", label: "Blue", value: "#3b82f6" },
  { id: "purple", label: "Purple", value: "#a855f7" },
]);

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

function sidebarThreadColorCss() {
  return THREAD_COLORS.flatMap(({ value }) => [
    `[${COLOR_ATTRIBUTE}=${JSON.stringify(value)}]{background-color:${value}24!important;}`,
    `[${COLOR_ATTRIBUTE}=${JSON.stringify(value)}]:hover{background-color:${value}38!important;}`,
  ]).join("");
}

function stateRuntime({ read, keys, write }) {
  const allowedColors = JSON.stringify(THREAD_COLORS.map(({ value }) => value));
  const css = sidebarThreadColorCss();
  return [
    `\n;globalThis.${STATE_MARKER}=async function(scope,threadId,color){try{`,
    `let selected=color==null?null:${allowedColors}.includes(color)?color:null;if(color!=null&&selected==null)return;`,
    `let raw=${read}(scope.get,${keys}.SIDEBAR_THREAD_METADATA),metadata=raw&&typeof raw===\`object\`&&!Array.isArray(raw)?{...raw}:{},rawEntry=metadata[threadId],entry=rawEntry&&typeof rawEntry===\`object\`&&!Array.isArray(rawEntry)?{...rawEntry}:{};`,
    `if(selected==null){if(!Object.prototype.hasOwnProperty.call(entry,\`labelColor\`))return;delete entry.labelColor}else{if(entry.labelColor===selected)return;entry.labelColor=selected}`,
    `Object.keys(entry).length===0?delete metadata[threadId]:metadata[threadId]=entry;await ${write}(scope,${keys}.SIDEBAR_THREAD_METADATA,Object.keys(metadata).length===0?void 0:metadata,{throwOnFailure:!0})`,
    `}catch(error){console.error(\`Could not update chat color\`,error)}};`,
    `(()=>{if(typeof document===\`undefined\`)return;let style=document.getElementById(${JSON.stringify(STYLE_ID)});if(style){style.textContent=${JSON.stringify(css)};return}style=document.createElement(\`style\`);style.id=${JSON.stringify(STYLE_ID)};style.textContent=${JSON.stringify(css)};(document.head||document.documentElement)?.appendChild(style)})();`,
  ].join("");
}

function initialContract(source) {
  return source.includes(STATE_MARKER) ||
    (SELECTOR_PATTERN.test(source) && WRITER_PATTERN.test(source));
}

function primaryContract(source) {
  return source.includes(UI_MARKER) ||
    (source.includes("labelColor:null,modelProvider:") &&
      source.includes(".sidebarThreadRow(") &&
      source.includes("threadHeader.openSideChat"));
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
  return `${source}${stateRuntime({ read, keys, write })}`;
}

function applySidebarThreadColorUiPatch(source, context = {}) {
  if (!enabled(context) || source.includes(UI_MARKER)) return source;
  if (!primaryContract(source)) {
    if (context.warnOnMissingMarkers === true) warn("Could not identify current sidebar row and menu");
    return source;
  }

  const cache = /t\[(\d+)\]!==([A-Za-z_$][\w$]*)\|\|t\[(\d+)\]!==null(?=[\s\S]{0,2400}?labelColor:null,modelProvider:)/u.exec(source);
  const formatMessage = /message:([A-Za-z_$][\w$]*)\(\{id:`threadHeader\.openSideChat`/u.exec(source)?.[1];
  const menuContext = /function [A-Za-z_$][\w$]*\(\{scope:([A-Za-z_$][\w$]*),target:[A-Za-z_$][\w$]*[\s\S]{0,300}?\}\)\{let\{conversationId:([A-Za-z_$][\w$]*)[\s\S]{0,1800}?[A-Za-z_$][\w$]*=[A-Za-z_$][\w$]*!==`sidebar`\|\|[A-Za-z_$][\w$]*\?\[\]:\[/u.exec(source);
  const rowAttributes = /dataAttributes:([A-Za-z_$][\w$]*)\.sidebarThreadRow\((\{[^{}]{0,240}?kind:`local`[^{}]{0,240}?title:void 0\})\)/u.exec(source);
  if (
    cache == null || formatMessage == null ||
    menuContext == null || rowAttributes == null
  ) {
    if (context.warnOnMissingMarkers === true) warn("Could not identify current sidebar color bindings");
    return source;
  }

  const [, firstCache, colorSelector, colorCache] = cache;
  const colorAssignment = `t[${firstCache}]=${colorSelector},t[${colorCache}]=null`;
  if (!source.includes(colorAssignment)) {
    if (context.warnOnMissingMarkers === true) warn("Could not identify current sidebar color cache");
    return source;
  }

  const [, scope, conversationId] = menuContext;
  const colorItems = THREAD_COLORS.map(({ id, label, value }) =>
    `{id:\`change-thread-color-${id}\`,message:${formatMessage}({id:\`codexLinux.sidebarThreadColor.${id}\`,defaultMessage:\`${label}\`,description:\`Color choice for a local chat\`}),onSelect:()=>globalThis.${STATE_MARKER}?.(${scope},${conversationId},\`${value}\`)}`
  ).join(",");
  const submenu = `[${colorItems},{id:\`change-thread-color-clear\`,message:${formatMessage}({id:\`codexLinux.sidebarThreadColor.clear\`,defaultMessage:\`No color\`,description:\`Remove the color from a local chat\`}),onSelect:()=>globalThis.${STATE_MARKER}?.(${scope},${conversationId},null)}]`;
  let patched = source
    .replace("labelColor:null,modelProvider:", `labelColor:${colorSelector},modelProvider:`)
    .replace(cache[0], `t[${firstCache}]!==${colorSelector}||t[${colorCache}]!==${colorSelector}`)
    .replace(colorAssignment, `t[${firstCache}]=${colorSelector},t[${colorCache}]=${colorSelector}`)
    .replace(
      rowAttributes[0],
      `dataAttributes:{...${rowAttributes[1]}.sidebarThreadRow(${rowAttributes[2]}),${JSON.stringify(COLOR_ATTRIBUTE)}:${colorSelector}}`,
    );
  patched = patched.replace(
    menuContext[0],
    `${menuContext[0]}{id:\`change-thread-color\`,message:${formatMessage}({id:\`codexLinux.sidebarThreadColor.menuItem\`,defaultMessage:\`Change chat color…\`,description:\`Menu item that changes a local chat color\`}),submenu:${submenu}},`,
  );
  if (patched === source || !patched.includes(COLOR_ATTRIBUTE) || !patched.includes("submenu:")) {
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
  COLOR_ATTRIBUTE,
  INITIAL_ASSET_PATTERN,
  PRIMARY_ASSET_PATTERN,
  STATE_MARKER,
  STYLE_ID,
  THREAD_COLORS,
  UI_MARKER,
  applySidebarThreadColorStatePatch,
  applySidebarThreadColorUiPatch,
  descriptors,
  sidebarThreadColorCss,
};
