"use strict";

const {
  extractedAppPatch,
} = require("../../../../descriptor.js");
const { patchStatusFromChange } = require("../../../../../lib/patch-report.js");
const { patchLinuxOwlCompatibilityAssets } = require("../../../../impl/main-process/misc.js");

module.exports = extractedAppPatch({
  id: "linux-owl-compatibility",
  phase: "extracted-app:pre-webview",
  order: 190,
  ciPolicy: "required-upstream",
  apply: patchLinuxOwlCompatibilityAssets,
  status: (result, warnings) => ({
    status: result?.shellMatched === 0 || result?.preferredLanguagesMatched === 0 ||
      result?.captureMatched === 0 || result?.downloadHistoryMatched === 0
      ? "failed-required"
      : patchStatusFromChange(Boolean(result?.changed), warnings, "required-upstream"),
    reason: result?.shellMatched === 0 || result?.preferredLanguagesMatched === 0 ||
      result?.captureMatched === 0 || result?.downloadHistoryMatched === 0
      ? `Owl compatibility contract missing: ${[
          result?.shellMatched === 0 ? "app shell guard" : null,
          result?.preferredLanguagesMatched === 0 ? "preferred languages" : null,
          result?.captureMatched === 0 ? "capture state" : null,
          result?.downloadHistoryMatched === 0 ? "download history" : null,
        ].filter(Boolean).join(", ")}`
      : result?.reason ?? warnings[0] ?? null,
  }),
});
