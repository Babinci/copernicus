# Built-in Browser OAuth Popups

Some sites start external sign-in with `window.open(...)`. Electron suppresses
those requests when the built-in browser webview has popup delivery disabled,
so the browser's existing restricted window-open handler never receives them.

This opt-in feature changes only the normal built-in-browser webview setup. It
runs the upstream hardener first, then restores the webview `allowpopups`
attribute and sets `disablePopups: false`. The patch applies only when it can
prove that the current upstream restricted-navigation handler and hardened
webview preferences are both present exactly once.

The feature does not relax sandboxing, context isolation, Node.js isolation,
web security, or the browser's navigation policy. Popup requests still pass
through the existing handler, which may deny them, open them in a new in-app
browser tab, or route them to an external browser according to the upstream
policy. Unknown or ambiguous upstream bundle shapes are left byte-identical.

Enable it in the ignored `linux-features/features.json` file and rebuild:

```json
{
  "enabled": ["browser-oauth-popups"]
}
```

This feature is disabled by default. When disabled, use the built-in browser's
external-browser action for popup-based sign-in sites.

Run its focused tests with:

```bash
node --test linux-features/browser-oauth-popups/test.js
```
