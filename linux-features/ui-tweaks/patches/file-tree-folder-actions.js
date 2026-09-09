"use strict";

const FILE_TREE_ASSET_PATTERN = /^review-file-tree-pane-[^.]+\.js$/;
const RUNTIME_MARKER = "codexLinuxFileTreeContextTarget";

const GET_ITEMS_MARKER =
  "Ge=()=>{if(!D)return[];let e=We({cwd:n,isWindowsHost:F===`windows`,itemPath:me.current,targetPathByDisplayPath:le});return Be({...st({scope:N,cwd:n,fallbackOpenTargets:R,hostId:l,targetPath:e}),onAddToChat:l==null?void 0:e=>{I.mutateAsync({hostId:l,path:e})},";
const GET_ITEMS_REPLACEMENT =
  "Ge=()=>{if(!D)return[];let e=codexLinuxFileTreeContextPath(le,me.current,n,F===`windows`);return Be({...st({scope:N,cwd:n,fallbackOpenTargets:R,hostId:l,targetPath:e}),onAddToChat:l==null||me.current?.type!==`file`?void 0:e=>{I.mutateAsync({hostId:l,path:e})},";
const PREFETCH_MARKER =
  "qe=()=>{if(D)return ct({scope:N,cwd:n,hostId:l,targetPath:We({cwd:n,isWindowsHost:F===`windows`,itemPath:me.current,targetPathByDisplayPath:le})})}";
const PREFETCH_REPLACEMENT =
  "qe=()=>{if(D)return ct({scope:N,cwd:n,hostId:l,targetPath:codexLinuxFileTreeContextPath(le,me.current,n,F===`windows`)})}";
const TARGET_MARKER = "Je=e=>{me.current=Ke(e.nativeEvent)}";
const TARGET_REPLACEMENT =
  "Je=e=>{me.current=codexLinuxFileTreeContextTarget(e.nativeEvent)}";

function warn(message) {
  console.warn(`WARN: ${message} - skipping ui-tweaks file tree folder actions patch`);
}

function enabled(context) {
  const defaults = context?.feature?.manifest?.tweaks?.fileTree?.folderActions;
  const settings = context?.feature?.settings?.tweaks?.fileTree?.folderActions;
  return (settings?.enabled ?? defaults?.enabled) === true;
}

function runtimeSource() {
  return [
    ";function codexLinuxFileTreeContextTarget(event){",
    "for(let element of event.composedPath()){",
    "if(!(element instanceof Element))continue;",
    "let type=element.getAttribute(`data-item-type`);",
    "if(type!==`file`&&type!==`folder`)continue;",
    "let path=element.getAttribute(`data-item-path`);",
    "if(path)return{path,type}",
    "}return null}",
    "function codexLinuxFileTreeContextPath(pathMap,target,cwd,isWindows){",
    "if(target==null)return null;let path=pathMap.get(target.path);",
    "return path??g(cwd??``,target.path,isWindows)}",
  ].join("");
}

function applyFileTreeFolderActionsPatch(source, context = {}) {
  if (!enabled(context) || source.includes(RUNTIME_MARKER)) return source;
  const replacements = [
    [GET_ITEMS_MARKER, GET_ITEMS_REPLACEMENT],
    [PREFETCH_MARKER, PREFETCH_REPLACEMENT],
    [TARGET_MARKER, TARGET_REPLACEMENT],
    ["onSaveAs:de.workspaceFiles.saveCopy==null?void 0", "onSaveAs:de.workspaceFiles.saveCopy==null||me.current?.type!==`file`?void 0"],
  ];
  const invalid = replacements.find(([marker]) => source.split(marker).length !== 2);
  if (invalid != null) {
    if (context.warnOnMissingMarkers === true) {
      warn(`Expected exactly one current file tree marker: ${invalid[0]}`);
    }
    return source;
  }

  let patched = source;
  for (const [marker, replacement] of replacements) patched = patched.replace(marker, replacement);
  return `${patched}\n${runtimeSource()}`;
}

const descriptors = [
  {
    id: "file-tree-folder-actions",
    phase: "webview-asset",
    order: 20_793,
    ciPolicy: "optional",
    pattern: FILE_TREE_ASSET_PATTERN,
    missingDescription: "workspace file tree bundle",
    skipDescription: "ui-tweaks file tree folder actions patch",
    apply: (source, context = {}) =>
      applyFileTreeFolderActionsPatch(source, { ...context, warnOnMissingMarkers: true }),
  },
];

module.exports = {
  FILE_TREE_ASSET_PATTERN,
  RUNTIME_MARKER,
  applyFileTreeFolderActionsPatch,
  descriptors,
  runtimeSource,
};
