# Standing Rules: Monthly Sales Forecast Assistant

PRD baseline: 1.3 | 2026-09-16

## 1. Project context

This project is a Thai/English sales and demand decision-support tool for the management team of a domestic metal-roofing company. It is a static, installable web app; files are read on the user's device and nothing is uploaded. A standalone prototype exists locally. The import sources are three Express CSV reports covering December 2025 to August 2026.

## 2. Working tool

Use **Claude Code** in the local project workspace, with the subagents in `.claude/agents/`:

| Subagent | Owns |
| --- | --- |
| `architect-reviewer` | Plans each phase and pre-reviews finished work; read-only |
| `data-import-engineer` | `js/model.js`, `js/storage.js`, `js/import-*.js` and their tests |
| `forecast-engineer` | `js/engine.js` and its tests |
| `ui-builder` | `index.html`, `css/`, `js/app.js`, `js/i18n.js`, `js/theme.js`, `js/views/` |
| `pwa-performance` | `manifest.webmanifest`, `sw.js`, `js/pwa.js`, `icons/`, `build.cjs`, the eco budget |
| `qa-tester` | Node tests, browser checks, device checklist |
| `docs-i18n` | Thai/English strings, README, runbook, `progress.md` drafts |

The main session coordinates, integrates, and reviews. `architect-reviewer` is a pre-review only; it never replaces the human sign-off required by section 6.

Claude Code may inspect files, edit source, run Node and browser checks, and review the live GitHub Pages URL. **Claude Code does not commit or push.** The milestone owner named in `implementation-plan.md` reviews the change, runs the checks themselves, and commits under their own GitHub account.

Never report a check as passed unless it was run in that session and its exact output is shown and recorded in `progress.md`.

## 3. Start each session

1. Read `CLAUDE.md`, then `prd.md` and `progress.md`, then the relevant architecture, schema, and plan sections.
2. Inspect the repository and current changes instead of assuming local work is committed.
3. Identify the requirement ID and milestone being changed.
4. Record missing client decisions; do not invent business rules.

## 4. Conventions

- English code identifiers and documentation; Thai/English user-facing text. Default language Thai, default theme system.
- Gregorian `YYYY-MM-DD` dates internally; retain original source date for import audit.
- THB values to 2 decimals; keep invoice gross, adjustments, invoice net, and item-line values distinct.
- Stable IDs for invoice, line, product/variant, customer, and salesperson.
- Never aggregate incompatible quantity units.
- Decode source files as Windows-874; UTF-8 only with a byte-order mark.
- Pure calculations belong outside interface rendering; rebuild the standalone distribution after source changes. The split-source/build choice and its reason are defined in `architecture.md`.
- Static site only: no framework, no CDN, no analytics, no backend, no runtime dependency. All paths relative.
- Escape all imported text before inserting it into the page; prefix CSV cells that begin with `=`, `+`, `-`, or `@` on export.

## 5. Hard rules

1. The PRD is the scope authority. Update the other five documents in the same commit when it changes.
2. No new dependency, server, API, or hosting choice without approval.
3. Never commit confidential exports, credentials, or browser-storage dumps to the public repository. Counts may be committed; money totals, customer names, phone numbers, and remark text may not.
4. Do not claim arbitrary file support. Test only documented formats and show unresolved rows.
5. Missing reports are not zero sales. Free/no-price lines may use zero revenue only with an explicit flag.
6. Preserve source traceability and the gross-adjustment-net reconciliation. Where two figures legitimately differ, such as deposits received against deposits deducted, report both and reconcile neither into the other.
7. Never infer customer group, product variant, unit conversion, attribute value, or salesperson from an unrelated column, a blank field, or a similar-looking name.
8. No-future-data backtests are mandatory: features come from before the cutoff, labels from after it, and the cutoff is always passed in, never read from the clock.
9. Predictions are decision support, not guarantees or automatic orders. Every predicted figure shows its method, window, cutoff, unit, and error; a series that cannot be predicted shows a reason, not a number.
10. The local privacy lock is a privacy feature, not production security, and the interface must say so.
11. A result reported from a local study is not a verified result. Label it as reported until a committed test reproduces it in the session that claims it.

## 6. Definition of done

- Acceptance criteria for the changed requirement pass.
- The hosted app installs and opens offline, and `dist/index.html` opens from a folder, both with no blocking browser error.
- Arithmetic changes have independent hand-worked tests.
- Import changes reproduce the counts in PRD section 7.2 and preserve unresolved discrepancies.
- Thai/English, keyboard, light/dark/system, and 360 px behaviour remain usable.
- Eco numbers measured and recorded for the phase.
- `progress.md` records checks, failures, decisions, and the next action.
- A teammate other than the implementer reviews the milestone before it is called accepted.
- Local completion is described as local until the source is verified in the repository.

## 7. End each session

1. Leave the application in a working state or clearly record the blocker.
2. Run checks appropriate to the changed milestone and record exact PASS/FAIL results.
3. Update `progress.md` with date, implementer, reviewer, changes, deviations, failures, and next action.
4. Do not mark a milestone accepted until a human other than its implementer signs off. The reviewer alternates Titan and Tonkla per `implementation-plan.md`.
5. Commit only the reviewed milestone scope; do not hide new requirements inside an existing milestone.

## 8. How to respond

Make small, reviewable changes: targeted edits rather than whole-file rewrites, so the diff shows exactly what moved and a teammate can read it in one sitting. Every team member must be able to explain every line at the viva, which a wall of regenerated file is no help with.

Summarize what changed file by file, state what was tested and show the exact output, name any assumption you had to make, and list the remaining client questions. When a requested capability needs a server, a dependency, or source data that does not exist, state that boundary and ask for the decision rather than simulating production behaviour.