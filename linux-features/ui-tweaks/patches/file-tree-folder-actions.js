"use strict";

const FILE_TREE_ASSET_PATTERN = /^app-initial-[^.]+\.js$/;
const RUNTIME_MARKER = "codexLinuxFileTreeContextTarget";

const GET_ITEMS_MARKER =
  "De=()=>{let e=Xso({cwd:n,isWindowsHost:M===`windows`,itemPath:U.current,targetPathByDisplayPath:z});return Kso({...pco({scope:A,cwd:n,fallbackOpenTargets:F,hostId:o,targetPath:e}),onAddToChat:o==null?void 0:e=>{N.mutateAsync({hostId:o,path:e})},";
const GET_ITEMS_REPLACEMENT =
  "De=()=>{let e=codexLinuxFileTreeContextPath(z,U.current,n,M===`windows`);return Kso({...pco({scope:A,cwd:n,fallbackOpenTargets:F,hostId:o,targetPath:e}),onAddToChat:o==null||U.current?.type!==`file`?void 0:e=>{N.mutateAsync({hostId:o,path:e})},";
const PREFETCH_MARKER =
  "Oe=()=>mco({scope:A,cwd:n,hostId:o,targetPath:Xso({cwd:n,isWindowsHost:M===`windows`,itemPath:U.current,targetPathByDisplayPath:z})})";
const PREFETCH_REPLACEMENT =
  "Oe=()=>mco({scope:A,cwd:n,hostId:o,targetPath:codexLinuxFileTreeContextPath(z,U.current,n,M===`windows`)})";
const TARGET_MARKER = "ke=e=>{U.current=Qso(e.nativeEvent)}";
const TARGET_REPLACEMENT =
  "ke=e=>{U.current=codexLinuxFileTreeContextTarget(e.nativeEvent)}";

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
    "return path??(target.type===`folder`?Sp(cwd??``,target.path,isWindows):target.path)}",
  ].join("");
}

function applyFileTreeFolderActionsPatch(source, context = {}) {
  if (!enabled(context) || source.includes(RUNTIME_MARKER)) return source;
  const replacements = [
    [GET_ITEMS_MARKER, GET_ITEMS_REPLACEMENT],
    [PREFETCH_MARKER, PREFETCH_REPLACEMENT],
    [TARGET_MARKER, TARGET_REPLACEMENT],
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
