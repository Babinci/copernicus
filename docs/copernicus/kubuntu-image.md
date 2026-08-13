---
type: runbook
title: Code-generated Kubuntu image
description: Build and verify a private Kubuntu 24.04.4 installer with a locally built ChatGPT Desktop package and the self-contained Copernicus plugin.
tags: [copernicus, kubuntu, installer, reproducibility, privacy]
timestamp: 2026-08-13
---

# Code-generated Kubuntu image

Copernicus can generate a bootable Kubuntu 24.04.4 amd64 installer from code.
The generated ISO installs the same interactive Calamares workflow as the
official image, a locally supplied `codex-desktop` Debian package, and a local
copy of the public Copernicus plugin marketplace.

The repository does not contain or publish an ISO, DMG, converted application,
credential, user profile, SSH key, tunnel, hostname, or project directory. The
full generated ISO contains an upstream proprietary application payload and is
therefore private unless a separate [binary-release licensing
preflight](../licensing.md#before-any-binary-release) clears that exact output.

## Build

On an amd64 Kubuntu or Ubuntu host, install `xorriso`, `squashfs-tools`,
`fakeroot`, and the normal Copernicus build prerequisites. Build the application
and Debian package locally:

```bash
make build-app-fresh
make deb
sha256sum dist/codex-desktop_*.deb
```

Run the harmless transfer test first. With no `--base-iso`, the builder fetches
the official Kubuntu 24.04.4 ISO, verifies Ubuntu's signed `SHA256SUMS`, and also
requires the release hash pinned in the script:

```bash
scripts/build-kubuntu-image.sh --marker-only \
  --output .copernicus/kubuntu-image/out/copernicus-kubuntu-marker-amd64.iso
```

Then build the full private image, substituting the exact package path and hash:

```bash
sudo scripts/build-kubuntu-image.sh \
  --codex-deb dist/codex-desktop_VERSION_amd64.deb \
  --codex-deb-sha256 SHA256 \
  --accept-private-codex-payload
```

The builder refuses an unpinned local base ISO, an unpinned or non-amd64
`codex-desktop` package, an existing output path, and a full build without the
private-payload acknowledgement. It writes the ISO last, beside a checksum and
JSON provenance record. It never writes to a disk device.

The base ISO and local Desktop package are content-pinned, while Ubuntu archive
dependencies are resolved when the image is built. Their exact installed
versions are captured in `casper/filesystem.manifest`; this is an auditable,
code-generated build, not a promise of byte-identical output at a later date.

## First login

Install Kubuntu normally and keep Calamares's own target-disk confirmation. On
the installed desktop:

1. Launch ChatGPT Desktop and complete native Codex sign-in.
2. Open **Install Copernicus Skills** from the application menu, or run
   `copernicus-first-run` in a terminal.

The helper installs the image's local Copernicus marketplace for that user. It
is idempotent, enables the packaged per-user updater when available, and does
not copy authentication state. Future plugin updates can come from the public
repository with the normal Codex plugin commands.

## Verification

Run the deterministic smoke test:

```bash
bash tests/kubuntu_image_smoke.sh
```

For a release candidate, also boot the marker ISO in disposable BIOS and UEFI
virtual machines, complete one UEFI install to an empty virtual disk, boot that
disk, and inspect `/etc/copernicus-image-release`. The repository includes
`packaging/kubuntu-image/Containerfile.vm-test` for a pinned QEMU/OVMF/VNC test
environment. The marker gate proves that Calamares transferred the rebuilt
SquashFS; it does not certify every physical laptop, firmware, GPU, Wi-Fi
adapter, or Secure Boot configuration.

## Remote sessions and hardware

The image enables no remote listener, firewall rule, tunnel, pairing, or saved
credential. After installation, choose an existing, independently documented
surface—Codex Remote SSH/upstream remote sessions or the separate Coding WebUI
companion—and configure its authentication for that machine.

NVIDIA drivers, Secure Boot/MOK enrollment, vendor firmware, no-suspend policy,
Docker, Cloudflare tunnels, and tablet tools remain explicit post-install choices.
They are hardware- or account-specific and do not belong in a generous public
default image.
