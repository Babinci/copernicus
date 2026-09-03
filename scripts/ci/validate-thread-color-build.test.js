"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  COLOR_ATTRIBUTE,
  STATE_MARKER,
  STYLE_ID,
  THREAD_COLORS,
  UI_MARKER,
  sidebarThreadColorCss,
} = require("../../linux-features/ui-tweaks/patches/sidebar-thread-color.js");
const { validateThreadColorBuild } = require("./validate-thread-color-build.js");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "thread-color-build-"));
  const assets = path.join(root, "content/webview/assets");
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(path.join(assets, "app-initial-test.js"), `${STATE_MARKER}${STYLE_ID}${JSON.stringify(sidebarThreadColorCss())}`);
  fs.writeFileSync(path.join(assets, "app-primary-test.js"), `${UI_MARKER}${COLOR_ATTRIBUTE}submenu:${THREAD_COLORS.map(({ id }) => `change-thread-color-${id}`).join("")}change-thread-color-clear`);
  return root;
}

test("validates the built direct chat-colour contract and rejects the old dialog", () => {
  const root = fixture();
  try {
    assert.doesNotThrow(() => validateThreadColorBuild(root));
    fs.appendFileSync(path.join(root, "content/webview/assets/app-primary-test.js"), "showColorPicker:!0");
    assert.throws(() => validateThreadColorBuild(root), /Legacy rename-dialog/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
