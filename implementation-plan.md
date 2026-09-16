# Implementation Plan: Review, Integration, Pilot, and Handover

PRD baseline: 1.3 | 2026-09-16

The local prototype was created before this formal plan. M0-M7 are controlled review and integration milestones, not a reconstruction story. Each milestone has an acceptance record in `progress.md` and one focused commit after sign-off.

**Who does what.** Claude Code implements, with the subagents in `.claude/agents/`. The named owner below is the human accountable for the milestone: they review the work, run the checks themselves, and make the commit under their own GitHub account. The reviewer named beside them is the second pair of eyes required by `AGENTS.md`. The `architect-reviewer` subagent is a pre-review; it never replaces the human sign-off.

**Fixed checkpoints:** MVP deployed to GitHub Pages by **30 September 2026**; remaining hardening complete before user test **R2 on 14 October 2026**. Dates between them are targets and may move when client data is late; the two checkpoints may not.

## M0 - App shell | 2026-09-18

Owner: Titan | Reviewer: Tonkla

Goal: Structure, `build.cjs`, seven-tab navigation (Stock hidden), Thai/English, light/dark/system theme, responsive layout, the PWA layer, and empty states for every view.

Verify: required filenames exist; `index.html` opens; `build.cjs` produces a `dist/index.html` that opens from a folder with no service worker; the hosted copy installs and reopens offline; the update banner appears after a version bump and reloads only when tapped; language and theme survive a reload and keep the current view; no page-level sideways scroll at 360 px; first-load bytes measured and recorded.

Shippable result: an installable, empty, navigable app in both languages and both themes.

## M1 - Canonical data and full-scale fixtures | 2026-09-20

Owner: Tonkla | Reviewer: Titan

Goal: Implement the PRD 1.3 model (invoice with channel, VAT, discount, due date, collected, deposit receipts and links, attributes, derived prediction tables), validation, IndexedDB storage, JSON backup v2 with v1 migration, and a synthetic fixture generator for all three report layouts.

Verify: stable IDs and relationships; generated fixtures reproduce the section 7.2 counts for all three reports at 9-month scale, in Windows-874, with invented names and no remark text; a credit invoice with no customer code validates; a blank salesperson validates and is counted; a v1 prototype backup migrates; no silent unresolved rows.

Shippable result: versioned canonical data and a fixture generator that makes the client files unnecessary for testing.

## M2 - Express CSV adapters | 2026-09-22

Owner: Titan | Reviewer: Tonkla

Goal: Read all three printed-style CSV reports in a Web Worker, link deposits to invoices, and support documented CSV/pasted rows and JSON restore.

Verify: repeated headings, invoice/item rows, deposits, Buddhist Era dates, free lines, service lines, totals, and unresolved rows. Run automated tests plus browser-console `runChecks()` with at least these cases:

1. `2569-07-01` becomes `2026-07-01` while the original value remains in audit data.
2. A repeated page heading creates no invoice or line.
3. A deposit row creates an adjustment and reduces invoice net without reducing product-line revenue.
4. A free item remains as quantity with `lineAmount = 0` and a quality flag.
5. An unknown row blocks activation and appears in the unresolved-row report.
6. All three fixtures reconcile to the counts in PRD 7.2 and to each report's footer totals.
7. A Windows-874 file and the same file as UTF-8 with a byte-order mark parse identically; a UTF-8 file with no mark is refused rather than mangled.
8. A line with unbalanced quotes is reported and does not shift the columns of later lines.
9. The cash footer's `***` invoice count is never used as a reconciliation source.
10. An `SR` deduction is stored unmatched, not invented as a receipt.
11. A failed import leaves the previous dataset active and selectable.
12. Import at full scale keeps the interface responsive and reports progress.

Shippable result: local import preview that never replaces valid data after a failed import.

## M3a - Overview and Sales team | 2026-09-24

Owner: Tonkla | Reviewer: Titan

Goal: Review Overview and Sales team interactions, comparisons, averages, heatmap, filters, and empty states.

Verify: invoice-net totals, average per invoice, preceding-period comparison, two-point comparison, hover values, salesperson detail, keyboard use, and `browser.test.cjs` after the final UI changes.

Shippable result: accepted management overview and salesperson analysis.

## M3b - Products and Customers | 2026-09-24

Owner: Titan | Reviewer: Tonkla

Goal: Review product/category rankings and customer/customer-group analysis.

Verify: Top 5 by revenue/compatible quantity; category/SKU/salesperson filters; average invoice value by customer group; exact metric labels; no incompatible-unit addition; the channel toggle works and every figure states whether it is cash, credit, or combined.

Shippable result: accepted product and customer decision views.

## M3c - Prediction views | 2026-09-25

Owner: Tonkla | Reviewer: Titan

Goal: Connect approved reporting data to the demand-class, attribute-forecast, repurchase, and best-seller screens without prematurely accepting the calculations behind them.

Verify: complete-month cutoff; series unit shown on every figure; assumption and "observed history" labels present; unmapped attribute counts visible; a series with no result shows its reason instead of a number; no replenishment screen is reachable.

Shippable result: reviewable prediction interfaces ready for M4-M5 sign-off.

## M4 - Demand classification and attribute forecasting | 2026-09-26

Owner: Titan | Reviewer: Tonkla

Goal: Accept FR17 (demand class per product series) and FR19 (next-month metres by profile, thickness, and colour), per PRD 8.2.1 and 8.2.3.

Verify:

1. Hand-worked ADI and CV-squared for one series in each of the five classes, including both boundary cases (ADI 1.32, CV-squared 0.49).
2. The sparsity guard fires on fewer than 6 complete periods and on fewer than 3 non-zero periods, and returns a reason rather than a class.
3. MA3 and SES hand-checked on one series; MA3 is the default, both methods are shown with their own error, and the SES smoothing constant is chosen per series from {0.1, 0.2, 0.3, 0.5, 0.7} by backtest error using pre-cutoff data only, falling back to 0.3 and saying so.
4. WAPE and MAPE hand-checked, including a zero-actual month that MAPE skips and counts.
5. No-future-data backtest: an invoice dated on or after a cutoff cannot change that cutoff's prediction.
6. Unmapped raw attribute values are counted and displayed; none is merged into a neighbouring value.
7. Missing month versus verified zero month produce different results.
8. Backtest WAPE reproduces the PRD 12.1 ranges from committed tests under the stated restriction — the 12 largest values of each attribute, metres only, excluding groups 77, 88, and 99 — and the interface shows the covered share (89% profile, 100% thickness, 61% colour) beside every error figure. Until this test passes, those figures stay labelled as reported, not measured.
9. The sparsity guard is the application's 6/3 rule, not the study's weaker 2-observation guard, and the resulting class counts are not compared with the study's.

Shippable result: explainable demand classes and attribute forecasts, each with cutoff, unit, method, range, and measured error.

## M5 - Repurchase alerts, best sellers, persistence, and export | 2026-09-28

Owner: Tonkla | Reviewer: Titan

Goal: Accept FR18 (repurchase and lapse), FR20 (observed monthly best sellers and the optional rating), local backup, and CSV export.

Verify:

1. Median gap, recency, and ratio hand-checked for one customer in each of the three rule states.
2. Eligibility: customers with fewer than 3 invoices are excluded with a stored reason; credit customers appear only when a confirmed name-to-code mapping exists.
3. The logistic fit is deterministic: two runs on the same data give identical coefficients.
4. Leakage test: an invoice dated after the cutoff changes the label but cannot change any feature.
5. Coefficients, standardisation values, cutoff, training rows, and convergence state are visible on screen and travel with any export.
6. Rule state and model probability are shown side by side and are never merged into one number.
7. No free-text remark data reaches this feature, its exports, or its logs.
8. Best-seller tables carry the "observed history, not a seasonal pattern" label, driven by the result flag rather than a hard-coded template string.
9. Delphi-lite ratings, if built, are stored separately, displayed beside observed data, and provably absent from every engine input.
10. Backup restores; exported values match the screen; the customer-list export carries its warning; on an installed iOS app the export opens the share sheet.
11. Backtest reproduces the PRD 12.1 ranges from committed tests: base rate 28-33%, rule precision 42-47%, AUC 0.78-0.81, top-100 precision 59-74%, lapsed-but-bought 15-18%. Until this test passes, those figures stay labelled as reported, not measured.

Confirm with the client before acceptance: the 1.5 and 2.0 gap thresholds, the "overdue" label for the band between them, and the 30-day horizon. Access is settled for the MVP: the ranked list is in the management view only, export is allowed with a warning, and the published build uses fake data.

Shippable result: a reviewable follow-up list and observed best-seller tables; no claim about any individual customer.

## M6 - Accessibility, responsive, and eco review | 2026-09-29

Owner: Titan | Reviewer: Tonkla

Goal: Accept Thai/English, light/dark/system, keyboard use, phone and tablet layout, the optional local privacy lock, and the eco budget; establish the current-process time baseline.

Verify: Windows Chrome and Edge, macOS Safari, iOS Safari, Android Chrome; 360, 390, 820, 1180, and 1440 px; tablet portrait, landscape, and Split View; 200% text; visible focus; chart values reachable by tap and keyboard; tap targets at least 44 px; inputs at least 16 px on touch; safe-area insets; WCAG AA contrast in both themes; `prefers-reduced-motion` honoured; the privacy lock is labelled as privacy, not security; first-load bytes within 250 KB with 0 KB of fonts, and repeat-visit transfer about 0 KB; the current Express-report task timed three times.

Shippable result: pilot-ready interface with clearly labelled prototype security limits and measured eco numbers.

## Deploy - GitHub Pages | 2026-09-30 (fixed checkpoint)

Owner: Titan | Reviewer: Tonkla

Goal: Publish fake/anonymized data only from `main` and repository root.

Verify: clean/pushed repository; root `index.html`, `manifest.webmanifest`, `sw.js`, `.nojekyll`; all browser checks rerun on the real Pages URL, on a second device, on mobile data; install and offline check on each target platform; update banner verified by shipping a version bump; README run/deploy steps; no client data in the release.

Shippable result: public MVP review URL and tag `v1.0-mvp`.

## M7 - Hardening and forecast accuracy log | 2026-10-09

Owner: Tonkla | Reviewer: Titan

Runs after deployment and R1 so that real findings are hardened, not guesses. Must be complete and re-deployed before R2.

Goal: Preserve issued predictions and later actuals; test recovery, duplicates, zero demand, leap dates, migrations, and expected volume.

Verify: immutable issue timestamp/cutoff, reproducible method inputs, actual attachment, WAPE and MAPE calculation, duplicate-import safety, storage-quota failure handled without data loss, a cleared-site-data recovery path, R1 findings fixed, and independent sign-off. Re-deploy and re-run the live checks afterwards.

Shippable result: release candidate with honest accuracy history, deployed before R2.

## R1 - Can users complete the tasks? | 2026-10-02

Owner: Tonkla (facilitator) | Reviewer/notes: Titan

Use 3 users, 4 realistic tasks, 20 minutes each. Give tasks without click instructions, do not help, time each task, and record questions/hesitations. Establish unaided task-success and time-to-decision baselines.

## R2 - Is the output correct? | 2026-10-14 (fixed checkpoint)

Owner: Titan (facilitator) | Reviewer/notes: Tonkla

Use the same users and real data from their own work. Compare dashboard conclusions and predictions with manual decisions. Record WAPE and MAPE, decision differences, issues found, and fixes. Real data stays on the client's device; it is never published.

## R3 - Do users return voluntarily? | 2026-11-04

Owner: Tonkla | Reviewer: Titan

Leave the app unattended for two weeks, then interview the same users. Count voluntary openings, repeat the task set, and target more than 80% unaided task completion by round 3. Report time-to-decision, forecast error, issues found/fixed, and voluntary use even when results are poor.

## Handover | 2026-11-28

Owner: Titan | Reviewer: Tonkla

Deliver the final README, operating runbook, import/data dictionary, test report, user-test report, known limitations, backup/recovery steps, tagged source, live URL, and a walkthrough with the client. Record ownership for future data imports, access administration, and support.

## Sequencing rules

Phase 0 -> M0 -> M1 -> M2 -> M3a -> M3b -> M3c -> M4 -> M5 -> M6 -> **Deploy** -> R1 -> M7 -> R2 -> R3 -> Handover.

Deployment moved ahead of M7 to meet the 30 September checkpoint. The order is deliberate: R1 asks whether people can use the thing at all, and hardening what real users actually broke is worth more than hardening what we imagined they would.

Phase-to-milestone mapping, matching `CLAUDE.md` section 6:

| Phase | Milestones |
| --- | --- |
| 0 | Documents (this change) |
| 1 | M0 |
| 2 | M1 |
| 3 | M2 |
| 4 | M3a + M3b |
| 5 | M3c + M4 |
| 6 | M5 |
| 7 | M6 |
| 8 | Deploy + R1 |
| 9 | M7, then R2, R3, Handover |

New feature requests become M8 or later with their own owner, reviewer, checks, and commit. They must not be hidden inside M6, M7, or a bug-fix commit.

Client input required before M4/M5 acceptance: the approved attribute value lists and colour aliases (M4), and the repurchase thresholds, horizon, and access decision (M5). Neither milestone is blocked on new data; both run on the 9 months already supplied.

## M8+ backlog, blocked on data

These are not scheduled. Each becomes a dated milestone when its input arrives; see PRD sections 11.1 and 13.

| Item | Unblocked by |
| --- | --- |
| Replenishment: stock planning, reorder quantities, pack rounding, lead-time horizons (former M5) | Stock snapshots with count dates, dated commitments, incoming supply, pack sizes, per-item lead times |
| Per-SKU quantity forecasting | 24 months of history plus an approved forecast identity |
| Seasonal forecasting and a long backtest | 24 complete months |
| Revenue forecasting, month-end projection, customer-group revenue | 24 months; customer groups for the group view |
| Forecast-identity work (product code + type + unit) | Client confirmation; it is an M8+ dependency now that the MVP forecasts attributes rather than SKUs |
| Prototype features held back from the MVP: daily sales entry, add product, add customer, tech-team role | Client decision; the tech role must not be able to reset the CEO password unless the CEO enabled it |

The single highest-value request to the client is 15 further months of the same three reports. It unblocks five rows of this table at once.