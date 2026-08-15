---
name: planning
description: Turn substantial coding work into an implementation-ready, dependency-linked workpack bundle with an evidence-backed design, tests written before implementation when authorized, deterministic validation, progressive indexes, and optional bounded GPT-only Fleet discovery. Use when the user asks to plan, architect, decompose, create workpacks, write an implementation plan, prepare test-first tasks, review a plan, recover a stalled implementation, or make long-running work resumable; keep focused single-change plans native and file-free.
---

# Copernicus Planning

Add durable execution contracts only where native Codex planning stops being
enough. A plan is not progress, evidence, or permission to implement.

Resolve `<planning-skill-dir>` to the directory containing this `SKILL.md`.
Resolve the script and references from there, never from the current directory.
Read [guide.md](references/guide.md) before choosing a mode, creating or
reviewing a bundle, designing a Fleet graph, or changing this skill.

## Select the mode

| Mode | Use | Artifact |
| --- | --- | --- |
| `native` | One bounded, well-understood change that fits the current task. | Native plan/progress only; no planning files. |
| `workpacks` | Default for substantial multi-file, dependency-linked, multi-owner, or resumable work. | One OKF-style design plus linked workpacks. |
| `discovery` | The solution, evaluator, feasibility, or architecture is materially uncertain. | Verified evidence/prototype first, then workpacks. |
| `review` | A plan or workpack bundle already exists. | Read-only verdict and smallest corrections. |

Do not estimate complexity with a numeric score. Choose the first lighter mode
that can still leave the next implementer decision-complete. Switch modes when
evidence changes the work, and record why in the bundle log.

## Plan

1. Read repository instructions, relevant source, current tests, durable design
   docs, and nearby history. Run deterministic searches before asking a model or
   the user.
2. Freeze the outcome, observable acceptance, authority/freshness boundary,
   constraints, non-goals, evaluator, and stop/escalation conditions. Ask the
   user only for decisions the authorized evidence cannot answer.
3. Run a leverage pass: name the smallest set of work that unlocks the outcome,
   defer work that does not, and test the riskiest reversible assumption first.
   Treat “80/20” as a prioritization hypothesis, never a quota or proof.
4. Apply sibling `$rick-rubin` before decomposition. Preserve safety,
   compatibility, accessibility, data-loss protection, and required validation.
5. Use sibling `$fleet` only for genuinely independent unknowns. Reuse Fleet's
   seat contract and model policy; never build another dispatcher. Use sibling
   `$auto-research` instead when candidates must learn across measured cycles.
6. Write one design before tasks. Resolve interfaces, ownership boundaries,
   expected behavior, alternatives, recovery, and evidence gaps. Mark unsupported
   claims `UNVERIFIED`.
7. Create the smallest independently verifiable workpacks. Each owns one
   deliverable and declares predecessors, parent hierarchy, paths, tests,
   implementation boundary, acceptance, risks, and handoff. Freeze exact
   observable data, ordering, escaping, and side-effect contracts where they
   matter; do not leave them for the implementer to invent.
8. Write behavior tests before implementation when the user authorized source
   test edits. Write the final success assertion once, run it unchanged, and
   record the expected red result. Test claimed non-mutation by comparing the
   affected state before and after. A plan-only request authorizes planning
   files, not source edits: keep the affected workpack `draft` until test
   materialization is authorized. For work without a real unit seam, set
   `test_first: false`, explain the waiver, and name the strongest real
   deterministic check.
9. Validate and index the bundle. A model must not waive a deterministic error.
10. Use a fresh reviewer for substantial or high-risk plans. Then apply sibling
    `$ponytail`: reuse existing paths and helpers, remove speculative abstraction,
    and retain the smallest check that catches each planned behavior.

## Create and traverse workpacks

Initialize without overwriting an existing path:

```bash
python3 <planning-skill-dir>/scripts/workpacks.py init .planning/<mission> \
  --title "Outcome-oriented title" --mode workpacks
```

Author `design.md` and the files under `workpacks/`, then run:

```bash
python3 <planning-skill-dir>/scripts/workpacks.py validate .planning/<mission>
python3 <planning-skill-dir>/scripts/workpacks.py index .planning/<mission> --write
python3 <planning-skill-dir>/scripts/workpacks.py validate .planning/<mission> \
  --implementation-ready --repo-root .
python3 <planning-skill-dir>/scripts/workpacks.py next .planning/<mission>
```

The tool uses only Python's standard library. It accepts YAML frontmatter with
plain scalars and JSON-compatible quoted values, booleans, and inline arrays. It
never executes workpack commands. It rejects path escapes, duplicate IDs,
unknown dependencies or parents, dependency and hierarchy cycles, conflicting
independent path ownership, missing ready-state tests, and non-generated index
overwrites.

## Workpack contract

Keep `index.md` and `log.md` as reserved navigation/history. Keep one
frontmatter-bearing `design.md` and one concept per `workpacks/WP-NNN.md`.
Use relative Markdown links. `parent` expresses containment; `depends_on`
expresses execution blocking. Never store derived execution waves—the tool
computes them from dependencies.

A ready workpack must have complete content under these exact headings:

```text
Outcome
Evidence and assumptions
Scope
Tests written first
Implementation
Acceptance
Risks and stop conditions
Handoff
```

Status is one of `draft`, `ready`, `active`, `blocked`, `done`, or `deferred`.
Priority is `vital`, `important`, or `later`; priority never overrides a
dependency or safety gate. Mark completion only from runnable evidence.

## Boundaries

- Planning is proposal-only unless the user separately authorizes source edits,
  implementation, external actions, or destructive work.
- Workpacks may link to OKF knowledge but are not canonical Auto-Research memory.
  Promotion still requires joined evidence at a cycle boundary.
- Do not copy private project material, secrets, credentials, runtime state, or
  volatile personal paths into a reusable bundle.
- Do not add a database, task service, graph store, daemon, provider proxy,
  universal reviewer loop, fixed workpack count, or literal Pareto cutoff.
- Model consensus is not verification. Tests, measurements, primary sources,
  and authorized human decisions remain the evaluators.
