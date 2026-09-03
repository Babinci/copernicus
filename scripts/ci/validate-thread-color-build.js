#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  COLOR_ATTRIBUTE,
  STATE_MARKER,
  STYLE_ID,
  THREAD_COLORS,
  UI_MARKER,
  sidebarThreadColorCss,
} = require("../../linux-features/ui-tweaks/patches/sidebar-thread-color.js");

function validateThreadColorBuild(appRoot) {
  const assets = path.join(appRoot, "content/webview/assets");
  const names = fs.readdirSync(assets);
  const readOne = prefix => {
    const matches = names.filter(name => name.startsWith(prefix) && name.endsWith(".js"));
    if (matches.length !== 1) throw new Error(`Expected one ${prefix} asset, found ${matches.length}`);
    return fs.readFileSync(path.join(assets, matches[0]), "utf8");
  };
  const initial = readOne("app-initial-");
  const primary = readOne("app-primary-");
  const requiredInitial = [STATE_MARKER, STYLE_ID, JSON.stringify(sidebarThreadColorCss())];
  const requiredPrimary = [UI_MARKER, COLOR_ATTRIBUTE, "change-thread-color-clear", "submenu:",
    ...THREAD_COLORS.map(({ id }) => `change-thread-color-${id}`)];
  for (const needle of requiredInitial) if (!initial.includes(needle)) throw new Error(`Missing initial contract: ${needle}`);
  for (const needle of requiredPrimary) if (!primary.includes(needle)) throw new Error(`Missing UI contract: ${needle}`);
  if (/id:`change-thread-color`[^}]*onSelect:/u.test(primary) || primary.includes("showColorPicker:!0")) {
    throw new Error("Legacy rename-dialog color behavior is present");
  }
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error("Usage: validate-thread-color-build.js <app-root>");
    validateThreadColorBuild(process.argv[2]);
    console.log("Built chat-colour contract passed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = { validateThreadColorBuild };
