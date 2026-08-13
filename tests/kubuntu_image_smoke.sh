#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILDER="$REPO_DIR/scripts/build-kubuntu-image.sh"
FIRST_RUN="$REPO_DIR/packaging/kubuntu-image/copernicus-first-run"

fail() {
    printf 'FAIL: %s\n' "$*" >&2
    exit 1
}

for tool in xorriso mksquashfs unsquashfs sha256sum python3; do
    command -v "$tool" >/dev/null 2>&1 || fail "missing test dependency: $tool"
done

work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/rootfs/etc" "$work/iso/casper"
printf 'ID=ubuntu\nVERSION_ID="24.04"\n' >"$work/rootfs/etc/os-release"
mksquashfs "$work/rootfs" "$work/iso/casper/filesystem.squashfs" \
    -noappend -all-root -comp xz -quiet >/dev/null
du -sx --block-size=1 "$work/rootfs" | awk '{print $1}' \
    >"$work/iso/casper/filesystem.size"
truncate -s 1440K "$work/iso/bios.img"
truncate -s 4M "$work/iso/efi.img"
(
    cd "$work/iso"
    find . -type f ! -name md5sum.txt -print0 \
        | sort -z \
        | xargs -0 md5sum >md5sum.txt
)
xorriso -as mkisofs -quiet -r -V TEST_KUBUNTU \
    -b bios.img -no-emul-boot -boot-load-size 4 -boot-info-table \
    -eltorito-alt-boot -e efi.img -no-emul-boot \
    -o "$work/base.iso" "$work/iso"
base_sha="$(sha256sum "$work/base.iso" | awk '{print $1}')"

"$BUILDER" --help >/dev/null

if "$BUILDER" --base-iso "$work/base.iso" --base-sha256 "${base_sha%?}0" \
    --output "$work/bad.iso" --marker-only >/dev/null 2>&1; then
    fail "bad source hash was accepted"
fi
[ ! -e "$work/bad.iso" ] || fail "failed build promoted an output"

"$BUILDER" --base-iso "$work/base.iso" --base-sha256 "$base_sha" \
    --output "$work/output.iso" --marker-only >/dev/null
[ -s "$work/output.iso" ] || fail "output ISO missing"
[ -s "$work/output.iso.sha256" ] || fail "output checksum missing"
[ -s "$work/output.iso.provenance.json" ] || fail "provenance missing"
(cd "$work" && sha256sum --check output.iso.sha256 >/dev/null)

mkdir "$work/output-root"
xorriso -osirrox on -indev "$work/output.iso" \
    -extract /casper/filesystem.squashfs "$work/output.squashfs" >/dev/null 2>&1
unsquashfs -d "$work/output-root" "$work/output.squashfs" >/dev/null
[ -f "$work/output-root/etc/copernicus-image-release" ] \
    || fail "marker did not reach rebuilt SquashFS"
rg -q '^PROFILE=marker-only$' "$work/output-root/etc/copernicus-image-release" \
    || fail "marker profile is wrong"

source_boot="$work/source.boot"
output_boot="$work/output.boot"
xorriso -indev "$work/base.iso" -report_el_torito plain 2>&1 \
    | sed -n '/^El Torito/p' \
    | sed -E -e 's/^(El Torito catalog  :).*/\1 <location>/' \
        -e '/^El Torito boot img/s/[[:space:]]+[0-9]+$/ <lba>/' >"$source_boot"
xorriso -indev "$work/output.iso" -report_el_torito plain 2>&1 \
    | sed -n '/^El Torito/p' \
    | sed -E -e 's/^(El Torito catalog  :).*/\1 <location>/' \
        -e '/^El Torito boot img/s/[[:space:]]+[0-9]+$/ <lba>/' >"$output_boot"
[ -s "$source_boot" ] || fail "source boot catalog report was empty"
rg -q 'BIOS' "$source_boot" || fail "source BIOS boot entry missing"
rg -q 'UEFI' "$source_boot" || fail "source UEFI boot entry missing"
cmp -s "$source_boot" "$output_boot" || fail "boot catalog was not replayed"

xorriso -osirrox on -indev "$work/output.iso" \
    -extract /md5sum.txt "$work/output.md5" >/dev/null 2>&1
expected_md5="$(md5sum "$work/output.squashfs" | awk '{print $1}')"
rg -q "^${expected_md5} +\\./casper/filesystem.squashfs$" "$work/output.md5" \
    || fail "SquashFS md5 metadata is stale"

python3 - "$work/output.iso.provenance.json" "$base_sha" <<'PY'
import json
import sys

value = json.load(open(sys.argv[1], encoding="utf-8"))
assert value["schema_version"] == "copernicus.kubuntu-image.v1"
assert value["source"]["sha256"] == sys.argv[2]
assert value["profile"] == "marker-only"
assert value["codex_deb"] is None
assert value["remote_services_enabled"] is False
PY

if "$BUILDER" --base-iso "$work/base.iso" --base-sha256 "$base_sha" \
    --output "$work/output.iso" --marker-only >/dev/null 2>&1; then
    fail "existing output was overwritten"
fi

mkdir -p "$work/bin" "$work/codex-state"
cat >"$work/bin/codex" <<'SH'
#!/usr/bin/env bash
set -eu
state="${CODEX_TEST_STATE:?}"
printf '%s\n' "$*" >>"$state/calls"
case "$*" in
    'plugin marketplace list --json')
        if [ -e "$state/marketplace" ]; then
            printf '{"marketplaces":[{"name":"copernicus"}]}\n'
        else
            printf '{"marketplaces":[]}\n'
        fi
        ;;
    'plugin marketplace add /usr/share/copernicus/marketplace')
        touch "$state/marketplace"
        ;;
    'plugin list --json')
        if [ -e "$state/plugin" ]; then
            printf '{"installed":[{"pluginId":"copernicus@copernicus","installed":true}]}\n'
        else
            printf '{"installed":[]}\n'
        fi
        ;;
    'plugin add copernicus@copernicus')
        touch "$state/plugin"
        ;;
    *) exit 9 ;;
esac
SH
chmod +x "$work/bin/codex"
for _ in 1 2; do
    CODEX_TEST_STATE="$work/codex-state" PATH="$work/bin:$PATH" \
        bash "$FIRST_RUN" >/dev/null
done
[ "$(rg -c '^plugin marketplace add ' "$work/codex-state/calls")" -eq 1 ] \
    || fail "first-run helper added the marketplace more than once"
[ "$(rg -c '^plugin add ' "$work/codex-state/calls")" -eq 1 ] \
    || fail "first-run helper installed the plugin more than once"

printf 'Kubuntu image smoke tests passed\n'
