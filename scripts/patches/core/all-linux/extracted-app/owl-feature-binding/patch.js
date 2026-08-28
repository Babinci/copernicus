"use strict";

const {
  extractedAppPatch,
} = require("../../../../descriptor.js");
const { patchStatusFromChange } = require("../../../../../lib/patch-report.js");
const { patchLinuxOwlFeatureBindingFallbackAssets } = require("../../../../impl/main-process/misc.js");

module.exports = extractedAppPatch({
  id: "linux-owl-feature-binding-fallback",
  phase: "extracted-app:pre-webview",
  order: 190,
  ciPolicy: "required-upstream",
  apply: patchLinuxOwlFeatureBindingFallbackAssets,
  status: (result, warnings) => ({
    status: result?.bindingMatched === 0 || result?.shellMatched === 0
      ? "failed-required"
      : patchStatusFromChange(Boolean(result?.changed), warnings, "required-upstream"),
    reason: result?.bindingMatched === 0 || result?.shellMatched === 0
      ? `Owl compatibility contract missing: ${[
          result?.bindingMatched === 0 ? "feature binding" : null,
          result?.shellMatched === 0 ? "app shell guard" : null,
        ].filter(Boolean).join(", ")}`
      : result?.reason ?? warnings[0] ?? null,
  }),
});
