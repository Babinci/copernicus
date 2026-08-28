# Browser Media Permissions

This opt-in feature lets pages opened in Codex Browser Use request Electron's
`media` permission for microphone or camera access. Access remains denied unless
the page's exact origin appears in `CODEX_BROWSER_USE_MEDIA_ORIGINS`.

Enable the feature in the gitignored `linux-features/features.json` file:

```json
{
  "enabled": ["browser-media-permissions"]
}
```

Set a comma-separated exact-origin allowlist before launching Desktop:

```bash
export CODEX_BROWSER_USE_MEDIA_ORIGINS="https://example.test,http://localhost:39137"
```

Paths are ignored because browser permissions are origin-scoped. Wildcards are
not supported. Invalid entries, missing configuration, non-Linux platforms, and
origins outside the allowlist remain denied. Clipboard permission behavior is
unchanged.

This feature does not grant `display-capture`, record system output, or choose a
microphone. Normal browser audio playback needs no additional permission.

Run the focused test with:

```bash
node --test linux-features/browser-media-permissions/test.js
```

The patch follows the current upstream Browser Use permission-handler shape.
Bundle drift warns and leaves the bundle unchanged.
