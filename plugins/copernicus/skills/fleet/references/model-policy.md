# GPT-only model policy

Copernicus uses native Codex authentication and three GPT-5.6 lanes. Defaults are data in `models.json`, not duplicated through scripts.

| Lane | Default model | Effort | Width | Use |
| --- | --- | --- | ---: | --- |
| `sol` | `gpt-5.6-sol` | `xhigh` | 4 | difficult synthesis, architecture, final verification |
| `terra` | `gpt-5.6-terra` | `medium` | 4 | everyday implementation and grounded review |
| `luna` | `gpt-5.6-luna` | `max` | 5 | repeatable, high-volume bounded work |

## Invariants

- Every model ID must start with `gpt-`.
- A missing or unavailable lane fails closed. It never changes provider or model family.
- The runner's width is a safety ceiling, not a quality target.
- Use the lowest effort that passes representative checks. `xhigh` and `max` are deliberate Fleet policies, not universal recommendations.
- Model access depends on the signed-in account and workspace. Copernicus cannot unlock a model or increase plan limits.
- Change a default only after `codex exec -m <model> --ephemeral "Reply with OK"` succeeds for that account and a representative mission still passes.

## Scheduled work

Prefer the ChatGPT desktop app's Scheduled tasks for local project work. Use the CLI runner for trusted local cron only. Keep the machine on, use read-only or workspace-write rather than full access, prevent overlapping runs, and review the first few outputs before increasing cadence.
