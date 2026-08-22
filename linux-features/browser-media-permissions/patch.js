"use strict";

const HELPER = "codexLinuxBrowserUseMediaOriginAllowed";
const MARKER = "/*codexLinuxBrowserUseMediaPermission*/";

function applyLinuxBrowserUseMediaPermissionPatch(source) {
  const hasHelper = source.includes(`function ${HELPER}(`);
  const hasMarker = source.includes(MARKER);
  if (hasHelper && hasMarker) return source;
  if (hasHelper || hasMarker) {
    console.warn("WARN: Browser media permission patch is partial; leaving the main bundle unchanged");
    return source;
  }

  const handlers =
    /([A-Za-z_$][\w$]*)\.setPermissionRequestHandler\(\(([A-Za-z_$][\w$]*),([A-Za-z_$][\w$]*),([A-Za-z_$][\w$]*)\)=>\{\4\(\3===`clipboard-sanitized-write`\)\}\),\1\.setPermissionCheckHandler\(\(([A-Za-z_$][\w$]*),([A-Za-z_$][\w$]*)\)=>\6===`clipboard-sanitized-write`\)/u;
  const match = source.match(handlers);
  if (match == null) {
    console.warn("WARN: Could not find Browser Use permission handlers; skipping browser media permission patch");
    return source;
  }

  const [original, session, requestContents, requestPermission, callback,
    checkContents, checkPermission] = match;
  const replacement =
    `${session}.setPermissionRequestHandler((${requestContents},${requestPermission},${callback},__codexDetails)=>{${callback}(${requestPermission}===\`clipboard-sanitized-write\`||${requestPermission}===\`media\`&&${HELPER}(__codexDetails?.securityOrigin??__codexDetails?.requestingUrl))}),` +
    `${session}.setPermissionCheckHandler((${checkContents},${checkPermission},__codexOrigin,__codexDetails)=>${checkPermission}===\`clipboard-sanitized-write\`||${checkPermission}===\`media\`&&${HELPER}(__codexDetails?.securityOrigin??__codexDetails?.requestingUrl??__codexOrigin))${MARKER}`;
  const helper =
    `function ${HELPER}(e){if(process.platform!==\`linux\`||typeof e!==\`string\`)return!1;let t;try{t=new URL(e).origin}catch{return!1}return(process.env.CODEX_BROWSER_USE_MEDIA_ORIGINS??\`\`).split(\`,\`).some(e=>{try{return new URL(e.trim()).origin===t}catch{return!1}})}`;
  const patched = source.replace(original, replacement);
  const insertion = patched.startsWith('"use strict";') ? '"use strict";'.length : 0;
  return patched.slice(0, insertion) + helper + patched.slice(insertion);
}

const descriptors = [
  {
    id: "browser-use-media-permission",
    phase: "main-bundle",
    order: 169,
    ciPolicy: "optional",
    apply: applyLinuxBrowserUseMediaPermissionPatch,
  },
];

module.exports = { applyLinuxBrowserUseMediaPermissionPatch, descriptors };
