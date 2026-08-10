const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workflow = fs.readFileSync(
  path.resolve(__dirname, "../../.github/workflows/cachix.yml"),
  "utf8",
);
const updateHashWorkflow = fs.readFileSync(
  path.resolve(__dirname, "../../.github/workflows/update-codex-hash.yml"),
  "utf8",
);
const flake = fs.readFileSync(path.resolve(__dirname, "../../flake.nix"), "utf8");
const pkgbuild = fs.readFileSync(
  path.resolve(__dirname, "../../packaging/linux/PKGBUILD.template"),
  "utf8",
);

test("Nix output validation runs only for an actual Codex DMG hash change", () => {
  assert.match(workflow, /name: Validate Nix Outputs/);
  assert.match(workflow, /paths:\n\s+- flake\.nix/);
  assert.doesNotMatch(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /id: codex-dmg-hash/);
  assert.match(workflow, /if: github\.event_name != 'workflow_dispatch' \|\| github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /EVENT_NAME: \$\{\{ github\.event_name \}\}/);
  assert.match(workflow, /BEFORE_SHA: \$\{\{ github\.event\.before \}\}/);
  assert.match(workflow, /if \[ "\$EVENT_NAME" = "workflow_dispatch" \]; then\n\s+changed=true/);
  assert.match(workflow, /read-flake-hash "codexDmg = pkgs\.fetchurl \{" "hash = "/);
  assert.match(workflow, /if: needs\.detect-codex-dmg-hash\.outputs\.changed == 'true'/);
});

test("Nix refresh commits allow post-merge workflows to run", () => {
  assert.doesNotMatch(updateHashWorkflow, /\[skip ci\]/);
  assert.match(updateHashWorkflow, /gh workflow run ci\.yml/);
});

test("Nix application builds are explicit unfree local checks, never cache uploads", () => {
  for (const source of [workflow, updateHashWorkflow]) {
    assert.match(source, /NIXPKGS_ALLOW_UNFREE: '1'/);
    assert.doesNotMatch(source, /CACHIX_AUTH_TOKEN|cachix push|cachix-action/);
  }
  assert.match(workflow, /nix build "\$output"[\s\S]*--impure/);
  assert.match(workflow, /nix store gc/);
  assert.match(workflow, /No application output was uploaded to a binary cache/);
});

test("Nix validation pins every third-party action", () => {
  assert.doesNotMatch(workflow, /uses:\s+[^\s]+@v\d/);
});

test("generated app metadata does not mislabel the whole payload as MIT", () => {
  assert.match(flake, /flakeSourceRemote = "https:\/\/github\.com\/Babinci\/copernicus\.git"/);
  assert.match(flake, /Copernicus — unofficial community Linux wrapper/);
  assert.match(flake, /license = with pkgs\.lib\.licenses; \[ mit unfree \];/);
  assert.match(flake, /sourceProvenance = with pkgs\.lib\.sourceTypes; \[ fromSource binaryNativeCode \];/);
  assert.match(pkgbuild, /pkgdesc="Copernicus — unofficial community Linux wrapper/);
  assert.match(pkgbuild, /license=\('MIT' 'LicenseRef-Proprietary'\)/);
  assert.equal(
    fs.existsSync(path.resolve(__dirname, "../../assets/codex-linux.png")),
    false,
    "modified upstream icon must not return",
  );
});
