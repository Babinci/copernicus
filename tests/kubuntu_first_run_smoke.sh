#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FIRST_RUN="$REPO_DIR/packaging/kubuntu-image/copernicus-first-run"

fail() {
    printf 'FAIL: %s\n' "$*" >&2
    exit 1
}

work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/bin" "$work/empty-bin"

cat >"$work/bin/codex" <<'SH'
#!/usr/bin/env bash
set -eu
state="${CODEX_TEST_STATE:?}"
printf '%s\n' "$*" >>"$state/calls"
case "$*" in
    'plugin marketplace list --json')
        case "${CODEX_TEST_MARKETPLACE_LIST:-normal}" in
            fail) exit 7 ;;
            malformed) printf '{\n'; exit 0 ;;
        esac
        if [ -e "$state/marketplace" ]; then
            printf '{"marketplaces":[{"name":"copernicus"}]}\n'
        else
            printf '{"marketplaces":[]}\n'
        fi
        ;;
    'plugin marketplace add /usr/share/copernicus/marketplace')
        if [ -e "$state/fail-marketplace-add-once" ]; then
            rm "$state/fail-marketplace-add-once"
            exit 41
        fi
        touch "$state/marketplace"
        ;;
    'plugin list --json')
        case "${CODEX_TEST_PLUGIN_LIST:-normal}" in
            fail) exit 8 ;;
            malformed) printf '{\n'; exit 0 ;;
        esac
        if [ -e "$state/plugin" ]; then
            printf '{"installed":[{"pluginId":"copernicus@copernicus","installed":true}]}\n'
        else
            printf '{"installed":[]}\n'
        fi
        ;;
    'plugin add copernicus@copernicus')
        if [ -e "$state/fail-plugin-add-once" ]; then
            rm "$state/fail-plugin-add-once"
            exit 42
        fi
        touch "$state/plugin"
        ;;
    *) exit 90 ;;
esac
SH

cat >"$work/bin/systemctl" <<'SH'
#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" >>"${CODEX_TEST_STATE:?}/systemctl-calls"
exit "${CODEX_TEST_SYSTEMCTL_STATUS:-0}"
SH
chmod +x "$work/bin/codex" "$work/bin/systemctl"

run_first_run() {
    name="$1"
    shift
    state="$work/state-$name"
    mkdir -p "$state"
    set +e
    env CODEX_TEST_STATE="$state" \
        COPERNICUS_UPDATE_SERVICE_FILE="$work/service-$name" \
        PATH="$work/bin:$PATH" "$@" \
        bash "$FIRST_RUN" >"$work/$name.out" 2>"$work/$name.err"
    RUN_STATUS=$?
    set -e
}

call_count() {
    pattern="$1"
    file="$2"
    grep -c -- "$pattern" "$file" 2>/dev/null || true
}

set +e
PATH="$work/empty-bin" /bin/bash "$FIRST_RUN" \
    >"$work/missing-cli.out" 2>"$work/missing-cli.err"
missing_cli_status=$?
set -e
[ "$missing_cli_status" -eq 3 ] || fail "missing Codex CLI did not exit 3"
grep -q 'complete its native sign-in' "$work/missing-cli.out" \
    || fail "missing Codex CLI guidance is incomplete"
[ ! -s "$work/missing-cli.err" ] || fail "missing Codex CLI wrote to stderr"

run_first_run idempotent
[ "$RUN_STATUS" -eq 0 ] || fail "first-run setup failed"
run_first_run idempotent
[ "$RUN_STATUS" -eq 0 ] || fail "idempotent rerun failed"
[ "$(call_count '^plugin marketplace add ' "$work/state-idempotent/calls")" -eq 1 ] \
    || fail "marketplace was added more than once"
[ "$(call_count '^plugin add ' "$work/state-idempotent/calls")" -eq 1 ] \
    || fail "plugin was added more than once"
[ ! -e "$work/state-idempotent/systemctl-calls" ] \
    || fail "absent updater service still invoked systemctl"

run_first_run list-fallback CODEX_TEST_MARKETPLACE_LIST=fail CODEX_TEST_PLUGIN_LIST=fail
[ "$RUN_STATUS" -eq 0 ] || fail "list-command fallback failed"
[ "$(call_count '^plugin marketplace add ' "$work/state-list-fallback/calls")" -eq 1 ] \
    || fail "marketplace list failure did not trigger add"
[ "$(call_count '^plugin add ' "$work/state-list-fallback/calls")" -eq 1 ] \
    || fail "plugin list failure did not trigger add"

run_first_run malformed CODEX_TEST_MARKETPLACE_LIST=malformed
[ "$RUN_STATUS" -ne 0 ] || fail "malformed marketplace JSON was accepted"
[ "$(call_count '^plugin marketplace add ' "$work/state-malformed/calls")" -eq 0 ] \
    || fail "malformed marketplace JSON triggered mutation"
! grep -q 'Copernicus plugin is installed' "$work/malformed.out" \
    || fail "malformed marketplace JSON printed success"

mkdir -p "$work/state-malformed-plugin"
touch "$work/state-malformed-plugin/marketplace"
run_first_run malformed-plugin CODEX_TEST_PLUGIN_LIST=malformed
[ "$RUN_STATUS" -ne 0 ] || fail "malformed plugin JSON was accepted"
[ "$(call_count '^plugin add ' "$work/state-malformed-plugin/calls")" -eq 0 ] \
    || fail "malformed plugin JSON triggered mutation"

mkdir -p "$work/state-marketplace-retry"
touch "$work/state-marketplace-retry/fail-marketplace-add-once"
run_first_run marketplace-retry
[ "$RUN_STATUS" -eq 41 ] || fail "marketplace-add failure status was lost"
[ "$(call_count '^plugin list ' "$work/state-marketplace-retry/calls")" -eq 0 ] \
    || fail "plugin setup continued after marketplace failure"
run_first_run marketplace-retry
[ "$RUN_STATUS" -eq 0 ] || fail "marketplace retry did not recover"
[ "$(call_count '^plugin marketplace add ' "$work/state-marketplace-retry/calls")" -eq 2 ] \
    || fail "marketplace retry count is wrong"
[ "$(call_count '^plugin add ' "$work/state-marketplace-retry/calls")" -eq 1 ] \
    || fail "marketplace retry did not install the plugin once"

retry_state="$work/state-retry"
mkdir -p "$retry_state"
touch "$retry_state/fail-plugin-add-once"
run_first_run retry
[ "$RUN_STATUS" -eq 42 ] || fail "plugin-add failure status was lost"
! grep -q 'Copernicus plugin is installed' "$work/retry.out" \
    || fail "failed plugin add printed success"
run_first_run retry
[ "$RUN_STATUS" -eq 0 ] || fail "partial-state retry did not recover"
[ "$(call_count '^plugin marketplace add ' "$retry_state/calls")" -eq 1 ] \
    || fail "partial-state retry duplicated marketplace add"
[ "$(call_count '^plugin add ' "$retry_state/calls")" -eq 2 ] \
    || fail "partial-state retry did not retry plugin add once"

touch "$work/service-updater-success"
mkdir -p "$work/state-updater-success"
touch "$work/state-updater-success/marketplace" "$work/state-updater-success/plugin"
run_first_run updater-success
[ "$RUN_STATUS" -eq 0 ] || fail "updater enablement failed"
[ "$(cat "$work/state-updater-success/systemctl-calls")" \
    = '--user enable --now codex-update-manager.service' ] \
    || fail "updater used the wrong systemctl command"

touch "$work/service-updater-failure"
mkdir -p "$work/state-updater-failure"
touch "$work/state-updater-failure/marketplace" "$work/state-updater-failure/plugin"
run_first_run updater-failure CODEX_TEST_SYSTEMCTL_STATUS=5
[ "$RUN_STATUS" -eq 0 ] || fail "best-effort updater failure aborted setup"
grep -q 'Retry with: systemctl --user enable --now codex-update-manager.service' \
    "$work/updater-failure.err" || fail "updater failure lacks recovery guidance"
grep -q 'Copernicus plugin is installed' "$work/updater-failure.out" \
    || fail "updater failure suppressed plugin success"

printf 'Kubuntu first-run smoke tests passed\n'
