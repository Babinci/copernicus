#!/usr/bin/env bash
set -eu

codex_home="${CODEX_HOME:-$HOME/.codex}"
socket_path="${CODEX_LINUX_APP_SERVER_BRIDGE_SOCKET:-$codex_home/app-server-control/app-server-control.sock}"
printf 'env CODEX_LINUX_APP_SERVER_BRIDGE_SOCKET=%s\n' "$socket_path"
