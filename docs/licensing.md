# Licensing and distribution map

This page records the repository's current provenance and distribution
boundaries. It is an engineering inventory, not legal advice or a substitute for
review of the terms that apply to a particular user, jurisdiction, or release.

## What each license covers

| Material | Status | Distribution rule |
| --- | --- | --- |
| Copernicus and inherited wrapper source | MIT, with both copyrights in [`LICENSE`](../LICENSE) | Source may be used under MIT. |
| Copernicus plugin | MIT, plus the bundled third-party notices | One plugin install may distribute the self-contained skills. |
| Locally generated Desktop app or native package | Composite: MIT wrapper plus upstream proprietary application and other dependencies | Not an MIT package as a whole; build locally from an authorized upstream copy. |
| `assets/codex.png` | OpenAI-owned application icon; excluded from MIT | Keep unmodified, acknowledge ownership, avoid implied endorsement, and follow current brand rules. |
| Rust, npm, Electron, Node.js, and optional feature dependencies | Their own licenses, recorded by their upstream packages and lockfiles | Preserve the notices required by each dependency when distributing a generated binary. |

The upstream wrapper is MIT-licensed at
[`ilysenko/codex-desktop-linux`](https://github.com/ilysenko/codex-desktop-linux/blob/main/LICENSE).
Grill Me and Handoff derive from Matt Pocock's MIT-licensed
[`skills`](https://github.com/mattpocock/skills); Caveman derives from the
MIT-licensed [`Ponytail`](https://github.com/DietrichGebert/ponytail) workflow.
Their full notices are inside the installable plugin at
[`plugins/copernicus/THIRD_PARTY_NOTICES.md`](../plugins/copernicus/THIRD_PARTY_NOTICES.md).

## Public-repository boundary

- Git does not contain the upstream DMG or converted app binaries.
- GitHub releases do not publish generated Desktop packages.
- Upstream-build Actions artifacts contain fingerprints, acceptance decisions,
  and JSON reports—not the DMG or built application.
- Actions may cache the upstream download for trusted rebuild validation, but
  the cache is not a public release asset.
- Nix validation builds are ephemeral and are not pushed to a Copernicus binary
  cache. Users build the unfree output locally after making their own terms and
  policy decision.

Public downloadability does not by itself establish a right to modify or
redistribute a binary. The wrapper therefore separates the MIT source release
from the user's local acquisition and conversion of the upstream application.

## Package metadata

Package metadata describes the generated payload, not just this Git repository:

- RPM labels the generated package proprietary.
- Arch labels both the MIT wrapper and proprietary application component.
- Nix labels the output MIT plus `unfree`, marks binary-native provenance, and
  requires an explicit unfree-package opt-in.

The [Nixpkgs license reference](https://nixos.org/manual/nixpkgs/stable/#sec-meta-license)
defines `unfree` as locally buildable but not redistributable through a binary
channel. That is the conservative classification until explicit upstream
redistribution rights are established.

## OpenAI names and assets

Copernicus is descriptive about the service it launches and explicitly
unofficial. The project must keep its own name and identity more prominent,
must not imply sponsorship, and must not modify the retained OpenAI icon.
Review the current [OpenAI brand guidelines](https://openai.com/brand/) and, for
public plugin distribution, the current
[App Developer Terms](https://openai.com/policies/developer-apps-terms/).

## Before any binary release

Do not add a generated `.deb`, `.rpm`, pacman package, AppImage, Nix store path,
DMG, APK, or converted app to a release or binary cache without a new licensing
preflight. At minimum, that preflight must establish upstream redistribution
authority, include all dependency notices, verify current brand rules, inspect
the exact payload, and record the approval. Source CI success is not that
approval.
