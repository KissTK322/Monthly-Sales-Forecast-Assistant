# Progress: Monthly Sales Forecast Assistant

PRD baseline: 1.3 | Updated: 2026-09-23

## Current state

- Phase: UI polish parts 1-2 (navigation + motion) done and awaiting review; part 3 (friendlier visual design) waits for a choice between two proposals. The application was ported from the client-reviewed prototype on 2026-09-19 (commits `1fa6a44` onward), so the "no application source" note below is historical.
- Blocking issues: 18 client questions are open (`prd.md` section 13). New: 9 invoice numbers with zero totals and no lines (see 2026-09-23 entry) need the client to confirm whether they are cancelled.
- Next action: team tests the deployed site (v1.5.6); then part 3 design proposals. Client permission for the logo on a public page is still to be confirmed.

## 2026-09-23 - Public branding and deploy

Prepared by: Claude Code
Reviewed by: Tonkla

Status: committed and pushed for GitHub Pages. Version 1.5.6.

Changes:

- The header no longer shows the client's registered company name. It shows the informal app name "ผู้ช่วยคาดการณ์ยอดขาย", and the logo alt text is "โลโก้". The logo stays, as the team decided. Exports take the name from the header, so they no longer carry the registered name either.

Checks and exact PASS/FAIL results:

- Unit tests 40/40 PASS; `node build.cjs` builds.
- No data files are staged: `.gitignore` keeps `private-data/` and every CSV out.

## 2026-09-23 - Review round 7: import guidance and overlapping files

Prepared by: Claude Code
Reviewed by: Tonkla (pending)

Status: implemented and checked; not committed. Version 1.5.5.

Changes:

- A "How to import" guide (7 points) sits inside every file picker (Overview import panel, salesperson welcome import, Data page backup). It covers:
  - the three reports chosen together, with how to multi-select on desktop and mobile
  - sales imports replacing everything, and several periods selected together
  - one sales report only
  - deposits added later
  - JSON backups on their own
  - using the Express CSV unedited
  - confirmation and failure behaviour
- The confirmation before importing lists each file and its detected report, warns about missing report types, and gives the sales date range, the counts, the repeated documents skipped, and whether it REPLACES or ADDS.
- Importer: the same document number in two selected files (overlapping periods), or a deposit already in the data, is kept once. The repeats are counted in `importSummary.duplicateDocuments`. On the real data this changes nothing (0 repeats).
- Import errors are shown in Thai (unsupported file, deposits alone, no sale lines, no sales file).

Checks and exact PASS/FAIL results:

- Unit tests 40/40 PASS, including the new `import-duplicates` 3/3: overlapping cash files counted once, no false repeats, and the same deposits file added twice.
- Real files: 31,578 lines, 193 deposits, 0 repeats. The same cash file selected twice gives 31,578 lines and 6,088 repeats skipped.
- In-app browser, five import cases:
  - 3 files: replace.
  - Cash only: warns that credit and deposits are missing.
  - Cash twice + credit: repeats skipped.
  - Deposits only: add.
  - Unknown file: Thai error, no confirmation.
  - JSON mixed with CSV: rejected.
- 390 px: no overflow.

## 2026-09-23 - Review round 6: full-file default dates, security and deploy review

Prepared by: Claude Code
Reviewed by: Tonkla (pending)

Status: implemented and checked; not committed. Version 1.5.4.

Changes:

- Default date range = the whole imported file (first sale date to the last day), on first open, after an import and on "Clear filters". It used to start on the last month only.
- Security:
  - A Content-Security-Policy meta allows own files only (`script-src 'self'`, inline styles allowed for chart bars) and blocks plugins, `<base>` and form posts.
  - `referrer` is set to no-referrer.
  - `build.cjs` strips the CSP from the single-file build, whose scripts are inline.
  - The export's Print button is wired from the app, since its inline onclick is blocked by the inherited CSP; the onclick stays for the downloaded .html.
- Performance on the new 9-month default:
  - The Sales Team chart sums in one pass instead of one scan per person per bucket: 389 -> 276 ms on 9 months, 203 -> 77 ms on 1 month, same sums.
  - Group forecasts are cached until the data or language changes.
- `progress.md`: real money figures written in earlier entries (a monthly total and three per-person averages) were replaced with placeholders, as CLAUDE.md does not allow money totals in the repo.

Checks and exact PASS/FAIL results:

- Unit tests 37/37 PASS.
- CSP-enforcing copy with the real data, every tab: 0 CSP violations and 0 console errors. The default range reads 2025-12-01 .. 2026-08-31.
- Render times, in-app browser, full 9 months: Overview 90, Forecast ~171, Products 89, Sales Team 276 and Customers 41 ms.
- Git history: no CSV, XLSX, JSON or private-data file was ever committed, and there are no secrets. The only network requests are the service worker fetching the app's own files. The docs screenshots contain no names or amounts.

Deploy and legal review (for the team to decide; not legal advice):

- The site is already public at kisstk322.github.io with the client's company name and logo. The client's written permission is needed for a public page carrying its name and logo; otherwise use a neutral-branded public build.
- The repository is public and includes `prd.md`, `schema.md` and `progress.md` with client process details and data counts. Confirm this with the client or instructor, or move the details to a private place.
- PDPA: customer names are processed only on the user's device and nothing is uploaded, so the company remains the data controller. Exports and "save on device" copies contain personal data; shared devices should use "Delete saved data".
- GitHub Pages terms: suited to this student project and demo. For long-term commercial use by the company, host it on the company's own hosting.
- `assets/fonts/chakra-petch-*.ttf` is unused; delete it, or keep the OFL licence file next to it.
- Capacity: a static site on GitHub's CDN, with all computation on each user's device, so the number of users does not load a server. First visit 232 KB gzip (571 KB precached). The soft limit of 100 GB/month is about 180,000 first-time installs; repeat visits come from the service worker.

## 2026-09-23 - Review round 5: pagination for long tables

Prepared by: Claude Code
Reviewed by: Tonkla (pending)

Status: implemented and checked; not committed. Version 1.5.3.

Changes:

- "Product details" (Products page) and "Next-month consumption by product" (Forecast page) listed all 634 SKUs, so the sections below them were hard to reach.
- Both now show 10 rows a page with Previous / Next and "page x / y · showing a–b of n".
  - The page resets when the table's filters or search change.
  - "Forecast →" from Products jumps the SKU table to the page holding that SKU.
  - After a page change the view returns to the top of that table.
- Shared helpers: `pageSlice` and `pagerHtml` in js/app.js.

Checks and exact PASS/FAIL results:

- Unit tests 37/37 PASS.
- In-app browser with the real data:
  - Products: 634 rows as 64 pages of 10; Next and Previous change the rows and come back to the same first row.
  - A search for "ลอน" resets to page 1 of 17.
  - "Forecast →" on 02-502 opened the SKU table at page 5 with that row highlighted.
  - The section below the SKU table is reachable.
- 390 px: 0 px overflow on Forecast, Products and Customers.

## 2026-09-23 - Review round 4: last "k" labels, accuracy measures shown with bars

Prepared by: Claude Code
Reviewed by: Tonkla (pending)

Status: implemented and checked; not committed. Version 1.5.2.

Changes:

- The pre-existing salesperson × product-group matrix still labelled cells "86k"; all heat-map cells now go through one helper (`heatShort`): whole baht in Thai, "k" only in English. The round-3 sweep had searched for พัน/ล้าน but not "k"; the check now covers both.
- Accuracy table: WAPE, MAPE, Bias and MASE are shown directly (no longer only behind "technical detail"), each with a mini bar, plus a one-line key.
  - Error bars use the 15% / 25% bands.
  - Bias is a centred bar: right = forecasts too high, left = too low.
  - MASE has a mark at 1 (= as good as repeating last month).
  - MAE and RMSE (in product units) remain under "technical detail".
- Report and slides forecast tables list WAPE, MAPE, Bias and MASE. The A4 table type is tightened so ten columns fit.
- Checked against the original app: no function was removed. `wapeMeter` is no longer called because the forecast bars became cards, and every earlier section is still present.

Checks and exact PASS/FAIL results:

- Unit tests 37/37 PASS.
- In-app browser, Thai, 390 px, every tab: 0 px overflow, 0 "k", 0 พัน/ล้าน, 0 "THB". Report and slides text: 0 "k", 0 พัน/ล้าน, 0 THB, 0 NaN/undefined, and 0 console errors.
- Page fit, measured in an iframe:
  - report: 6 pages, the tallest 1,014 of 1,123 px, no table wider than the page
  - slides: 14, none over 540 px

Not re-run this round: the headless-Chrome numbers diff and the 6-device sweep, because Google Chrome is no longer in /Applications on this machine (it disappeared after the disk filled). The changes in this round are labels, formatting and a new table layout; no calculation changed.

## 2026-09-23 - Review round 3: full Thai amounts, bug sweep

Prepared by: Claude Code
Reviewed by: Tonkla (pending)

Status: implemented and checked; not committed. Version 1.5.1.

Changes:

- Thai numbers are no longer shortened anywhere. There is no "123.4 พันบาท", "12.35 ล้านบาท", "2.5 ล้าน" or heat-map cell in thousands; Thai shows the full amount with บาท (heat maps and chart labels are whole baht, "ปัดเศษสตางค์"). English keeps k / M THB. This covers the app axis, the in-app heat maps, and the report, slides and Excel.
- Thai money in the app is written "1,234.56 บาท" instead of "THB 1,234.56", including chart tooltips and the report's key points.
- Bug fixed: at 360 px the sales KPI broke inside the number (e.g. "1,234,567." / "89 บาท"). Numbers no longer wrap mid-number, and the sales card spans the row on narrow screens.
- Report page 2 lists sales by salesperson and by product group in one column so full amounts fit without cutting names.

Checks and exact PASS/FAIL results:

- Unit tests 37/37 PASS.
- Feature sweep through the real import path (three CSVs via the file input): 42/42 PASS, 0 script errors. It covered:
  - every tab rendering
  - no "THB" and no พัน/ล้าน abbreviation in Thai, in the app or in both exports
  - no NaN/undefined in the exports
  - Top N, the Sales Team highlight and untick, the language and theme switch keeping the tab, the forecast technical detail, and save / load / delete
  - the switch to Supervisor opening its access screen
- Numbers: 44 pages vs `d1a9852` with the same people ticked and axis labels excluded. 286 vanished tokens, all explained, 0 values changed:
  - 158 old "THB x.xx" amounts that the text glued to the next number
  - 92 group codes glued to values
  - 28 still present inside text
  - 8 old labels
- No big number splits across lines at 360, 390 or 768 px on Overview, Forecast, Team or Customers.
- The 6-device sweep is clean. The report has 6 pages and the slides 14, none overflowing. The .xlsx has 11 sheets, well-formed XML, and no THB or พัน/ล้าน in the Thai workbook.

Note: the test browser's temporary profiles filled the disk during this round; they are now deleted after each run.

## 2026-09-23 - Review round 2: readable charts, forecast verdicts, units and heat maps in the CEO export

Prepared by: Claude Code
Reviewed by: Tonkla (pending)

Status: implemented and checked; not committed. Version 1.5.0.

Changes:

- Sales Team chart:
  - Each salesperson has a distinct colour (`--person-1..8`, light and dark, each at least 4.5:1). Before, 03/08 were 1.09:1 apart and the average line shared its colour with "unassigned".
  - The chip list and the chart use the same colour. Pointing at or focusing a name fades the other lines.
  - The axis is in thousand/million baht.
  - "Unassigned" is unticked by default, since it is not a person.
  - The average is labelled "per person per day/month" with the count of people.
  - The duplicate legend was removed.
- Forecast cards:
  - History bars now 4.5:1 (was 1.73:1), with the forecast bar in orange.
  - "vs last month" with ▲▼. A month that sold under a quarter of its usual volume is described in words instead of as a % (group 07 was +742%).
  - A note that each card has its own scale.
  - A unit-coverage note when a group is forecast on its main unit only.
  - A plain verdict replaces the WAPE grade badge: Reliable / Guide only / Do not rely. Reliable needs at least 3 tested months, WAPE within 15% and MASE < 1.
- Accuracy table: verdict, WAPE, "better than repeating last month?" and months tested. The six measures sit under "Technical detail".
- In-app heat maps: sales by product group × month (Products) and by salesperson × month (Sales Team), in thousand baht over every imported month. The heat-map text colour is now fixed dark or white (was `--ink`, unreadable in dark mode).
- CEO export:
  - Thai money is written as บาท / ล้านบาท throughout, and chart units are stated in titles.
  - The forecast is listed per unit (never mixed or ranked across units), with the main-unit coverage shown.
  - A units note says money is summed line amounts before invoice discounts, VAT and deposits.
  - A group 77 service-fee note is added.
  - New: cash/credit split, customer concentration (customers making 80% of sales), group growth vs the previous period, average invoice per month, and three heat maps (group × month, salesperson × month, weekday × month).
  - The .xlsx has 11 sheets; the three heat-map sheets use an Excel colour scale.
  - The report is 6 A4 pages and the slides about 14.

Checks and exact PASS/FAIL results:

- Unit tests: accuracy 3/3, csv-quotes 4/4, encoding 5/5, import-deposit-merge 5/5, predictions 20/20 - PASS.
- Numbers: compared with `d1a9852` using the same people ticked and the chart axis labels (now abbreviated) left out, over 44 pages:
  - Overview, Sales Team, Customers and Data: no number missing.
  - Forecast and Products: 96 vanished tokens, all old labels ("Top 5", "within 10/15/25%") or group codes that the old text glued to their values.
  - Intended changes: "unassigned" unticked by default and the abbreviated axis.
- Export:
  - The .xlsx passes a zip test, all XML is well-formed, 11 sheets, and a colour scale on sheets 4-6.
  - Report: 6 PDF pages, each page's content under the A4 height.
  - Slides: 14 PDF pages, no slide clipped.
- Devices: 360, 390, 844 landscape, 768, 1024 and 1440 × light/TH/management and dark/EN/supervisor. No page overflow, no small tap targets, 0 script errors.

Known gaps: the Sales Team chart is still busy on daily ranges with five people; highlighting helps, but a monthly view is clearer. The .xlsx has not been opened in Excel or Numbers on this machine.

Next action: user checks in Safari; then part 3 proposals.

## 2026-09-23 - Review round: bug fixes, top menu, forecast cards, Top N, CEO export

Prepared by: Claude Code
Reviewed by: Tonkla (pending)

Status: implemented and checked on top of the uncommitted parts 1-2 below; not committed.

Changes:

- Bugs:
  - Sales Team average shrank as more names were ticked while a salesperson filter was set. The filter forced the others to zero, so the average was one person's sales divided by the number ticked (the screenshots showed exactly 6 : 4 between the two values). The salesperson filter is now hidden and ignored on that page (`personFilter()`), and a note says so.
  - "Save on this device" always failed: the real data is 7.7 MB and localStorage holds about 5 MB. It now uses IndexedDB (`monthly-forecast-saved-v1`), only when pressed, and there is a new "Delete saved data" button. The app still opens empty.
  - The Data page gained "Load a backup file (.json)".
  - Backups are written compact (11.2 MB -> 7.7 MB) with the date in the file name.
- Header and menu:
  - The view select, exit button and "client review" label are replaced by one account menu (switch view, exit). The menu closes on an outside click or Escape.
  - Navigation is a top bar on every screen. The indicator slides with translateX and scaleX.
- Forecast:
  - One card per product group, with the forecast, a likely range, 9 months of history plus the forecast month, and the tested WAPE.
  - The range is forecast x (1 +/- WAPE), k = 1 (CLAUDE.md section 8).
  - A new accuracy table shows WAPE, MAPE (skips zero months), MAE, RMSE, Bias and MASE, with plain-language help.
  - `Predictions.accuracyMetrics()` is new, and the backtest now keeps each month's naive value. WAPE and the forecast value are unchanged.
- Top N: 5 / 10 / 15 / All on product changes, best sellers, customer companies, attribute ranking and top products. The choice is remembered per ranking for the session, and "All" scrolls inside its box. The best sellers default changed from a fixed 8 to Top 10.
- CEO export (`js/export.js`, no library):
  - Excel .xlsx, 7 sheets, from a hand-written zip.
  - A4 report, 3 pages.
  - 16:9 slides, 9 pages.
  - The report and slides open as a printable page ("Print / Save as PDF"); if pop-ups are blocked, the file downloads as .html.
  - The export is available from the Overview heading and the Data page, and warns that the files contain customer names and amounts.
- `sw.js` / `js/pwa.js`: version 1.4.0, `js/export.js` precached.

Checks and exact PASS/FAIL results:

- Unit tests: `accuracy` 3/3 (new, hand-worked example), `csv-quotes` 4/4, `encoding` 5/5, `import-deposit-merge` 5/5, `predictions` 20/20 - PASS.
- Numbers: the same 44 pages as before, compared with `d1a9852`. 111,266 numbers compared; 596 are no longer on the page, and every one is explained:
  - Salesperson codes in the hidden Team filter.
  - "Top 5" / "within 10/15/25%" labels.
  - 104 tokens where the old text glued a group code to its value, for example "07" + "818.6". The value itself is still shown.
  - No number changed value.
- Phase A in the browser:
  - Team page: the filter is hidden and the note is shown.
  - Save, load, delete and load-backup-file all work on the real data (backup load: "Import complete").
- Export:
  - The .xlsx passes a zip integrity test and all 12 XML parts are well-formed. It has not been opened in Excel on this machine.
  - The report prints to 3 PDF pages and the slides to 9, measured with Chrome print-to-PDF. This found and fixed blank or extra pages caused by screen-only media queries applying in print.
- Devices: 360x740, 390x844, 844x390, 768x1024, 1024x768 and 1440x900, each with light/TH/management and dark/EN/supervisor, on every tab:
  - no page-level horizontal overflow
  - no nav, menu, Top N or export control shorter than 36 px
  - account menu on screen
  - 0 script errors
- The real app on http://127.0.0.1:8123 loads all 7 scripts, version 1.4.0, with 0 errors.

Known gaps: the primary button colour (`--blue` #687fb7 on white, 3.96:1) still fails AA; it belongs to part 3. The .xlsx has not been opened in Excel or Numbers, and Safari printing has not been tried; both need a real check on the user's machine.

Next action: user checks in Safari; then part 3 proposals.

## 2026-09-23 - UI polish parts 1-2: navigation and motion

Prepared by: Claude Code
Reviewed by: Tonkla (pending)

Status: implemented and checked; not committed.

Prerequisite commits made first (author KissTK322): `d705c39` app.js synced with the client-reviewed single-file build; `c8017d1` unescaped inch marks in Express CSV cells (real data now 30,942 cash lines, 626 cash codes; 6,247 invoices with lines, the other 9 of 6,256 document numbers have zero totals and no lines); `d1a9852` tab-switch speed (Map lookups, cached `bounds()`, last-year sales summed once; Products 786-1,665 ms -> 42-80 ms).

Changes:

- `css/styles.css`: one design-token set in `:root` (font stack, radius, shadow, spacing, durations, easing, nav colours) with dark values, and one new block at the end of the file. Earlier rules untouched.
- `js/motion.js` (new, ~11 KB): page-entry fade + 8 px rise staggered 40 ms (max 6, the rest together), KPI count-up 500 ms on the first visit of a page only, bars grow and chart lines reveal (~450 ms), sliding nav indicator, auto-scroll of the active pill on narrow screens with edge fades, skeleton only when that page's previous render took > 150 ms, smooth open/close for every `<details>`. Transform and opacity only; `prefers-reduced-motion` turns it into a short fade.
- `js/app.js`: inline SVG nav icons; the tab click marks the tab active first, then renders; render reports the current page to `Motion.afterRender`; toast fades out before hiding.
- `index.html`, `sw.js`, `js/pwa.js`: load and precache `js/motion.js`; version 1.3.0. The four Chakra Petch files were removed from the precache list (no longer used).
- Font: system stack `system-ui, -apple-system, "Segoe UI", "Leelawadee UI", "Sukhumvit Set", "Noto Sans Thai", "Noto Sans", Tahoma, sans-serif` for body, controls and `.chart text`. The served app previously used self-hosted Chakra Petch (not Tahoma; Tahoma appeared only in the single-file build, which does not inline fonts).

Checks and exact PASS/FAIL results:

- Unit tests: `csv-quotes` 4/4, `encoding` 5/5, `import-deposit-merge` 5/5, `predictions` 20/20 - PASS.
- Numbers unchanged: every tab rendered with the real data before (`d1a9852`) and after, management + supervisor x TH + EN x two date ranges = 44 pages; visible text plus every tooltip, aria-label, title and form value compared after animations finish. 44/44 identical, 111,510 numeric tokens compared, 0 differ. The baseline itself was identical across two runs.
- Found and fixed during that check: the first skeleton version overwrote `<main>`, which also deleted `#controls` on pages that move it there, and the next render threw. The skeleton now sits beside `<main>`.
- Behaviour (headless Chrome, 1440 px): tab active immediately on click; count-up on first visit only; 0 animated elements after a filter change or search keystroke; skeleton shown only on a repeat visit to Forecast (render ~190 ms).
- Jank, measured in the 700 ms after each render (PerformanceObserver `longtask` and `long-animation-frame`, 4 runs of 7-14 tab changes, motion on and reduced): long tasks none in any run; longest frame gap 17 ms. One reduced-motion run recorded two long animation frames (493 ms, 102 ms) that did not recur in the two repeat runs. The render itself is still one long task (Forecast ~190 ms, Team ~115-130 ms, Overview/Products ~60-80 ms).
- Screens: 390 / 768 / 1440 px, light and dark, TH and EN, management and supervisor.

Eco numbers (HTML + CSS + JS; `build.cjs` does not minify, so there is no minified figure):

| | raw | gzip |
|---|---|---|
| before, code | 327.6 KB | 89.1 KB |
| before, Chakra Petch loaded (400/600/700) | 205.7 KB | 103.6 KB |
| after, code | 349.7 KB | 96.0 KB |
| after, fonts | 0 KB | 0 KB |

The CLAUDE.md budget "first load <= 250 KB uncompressed" refers to the raw column: 349.7 KB, still over budget, as it was before (533.3 KB including fonts). No JS was cut in this phase, as agreed.

Approved deviations from plan: none. Chakra Petch files remain in `assets/fonts/` and their `@font-face` rules remain in the CSS (unused, so not downloaded); deleting them is left to the reviewer.

Open decisions: part 3 design choice; whether to delete the unused font files.

Next action: review, commit, then part 3 proposals.

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