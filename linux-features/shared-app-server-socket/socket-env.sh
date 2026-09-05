#!/usr/bin/env bash
set -eu

codex_home="${CODEX_HOME:-$HOME/.codex}"
control_dir="$codex_home/app-server-control"
managed_socket="$control_dir/app-server-control.sock"
socket_path="${CODEX_LINUX_APP_SERVER_BRIDGE_SOCKET:-$managed_socket}"

if [ "${CODEX_LINUX_APP_SERVER_BRIDGE_ATTACH_ONLY:-0}" != "1" ] && \
   [ "$socket_path" = "$managed_socket" ]; then
    cli_path="${CODEX_CLI_PATH:?shared app-server socket requires CODEX_CLI_PATH}"
    umask 077
    mkdir -p "$control_dir"
    exec 9>"$control_dir/copernicus-daemon-refresh.lock"
    flock -w 20 9

    daemon_json="$("$cli_path" app-server daemon version 2>/dev/null)"
    cli_version="$(printf '%s\n' "$daemon_json" | sed -n 's/.*"cliVersion"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    app_server_version="$(printf '%s\n' "$daemon_json" | sed -n 's/.*"appServerVersion"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    [ -n "$cli_version" ]

    if [ -n "$app_server_version" ] && [ "$app_server_version" != "$cli_version" ]; then
        "$cli_path" app-server daemon stop >/dev/null 2>&1
        recovery_root="$control_dir/recovery"
        backup_dir="$recovery_root/thread-history-$(date +%Y%m%dT%H%M%S)-$$"
        for history_file in \
            "$codex_home/thread_history_1.sqlite" \
            "$codex_home/thread_history_1.sqlite-shm" \
            "$codex_home/thread_history_1.sqlite-wal"; do
            if [ -e "$history_file" ]; then
                mkdir -p "$backup_dir"
                mv -- "$history_file" "$backup_dir/"
            fi
        done
        "$cli_path" app-server daemon start >/dev/null 2>&1
    elif [ -z "$app_server_version" ]; then
        "$cli_path" app-server daemon start >/dev/null 2>&1
    fi

    daemon_json="$("$cli_path" app-server daemon version 2>/dev/null)"
    cli_version="$(printf '%s\n' "$daemon_json" | sed -n 's/.*"cliVersion"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    app_server_version="$(printf '%s\n' "$daemon_json" | sed -n 's/.*"appServerVersion"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    [ -n "$cli_version" ] && [ "$app_server_version" = "$cli_version" ]
fi

printf 'env CODEX_LINUX_APP_SERVER_BRIDGE_SOCKET=%s\n' "$socket_path"
