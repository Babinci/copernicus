---
okf_version: "0.1"
---

# Copernicus

Copernicus is a local-build Linux Desktop fork plus an installable GPT-only
problem-solving plugin.

## Start here

- [Getting started](getting-started.md) — install the plugin and run a first bounded mission.
- [Skills](skills.md) — understand why each skill exists, what it does, what it produces, and its limits.
- [Breathe explained](../../plugins/copernicus/skills/breathe/references/guide.md) — connect deep Fleet investigation to short decision, delivery, or understanding checkpoints.
- [Practitioner HTML reports](html-reports.md) — turn evaluated work into a portable human-readable briefing or lesson.
- [Architecture](architecture.md) — understand Fleet, SAS, receipts, evaluation, and OKF memory.
- [Scheduled work](scheduled-work.md) — run attended Scheduled tasks or trusted local cron safely.
- [Licensing and distribution](../licensing.md) — distinguish MIT source, proprietary app output, third-party skills, assets, and CI boundaries.
- [Coding WebUI](https://github.com/Babinci/coding-webui) — optionally control host Codex sessions
  from a self-hosted responsive web UI or the companion Android client.

## Product boundaries

- The Linux wrapper locally converts a user-authorized upstream DMG; it does not redistribute it.
- Generated app packages are composite, unfree outputs; the repository publishes source and validation metadata only.
- The plugin uses native Codex authentication and GPT models only.
- Coding WebUI is an independent deployment with its own TLS, login, workspace, and release boundary.
- Auto-research proposes memory from joined evidence at cycle boundaries; it never promotes guesses mid-cycle.
- External writes, publishing, purchases, deployment, messaging, and destructive actions remain human-authorized.
