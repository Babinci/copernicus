#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OFFICIAL_NAME="kubuntu-24.04.4-desktop-amd64.iso"
OFFICIAL_BASE_URL="https://cdimage.ubuntu.com/kubuntu/releases/24.04.4/release"
OFFICIAL_SHA256="02cda2568cb96c090b0438a31a7d2e7b07357fde16217c215e7c3f45263bcc49"
STATE_DIR="$REPO_DIR/.copernicus/kubuntu-image"
BASE_ISO=""
BASE_SHA256=""
OUTPUT="$STATE_DIR/out/copernicus-kubuntu-24.04.4-amd64.iso"
PROFILE="full"
CODEX_DEB=""
CODEX_DEB_SHA256=""
ACCEPT_PRIVATE_PAYLOAD=0

usage() {
    cat <<'EOF'
Build a local Copernicus-provisioned Kubuntu 24.04.4 amd64 ISO.

Usage:
  sudo scripts/build-kubuntu-image.sh [options]

Options:
  --base-iso PATH       Use an existing ISO instead of downloading the official ISO.
  --base-sha256 HASH    Required with --base-iso; pin the exact local input.
  --output PATH         Output ISO path (must not already exist).
  --codex-deb PATH      Locally built codex-desktop .deb for the full profile.
  --codex-deb-sha256 H  Required SHA-256 for --codex-deb.
  --accept-private-codex-payload
                        Confirm the generated ISO stays private unless its
                        proprietary payload is separately cleared for sharing.
  --marker-only         Add only the harmless transfer-test marker.
  -h, --help            Show this help.

With no --base-iso, the pinned official Kubuntu ISO, SHA256SUMS, and signature
are downloaded from cdimage.ubuntu.com. Generated images stay under the ignored
.copernicus directory by default. The normal Calamares disk confirmation is not
changed. This command never writes an installer image to a device.
EOF
}

die() {
    printf 'kubuntu-image: %s\n' "$*" >&2
    exit 2
}

require_tool() {
    command -v "$1" >/dev/null 2>&1 || die "missing required tool: $1"
}

is_sha256() {
    [[ "$1" =~ ^[0-9a-f]{64}$ ]]
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --base-iso)
            [ "$#" -ge 2 ] || die "--base-iso requires a path"
            BASE_ISO="$2"
            shift 2
            ;;
        --base-sha256)
            [ "$#" -ge 2 ] || die "--base-sha256 requires a hash"
            BASE_SHA256="$2"
            shift 2
            ;;
        --output)
            [ "$#" -ge 2 ] || die "--output requires a path"
            OUTPUT="$2"
            shift 2
            ;;
        --codex-deb)
            [ "$#" -ge 2 ] || die "--codex-deb requires a path"
            CODEX_DEB="$2"
            shift 2
            ;;
        --codex-deb-sha256)
            [ "$#" -ge 2 ] || die "--codex-deb-sha256 requires a hash"
            CODEX_DEB_SHA256="$2"
            shift 2
            ;;
        --accept-private-codex-payload)
            ACCEPT_PRIVATE_PAYLOAD=1
            shift
            ;;
        --marker-only)
            PROFILE="marker-only"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *) die "unknown option: $1" ;;
    esac
done

if [ -n "$BASE_ISO" ] && [ -z "$BASE_SHA256" ]; then
    die "--base-sha256 is required with --base-iso"
fi
if [ -z "$BASE_ISO" ] && [ -n "$BASE_SHA256" ]; then
    die "--base-sha256 requires --base-iso"
fi

if [ "$PROFILE" = "full" ]; then
    [ -n "$CODEX_DEB" ] || die "--codex-deb is required for the full profile"
    [ -n "$CODEX_DEB_SHA256" ] || die "--codex-deb-sha256 is required for the full profile"
    [ "$ACCEPT_PRIVATE_PAYLOAD" -eq 1 ] \
        || die "--accept-private-codex-payload is required for the full profile"
    [ "$(id -u)" -eq 0 ] || die "the full profile must run as root (use sudo or a privileged build container)"
else
    [ -z "$CODEX_DEB$CODEX_DEB_SHA256" ] && [ "$ACCEPT_PRIVATE_PAYLOAD" -eq 0 ] \
        || die "Codex package options cannot be used with --marker-only"
fi

for tool in awk curl du git gpgv grep md5sum mksquashfs python3 sha256sum unsquashfs xorriso; do
    require_tool "$tool"
done
if [ "$PROFILE" = "marker-only" ]; then
    require_tool fakeroot
else
    require_tool chroot
    require_tool dpkg-deb
fi

if [ "$PROFILE" = "marker-only" ] && [ "$(id -u)" -ne 0 ] && [ -z "${FAKEROOTKEY:-}" ]; then
    fakeroot_args=(--output "$OUTPUT" --marker-only)
    if [ -n "$BASE_ISO" ]; then
        fakeroot_args+=(--base-iso "$BASE_ISO" --base-sha256 "$BASE_SHA256")
    fi
    exec fakeroot -- "$0" "${fakeroot_args[@]}"
fi

OUTPUT="$(python3 -c 'import os,sys; print(os.path.abspath(sys.argv[1]))' "$OUTPUT")"
output_dir="$(dirname "$OUTPUT")"
output_name="$(basename "$OUTPUT")"
checksum_path="$OUTPUT.sha256"
provenance_path="$OUTPUT.provenance.json"
mkdir -p "$output_dir"
for path in "$OUTPUT" "$checksum_path" "$provenance_path"; do
    [ ! -e "$path" ] && [ ! -L "$path" ] \
        || die "refusing to overwrite existing path: $path"
done

work="$(mktemp -d "${TMPDIR:-/tmp}/copernicus-kubuntu-image.XXXXXX")"
tmp_iso="$output_dir/.${output_name}.tmp.$$"
tmp_checksum="$work/output.sha256"
tmp_provenance="$work/provenance.json"
promoted=0
cleanup() {
    status=$?
    rm -f -- "$tmp_iso"
    rm -rf -- "$work"
    if [ "$promoted" -eq 0 ]; then
        rm -f -- "$checksum_path" "$provenance_path"
    fi
    exit "$status"
}
trap cleanup EXIT INT TERM

verification="local-pinned"
if [ -z "$BASE_ISO" ]; then
    keyring="/usr/share/keyrings/ubuntu-archive-keyring.gpg"
    [ -r "$keyring" ] || die "Ubuntu archive keyring is required: $keyring"
    mkdir -p "$STATE_DIR/input"
    sums="$work/SHA256SUMS"
    signature="$work/SHA256SUMS.gpg"
    curl -fsSL "$OFFICIAL_BASE_URL/SHA256SUMS" -o "$sums"
    curl -fsSL "$OFFICIAL_BASE_URL/SHA256SUMS.gpg" -o "$signature"
    gpgv --keyring "$keyring" "$signature" "$sums" >/dev/null 2>&1 \
        || die "official SHA256SUMS signature verification failed"
    signed_sha="$(awk -v name="$OFFICIAL_NAME" '$2 == "*" name || $2 == name {print $1}' "$sums")"
    [ "$signed_sha" = "$OFFICIAL_SHA256" ] \
        || die "signed official ISO hash does not match the pinned release"
    BASE_ISO="$STATE_DIR/input/$OFFICIAL_NAME"
    if [ ! -f "$BASE_ISO" ]; then
        part="$BASE_ISO.part"
        curl -fL --retry 3 --continue-at - "$OFFICIAL_BASE_URL/$OFFICIAL_NAME" -o "$part"
        actual_part_sha="$(sha256sum "$part" | awk '{print $1}')"
        [ "$actual_part_sha" = "$OFFICIAL_SHA256" ] || die "downloaded ISO hash mismatch"
        mv -- "$part" "$BASE_ISO"
    fi
    BASE_SHA256="$OFFICIAL_SHA256"
    verification="official-signed-and-pinned"
fi

BASE_ISO="$(python3 -c 'import os,sys; print(os.path.abspath(sys.argv[1]))' "$BASE_ISO")"
[ -f "$BASE_ISO" ] || die "base ISO not found: $BASE_ISO"
is_sha256 "$BASE_SHA256" || die "invalid --base-sha256 value"
actual_sha="$(sha256sum "$BASE_ISO" | awk '{print $1}')"
[ "$actual_sha" = "$BASE_SHA256" ] || die "base ISO SHA256 mismatch"
[ "$BASE_ISO" != "$OUTPUT" ] || die "input and output paths must differ"

deb_package=""
deb_version=""
deb_arch=""
if [ "$PROFILE" = "full" ]; then
    CODEX_DEB="$(python3 -c 'import os,sys; print(os.path.abspath(sys.argv[1]))' "$CODEX_DEB")"
    [ -f "$CODEX_DEB" ] || die "Codex package not found: $CODEX_DEB"
    is_sha256 "$CODEX_DEB_SHA256" || die "invalid --codex-deb-sha256 value"
    actual_deb_sha="$(sha256sum "$CODEX_DEB" | awk '{print $1}')"
    [ "$actual_deb_sha" = "$CODEX_DEB_SHA256" ] || die "Codex package SHA256 mismatch"
    deb_package="$(dpkg-deb -f "$CODEX_DEB" Package)"
    deb_version="$(dpkg-deb -f "$CODEX_DEB" Version)"
    deb_arch="$(dpkg-deb -f "$CODEX_DEB" Architecture)"
    [ "$deb_package" = "codex-desktop" ] || die "expected package codex-desktop, found $deb_package"
    [ "$deb_arch" = "amd64" ] || die "expected amd64 Codex package, found $deb_arch"
fi

source_squash="$work/source.squashfs"
rootfs="$work/rootfs"
rebuilt_squash="$work/filesystem.squashfs"
rebuilt_size="$work/filesystem.size"
rebuilt_md5="$work/md5sum.txt"

xorriso -osirrox on -indev "$BASE_ISO" \
    -extract /casper/filesystem.squashfs "$source_squash" >/dev/null 2>&1 \
    || die "base ISO lacks /casper/filesystem.squashfs"
xorriso -osirrox on -indev "$BASE_ISO" \
    -extract /md5sum.txt "$rebuilt_md5" >/dev/null 2>&1 \
    || die "base ISO lacks /md5sum.txt"
unsquashfs -d "$rootfs" "$source_squash" >/dev/null
mkdir -p "$rootfs/etc"
cat >"$rootfs/etc/copernicus-image-release" <<EOF
SCHEMA=copernicus.kubuntu-image.v1
KUBUNTU_RELEASE=24.04.4
ARCH=amd64
PROFILE=$PROFILE
SOURCE_ISO_SHA256=$BASE_SHA256
REMOTE_SERVICES_ENABLED=false
EOF
if [ "$PROFILE" = "full" ]; then
    cat >>"$rootfs/etc/copernicus-image-release" <<EOF
CODEX_DESKTOP_PACKAGE=$deb_package
CODEX_DESKTOP_VERSION=$deb_version
CODEX_DEB_SHA256=$CODEX_DEB_SHA256
COPERNICUS_PLUGIN_BUNDLED=true
EOF
fi
chmod 0644 "$rootfs/etc/copernicus-image-release"

rebuilt_manifest=""
if [ "$PROFILE" = "full" ]; then
    marketplace="$rootfs/usr/share/copernicus/marketplace"
    install -d -m 0755 \
        "$marketplace/.agents/plugins" \
        "$marketplace/plugins" \
        "$rootfs/usr/local/bin" \
        "$rootfs/usr/share/applications" \
        "$rootfs/usr/share/doc/copernicus-image"
    install -m 0644 "$REPO_DIR/.agents/plugins/marketplace.json" \
        "$marketplace/.agents/plugins/marketplace.json"
    cp -a "$REPO_DIR/plugins/copernicus" "$marketplace/plugins/copernicus"
    find "$marketplace" -type f -name '*.pyc' -delete
    find "$marketplace" -depth -type d -name __pycache__ -delete
    install -m 0644 "$REPO_DIR/LICENSE" "$marketplace/LICENSE"
    chown -R 0:0 "$marketplace"
    chmod -R u=rwX,go=rX "$marketplace"
    install -m 0755 "$REPO_DIR/packaging/kubuntu-image/copernicus-first-run" \
        "$rootfs/usr/local/bin/copernicus-first-run"
    install -m 0644 "$REPO_DIR/packaging/kubuntu-image/copernicus-first-run.desktop" \
        "$rootfs/usr/share/applications/copernicus-first-run.desktop"
    install -m 0644 "$REPO_DIR/docs/copernicus/kubuntu-image.md" \
        "$rootfs/usr/share/doc/copernicus-image/README.md"

    staged_deb="/tmp/copernicus-image-codex.deb"
    cp "$CODEX_DEB" "$rootfs$staged_deb"

    resolver_kind="missing"
    resolver_target=""
    if [ -L "$rootfs/etc/resolv.conf" ]; then
        resolver_kind="symlink"
        resolver_target="$(readlink "$rootfs/etc/resolv.conf")"
        rm "$rootfs/etc/resolv.conf"
    elif [ -f "$rootfs/etc/resolv.conf" ]; then
        resolver_kind="file"
        cp "$rootfs/etc/resolv.conf" "$work/resolv.conf.original"
    fi
    cp /etc/resolv.conf "$rootfs/etc/resolv.conf"

    policy="$rootfs/usr/sbin/policy-rc.d"
    policy_existed=0
    if [ -e "$policy" ]; then
        policy_existed=1
        cp -a "$policy" "$work/policy-rc.d.original"
    fi
    cat >"$policy" <<'EOF'
#!/bin/sh
exit 101
EOF
    chmod 0755 "$policy"

    chroot "$rootfs" /usr/bin/env DEBIAN_FRONTEND=noninteractive \
        apt-get update -qq
    chroot "$rootfs" /usr/bin/env DEBIAN_FRONTEND=noninteractive \
        apt-get install -y "$staged_deb"
    installed_status="$(chroot "$rootfs" dpkg-query -W \
        -f='${db:Status-Status}' "$deb_package")"
    [ "$installed_status" = "installed" ] || die "Codex package did not reach installed state"
    chroot "$rootfs" apt-get clean
    rm -f "$rootfs$staged_deb"
    find "$rootfs/var/lib/apt/lists" -mindepth 1 -delete

    rm -f "$rootfs/etc/resolv.conf"
    case "$resolver_kind" in
        symlink) ln -s "$resolver_target" "$rootfs/etc/resolv.conf" ;;
        file) cp "$work/resolv.conf.original" "$rootfs/etc/resolv.conf" ;;
    esac
    if [ "$policy_existed" -eq 1 ]; then
        cp -a "$work/policy-rc.d.original" "$policy"
    else
        rm -f "$policy"
    fi

    rebuilt_manifest="$work/filesystem.manifest"
    chroot "$rootfs" dpkg-query -W -f='${binary:Package}\t${Version}\n' \
        | LC_ALL=C sort >"$rebuilt_manifest"
fi

compression="$(unsquashfs -s "$source_squash" | awk '$1 == "Compression" {print $2; exit}')"
block_size="$(unsquashfs -s "$source_squash" | awk '$1 == "Block" && $2 == "size" {print $3; exit}')"
case "$compression" in
    gzip|lzo|lz4|xz|zstd) ;;
    *) die "unsupported SquashFS compression: ${compression:-unknown}" ;;
esac
[[ "$block_size" =~ ^[0-9]+$ ]] || die "cannot determine SquashFS block size"
mksquashfs "$rootfs" "$rebuilt_squash" -noappend -comp "$compression" \
    -b "$block_size" -quiet >/dev/null
du -sx --block-size=1 "$rootfs" | awk '{print $1}' >"$rebuilt_size"

python3 - "$rebuilt_md5" "$rebuilt_squash" "$rebuilt_size" "$rebuilt_manifest" <<'PY'
import hashlib
import pathlib
import re
import sys

metadata = pathlib.Path(sys.argv[1])
replacements = {
    "casper/filesystem.squashfs": pathlib.Path(sys.argv[2]),
    "casper/filesystem.size": pathlib.Path(sys.argv[3]),
}
if sys.argv[4]:
    replacements["casper/filesystem.manifest"] = pathlib.Path(sys.argv[4])

def md5(path):
    digest = hashlib.md5()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

seen = set()
lines = []
for raw in metadata.read_text(encoding="utf-8").splitlines():
    match = re.match(r"^[0-9a-fA-F]{32}(\s+\*?)(?:\./)?(.+)$", raw)
    if match and match.group(2) in replacements:
        name = match.group(2)
        lines.append(f"{md5(replacements[name])}{match.group(1)}./{name}")
        seen.add(name)
    else:
        lines.append(raw)
for name, path in replacements.items():
    if name not in seen:
        lines.append(f"{md5(path)}  ./{name}")
metadata.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

map_args=(
    -map "$rebuilt_squash" /casper/filesystem.squashfs
    -map "$rebuilt_size" /casper/filesystem.size
    -map "$rebuilt_md5" /md5sum.txt
)
if [ -n "$rebuilt_manifest" ]; then
    map_args+=(-map "$rebuilt_manifest" /casper/filesystem.manifest)
fi
xorriso -indev "$BASE_ISO" -outdev "$tmp_iso" \
    -boot_image any replay -overwrite on \
    "${map_args[@]}" \
    -commit -end >/dev/null 2>&1 \
    || die "xorriso failed to rebuild the ISO"

check_squash="$work/check.squashfs"
xorriso -osirrox on -indev "$tmp_iso" \
    -extract /casper/filesystem.squashfs "$check_squash" >/dev/null 2>&1
expected_squash_sha="$(sha256sum "$rebuilt_squash" | awk '{print $1}')"
actual_squash_sha="$(sha256sum "$check_squash" | awk '{print $1}')"
[ "$actual_squash_sha" = "$expected_squash_sha" ] || die "rebuilt SquashFS verification failed"
unsquashfs -cat "$check_squash" etc/copernicus-image-release 2>/dev/null \
    | grep -qx "PROFILE=$PROFILE" \
    || die "rebuilt ISO lacks the transfer marker"
if [ "$PROFILE" = "full" ]; then
    unsquashfs -ll "$check_squash" usr/local/bin/copernicus-first-run 2>/dev/null \
        | grep -q 'usr/local/bin/copernicus-first-run' \
        || die "rebuilt ISO lacks the first-run helper"
fi

output_sha="$(sha256sum "$tmp_iso" | awk '{print $1}')"
printf '%s  %s\n' "$output_sha" "$output_name" >"$tmp_checksum"
revision="$(git -c safe.directory="$REPO_DIR" -C "$REPO_DIR" \
    describe --always --dirty 2>/dev/null || printf unknown)"
python3 - "$tmp_provenance" "$(basename "$BASE_ISO")" "$BASE_SHA256" \
    "$verification" "$output_name" "$output_sha" "$revision" "$PROFILE" \
    "$deb_package" "$deb_version" "$deb_arch" "$CODEX_DEB_SHA256" <<'PY'
import datetime
import json
import sys

value = {
    "schema_version": "copernicus.kubuntu-image.v1",
    "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "builder_revision": sys.argv[7],
    "profile": sys.argv[8],
    "source": {
        "filename": sys.argv[2],
        "sha256": sys.argv[3],
        "verification": sys.argv[4],
    },
    "output": {"filename": sys.argv[5], "sha256": sys.argv[6]},
    "codex_deb": None if not sys.argv[9] else {
        "package": sys.argv[9],
        "version": sys.argv[10],
        "architecture": sys.argv[11],
        "sha256": sys.argv[12],
    },
    "packages": [] if not sys.argv[9] else [sys.argv[9]],
    "remote_services_enabled": False,
}
with open(sys.argv[1], "w", encoding="utf-8") as handle:
    json.dump(value, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY

mv -- "$tmp_checksum" "$checksum_path"
mv -- "$tmp_provenance" "$provenance_path"
mv -- "$tmp_iso" "$OUTPUT"
promoted=1
printf 'Built %s\n' "$OUTPUT"
printf 'SHA256 %s\n' "$output_sha"
