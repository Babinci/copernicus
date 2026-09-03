"use strict";

const PRIMARY_ASSET_PATTERN = /^app-primary-[^.]+\.js$/;
const BROWSER_TAB_ASSET_PATTERN = /^open-tab-[^.]+\.js$/;
const THREAD_MARKER = "codexLinuxThreadSessionCopy";
const BROWSER_TAB_MARKER = "codexLinuxBrowserTabSessionCopy";

function applyThreadSessionCopyPatch(source) {
  if (source.includes(THREAD_MARKER)) return source;
  const items = [...source.matchAll(/additionalItems:\[\{id:`copy-conversation-markdown`/g)];
  if (items.length !== 1) return source;
  const itemStart = items[0].index + "additionalItems:[".length;
  const functionStart = source.lastIndexOf("function ", itemStart);
  const functionEnd = source.indexOf("function ", functionStart + 9);
  const sessionId = source.slice(functionStart, functionEnd < 0 ? itemStart : functionEnd)
    .match(/let\{conversationId:([A-Za-z_$][\w$]*)/)?.[1];
  if (!sessionId) return source;
  const item = `/*${THREAD_MARKER}*/{id:\`copy-session-id\`,message:{id:\`threadHeader.copySessionId\`,defaultMessage:\`Copy session ID\`,description:\`Menu item to copy the current chat session ID\`},onSelect:()=>navigator.clipboard.writeText(${sessionId})},`;
  return `${source.slice(0, itemStart)}${item}${source.slice(itemStart)}`;
}

function applyBrowserTabSessionCopyPatch(source) {
  if (source.includes(BROWSER_TAB_MARKER)) return source;
  const functions = [...source.matchAll(/function [A-Za-z_$][\w$]*\(\{browserConversationId:([A-Za-z_$][\w$]*),browserHostDisplayName:[A-Za-z_$][\w$]*,browserTabId:[A-Za-z_$][\w$]*,cwd:[A-Za-z_$][\w$]*,target:[A-Za-z_$][\w$]*\}\)\{/g)];
  if (functions.length !== 1) return source;
  const fn = functions[0];
  const functionEnd = source.indexOf("function ", fn.index + fn[0].length);
  const end = functionEnd < 0 ? source.length : functionEnd;
  const start = source.indexOf("[{id:`new-browser-tab-to-the-right`", fn.index);
  const body = source.slice(fn.index, end);
  const formatter = body.match(/message:([A-Za-z_$][\w$]*)\(\{id:`thread\.sidePanel\.browserTabMenu\.newTabToTheRight`/)?.[1];
  const clipboard = body.match(/([A-Za-z_$][\w$]*)\.clipboard\.writeText\(/)?.[1];
  if (start < 0 || start > end || !formatter || !clipboard) return source;
  const item = `/*${BROWSER_TAB_MARKER}*/{id:\`copy-browser-tab-session-id\`,message:${formatter}({id:\`thread.sidePanel.browserTabMenu.copySessionId\`,defaultMessage:\`Copy session ID\`,description:\`Context menu action that copies the owning chat session ID\`}),onSelect:()=>${clipboard}.clipboard.writeText(${fn[1]})},{id:\`copy-browser-tab-session-id-separator\`,type:\`separator\`},`;
  return `${source.slice(0, start + 1)}${item}${source.slice(start + 1)}`;
}

const descriptors = [
  {
    id: "thread-session-id-copy",
    phase: "webview-asset",
    order: 20_794,
    ciPolicy: "optional",
    pattern: PRIMARY_ASSET_PATTERN,
    assetMatch: source => source.includes(THREAD_MARKER) || source.includes("additionalItems:[{id:`copy-conversation-markdown`"),
    missingDescription: "native thread Copy menu",
    apply: applyThreadSessionCopyPatch,
  },
  {
    id: "browser-tab-session-id-copy",
    phase: "webview-asset",
    order: 20_795,
    ciPolicy: "optional",
    pattern: BROWSER_TAB_ASSET_PATTERN,
    assetMatch: source => source.includes(BROWSER_TAB_MARKER) || source.includes("new-browser-tab-to-the-right"),
    missingDescription: "native browser-tab menu",
    apply: applyBrowserTabSessionCopyPatch,
  },
];

module.exports = {
  BROWSER_TAB_ASSET_PATTERN,
  BROWSER_TAB_MARKER,
  PRIMARY_ASSET_PATTERN,
  THREAD_MARKER,
  applyBrowserTabSessionCopyPatch,
  applyThreadSessionCopyPatch,
  descriptors,
};
