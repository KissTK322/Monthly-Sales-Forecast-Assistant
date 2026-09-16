# Progress: Monthly Sales Forecast Assistant

PRD baseline: 1.3 | Updated: 2026-09-16

## Current state

- Phase: Phase 0 (documents) complete and awaiting review. Phase 1 / M0 (app shell) not started.
- Blocking issues: no application source or tests exist yet; 18 client questions are open (`prd.md` section 13), of which the 24-month history request and the colour normalisation table matter most.
- Next action: Tonkla reviews the Phase 0 change, commits it, then Phase 1 / M0 begins with a plan for approval before any code.

## 2026-09-16 - Phase 0: predictive scope, platform requirements, and document alignment

Prepared by: Claude Code  
Reviewed by: Tonkla

Status: documents revised; awaiting review and commit. No application milestone is claimed.

Changes:

- `prd.md` to version 1.3. Three decision statements replace the single replenishment statement. New FR17-FR21 (demand class, repurchase and lapse, attribute forecast, observed best sellers, prediction honesty) and FR22-FR27 (install and offline, update banner, responsive, mobile file picking, CSV and iOS share, device data). FR11 and FR16 moved to M8+. Section 7 rewritten for the three Express CSV reports with the counts now approved for the repository. Section 8.2 defines the four methods. Sections 11.1 and 11.2 record what is deferred and what was tested and rejected. Section 12.1 records the study's targets. Section 13 is one numbered client-question list.
- `architecture.md`: the flow, the four prediction branches, the engine module design (5.1-5.5), the three CSV adapters and the encoding boundary, the PWA layer and update flow, the storage layer, the seven-tab navigation, the new repository layout, and the deployment checks.
- `schema.md`: `channel`, VAT, discount, due date, collected, and `lineSumVariance` on invoices; nullable customer and salesperson with explicit rules; `deposit_receipts` and `deposit_links`; attribute values and aliases; demand classes; repurchase models and scores; optional judgement ratings; storage and backup versioning; fixtures re-baselined to full scale.
- `implementation-plan.md`: M0 through M7 re-dated and re-scoped, deployment moved ahead of M7 to meet the 30 September checkpoint, the M8+ backlog recorded, and the phase-to-milestone mapping fixed.
- `AGENTS.md`: working tool changed from Codex to Claude Code with its subagents; small reviewable changes replace whole-file returns; the milestone owner commits, not the tool; new rules on committable data, inference, no-future-data backtests, and reported-versus-verified results.
- `CLAUDE.md`: phase table and defaults aligned with the above.
- `.gitignore`: `*.csv` ignored everywhere except `tests/fixtures/`. `README.md` rewritten.

Decisions recorded in this phase:

- Predict only what 9 months without stock data supports: demand classification, repurchase and lapse, attribute demand, observed best sellers.
- `.xlsx` import and SheetJS dropped to M8+; the MVP ships with no runtime dependency.
- Management-only MVP with an optional local privacy lock; other roles move to M8+ together.
- WAPE is the headline error, MAPE is reported beside it and skips zero-actual periods, `k = 1`.
- MA3 is the default attribute method; SES chooses its constant per series by backtest error.
- Combined cash and credit by default, labelled, with toggles. System fonts. Thai default, system theme.
- The instructor allows the team's own approach; Track A is no longer a requirement.

Checks and exact PASS/FAIL results:

- None. This change is documents only; no code was written and no test was run.
- The backtest figures in `prd.md` 12.1 come from the team's local study on private data. They are **not verified in this repository** and are labelled as reported throughout. M4 and M5 must reproduce them.

Failures and fixes: none.

Approved deviations from plan: deployment now precedes M7, so that R1 findings are hardened rather than imagined. Recorded in the plan's sequencing rules.

Open decisions: the 18 questions in `prd.md` section 13.

Next action: review, commit, then begin Phase 1 / M0.

## 2026-09-16 - Colleague review incorporated

Prepared by: Titan  
Reviewed by: KissTK322 (GitHub review)

Status: document revision complete; repository acceptance pending.

Changes:

- Aligned all six documents to PRD 1.2.
- Removed project-history and chat-style commentary.
- Defined Codex as the repository/test-capable working tool and added session-end rules. (Superseded on 2026-09-16: the working tool is Claude Code.)
- Added split-source/build rationale, GitHub Pages deployment, live-URL testing, and open architecture questions.
- Converted M0-M7 into dated, alternating Titan/Tonkla review milestones; split M3 into M3a-M3c.
- Added browser-console `runChecks()`, R1-R3, handover, and the M8+ sequencing rule.
- Updated the model for multi-description codes, multi-unit lines, invoice gross/net/adjustments, free items, Buddhist Era dates, services, dated commitments, stock history, and forecast accuracy records.

Checks performed for this document revision:

- Six required Markdown files present.
- Version/date consistency and prohibited-phrase search.
- Required PRD, architecture, plan, progress, and schema sections present.
- Workshop test/deployment numbers checked against slides 54-56.

Not yet claimed:

- No application milestone is marked accepted from this document review.
- Node and browser test PASS results must be rerun from committed source. `browser.test.cjs` is specifically required before M3a acceptance.

Next action: complete M0 repository scaffold and reviewer sign-off.

## 2026-09 - Client discovery meeting

Recorded by: Tonkla and Titan  
Reviewed by: client CEO/management representative (personal name not recorded)

Status: requirements evidence captured.

Findings:

- Management needs next-month product demand and replenishment support, linked to product, customer group, and salesperson performance.
- Express reporting is combined manually; physical and system stock are reconciled monthly.
- Ordinary lead time is about 1-2 days; special products may require 30-40 days.
- The team agreed to use about one week as the review cycle for this phase because no fixed ordering cycle exists.

Open decisions: product identity, customer-group source, revenue/adjustment rules, stock ownership, production roles, and default buffer.

Next action: request the data listed in PRD open questions and time the current reporting workflow.

## Session 0 - Planning baseline

Prepared by: Titan  
Reviewed by: Tonkla

Status: M0-M7 plan established as review/integration work.

Decisions:

- The PRD is the scope authority.
- Each milestone has a different implementer and reviewer and one focused commit after sign-off.
- New requirements become M8+ rather than being inserted into M6/M7.
- GitHub Pages carries fake/anonymized data only; real client exports remain local.

Next action: execute M0 and record exact command/output evidence.

## Entry template

```markdown
## YYYY-MM-DD - Milestone / change

Prepared by:
Reviewed by:
Status:
Changes:
Checks and exact PASS/FAIL results:
Failures and fixes:
Approved deviations from plan:
Open decisions:
Next action:
```