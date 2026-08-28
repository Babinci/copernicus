"use strict";

const THREAD_COLOR_ASSET_PATTERN = /^app-initial-[^.]+\.js$/;
const RUNTIME_MARKER = "codexLinuxSidebarThreadColorRuntime";
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

const COLOR_SELECTOR_DEFINITION_PATTERN =
  /([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)\(([A-Za-z_$][\w$]*),\(e,\{get:t\}\)=>e==null\?null:([A-Za-z_$][\w$]*)\(t,([A-Za-z_$][\w$]*)\.SIDEBAR_THREAD_METADATA\)\?\.\[e\]\?\.labelColor\?\?null\)/gu;
const NULL_COLOR_MARKER = "labelColor:null,modelProvider:";
const NULL_COLOR_REPLACEMENT = "labelColor:Te,modelProvider:";
const COLOR_CACHE_DEPENDENCY_MARKER = "t[135]!==Te||t[136]!==null";
const COLOR_CACHE_DEPENDENCY_REPLACEMENT = "t[135]!==Te||t[136]!==Te";
const COLOR_CACHE_VALUE_MARKER = "t[135]=Te,t[136]=null";
const COLOR_CACHE_VALUE_REPLACEMENT = "t[135]=Te,t[136]=Te";
const ROW_ATTRIBUTES_PATTERN =
  /dataAttributes:([A-Za-z_$][\w$]*)\.sidebarThreadRow\(\{active:c,hostId:m,id:u,kind:`local`,pinned:r,selected:i,title:k\}\)/gu;
const MENU_PATTERN =
  /(function [A-Za-z_$][\w$]*\(\{scope:([A-Za-z_$][\w$]*),target:([A-Za-z_$][\w$]*),[^)]*?surface:([A-Za-z_$][\w$]*),[^)]*\}\)\{let\{conversationId:([A-Za-z_$][\w$]*)[^}]*\}=\3,[\s\S]{0,1500}?let ([A-Za-z_$][\w$]*)=[A-Za-z_$][\w$]*\(\{pin:[\s\S]{0,800}?archive:[\s\S]{0,250}?\}\)),([A-Za-z_$][\w$]*)=\4!==`sidebar`/u;

function warn(message) {
  console.warn(`WARN: ${message} - skipping ui-tweaks sidebar thread color patch`);
}

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

function countOccurrences(source, marker) {
  let count = 0;
  let offset = 0;
  while ((offset = source.indexOf(marker, offset)) >= 0) {
    count += 1;
    offset += marker.length;
  }
  return count;
}

function sidebarThreadColorCss() {
  return THREAD_COLORS.flatMap(({ value }) => [
    `[${COLOR_ATTRIBUTE}=${JSON.stringify(value)}]{background-color:${value}24!important;}`,
    `[${COLOR_ATTRIBUTE}=${JSON.stringify(value)}]:hover{background-color:${value}38!important;}`,
  ]).join("");
}

function refreshSidebarThreadColorCss(source) {
  const prefix = `STYLE_ID=${JSON.stringify(STYLE_ID)},CSS=`;
  const start = source.indexOf(prefix);
  if (start < 0) return source;
  const cssStart = start + prefix.length;
  const cssEnd = source.indexOf(";if(typeof document===", cssStart);
  if (cssEnd < 0) return source;
  return `${source.slice(0, cssStart)}${JSON.stringify(sidebarThreadColorCss())}${source.slice(cssEnd)}`;
}

function sidebarThreadColorRuntimeSource({
  errorToastAtom = "ov",
  formatMessage = "kd",
  globalStateKeys = "ru",
  readGlobalState = "cm",
  writeGlobalState = "sm",
} = {}) {
  const css = sidebarThreadColorCss();

  return [
    `;var codexLinuxSidebarThreadColors=${JSON.stringify(THREAD_COLORS)};`,
    `async function codexLinuxSetSidebarThreadColor(scope,threadId,color){`,
    `let selected=color==null?null:codexLinuxSidebarThreadColors.find(item=>item.value===color)?.value;`,
    `if(color!=null&&selected==null)return;`,
    `let raw=${readGlobalState}(scope.get,${globalStateKeys}.SIDEBAR_THREAD_METADATA),metadata=raw&&typeof raw===\"object\"&&!Array.isArray(raw)?{...raw}:{},`,
    `rawEntry=metadata[threadId],entry=rawEntry&&typeof rawEntry===\"object\"&&!Array.isArray(rawEntry)?{...rawEntry}:{};`,
    `if(selected==null){if(!Object.prototype.hasOwnProperty.call(entry,\"labelColor\"))return;delete entry.labelColor}`,
    `else{if(entry.labelColor===selected)return;entry.labelColor=selected}`,
    `Object.keys(entry).length>0?metadata[threadId]=entry:delete metadata[threadId];`,
    `try{await ${writeGlobalState}(scope,${globalStateKeys}.SIDEBAR_THREAD_METADATA,Object.keys(metadata).length>0?metadata:void 0,{throwOnFailure:!0})}`,
    `catch(error){scope.get(${errorToastAtom}).danger(\"Could not update chat color\")}}`,
    `function codexLinuxSidebarThreadColorMenu(scope,threadId){return[`,
    `...codexLinuxSidebarThreadColors.map(item=>({id:\`change-thread-color-\${item.id}\`,`,
    `message:${formatMessage}({id:\`codexLinux.sidebarThreadColor.\${item.id}\`,defaultMessage:item.label,`,
    `description:\`Color choice for a local chat\`}),`,
    `onSelect:()=>codexLinuxSetSidebarThreadColor(scope,threadId,item.value)})),`,
    `{id:\`change-thread-color-clear\`,message:${formatMessage}({id:\`codexLinux.sidebarThreadColor.clear\`,`,
    `defaultMessage:\`No color\`,description:\`Remove the color from a local chat\`}),`,
    `onSelect:()=>codexLinuxSetSidebarThreadColor(scope,threadId,null)}]}`,
    `;(()=>{const ${RUNTIME_MARKER}=true,STYLE_ID=${JSON.stringify(STYLE_ID)},CSS=${JSON.stringify(css)};`,
    `if(typeof document===\"undefined\")return;let style=document.getElementById(STYLE_ID);`,
    `if(style){style.textContent!==CSS&&(style.textContent=CSS);return}`,
    `style=document.createElement(\"style\");style.id=STYLE_ID;style.textContent=CSS;`,
    `(document.head||document.documentElement)?.appendChild(style)})();`,
  ].join("");
}

function currentBundleAliases(source) {
  const selectorMatches = [...source.matchAll(COLOR_SELECTOR_DEFINITION_PATTERN)];
  if (selectorMatches.length !== 1) return null;
  const selector = selectorMatches[0][1];
  const readGlobalState = selectorMatches[0][4];
  const globalStateKeys = selectorMatches[0][5];

  const writerPattern =
    /async function ([A-Za-z_$][\w$]*)\(([A-Za-z_$][\w$]*),([A-Za-z_$][\w$]*),([A-Za-z_$][\w$]*),([A-Za-z_$][\w$]*)\)\{[\s\S]{0,900}?`set-global-state`,\{params:\{key:\3,value:\4\}\}/gu;
  const writers = new Set([...source.matchAll(writerPattern)].map((match) => match[1]));
  const formatMatches = [
    ...source.matchAll(
      /message:([A-Za-z_$][\w$]*)\(\{id:`threadHeader\.openSideChat`/gu,
    ),
  ];
  const toastMatches = [
    ...source.matchAll(
      /function [A-Za-z_$][\w$]*\(e,t\)\{e\.get\(([A-Za-z_$][\w$]*)\)\.danger\(e\.get\([A-Za-z_$][\w$]*\)\.formatMessage\(t\)\)\}/gu,
    ),
  ];
  if (writers.size !== 1 || formatMatches.length !== 1 || toastMatches.length !== 1) {
    return null;
  }

  return {
    errorToastAtom: toastMatches[0][1],
    formatMessage: formatMatches[0][1],
    globalStateKeys,
    readGlobalState,
    selector,
    writeGlobalState: [...writers][0],
  };
}

function applySidebarThreadColorPatch(source, context = {}) {
  try {
    if (typeof source !== "string") {
      warn("Asset source is not a string");
      return source;
    }
    if (!enabled(context)) {
      return source;
    }
    if (source.includes(RUNTIME_MARKER)) return refreshSidebarThreadColorCss(source);

    const aliases = currentBundleAliases(source);
    if (aliases == null) {
      if (context.warnOnMissingMarkers === true) {
        warn("Could not identify the current sidebar metadata helpers");
      }
      return source;
    }

    const rowMatches = [...source.matchAll(ROW_ATTRIBUTES_PATTERN)];
    const menuMatches = [...source.matchAll(new RegExp(MENU_PATTERN.source, "gu"))];
    const replacements = [
      [NULL_COLOR_MARKER, NULL_COLOR_REPLACEMENT],
      [COLOR_CACHE_DEPENDENCY_MARKER, COLOR_CACHE_DEPENDENCY_REPLACEMENT],
      [COLOR_CACHE_VALUE_MARKER, COLOR_CACHE_VALUE_REPLACEMENT],
    ];
    const invalid = replacements.find(([marker]) => countOccurrences(source, marker) !== 1);
    if (invalid != null || rowMatches.length !== 1 || menuMatches.length !== 1) {
      if (context.warnOnMissingMarkers === true) {
        warn(`Expected exactly one current sidebar marker: ${invalid?.[0] ?? (rowMatches.length !== 1 ? "sidebarThreadRow" : "thread menu")}`);
      }
      return source;
    }

    let patched = source;
    for (const [marker, replacement] of replacements) {
      patched = patched.replace(marker, replacement);
    }
    patched = patched.replace(
      MENU_PATTERN,
      (_match, menuPrefix, scope, _target, surface, threadId, menuItems, followingItems) =>
        `${menuPrefix},${surface}===\`sidebar\`&&${menuItems}.push({id:\`change-thread-color\`,message:${aliases.formatMessage}({id:\`codexLinux.sidebarThreadColor.menuItem\`,defaultMessage:\`Change chat color…\`,description:\`Menu item that changes a local chat color\`}),submenu:codexLinuxSidebarThreadColorMenu(${scope},${threadId})}),${followingItems}=${surface}!==\`sidebar\``,
    );
    const attributes = rowMatches[0][1];
    patched = patched.replace(
      ROW_ATTRIBUTES_PATTERN,
      `dataAttributes:{...${attributes}.sidebarThreadRow({active:c,hostId:m,id:u,kind:\`local\`,pinned:r,selected:i,title:k}),${JSON.stringify(COLOR_ATTRIBUTE)}:Te}`,
    );
    return `${patched}\n${sidebarThreadColorRuntimeSource(aliases)}`;
  } catch (error) {
    warn(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    return source;
  }
}

const descriptors = [
  {
    id: "sidebar-thread-color",
    phase: "webview-asset",
    order: 20_792,
    ciPolicy: "optional",
    pattern: THREAD_COLOR_ASSET_PATTERN,
    missingDescription: "local thread sidebar bundle",
    skipDescription: "ui-tweaks sidebar thread color patch",
    apply: (source, context = {}) =>
      applySidebarThreadColorPatch(source, { ...context, warnOnMissingMarkers: true }),
  },
];

module.exports = {
  COLOR_ATTRIBUTE,
  RUNTIME_MARKER,
  STYLE_ID,
  THREAD_COLORS,
  THREAD_COLOR_ASSET_PATTERN,
  applySidebarThreadColorPatch,
  descriptors,
  sidebarThreadColorCss,
  sidebarThreadColorRuntimeSource,
};
