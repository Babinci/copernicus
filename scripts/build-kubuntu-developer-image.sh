#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILDER="$SCRIPT_DIR/build-kubuntu-image.sh"
WORKSPACE="/mnt/d/.copernicus-build-tmp"
BASE_ISO=""
CODEX_DEB=""
OUTPUT=""
DRY_RUN=0
DOWNLOAD_BASE=0

usage() {
    cat <<'EOF'
Build and verify a private Copernicus Kubuntu developer ISO in one command.

Usage:
  sudo scripts/build-kubuntu-developer-image.sh [options]

Options:
  --workspace PATH  Scratch and output directory (default: /mnt/d/.copernicus-build-tmp).
  --base-iso PATH   Existing pinned Kubuntu 24.04.4 ISO; otherwise use/download the official image.
  --download-base   Ignore a cached repository ISO and fetch the signed official image.
  --codex-deb PATH  Local codex-desktop amd64 package; otherwise use the newest package in dist/.
  --output PATH     New output ISO path (default: a timestamped file under WORKSPACE/out).
  --dry-run         Resolve and verify inputs without building.
  -h, --help        Show this help.

This script only creates files under the workspace and never writes to a block device.
It does not partition disks, format filesystems, or flash USB drives.
Build output is preserved under .copernicus/logs/kubuntu-image/ (gitignored).
EOF
}

die() {
    printf 'kubuntu-developer-image: %s\n' "$*" >&2
    exit 2
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --workspace) [ "$#" -ge 2 ] || die "--workspace requires a path"; WORKSPACE="$2"; shift 2 ;;
        --base-iso) [ "$#" -ge 2 ] || die "--base-iso requires a path"; BASE_ISO="$2"; shift 2 ;;
        --download-base) DOWNLOAD_BASE=1; shift ;;
        --codex-deb) [ "$#" -ge 2 ] || die "--codex-deb requires a path"; CODEX_DEB="$2"; shift 2 ;;
        --output) [ "$#" -ge 2 ] || die "--output requires a path"; OUTPUT="$2"; shift 2 ;;
        --dry-run) DRY_RUN=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) die "unknown option: $1" ;;
    esac
done
[ "$DOWNLOAD_BASE" -eq 0 ] || [ -z "$BASE_ISO" ] \
    || die "--download-base cannot be combined with --base-iso"

if [ "$DRY_RUN" -eq 0 ]; then
    log_dir="${COPERNICUS_BUILD_LOG_DIR:-$REPO_DIR/.copernicus/logs/kubuntu-image}"
    [ ! -L "$log_dir" ] || die "log directory must not be a symlink: $log_dir"
    mkdir -p "$log_dir"
    log_file="$log_dir/kubuntu-developer-image-$(date -u +%Y%m%dT%H%M%SZ)-$$.log"
    : >"$log_file"
    chmod 0644 "$log_file"
    exec > >(tee -a "$log_file") 2>&1
    finish_log() {
        status=$?
        trap - EXIT
        printf 'Build exited with status %s\nBuild log: %s\n' "$status" "$log_file"
        exit "$status"
    }
    trap finish_log EXIT
    printf 'Build log: %s\n' "$log_file"
fi

if [ -z "$CODEX_DEB" ]; then
    shopt -s nullglob
    packages=("$REPO_DIR"/dist/codex-desktop_*_amd64.deb)
    [ "${#packages[@]}" -gt 0 ] || die "no codex-desktop amd64 package found in $REPO_DIR/dist"
    CODEX_DEB="${packages[0]}"
    for candidate in "${packages[@]:1}"; do
        [ "$candidate" -nt "$CODEX_DEB" ] && CODEX_DEB="$candidate"
    done
fi
[ -f "$CODEX_DEB" ] || die "Codex package not found: $CODEX_DEB"

if [ "$DOWNLOAD_BASE" -eq 0 ] && [ -z "$BASE_ISO" ] \
    && [ -f "$REPO_DIR/.copernicus/kubuntu-image/input/kubuntu-24.04.4-desktop-amd64.iso" ]; then
    BASE_ISO="$REPO_DIR/.copernicus/kubuntu-image/input/kubuntu-24.04.4-desktop-amd64.iso"
fi
[ -z "$BASE_ISO" ] || [ -f "$BASE_ISO" ] || die "base ISO not found: $BASE_ISO"

WORKSPACE="$(python3 -c 'import os,sys; print(os.path.abspath(sys.argv[1]))' "$WORKSPACE")"
[ ! -L "$WORKSPACE" ] || die "workspace must not be a symlink: $WORKSPACE"
[ -n "$OUTPUT" ] || OUTPUT="$WORKSPACE/out/copernicus-kubuntu-24.04.4-developer-$(date -u +%Y%m%dT%H%M%SZ).iso"
OUTPUT="$(python3 -c 'import os,sys; print(os.path.abspath(sys.argv[1]))' "$OUTPUT")"
workspace_real="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$WORKSPACE")"
output_real="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$OUTPUT")"
case "$output_real" in "$workspace_real"/*) ;; *) die "output must stay inside the workspace" ;; esac

deb_sha="$(sha256sum "$CODEX_DEB" | awk '{print $1}')"
args=(--output "$OUTPUT" --codex-deb "$CODEX_DEB" --codex-deb-sha256 "$deb_sha"
    --accept-private-codex-payload --developer-tools)
if [ -n "$BASE_ISO" ]; then
    base_sha="$(sha256sum "$BASE_ISO" | awk '{print $1}')"
    [ "$base_sha" = 02cda2568cb96c090b0438a31a7d2e7b07357fde16217c215e7c3f45263bcc49 ] \
        || die "base ISO is not the pinned Kubuntu 24.04.4 amd64 image"
    args+=(--base-iso "$BASE_ISO" --base-sha256 "$base_sha")
fi

printf 'Workspace: %s\nCodex package: %s\nOutput: %s\n' "$WORKSPACE" "$CODEX_DEB" "$OUTPUT"
[ -z "$BASE_ISO" ] || printf 'Base ISO: %s\n' "$BASE_ISO"
if [ "$DRY_RUN" -eq 1 ]; then
    printf 'Dry run passed; build would enable the developer-tools profile.\n'
    exit 0
fi

[ "$(id -u)" -eq 0 ] || die "run this command with sudo"
mkdir -p "$WORKSPACE/tmp" "$WORKSPACE/out" "$WORKSPACE/state"
available_kib="$(df -Pk "$WORKSPACE" | awk 'NR == 2 {print $4}')"
[ "$available_kib" -ge 31457280 ] || die "workspace needs at least 30 GiB free"
[ ! -e "$OUTPUT" ] && [ ! -L "$OUTPUT" ] || die "output already exists: $OUTPUT"
TMPDIR="$WORKSPACE/tmp" COPERNICUS_KUBUNTU_STATE_DIR="$WORKSPACE/state" \
    "$BUILDER" "${args[@]}"
printf 'Verified checksum: %s.sha256\nProvenance: %s.provenance.json\n' "$OUTPUT" "$OUTPUT"
