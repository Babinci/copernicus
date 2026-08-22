# Shared App-Server Socket

This opt-in feature makes Codex Desktop use the official managed Codex
app-server daemon instead of starting a second app-server. Desktop, SSH proxy
clients, and browser frontends then share one thread authority and one Unix
socket without translating or filtering the app-server protocol.

Before each Desktop connection, the feature runs the idempotent native command:

```bash
codex app-server daemon start
```

Desktop then connects through the stock proxy command:

```bash
codex app-server proxy --sock "$HOME/.codex/app-server-control/app-server-control.sock"
```

The daemon owns its lifecycle and socket. Closing Desktop does not terminate
other clients or active tasks. The launcher defaults to the Codex-managed
socket under `CODEX_HOME`; `CODEX_LINUX_APP_SERVER_BRIDGE_SOCKET` may override
that path when the CLI daemon is configured differently.

The socket is a user-private local control endpoint. Do not expose it directly
over TCP or share it with another user.

Enable the feature in ignored `linux-features/features.json`:

```json
{
  "enabled": ["shared-app-server-socket"]
}
```

Then rebuild and reinstall. The feature is disabled by default. Bundle drift
warns and skips instead of patching an unknown Desktop transport.

Run the focused check with:

```bash
TMPDIR=/tmp CODEX_CLI_PATH=/usr/bin/codex node --test linux-features/shared-app-server-socket/test.js
```
