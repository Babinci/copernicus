# Copernicus notices

Copernicus is maintained by Wojtek (Babinci) and derived from
[`ilysenko/codex-desktop-linux`](https://github.com/ilysenko/codex-desktop-linux).
The original wrapper copyright and MIT license are preserved in `LICENSE` and
the Git history. Copernicus additions are released under the same MIT license.

The MIT license covers this repository's wrapper source, Linux compatibility
code, documentation, and original plugin material. It does not relicense a
generated application as a whole. A locally generated app or package combines
MIT-licensed wrapper material with upstream proprietary software and other
dependencies under their own terms.

This public repository and its GitHub releases do not publish the upstream
ChatGPT Desktop DMG or a converted application package. Upstream acceptance CI
publishes metadata and reports only. Nix package checks build on an ephemeral
runner and do not upload application outputs to a Copernicus binary cache.

`assets/codex.png` is an unmodified upstream application icon retained only to
identify the OpenAI service this wrapper launches. It is excluded from the MIT
license, remains owned by OpenAI, and must be used in accordance with OpenAI's
[brand guidelines](https://openai.com/brand/). Copernicus branding must not
imply OpenAI sponsorship or endorsement.

The Copernicus plugin includes adapted MIT-licensed companion workflows. Their
required notices ship inside the plugin at
`plugins/copernicus/THIRD_PARTY_NOTICES.md`.

Copernicus is an unofficial community project. OpenAI, ChatGPT, Codex, upstream
application code, services, assets, and trademarks belong to OpenAI or their
respective owners. Use remains subject to applicable terms and server-side
availability. See `docs/licensing.md` for the evidence-backed licensing map.
