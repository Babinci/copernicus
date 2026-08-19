"use strict";

const THREAD_COLOR_ASSET_PATTERN = /^app-initial-[^.]+\.js$/;
const RUNTIME_MARKER = "codexLinuxSidebarThreadColorRuntime";
const INTERACTIVE_MARKER = "codexLinuxOpenSidebarThreadColorMenu";
const POPOVER_MARKER = "codex-linux-sidebar-thread-color-popover";
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

const NULL_COLOR_MARKER = "labelColor:null,modelProvider:";
const NULL_COLOR_REPLACEMENT = "labelColor:Ce,modelProvider:";
const ROW_ATTRIBUTES_MARKER =
  "dataAttributes:Rp.sidebarThreadRow({active:c,hostId:m,id:u,kind:`local`,pinned:r,selected:i,title:k})";
const ROW_ATTRIBUTES_REPLACEMENT =
  `dataAttributes:{...Rp.sidebarThreadRow({active:c,hostId:m,id:u,kind:\`local\`,pinned:r,selected:i,title:k}),` +
  `${JSON.stringify(COLOR_ATTRIBUTE)}:Ce}`;
const MENU_MARKER =
  "{id:`rename-thread`,message:YY.renameThread,onSelect:et},...j==null||j===`local`?[]:" +
  "[{id:`change-connection-color`";
const MENU_REPLACEMENT =
  "{id:`rename-thread`,message:YY.renameThread,onSelect:et}," +
  "...((j==null||j===`local`)?[{id:`change-thread-color`," +
  "message:{id:`codexLinux.sidebarThreadColor.menuItem`,defaultMessage:`Change chat color…`," +
  "description:`Menu item that changes a local chat color`}," +
  "submenu:codexLinuxSidebarThreadColorMenu(T,n)}]:[])," +
  "...j==null||j===`local`?[]:[{id:`change-connection-color`";
const HOVER_ACTION_COMPONENT_MARKER =
  "function G4c(e){let t=(0,J4c.c)(8),{archive:n,pinAction:r}=e,i=Dd();if(n==null&&r==null)return null;" +
  "let a;t[0]===r?a=t[1]:(a=r==null?[]:[{id:`thread-pin-action`,ariaLabel:r.ariaLabel," +
  "icon:r.isPinned?(0,c5.jsx)(E0c,{className:`translate-x-px`}):(0,c5.jsx)(S$,{className:`translate-x-px`})," +
  "onClick:r.onClick}],t[0]=r,t[1]=a);let o;t[2]!==n||t[3]!==i?(o=n==null?[]:[{id:`thread-primary-action`," +
  "ariaLabel:i.formatMessage(YY.archiveThread),icon:(0,c5.jsx)(b$,{}),onClick:n}],t[2]=n,t[3]=i,t[4]=o):o=t[4];" +
  "let s;return t[5]!==a||t[6]!==o?(s=(0,c5.jsx)(b0c,{actions:[...a,...o],className:SQc})," +
  "t[5]=a,t[6]=o,t[7]=s):s=t[7],s}";
const HOVER_ACTION_COMPONENT_REPLACEMENT =
  "function G4c(e){let t=(0,J4c.c)(8),{archive:n,pinAction:r,colorAction:l}=e,i=Dd();" +
  "if(n==null&&r==null&&l==null)return null;let a;t[0]===r?a=t[1]:(a=r==null?[]:[{id:`thread-pin-action`," +
  "ariaLabel:r.ariaLabel,icon:r.isPinned?(0,c5.jsx)(E0c,{className:`translate-x-px`}):" +
  "(0,c5.jsx)(S$,{className:`translate-x-px`}),onClick:r.onClick}],t[0]=r,t[1]=a);" +
  "let o;t[2]!==n||t[3]!==i?(o=n==null?[]:[{id:`thread-primary-action`,ariaLabel:i.formatMessage(YY.archiveThread)," +
  "icon:(0,c5.jsx)(b$,{}),onClick:n}],t[2]=n,t[3]=i,t[4]=o):o=t[4];" +
  "let c=l==null?[]:[{id:`thread-color-action`,ariaLabel:l.ariaLabel," +
  "icon:(0,c5.jsx)(`span`,{className:`h-3 w-3 rounded-full ring-1 ring-inset ring-border`," +
  "style:{backgroundColor:l.color??`transparent`}}),onClick:l.onClick}];" +
  "return(0,c5.jsx)(b0c,{actions:[...c,...a,...o],className:l==null?SQc:`${SQc} !w-[80px]`})}";
const HOVER_ACTION_GUARD_MARKER = "||t[118]!==mt?(ht=e=>";
const HOVER_ACTION_GUARD_REPLACEMENT =
  "||t[118]!==`${mt}:${j??``}:${C??``}`?(ht=e=>";
const HOVER_ACTION_PROPS_MARKER =
  "pinAction:mt?{ariaLabel:k.formatMessage(b?o5:a5),isPinned:b,onClick:()=>{qY(T,n,!b)}}:void 0})";
const HOVER_ACTION_PROPS_NATIVE_REPLACEMENT =
  "pinAction:mt?{ariaLabel:k.formatMessage(b?o5:a5),isPinned:b,onClick:()=>{qY(T,n,!b)}}:void 0," +
  "colorAction:j==null||j===`local`?{ariaLabel:k.formatMessage({id:`codexLinux.sidebarThreadColor.button`," +
  "defaultMessage:`Change chat color`,description:`Button that changes a local chat color`}),color:C," +
  "onClick:()=>{codexLinuxOpenSidebarThreadColorMenu(T,n,k.formatMessage)}}:void 0})";
const HOVER_ACTION_PROPS_REPLACEMENT =
  "pinAction:mt?{ariaLabel:k.formatMessage(b?o5:a5),isPinned:b,onClick:()=>{qY(T,n,!b)}}:void 0," +
  "colorAction:j==null||j===`local`?{ariaLabel:k.formatMessage({id:`codexLinux.sidebarThreadColor.button`," +
  "defaultMessage:`Change chat color`,description:`Button that changes a local chat color`}),color:C," +
  "onClick:e=>{codexLinuxOpenSidebarThreadColorMenu(T,n,t=>k.formatMessage(t),e?.currentTarget)}}:void 0})";
const HOVER_ACTION_EVENT_MARKER =
  '"aria-label":e.ariaLabel,onClick:t=>{t.stopPropagation(),e.onClick()},onPointerDown:x0c';
const HOVER_ACTION_EVENT_REPLACEMENT =
  '"aria-label":e.ariaLabel,onClick:t=>{t.stopPropagation(),e.onClick(t)},onPointerDown:x0c';
const RUNTIME_COLOR_ITEM_MARKER =
  "description:`Color choice for a local chat`},onSelect:";
const RUNTIME_COLOR_ITEM_REPLACEMENT =
  "description:`Color choice for a local chat`},color:item.value,onSelect:";
const RUNTIME_CLEAR_ITEM_MARKER =
  "description:`Remove the color from a local chat`},onSelect:";
const RUNTIME_CLEAR_ITEM_REPLACEMENT =
  "description:`Remove the color from a local chat`},color:null,onSelect:";
const HOVER_ACTION_CACHE_MARKER = "t[117]=T,t[118]=mt,t[119]=ht";
const HOVER_ACTION_CACHE_REPLACEMENT =
  "t[117]=T,t[118]=`${mt}:${j??``}:${C??``}`,t[119]=ht";
const HOVER_ACTION_COUNT_MARKER = "let yt=Pe??he,bt=+!!mt,xt=ge.renderActions??gt";
const HOVER_ACTION_COUNT_REPLACEMENT =
  "let yt=Pe??he,bt=+!!mt+(j==null||j===`local`?1:0),xt=ge.renderActions??gt";
const RUNTIME_IIFE_MARKER = `;(()=>{const ${RUNTIME_MARKER}=true`;
const LEGACY_MESSAGE_REPLACEMENTS = [
  [
    "message:$u({id:`codexLinux.sidebarThreadColor.menuItem`,defaultMessage:`Change chat color…`," +
      "description:`Menu item that changes a local chat color`}),",
    "message:{id:`codexLinux.sidebarThreadColor.menuItem`,defaultMessage:`Change chat color…`," +
      "description:`Menu item that changes a local chat color`},",
  ],
  [
    "ariaLabel:k.formatMessage($u({id:`codexLinux.sidebarThreadColor.button`,defaultMessage:`Change chat color`," +
      "description:`Button that changes a local chat color`})),",
    "ariaLabel:k.formatMessage({id:`codexLinux.sidebarThreadColor.button`,defaultMessage:`Change chat color`," +
      "description:`Button that changes a local chat color`}),",
  ],
  [
    "message:$u({id:`codexLinux.sidebarThreadColor.${item.id}`,defaultMessage:item.label," +
      "description:`Color choice for a local chat`}),",
    "message:{id:`codexLinux.sidebarThreadColor.${item.id}`,defaultMessage:item.label," +
      "description:`Color choice for a local chat`},",
  ],
  [
    "message:$u({id:`codexLinux.sidebarThreadColor.clear`,defaultMessage:`No color`," +
      "description:`Remove the color from a local chat`}),",
    "message:{id:`codexLinux.sidebarThreadColor.clear`,defaultMessage:`No color`," +
      "description:`Remove the color from a local chat`},",
  ],
];

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

function sidebarThreadColorRuntimeSource() {
  const css = sidebarThreadColorCss();

  return [
    `;var codexLinuxSidebarThreadColors=${JSON.stringify(THREAD_COLORS)};`,
    `async function codexLinuxSetSidebarThreadColor(scope,threadId,color){`,
    `let selected=color==null?null:codexLinuxSidebarThreadColors.find(item=>item.value===color)?.value;`,
    `if(color!=null&&selected==null)return;`,
    `let raw=cm(scope.get,ru.SIDEBAR_THREAD_METADATA),metadata=raw&&typeof raw===\"object\"&&!Array.isArray(raw)?{...raw}:{},`,
    `rawEntry=metadata[threadId],entry=rawEntry&&typeof rawEntry===\"object\"&&!Array.isArray(rawEntry)?{...rawEntry}:{};`,
    `if(selected==null){if(!Object.prototype.hasOwnProperty.call(entry,\"labelColor\"))return;delete entry.labelColor}`,
    `else{if(entry.labelColor===selected)return;entry.labelColor=selected}`,
    `Object.keys(entry).length>0?metadata[threadId]=entry:delete metadata[threadId];`,
    `try{await sm(scope,ru.SIDEBAR_THREAD_METADATA,Object.keys(metadata).length>0?metadata:void 0,{throwOnFailure:!0})}`,
    `catch(error){console.warn(\"Could not update chat color\",error)}}`,
    `function codexLinuxSidebarThreadColorMenu(scope,threadId){return[`,
    `...codexLinuxSidebarThreadColors.map(item=>({id:\`change-thread-color-\${item.id}\`,`,
    `message:{id:\`codexLinux.sidebarThreadColor.\${item.id}\`,defaultMessage:item.label,`,
    `description:\`Color choice for a local chat\`},`,
    `color:item.value,`,
    `onSelect:()=>codexLinuxSetSidebarThreadColor(scope,threadId,item.value)})),`,
    `{id:\`change-thread-color-clear\`,message:{id:\`codexLinux.sidebarThreadColor.clear\`,`,
    `defaultMessage:\`No color\`,description:\`Remove the color from a local chat\`},`,
    `color:null,`,
    `onSelect:()=>codexLinuxSetSidebarThreadColor(scope,threadId,null)}]}`,
    sidebarThreadColorOpenMenuSource(),
    `;(()=>{const ${RUNTIME_MARKER}=true,STYLE_ID=${JSON.stringify(STYLE_ID)},CSS=${JSON.stringify(css)};`,
    `if(typeof document===\"undefined\")return;let style=document.getElementById(STYLE_ID);`,
    `if(style){style.textContent!==CSS&&(style.textContent=CSS);return}`,
    `style=document.createElement(\"style\");style.id=STYLE_ID;style.textContent=CSS;`,
    `(document.head||document.documentElement)?.appendChild(style)})();`,
  ].join("");
}

function sidebarThreadColorOpenMenuSource() {
  return [
    `;function ${INTERACTIVE_MARKER}(scope,threadId,formatMessage,anchor){`,
    `if(typeof document===\"undefined\"||document.body==null)return;`,
    `document.getElementById(${JSON.stringify(POPOVER_MARKER)})?.remove();`,
    `let root=document.createElement(\"div\"),outside=null,key=null,close=()=>{root.remove();`,
    `outside&&document.removeEventListener(\"pointerdown\",outside,!0);key&&document.removeEventListener(\"keydown\",key,!0)};`,
    `root.id=${JSON.stringify(POPOVER_MARKER)};root.setAttribute(\"role\",\"menu\");`,
    `root.style.cssText=\"position:fixed;z-index:2147483647;display:flex;min-width:180px;flex-direction:column;gap:2px;padding:6px;border:1px solid var(--color-border-default,#d1d5db);border-radius:12px;background:var(--color-surface-elevated,#fff);color:var(--color-text-primary,#111);box-shadow:0 10px 30px #0003\";`,
    `for(let item of codexLinuxSidebarThreadColorMenu(scope,threadId)){let button=document.createElement(\"button\"),`,
    `swatch=document.createElement(\"span\"),label=document.createElement(\"span\");button.type=\"button\";`,
    `button.setAttribute(\"role\",\"menuitem\");button.style.cssText=\"display:flex;align-items:center;gap:10px;width:100%;padding:7px 9px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;cursor:pointer\";`,
    `swatch.style.cssText=\"display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;flex:none;border:1px solid #0004;border-radius:999px;font-size:11px;line-height:1\";`,
    `swatch.style.backgroundColor=item.color??\"transparent\";swatch.textContent=item.color==null?\"×\":\"\";`,
    `label.textContent=typeof formatMessage===\"function\"?formatMessage(item.message):item.message.defaultMessage;`,
    `button.append(swatch,label);button.onmouseenter=()=>button.style.background=\"var(--color-background-secondary,#0000000d)\";`,
    `button.onmouseleave=()=>button.style.background=\"transparent\";button.onclick=async event=>{event.stopPropagation();close();await item.onSelect?.()};root.append(button)}`,
    `root.onpointerdown=event=>event.stopPropagation();document.body.append(root);let anchorRect=anchor?.getBoundingClientRect?.(),`,
    `menuRect=root.getBoundingClientRect(),left=Math.max(8,Math.min(anchorRect?.left??8,window.innerWidth-menuRect.width-8)),`,
    `top=Math.max(8,Math.min((anchorRect?.bottom??8)+6,window.innerHeight-menuRect.height-8));root.style.left=left+\"px\";root.style.top=top+\"px\";`,
    `setTimeout(()=>{outside=event=>{!root.contains(event.target)&&event.target!==anchor&&close()};key=event=>{event.key===\"Escape\"&&close()};`,
    `document.addEventListener(\"pointerdown\",outside,!0);document.addEventListener(\"keydown\",key,!0);root.firstElementChild?.focus()},0)}`,
  ].join("");
}

function sidebarThreadColorNativeMenuSource() {
  return [
    `;async function ${INTERACTIVE_MARKER}(scope,threadId,formatMessage){`,
    `let bridge=typeof window===\"undefined\"?null:window.electronBridge;`,
    `if(typeof bridge?.showContextMenu!==\"function\")return;`,
    `let items=codexLinuxSidebarThreadColorMenu(scope,threadId),menu=items.map(item=>({`,
    `id:item.id,label:typeof formatMessage===\"function\"?formatMessage(item.message):item.message.defaultMessage})),`,
    `result=await bridge.showContextMenu(menu),selected=items.find(item=>item.id===result?.id);`,
    `await selected?.onSelect?.()}`,
  ].join("");
}

function interactiveReplacements() {
  return [
    [HOVER_ACTION_COMPONENT_MARKER, HOVER_ACTION_COMPONENT_REPLACEMENT],
    [HOVER_ACTION_EVENT_MARKER, HOVER_ACTION_EVENT_REPLACEMENT],
    [HOVER_ACTION_GUARD_MARKER, HOVER_ACTION_GUARD_REPLACEMENT],
    [HOVER_ACTION_PROPS_MARKER, HOVER_ACTION_PROPS_REPLACEMENT],
    [HOVER_ACTION_CACHE_MARKER, HOVER_ACTION_CACHE_REPLACEMENT],
    [HOVER_ACTION_COUNT_MARKER, HOVER_ACTION_COUNT_REPLACEMENT],
  ];
}

function replaceCurrentContract(source, replacements) {
  const invalid = replacements.find(([marker]) => countOccurrences(source, marker) !== 1);
  if (invalid != null) return null;
  return replacements.reduce(
    (patched, [marker, replacement]) => patched.replace(marker, replacement),
    source,
  );
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
    if (source.includes(RUNTIME_MARKER)) {
      if (source.includes(INTERACTIVE_MARKER)) {
        let upgraded = source;
        const hasLegacyMessageHelper = LEGACY_MESSAGE_REPLACEMENTS.some(([marker]) =>
          upgraded.includes(marker),
        );
        if (hasLegacyMessageHelper) {
          const repaired = replaceCurrentContract(upgraded, LEGACY_MESSAGE_REPLACEMENTS);
          if (repaired == null) {
            if (context.warnOnMissingMarkers === true) warn("Expected legacy sidebar color messages");
            return source;
          }
          upgraded = repaired;
        }
        if (!upgraded.includes(POPOVER_MARKER)) {
          const popoverUpgrade = replaceCurrentContract(upgraded, [
            [HOVER_ACTION_EVENT_MARKER, HOVER_ACTION_EVENT_REPLACEMENT],
            [HOVER_ACTION_PROPS_NATIVE_REPLACEMENT, HOVER_ACTION_PROPS_REPLACEMENT],
            [RUNTIME_COLOR_ITEM_MARKER, RUNTIME_COLOR_ITEM_REPLACEMENT],
            [RUNTIME_CLEAR_ITEM_MARKER, RUNTIME_CLEAR_ITEM_REPLACEMENT],
            [sidebarThreadColorNativeMenuSource(), sidebarThreadColorOpenMenuSource()],
          ]);
          if (popoverUpgrade == null) {
            if (context.warnOnMissingMarkers === true) warn("Expected native sidebar color menu");
            return source;
          }
          upgraded = popoverUpgrade;
        }
        return refreshSidebarThreadColorCss(upgraded);
      }
      const replacements = [
        ...interactiveReplacements(),
        [RUNTIME_IIFE_MARKER, `${sidebarThreadColorOpenMenuSource()}${RUNTIME_IIFE_MARKER}`],
      ];
      const upgraded = replaceCurrentContract(source, replacements);
      if (upgraded == null) {
        if (context.warnOnMissingMarkers === true) warn("Expected current interactive sidebar markers");
        return source;
      }
      return refreshSidebarThreadColorCss(upgraded);
    }

    const replacements = [
      [NULL_COLOR_MARKER, NULL_COLOR_REPLACEMENT],
      [ROW_ATTRIBUTES_MARKER, ROW_ATTRIBUTES_REPLACEMENT],
      [MENU_MARKER, MENU_REPLACEMENT],
      ...interactiveReplacements(),
    ];
    const patched = replaceCurrentContract(source, replacements);
    if (patched == null) {
      if (context.warnOnMissingMarkers === true) {
        warn("Expected exactly one current sidebar marker");
      }
      return source;
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
  INTERACTIVE_MARKER,
  POPOVER_MARKER,
  STYLE_ID,
  THREAD_COLORS,
  THREAD_COLOR_ASSET_PATTERN,
  applySidebarThreadColorPatch,
  descriptors,
  sidebarThreadColorCss,
  sidebarThreadColorOpenMenuSource,
  sidebarThreadColorRuntimeSource,
};
