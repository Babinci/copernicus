#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILDER="$REPO_DIR/scripts/build-kubuntu-image.sh"
DEVELOPER_BUILDER="$REPO_DIR/scripts/build-kubuntu-developer-image.sh"

fail() {
    printf 'FAIL: %s\n' "$*" >&2
    exit 1
}

for tool in dpkg-deb fakeroot xorriso mksquashfs unsquashfs sha256sum python3; do
    command -v "$tool" >/dev/null 2>&1 || fail "missing test dependency: $tool"
done

work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
mkdir -p \
    "$work/rootfs/etc" \
    "$work/rootfs/tmp" \
    "$work/rootfs/usr/sbin" \
    "$work/rootfs/var/lib/apt/lists" \
    "$work/iso/casper"
printf 'ID=ubuntu\nVERSION_ID="24.04"\n' >"$work/rootfs/etc/os-release"
ln -s /run/systemd/resolve/stub-resolv.conf "$work/rootfs/etc/resolv.conf"
printf '# original policy\nexit 77\n' >"$work/rootfs/usr/sbin/policy-rc.d"
chmod 0744 "$work/rootfs/usr/sbin/policy-rc.d"
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
if [ "${base_sha:0:1}" = 0 ]; then
    bad_base_sha="1${base_sha:1}"
else
    bad_base_sha="0${base_sha:1}"
fi

builder_help="$("$BUILDER" --help)"
grep -q -- '--developer-tools' <<<"$builder_help" \
    || fail "builder help omits the developer-tools profile"
[ -x "$DEVELOPER_BUILDER" ] || fail "one-command developer image builder is missing"
developer_help="$("$DEVELOPER_BUILDER" --help)"
grep -q 'never writes to a block device' <<<"$developer_help" \
    || fail "developer builder does not state its disk-safety boundary"

ln -s missing "$work/symlink-output.iso.sha256"
if "$BUILDER" --base-iso "$work/base.iso" --base-sha256 "$base_sha" \
    --output "$work/symlink-output.iso" --marker-only >/dev/null 2>&1; then
    fail "dangling output sidecar was overwritten"
fi
[ -L "$work/symlink-output.iso.sha256" ] \
    || fail "dangling output sidecar was not preserved"
[ ! -e "$work/symlink-output.iso" ] \
    || fail "sidecar refusal still promoted an ISO"

if "$BUILDER" --base-iso "$work/base.iso" --base-sha256 "$bad_base_sha" \
    --output "$work/bad.iso" --marker-only >/dev/null 2>&1; then
    fail "bad source hash was accepted"
fi
[ ! -e "$work/bad.iso" ] || fail "failed build promoted an output"
if "$BUILDER" --base-iso "$work/base.iso" --base-sha256 "$base_sha" \
    --output "$work/bad-developer-marker.iso" --marker-only --developer-tools \
    >/dev/null 2>&1; then
    fail "developer tools were accepted for the marker-only profile"
fi

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
grep -q '^PROFILE=marker-only$' "$work/output-root/etc/copernicus-image-release" \
    || fail "marker profile is wrong"
grep -q '^KUBUNTU_RELEASE=24.04.4$' "$work/output-root/etc/copernicus-image-release" \
    || fail "marker release is wrong"
grep -q '^ARCH=amd64$' "$work/output-root/etc/copernicus-image-release" \
    || fail "marker architecture is wrong"
grep -q "^SOURCE_ISO_SHA256=${base_sha}$" \
    "$work/output-root/etc/copernicus-image-release" \
    || fail "marker source hash is wrong"
grep -q '^REMOTE_SERVICES_ENABLED=false$' \
    "$work/output-root/etc/copernicus-image-release" \
    || fail "marker remote policy is wrong"

source_compression="$(unsquashfs -s "$work/iso/casper/filesystem.squashfs" \
    | awk '$1 == "Compression" {print $2; exit}')"
output_compression="$(unsquashfs -s "$work/output.squashfs" \
    | awk '$1 == "Compression" {print $2; exit}')"
source_block_size="$(unsquashfs -s "$work/iso/casper/filesystem.squashfs" \
    | awk '$1 == "Block" && $2 == "size" {print $3; exit}')"
output_block_size="$(unsquashfs -s "$work/output.squashfs" \
    | awk '$1 == "Block" && $2 == "size" {print $3; exit}')"
[ "$output_compression" = "$source_compression" ] \
    || fail "SquashFS compression was not preserved"
[ "$output_block_size" = "$source_block_size" ] \
    || fail "SquashFS block size was not preserved"

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
grep -q 'BIOS' "$source_boot" || fail "source BIOS boot entry missing"
grep -q 'UEFI' "$source_boot" || fail "source UEFI boot entry missing"
cmp -s "$source_boot" "$output_boot" || fail "boot catalog was not replayed"
for boot_image in bios.img efi.img; do
    xorriso -osirrox on -indev "$work/base.iso" \
        -extract "/$boot_image" "$work/base-$boot_image" >/dev/null 2>&1
    xorriso -osirrox on -indev "$work/output.iso" \
        -extract "/$boot_image" "$work/output-$boot_image" >/dev/null 2>&1
    if [ "$boot_image" = bios.img ]; then
        python3 - "$work/base-$boot_image" "$work/output-$boot_image" <<'PY'
import pathlib
import sys

def normalized(path):
    value = bytearray(pathlib.Path(path).read_bytes())
    value[8:64] = b"\0" * 56  # El Torito boot-info table is layout-dependent.
    return value

assert normalized(sys.argv[1]) == normalized(sys.argv[2])
PY
    else
        cmp -s "$work/base-$boot_image" "$work/output-$boot_image" \
            || fail "$boot_image bytes changed during boot replay"
    fi
done

xorriso -osirrox on -indev "$work/output.iso" \
    -extract /md5sum.txt "$work/output.md5" >/dev/null 2>&1
xorriso -osirrox on -indev "$work/output.iso" \
    -extract /casper/filesystem.size "$work/output.size" >/dev/null 2>&1
expected_md5="$(md5sum "$work/output.squashfs" | awk '{print $1}')"
grep -Eq "^${expected_md5} +\\./casper/filesystem.squashfs$" "$work/output.md5" \
    || fail "SquashFS md5 metadata is stale"
expected_size_md5="$(md5sum "$work/output.size" | awk '{print $1}')"
grep -Eq "^${expected_size_md5} +\\./casper/filesystem.size$" "$work/output.md5" \
    || fail "filesystem.size md5 metadata is stale"
expected_size="$(du -sx --block-size=1 "$work/output-root" | awk '{print $1}')"
[ "$(cat "$work/output.size")" = "$expected_size" ] \
    || fail "filesystem.size content is stale"

python3 - "$work/output.iso.provenance.json" "$work/output.iso" "$base_sha" <<'PY'
import hashlib
import json
import pathlib
import sys

value = json.load(open(sys.argv[1], encoding="utf-8"))
output = pathlib.Path(sys.argv[2])
assert value["schema_version"] == "copernicus.kubuntu-image.v1"
assert value["source"] == {
    "filename": "base.iso",
    "sha256": sys.argv[3],
    "verification": "local-pinned",
}
assert value["profile"] == "marker-only"
assert value["codex_deb"] is None
assert value["packages"] == []
assert value["remote_services_enabled"] is False
assert value["output"]["filename"] == output.name
assert value["output"]["sha256"] == hashlib.sha256(output.read_bytes()).hexdigest()
PY

if "$BUILDER" --base-iso "$work/base.iso" --base-sha256 "$base_sha" \
    --output "$work/output.iso" --marker-only >/dev/null 2>&1; then
    fail "existing output was overwritten"
fi

make_test_deb() {
    package="$1"
    arch="$2"
    output="$3"
    root="$work/deb-$package-$arch"
    mkdir -p "$root/DEBIAN" "$root/usr/share/copernicus-image-test"
    cat >"$root/DEBIAN/control" <<EOF
Package: $package
Version: 0.0.0-test
Architecture: $arch
Maintainer: Copernicus Tests <tests@example.invalid>
Description: Synthetic package for the Kubuntu image smoke test
EOF
    printf '%s\n' "$package/$arch" >"$root/usr/share/copernicus-image-test/payload.txt"
    dpkg-deb --build "$root" "$output" >/dev/null
}

mkdir -p "$work/fake-bin"
cat >"$work/fake-bin/id" <<'SH'
#!/usr/bin/env bash
set -eu
if [ "${1:-}" = -u ]; then
    printf '0\n'
else
    exec /usr/bin/id "$@"
fi
SH
cat >"$work/fake-bin/chroot" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
root="$1"
shift
printf '%q ' "$@" >>"${CODEX_TEST_CHROOT_LOG:?}"
printf '\n' >>"$CODEX_TEST_CHROOT_LOG"
if [ "${1:-}" = /usr/bin/env ]; then
    shift
    while [[ "${1:-}" == *=* ]]; do shift; done
fi
command_name="${1:-}"
shift || true
check_build_guards() {
    [ -f "$root/etc/resolv.conf" ] && [ ! -L "$root/etc/resolv.conf" ]
    set +e
    "$root/usr/sbin/policy-rc.d"
    policy_status=$?
    set -e
    [ "$policy_status" -eq 101 ]
}
case "$command_name" in
    apt-get)
        action="${1:-}"
        case "$action" in
            update)
                [ "$*" = 'update -qq' ]
                check_build_guards
                ;;
            install)
                check_build_guards
                if [ "$*" = 'install -y /tmp/copernicus-image-codex.deb' ]; then
                    /usr/bin/dpkg-deb -x "$root/tmp/copernicus-image-codex.deb" "$root"
                else
                    [[ " $* " == *' docker-ce '* ]] || exit 94
                fi
                ;;
            clean) [ "$*" = clean ] ;;
            *) exit 90 ;;
        esac
        ;;
    dpkg-query)
        case "$*" in
            '-W -f=${db:Status-Status} codex-desktop') printf 'installed\n' ;;
            '-W -f=${Version} docker-ce') printf '29.6.1-test\n' ;;
            '-W -f=${binary:Package}\t${Version}\n')
                printf 'base-fixture\t1.0\ncodex-desktop\t0.0.0-test\ndocker-ce\t29.6.1-test\n'
                ;;
            *) exit 92 ;;
        esac
        ;;
    npm)
        [ "$*" = 'install --global --no-audit --no-fund @openai/codex@0.147.0' ]
        printf '#!/bin/sh\nexit 0\n' >"$root/opt/node-v24.19.0-linux-x64/bin/codex"
        chmod +x "$root/opt/node-v24.19.0-linux-x64/bin/codex"
        ;;
    *) exit 91 ;;
esac
SH
cat >"$work/fake-bin/chown" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >>"${CODEX_TEST_CHOWN_LOG:?}"
[ "${1:-}" = -R ] && [ "${2:-}" = 0:0 ]
case "${3:-}" in
    */rootfs/usr/share/copernicus/marketplace) ;;
    *) exit 93 ;;
esac
exec /usr/bin/chown "$@"
SH
cat >"$work/fake-bin/gpg" <<'SH'
#!/usr/bin/env bash
set -eu
[ "${1:-}" = --show-keys ]
printf 'fpr:::::::::9DC858229FC7DD38854AE2D88D81803C0EBFCD88:\n'
SH
chmod +x "$work/fake-bin/id" "$work/fake-bin/chroot" "$work/fake-bin/chown" \
    "$work/fake-bin/gpg"

mkdir -p "$work/node/node-v24.19.0-linux-x64/bin" \
    "$work/uv/uv-x86_64-unknown-linux-gnu"
for command_name in node npm npx; do
    printf '#!/bin/sh\nexit 0\n' >"$work/node/node-v24.19.0-linux-x64/bin/$command_name"
    chmod +x "$work/node/node-v24.19.0-linux-x64/bin/$command_name"
done
for command_name in uv uvx; do
    printf '#!/bin/sh\nexit 0\n' >"$work/uv/uv-x86_64-unknown-linux-gnu/$command_name"
    chmod +x "$work/uv/uv-x86_64-unknown-linux-gnu/$command_name"
done
tar -cJf "$work/node.tar.xz" -C "$work/node" node-v24.19.0-linux-x64
tar -czf "$work/uv.tar.gz" -C "$work/uv" uv-x86_64-unknown-linux-gnu
printf 'synthetic Docker key\n' >"$work/docker.asc"
node_sha="$(sha256sum "$work/node.tar.xz" | awk '{print $1}')"
uv_sha="$(sha256sum "$work/uv.tar.gz" | awk '{print $1}')"

make_test_deb codex-desktop amd64 "$work/codex-desktop.deb"
make_test_deb other-package amd64 "$work/other-package.deb"
make_test_deb codex-desktop i386 "$work/codex-desktop-i386.deb"
deb_sha="$(sha256sum "$work/codex-desktop.deb" | awk '{print $1}')"
other_sha="$(sha256sum "$work/other-package.deb" | awk '{print $1}')"
i386_sha="$(sha256sum "$work/codex-desktop-i386.deb" | awk '{print $1}')"

wrapper_output="$work/wrapper/out/developer.iso"
wrapper_plan="$("$DEVELOPER_BUILDER" --dry-run --download-base --workspace "$work/wrapper" \
    --codex-deb "$work/codex-desktop.deb" --output "$wrapper_output")"
grep -q 'developer-tools profile' <<<"$wrapper_plan" \
    || fail "one-command wrapper did not select the developer profile"
[ ! -e "$work/wrapper" ] || fail "developer wrapper dry run wrote to its workspace"
if "$DEVELOPER_BUILDER" --dry-run --download-base --workspace "$work/wrapper" \
    --codex-deb "$work/codex-desktop.deb" --output "$work/outside.iso" \
    >/dev/null 2>&1; then
    fail "developer wrapper accepted output outside its workspace"
fi
mkdir -p "$work/wrapper-symlink" "$work/symlink-target"
ln -s "$work/symlink-target" "$work/wrapper-symlink/out"
if "$DEVELOPER_BUILDER" --dry-run --download-base --workspace "$work/wrapper-symlink" \
    --codex-deb "$work/codex-desktop.deb" \
    --output "$work/wrapper-symlink/out/developer.iso" >/dev/null 2>&1; then
    fail "developer wrapper followed an output-directory symlink outside its workspace"
fi

expect_full_rejection() {
    name="$1"
    expected="$2"
    shift 2
    set +e
    rejection_output="$(PATH="$work/fake-bin:$PATH" "$BUILDER" "$@" 2>&1)"
    rejection_status=$?
    set -e
    [ "$rejection_status" -ne 0 ] || fail "$name was accepted"
    printf '%s\n' "$rejection_output" | grep -Fq -- "$expected" \
        || fail "$name returned the wrong error"
    for suffix in '' .sha256 .provenance.json; do
        [ ! -e "$work/$name.iso$suffix" ] && [ ! -L "$work/$name.iso$suffix" ] \
            || fail "$name promoted an output"
    done
}

common_full=(
    --base-iso "$work/base.iso"
    --base-sha256 "$base_sha"
)
expect_full_rejection missing-ack '--accept-private-codex-payload is required' \
    "${common_full[@]}" --output "$work/missing-ack.iso" \
    --codex-deb "$work/codex-desktop.deb" --codex-deb-sha256 "$deb_sha"
expect_full_rejection bad-deb-sha 'Codex package SHA256 mismatch' \
    "${common_full[@]}" --output "$work/bad-deb-sha.iso" \
    --codex-deb "$work/codex-desktop.deb" --codex-deb-sha256 "$bad_base_sha" \
    --accept-private-codex-payload
expect_full_rejection wrong-package 'expected package codex-desktop' \
    "${common_full[@]}" --output "$work/wrong-package.iso" \
    --codex-deb "$work/other-package.deb" --codex-deb-sha256 "$other_sha" \
    --accept-private-codex-payload
expect_full_rejection wrong-architecture 'expected amd64 Codex package' \
    "${common_full[@]}" --output "$work/wrong-architecture.iso" \
    --codex-deb "$work/codex-desktop-i386.deb" --codex-deb-sha256 "$i386_sha" \
    --accept-private-codex-payload
set +e
invalid_version_output="$(COPERNICUS_NODE_VERSION=../../escape PATH="$work/fake-bin:$PATH" \
    "$BUILDER" "${common_full[@]}" --output "$work/invalid-node-version.iso" \
    --codex-deb "$work/codex-desktop.deb" --codex-deb-sha256 "$deb_sha" \
    --accept-private-codex-payload --developer-tools 2>&1)"
invalid_version_status=$?
set -e
[ "$invalid_version_status" -ne 0 ] || fail "invalid Node.js version was accepted"
grep -Fq 'invalid Node.js version' <<<"$invalid_version_output" \
    || fail "invalid Node.js version returned the wrong error"
[ ! -e "$work/chroot.log" ] || fail "rejected package reached chroot"

CODEX_TEST_CHROOT_LOG="$work/chroot.log" CODEX_TEST_CHOWN_LOG="$work/chown.log" \
    COPERNICUS_NODE_URL="file://$work/node.tar.xz" COPERNICUS_NODE_SHA256="$node_sha" \
    COPERNICUS_UV_URL="file://$work/uv.tar.gz" COPERNICUS_UV_SHA256="$uv_sha" \
    COPERNICUS_DOCKER_GPG_URL="file://$work/docker.asc" \
    PATH="$work/fake-bin:$PATH" \
    fakeroot -- "$BUILDER" "${common_full[@]}" --output "$work/full-output.iso" \
    --codex-deb "$work/codex-desktop.deb" --codex-deb-sha256 "$deb_sha" \
    --accept-private-codex-payload --developer-tools >/dev/null

xorriso -osirrox on -indev "$work/full-output.iso" \
    -extract /casper/filesystem.squashfs "$work/full-output.squashfs" >/dev/null 2>&1
xorriso -osirrox on -indev "$work/full-output.iso" \
    -extract /casper/filesystem.manifest "$work/full-output.manifest" >/dev/null 2>&1
xorriso -osirrox on -indev "$work/full-output.iso" \
    -extract /md5sum.txt "$work/full-output.md5" >/dev/null 2>&1
unsquashfs -d "$work/full-output-root" "$work/full-output.squashfs" >/dev/null
[ "$(wc -l <"$work/chown.log")" -eq 1 ] \
    || fail "marketplace ownership was not normalized exactly once"

full_root="$work/full-output-root"
grep -q '^PROFILE=full$' "$full_root/etc/copernicus-image-release" \
    || fail "full image marker profile is wrong"
grep -q '^CODEX_DESKTOP_PACKAGE=codex-desktop$' "$full_root/etc/copernicus-image-release" \
    || fail "full image marker package is wrong"
grep -q '^CODEX_DESKTOP_VERSION=0.0.0-test$' "$full_root/etc/copernicus-image-release" \
    || fail "full image marker version is wrong"
grep -q "^CODEX_DEB_SHA256=${deb_sha}$" "$full_root/etc/copernicus-image-release" \
    || fail "full image marker package hash is wrong"
grep -q '^COPERNICUS_PLUGIN_BUNDLED=true$' "$full_root/etc/copernicus-image-release" \
    || fail "full image marker omits plugin state"
grep -q '^DEVELOPER_TOOLS_ENABLED=true$' "$full_root/etc/copernicus-image-release" \
    || fail "developer image marker omits its profile"
grep -q '^NODE_VERSION=24.19.0$' "$full_root/etc/copernicus-developer-tools" \
    || fail "developer tool manifest omits Node.js"
grep -q '^UV_VERSION=0.11.32$' "$full_root/etc/copernicus-developer-tools" \
    || fail "developer tool manifest omits uv"
grep -q '^CODEX_CLI_VERSION=0.147.0$' "$full_root/etc/copernicus-developer-tools" \
    || fail "developer tool manifest omits Codex CLI"
grep -q '^DOCKER_VERSION=29.6.1-test$' "$full_root/etc/copernicus-developer-tools" \
    || fail "developer tool manifest omits Docker"
grep -q '^DOCKER_GROUP_ACCESS=false$' "$full_root/etc/copernicus-developer-tools" \
    || fail "developer tool manifest granted root-equivalent Docker access"
grep -q '^REMOTE_DOCKER_API=false$' "$full_root/etc/copernicus-developer-tools" \
    || fail "developer tool manifest enabled the remote Docker API"
for command_name in node npm npx uv uvx codex fd; do
    [ -e "$full_root/usr/local/bin/$command_name" ] \
        || [ -L "$full_root/usr/local/bin/$command_name" ] \
        || fail "developer image omits $command_name"
done
[ -f "$full_root/etc/apt/sources.list.d/docker.sources" ] \
    || fail "developer image omits Docker's apt source"
[ "$(cat "$full_root/usr/share/copernicus-image-test/payload.txt")" = 'codex-desktop/amd64' ] \
    || fail "synthetic package payload is missing"
[ -f "$full_root/usr/share/copernicus/marketplace/.agents/plugins/marketplace.json" ] \
    || fail "bundled marketplace metadata is missing"
[ -f "$full_root/usr/share/copernicus/marketplace/plugins/copernicus/.codex-plugin/plugin.json" ] \
    || fail "bundled Copernicus plugin is missing"
unsquashfs -ll "$work/full-output.squashfs" \
    usr/share/copernicus/marketplace >"$work/full-marketplace.list"
if ! awk '
    $NF ~ /\/usr\/share\/copernicus\/marketplace(\/|$)/ && $2 != "root/root" {exit 1}
' "$work/full-marketplace.list"; then
    sed -n '1,40p' "$work/full-marketplace.list" >&2
    fail "bundled marketplace is not root-owned"
fi
if ! awk '
    $NF ~ /\/usr\/share\/copernicus\/marketplace(\/|$)/ &&
        (substr($1, 6, 1) == "w" || substr($1, 9, 1) == "w") {exit 1}
' "$work/full-marketplace.list"; then
    sed -n '1,40p' "$work/full-marketplace.list" >&2
    fail "bundled marketplace is group- or world-writable"
fi
[ -x "$full_root/usr/local/bin/copernicus-first-run" ] \
    || fail "first-run helper is missing or not executable"
[ -f "$full_root/usr/share/applications/copernicus-first-run.desktop" ] \
    || fail "first-run desktop entry is missing"
[ ! -e "$full_root/tmp/copernicus-image-codex.deb" ] \
    || fail "staged package was left in the image"
[ -L "$full_root/etc/resolv.conf" ] \
    && [ "$(readlink "$full_root/etc/resolv.conf")" = /run/systemd/resolve/stub-resolv.conf ] \
    || fail "resolver symlink was not restored"
cmp -s "$work/rootfs/usr/sbin/policy-rc.d" "$full_root/usr/sbin/policy-rc.d" \
    || fail "policy-rc.d was not restored"
[ "$(stat -c '%a' "$full_root/usr/sbin/policy-rc.d")" = 744 ] \
    || fail "policy-rc.d mode was not restored"
grep -q $'^codex-desktop\t0.0.0-test$' "$work/full-output.manifest" \
    || fail "full image manifest omits the installed package"
grep -q $'^docker-ce\t29.6.1-test$' "$work/full-output.manifest" \
    || fail "full image manifest omits Docker"
manifest_md5="$(md5sum "$work/full-output.manifest" | awk '{print $1}')"
grep -Eq "^${manifest_md5} +\\./casper/filesystem.manifest$" "$work/full-output.md5" \
    || fail "full image manifest md5 metadata is stale"

python3 - "$work/full-output.iso.provenance.json" "$work/full-output.iso" \
    "$base_sha" "$deb_sha" <<'PY'
import hashlib
import json
import pathlib
import sys

value = json.load(open(sys.argv[1], encoding="utf-8"))
output = pathlib.Path(sys.argv[2])
assert value["profile"] == "full"
assert value["source"]["sha256"] == sys.argv[3]
assert value["output"]["sha256"] == hashlib.sha256(output.read_bytes()).hexdigest()
assert value["codex_deb"] == {
    "package": "codex-desktop",
    "version": "0.0.0-test",
    "architecture": "amd64",
    "sha256": sys.argv[4],
}
assert value["packages"] == ["codex-desktop"]
assert value["developer_tools"] == {
    "node_version": "24.19.0",
    "uv_version": "0.11.32",
    "codex_cli_version": "0.147.0",
    "docker_version": "29.6.1-test",
    "docker_group_access": False,
    "remote_docker_api": False,
}
assert value["remote_services_enabled"] is False
PY

printf 'Kubuntu image smoke tests passed\n'
