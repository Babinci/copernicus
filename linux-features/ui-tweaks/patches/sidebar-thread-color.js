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

const COLOR_SELECTOR_MARKER = "Mo(Kas,B);let ne=";
const COLOR_SELECTOR_REPLACEMENT =
  "let codexLinuxThreadLabelColor=Mo(Kas,B),ne=";
const NULL_COLOR_MARKER = "labelColor:null,modelProvider:";
const NULL_COLOR_REPLACEMENT = "labelColor:codexLinuxThreadLabelColor,modelProvider:";
const ROW_ATTRIBUTES_MARKER =
  "S=g===void 0?null:g,C=No(Q),[w,T]=(0,enu.useState)(!1),E=Zu()";
const ROW_ATTRIBUTES_REPLACEMENT =
  `S=g===void 0?null:g,C=No(Q);x!=null&&(_.dataAttributes={..._.dataAttributes,` +
  `${JSON.stringify(COLOR_ATTRIBUTE)}:x});let[w,T]=(0,enu.useState)(!1),E=Zu()`;
const MENU_MARKER =
  "{id:`rename-thread`,message:sK.renameThread,onSelect:Ke},...O==null||O===`local`?[]:" +
  "[{id:`change-connection-color`";
const MENU_REPLACEMENT =
  "{id:`rename-thread`,message:sK.renameThread,onSelect:Ke}," +
  "...(v&&(O==null||O===`local`)?[{id:`change-thread-color`," +
  "message:$u({id:`codexLinux.sidebarThreadColor.menuItem`,defaultMessage:`Change pin color…`," +
  "description:`Menu item that changes a pinned local chat color`})," +
  "submenu:codexLinuxSidebarThreadColorMenu(C,n)}]:[])," +
  "...O==null||O===`local`?[]:[{id:`change-connection-color`";

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

function sidebarThreadColorRuntimeSource() {
  const css = [
    `[${COLOR_ATTRIBUTE}]{position:relative;}`,
    ...THREAD_COLORS.map(
      ({ value }) =>
        `[${COLOR_ATTRIBUTE}=${JSON.stringify(value)}]::before{` +
        `content:"";position:absolute;inset-block:8px;inset-inline-start:2px;` +
        `width:3px;border-radius:9999px;background:${value};}`,
    ),
  ].join("");

  return [
    `;var codexLinuxSidebarThreadColors=${JSON.stringify(THREAD_COLORS)};`,
    `async function codexLinuxSetSidebarThreadColor(scope,threadId,color){`,
    `let selected=color==null?null:codexLinuxSidebarThreadColors.find(item=>item.value===color)?.value;`,
    `if(color!=null&&selected==null)return;`,
    `let raw=Cp(scope.get,Il.SIDEBAR_THREAD_METADATA),metadata=raw&&typeof raw===\"object\"&&!Array.isArray(raw)?{...raw}:{},`,
    `rawEntry=metadata[threadId],entry=rawEntry&&typeof rawEntry===\"object\"&&!Array.isArray(rawEntry)?{...rawEntry}:{};`,
    `if(selected==null){if(!Object.prototype.hasOwnProperty.call(entry,\"labelColor\"))return;delete entry.labelColor}`,
    `else{if(entry.labelColor===selected)return;entry.labelColor=selected}`,
    `Object.keys(entry).length>0?metadata[threadId]=entry:delete metadata[threadId];`,
    `try{await Sp(scope,Il.SIDEBAR_THREAD_METADATA,Object.keys(metadata).length>0?metadata:void 0,{throwOnFailure:!0})}`,
    `catch(error){scope.get(Th).danger(\"Could not update pin color\")}}`,
    `function codexLinuxSidebarThreadColorMenu(scope,threadId){return[`,
    `...codexLinuxSidebarThreadColors.map(item=>({id:\`change-thread-color-\${item.id}\`,`,
    `message:$u({id:\`codexLinux.sidebarThreadColor.\${item.id}\`,defaultMessage:item.label,`,
    `description:\`Color choice for a pinned local chat\`}),`,
    `onSelect:()=>codexLinuxSetSidebarThreadColor(scope,threadId,item.value)})),`,
    `{id:\`change-thread-color-clear\`,message:$u({id:\`codexLinux.sidebarThreadColor.clear\`,`,
    `defaultMessage:\`No color\`,description:\`Remove the color from a pinned local chat\`}),`,
    `onSelect:()=>codexLinuxSetSidebarThreadColor(scope,threadId,null)}]}`,
    `;(()=>{const ${RUNTIME_MARKER}=true,STYLE_ID=${JSON.stringify(STYLE_ID)},CSS=${JSON.stringify(css)};`,
    `if(typeof document===\"undefined\")return;let style=document.getElementById(STYLE_ID);`,
    `if(style){style.textContent!==CSS&&(style.textContent=CSS);return}`,
    `style=document.createElement(\"style\");style.id=STYLE_ID;style.textContent=CSS;`,
    `(document.head||document.documentElement)?.appendChild(style)})();`,
  ].join("");
}

function applySidebarThreadColorPatch(source, context = {}) {
  try {
    if (typeof source !== "string") {
      warn("Asset source is not a string");
      return source;
    }
    if (!enabled(context) || source.includes(RUNTIME_MARKER)) {
      return source;
    }

    const replacements = [
      [COLOR_SELECTOR_MARKER, COLOR_SELECTOR_REPLACEMENT],
      [NULL_COLOR_MARKER, NULL_COLOR_REPLACEMENT],
      [ROW_ATTRIBUTES_MARKER, ROW_ATTRIBUTES_REPLACEMENT],
      [MENU_MARKER, MENU_REPLACEMENT],
    ];
    const invalid = replacements.find(([marker]) => countOccurrences(source, marker) !== 1);
    if (invalid != null) {
      if (context.warnOnMissingMarkers === true) {
        warn(`Expected exactly one current sidebar marker: ${invalid[0]}`);
      }
      return source;
    }

    let patched = source;
    for (const [marker, replacement] of replacements) {
      patched = patched.replace(marker, replacement);
    }
    return `${patched}\n${sidebarThreadColorRuntimeSource()}`;
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
  sidebarThreadColorRuntimeSource,
};
