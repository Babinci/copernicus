# Shared App-Server Socket

This opt-in feature makes Codex Desktop use the official managed Codex
app-server daemon instead of starting a second app-server. Desktop, SSH proxy
clients, and browser frontends then share one thread authority and one Unix
socket without translating or filtering the app-server protocol.

Before each Desktop connection, the feature asks the native CLI for both its
version and the running daemon's version. A current daemon is reused without
being restarted. A missing daemon is started with the native command:

```bash
codex app-server daemon start
```

If the versions differ, the launcher stops the stale managed daemon before
Desktop attaches to it, moves only the rebuildable
`thread_history_1.sqlite{,-shm,-wal}` projection into a private directory under
`$CODEX_HOME/app-server-control/recovery/`, and starts the current daemon. The
canonical rollout files and `state_5.sqlite` task metadata are never moved.
Reopening a task lets the current daemon project its visible turns again. The
shared socket is exported only after a second native version check confirms
that the daemon and CLI match.

Desktop then connects through the stock proxy command:

```bash
codex app-server proxy --sock "$HOME/.codex/app-server-control/app-server-control.sock"
```

The daemon owns its lifecycle and socket. Closing Desktop does not terminate
other clients or active tasks. The launcher defaults to the Codex-managed
socket under `CODEX_HOME`; `CODEX_LINUX_APP_SERVER_BRIDGE_SOCKET` may override
that path when the CLI daemon is configured differently.

When another supervised local process owns the authority, set
`CODEX_LINUX_APP_SERVER_BRIDGE_ATTACH_ONLY=1`. Desktop then waits for the Unix
socket and only creates proxy clients; it never starts, stops, or unlinks that
authority.

An explicit `CODEX_LINUX_APP_SERVER_BRIDGE_SOCKET` outside the native managed
socket receives the same external-owner treatment. Its supervisor owns version
freshness and recovery.

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
