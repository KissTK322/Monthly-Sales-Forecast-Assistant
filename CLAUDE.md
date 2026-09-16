# CLAUDE.md — Monthly Sales Forecast Assistant

Claude Code reads this file at the start of every session. Keep it current.

## 1. What this project is

A Thai/English sales dashboard and next-month demand / stock planning tool for the management team of a domestic metal-roofing manufacturer. Data comes from the company's Express accounting software (printed-style Excel reports).

It is a university workshop project ("Vibe Coding"). The instructor confirmed on 2026-09-16 that the team may design its own approach rather than follow Track A. The team is **Titan** and **Tonkla**; they alternate implementer / reviewer per `implementation-plan.md`. The instructor reads the GitHub repo and issues. Every team member must be able to explain every line, so keep code readable and explain your changes.

## 2. Source of truth (read in this order)

1. `prd.md` — scope authority (v1.3, 2026-09-16)
2. `AGENTS.md` — standing rules (they apply to you)
3. `architecture.md`, `schema.md`
4. `implementation-plan.md` — milestones M0–M7, Deploy, R1–R3, Handover
5. `progress.md` — what is actually done; append an entry after every phase
6. `reference/` — **read-only** inputs (not committed):
   - `client-meeting-notes.md` — client interview (Thai)
   - `prototype-monthly-sales-forecast.html` — teammate's working prototype (minified single file, old data model). Reuse its features, UI ideas and verified maths; do not copy its data model.
   - `sales-compass-original.html` — earlier team project; its `SalesDataEngine` already parses the real Express cash-sales report correctly (683 invoices, footer reconciled). Reuse its row-classification logic for `import-express.js`.
   - `sales-compass-pwa/` — PWA version of Sales Compass (manifest, `sw.js`, `pwa.js`, touch fixes, iOS CSV share, saved report in IndexedDB). Passed 50/50 Chromium checks. Reuse this PWA layer.
   - `vibe-coding-workshop.pdf` — course slides (milestones, testing, grading)
7. `private-data/` — **real client exports (current data source)**. **Never commit, never copy into fixtures, never print customer names, phone numbers or money totals.** Use them only for local reconciliation tests.
   - `cash-sales.csv` — Express "รายงานขายเงินสด เรียงตามวันที่" (cash sales)
   - `credit-sales.csv` — Express "รายงานใบกำกับสินค้า เรียงตามวันที่" (credit sales / tax invoices)
   - `deposits.csv` — Express "รายงานใบรับมัดจำ แยกตามลูกค้า" (deposit receipts)
   - `ExcelAssignment2.xlsx` (optional, older) — July 2026 cash sales only; identical to the July part of `cash-sales.csv`.

If documents disagree with each other or with the user's request, stop and ask. Do not silently pick one.

## 3. How we work (phase gates)

- Work **one phase at a time** (§6). At the end of each phase, **stop** and report using the template in §9. Do not start the next phase until the user writes "approve".
- Before writing code in a phase, show a short plan (files to create/change, tests) and wait for approval.
- Use the subagents in `.claude/agents/` for their areas. The main session coordinates, integrates and does final review.
- Small, reviewable changes. No hidden features. New requests become M8+ (see `implementation-plan.md`).
- Do not run `git commit` or `git push` unless the user asks. The user commits under the milestone owner's GitHub account.
- Never claim a test passed unless you ran it in this session and show the output.

## 4. Platform requirements (added to PRD v1.3 in Phase 0, 2026-09-16)

These are now recorded in `prd.md` (FR22–FR27, NFR02, NFR08, NFR11–NFR16) and `architecture.md` (sections 2, 3, 4.1, 4.2, 7). They remain listed here because they shape every phase:

1. **PWA**: installable and usable offline after first visit on **iOS/iPadOS (Safari), Android (Chrome), macOS (Safari/Chrome), Windows (Edge/Chrome)**. Manifest, icons (incl. maskable + apple-touch-icon), service worker with versioned cache and "new version available → Reload" banner, per-platform install help (iOS has no install prompt).
2. **Responsive** from 360 px phones to tablets (portrait, landscape, Split View) and desktop. No page-level sideways scroll, tap targets ≥ 44 px, safe-area insets, chart values available by tap and keyboard (not hover-only), inputs ≥ 16 px on touch (prevents iOS zoom).
3. **Report upload on phones/tablets** (the three Express CSV reports; `.xlsx` only if the client still needs it): file picker must work from iOS Files / iCloud Drive / Google Drive and Android Downloads / Drive. `accept` lists both extensions and MIME types; provide a fallback picker without `accept`. "Upload" means read on the device; nothing is sent to a server. In installed iOS apps use the share sheet for CSV export.
4. **Thai / English** switch that keeps the current view state and is remembered.
5. **Theme**: light / dark / system, one set of CSS variables, WCAG AA contrast in both.
6. **Eco-friendly** (measured every phase, see §5).

`AGENTS.md` names Claude Code (with subagents) as the working tool, updated in Phase 0.

## 5. Technical rules

- Static site only: HTML, CSS, plain JavaScript (ES modules or classic scripts). **No framework, no CDN, no analytics, no backend.** A server needs a PRD change first.
- File layout (propose adjustments in Phase 0 if needed):

```text
index.html  manifest.webmanifest  sw.js
css/styles.css
js/app.js  js/i18n.js  js/theme.js  js/engine.js  js/model.js  js/storage.js
js/import-express.js  js/import-csv.js  js/import-worker.js  js/pwa.js
js/views/*.js
icons/  tests/  build.cjs  dist/index.html (generated offline single file)
```

- `index.html` and `sw.js` sit at the repo root (GitHub Pages serves the root). All paths relative (site lives under `/Monthly-Sales-Forecast-Assistant/`).
- Pure functions for all maths and parsing (testable in Node without a browser).
- Parse reports in a Web Worker; show progress; a failed import never replaces valid data.
- CSV files are **Windows-874 (TIS-620) encoded**: decode with `new TextDecoder('windows-874')`, never as UTF-8. Accept UTF-8 too if a BOM is present.
- Storage: IndexedDB for datasets, import batches and forecast records; localStorage only for small settings (language, theme). JSON backup v2 + migration from the prototype's v1 JSON.
- Security: escape all text from files before inserting into HTML; CSV cells starting with `= + - @` are prefixed; local passwords are privacy locks only (say so in the UI).
- Dependencies: none at runtime except the vendored SheetJS. Dev-only tools (e.g. Playwright) need the user's approval first.

### Eco budget (report actual numbers every phase)

| Item | Budget |
|---|---|
| First load (HTML + CSS + JS + fonts, excluding SheetJS) | ≤ 250 KB uncompressed |
| Fonts | 0 KB — system fonts only (decided in Phase 0) |
| Runtime dependencies | none; SheetJS is removed with `.xlsx` import (M8+) |
| Repeat visit network transfer | ≈ 0 KB (service worker) |
| Runtime | no polling, no timers in hidden tabs, render charts only for the visible tab, honour `prefers-reduced-motion`, dark theme available |

## 6. Phases (update the status here)

| Phase | Milestone | Content | Status |
|---|---|---|---|
| 0 | — | PRD v1.3 + architecture + schema/plan/AGENTS/progress for §4 and the predictive scope | ☑ 2026-09-16, awaiting review |
| 1 | M0 | App shell: structure, build.cjs, nav (7 tabs, Stock hidden), i18n, theme, responsive layout, PWA layer, empty states | ☐ |
| 2 | M1 | Data model (schema + channel, VAT, discount, due date, collected, deposit receipts and links, attributes, prediction tables), validation, IndexedDB storage, JSON backup v2/migration, synthetic fixture generator for the three report layouts (Windows-874, fake names, full scale, 9 months) | ☐ |
| 3 | M2 | Import: three Express CSV adapters (cash, credit, deposits; Windows-874), CSV/paste, JSON; deposit-to-invoice links; reconciliation preview; worker; `runChecks()` cases; tests | ☐ |
| 4 | M3a + M3b | Overview, Sales team, Products, Customers (FR03–FR08) | ☐ |
| 5 | M3c + M4 | Predictions view + engine: demand class (A6), attribute forecast (B3), backtest WAPE + MAPE, range | ☐ |
| 6 | M5 | Repurchase and lapse (B1), observed best sellers (C1-lite), CSV export, backup/restore | ☐ |
| 7 | M6 | Accessibility, responsive + eco audit, privacy lock, current-process timing sheet | ☐ |
| 8 | Deploy + R1 | GitHub Pages at repo root by **30 Sep 2026** (fake data only), README, runbook, device checklist; then user test R1 | ☐ |
| 9 | M7 | Accuracy log, hardening, volume test, migrations, R1 fixes; re-deploy before **R2 on 14 Oct 2026** | ☐ |

## 7. Known facts about the real Express data (3 CSV reports)

All three: Windows-874 encoding, CRLF, period **1 Dec 2568 – 31 Aug 2569 BE (= Dec 2025 – Aug 2026, 9 months)**, printed layout exported to CSV (company header, report title, date range, repeated page headers with `หน้า`, dashed/`=` rule lines, column-header rows, footer rows, remark `หมายเหตุ`, end marker `>>>> จบรายงาน <<<<`). Dates are `dd/mm/yyyy` in the **Buddhist year** → Gregorian (−543), keep the original text. A leading `*` on a document number means cancelled; a `*` after a due date means overdue. Some lines are malformed CSV (unbalanced quotes) — parse line by line and report, never crash.

### 7.1 Cash sales — `cash-sales.csv` (invoice prefix `HS`)

- Invoice row: date, doc no, customer code, customer name, salesperson, V, **discount**, goods value, **VAT**, total, over-received, received cash/transfer, received by cheque, withholding tax.
- Item row: `""`, line no, `"GG-NNN -  description"`, qty, unit, unit price, line discount, amount, sales-order ref (`SO6811/2904   1`, present on ~61 % of lines).
- Deposit note row: text `ตัดใบรับมัดจำ#  <doc> <amount>`; prefixes `AI` (193 notes) and `SR` (79 notes).
- Free-text remark rows (`"","","..."`) may contain **personal data (phone numbers, names)** — keep them out of the UI, exports and logs.
- Reconciliation targets (counts safe to commit): **6,088 invoices, 30,942 item lines, 626 product codes in 19 groups, 1,471 customer codes, salespeople 01/03/04/06/08 (11 invoices have a blank salesperson), 27 units (34 lines with a blank unit), 4,910 lines without price/amount** (mostly `99-xxx` free items; also `88-101` PU foam and `77-xxx` services), 183 invoices with an invoice discount, 6 invoices with VAT, 272 invoices with deposit notes, no cancelled documents in this export.
- Footer: invoice count is printed as `***` (overflow) → **cannot** be used; reconcile goods, VAT, total, deposit deductions and the before-deposit total (`ยอดที่ตัดใบรับมัดจำ <before-deposit>` + deposit column). Parsed sums match the footer exactly.
- The invoice goods/total are **after** deposit deductions: `total + deposits = before-deposit total`. For 41 invoices `sum(lines) − discount − deposits ≠ goods` (VAT-inclusive prices on 6 invoices, other small adjustments) — show the difference, do not hide it.
- The July 2026 part equals the older `ExcelAssignment2.xlsx` (683 invoices, 3,283 lines).

### 7.2 Credit sales — `credit-sales.csv` (invoice prefix `IV`)

- Different layout. Invoice row: date, doc no, **customer name only (no customer code)**, salesperson, V, discount, goods value, VAT, total, **due date**, sales order, **collected flag (Y/N)**.
- Item row: `""`, line no, `"GG-NNN -"`, **description in its own column**, qty, unit, price, discount, amount, `""`, `""`, sales-order line ref.
- Salesperson codes are inconsistent (`03` and ` 3`) → normalise to two digits.
- Reconciliation targets: **168 invoices, 636 item lines, 88 codes, 29 customer names, 63 lines without amount, 15 invoices not yet collected, deposits 1 note**. The footer count (`รวม 168 ใบ`) is usable; the deposit footer is a single text cell (`ยอดที่ตัดใบรับมัดจำ <deposit> <before-deposit>`).
- Many lines are **services** (`77-xxx` roll-forming fees such as ค่ารีดลอน, `99-101` transport ค่าขนส่ง, `99-100` sets); unit `กิโลกรัม` also appears.
- Matching credit customers to cash customer codes needs a name-mapping table (open question); never guess.

### 7.3 Deposit receipts — `deposits.csv` (document prefix `AI`)

- Grouped **by customer**: a line `"  <name> /<code>"`, then deposit rows (`"",doc,date,salesperson,V,value,VAT,total,due date,outstanding,fully used?(Y/N),cash/transfer,cheque`), detail rows (`"",1,description,"",amount`), free-text summary lines (`ยอดทั้งหมด … บาท`, `มัดจำ …`, `ค้างชำระ …`, `ยอดรับมัดจำ …`), a `เอกสารที่ตัด:` block whose rows (`"",invoice no,date,date,amount`) link the deposit to the invoices that used it (`HS` and `IV`), and a customer subtotal `รวม <name> /<code>`.
- Footer: `รวมทั้งสิ้น 193 ใบ` with total value and outstanding amount — reconcile against it.
- 188 of the 193 `AI` deposit notes in cash sales match a link in this report with the same amount. `SR` deposit notes (79) are **not** in this report → ask the client what `SR` documents are.
- Deposits received before Dec 2025 can be used inside the period, so deposit totals and deduction totals differ — explain, do not force them equal.

### 7.4 Consequences

- 9 months of history: the recent 3-month method works; the seasonal method (24 months) and a long backtest are **not possible yet**.
- Cash and credit are separate channels: keep a `channel` field and let users view both or either (open question: combined by default?).
- Still missing: customer groups, stock data, dated commitments/incoming supply, what `SR` is, credit-customer codes.
- Forecast identity, units and service classification remain open (see §8).
- Synthetic fixtures in `tests/` must reproduce all three layouts **and** the Windows-874 encoding, with fake names and phone-free remarks.

## 8. Decisions and defaults (change only with the user)

Settled in Phase 0 (2026-09-16):

- **Data source:** the three Express CSV reports. `.xlsx` and SheetJS are **M8+**; the MVP has no runtime dependency.
- **History:** 9 complete months, Dec 2025 – Aug 2026. First predicted month: Sep 2026.
- **Predictive scope:** demand class (A6), repurchase and lapse (B1), attribute demand in metres (B3), observed best sellers (C1-lite). Everything else is M8+ (`prd.md` §11.1); ARIMA, linear trend and kNN were tested and rejected (§11.2).
- **Error:** WAPE is the headline; MAPE beside it, skipping zero-actual periods and reporting the count; range uses `k = 1`.
- **Methods:** MA3 is the default for B3; SES picks its constant per series from {0.1, 0.2, 0.3, 0.5, 0.7} by backtest error, 0.3 as fallback. SBC cut-offs 1.32 / 0.49, CV² on non-zero sizes, monthly periods, sparsity guard 6 periods / 3 non-zero.
- **Users:** management only, plus an optional local privacy lock. Salesperson and supervisor views, the tech-team role and its CEO-password rule are M8+ and move together. Daily sales entry and add product / customer are also M8+.
- **Tabs (7):** Overview, Predictions, Products, Sales team, Customers, Stock (hidden until stock data exists), Data & guide.
- Revenue views show cash, credit and combined; default = combined, labelled.
- Credit customers without a code are shown by name and flagged "unmapped" until a mapping exists.
- Free / no-price lines: quantity kept, `lineAmount = 0`, flagged.
- **Stock defaults** (review 7 days, buffer 7 days, excess > 90 days) are inherited from the prototype, carried into M8+ only, and labelled "pending client confirmation" wherever they appear.
- Forecast identity (product code + product type + unit) is an M8+ dependency; the MVP forecasts attributes, not SKUs.
- Language default Thai; theme default system; system fonts only.
- The ranked customer list is management-view only; CSV export allowed with a warning.
- GitHub Pages carries fake / anonymized data only, and is the primary delivery; `dist/index.html` is the offline single file and has no service worker.
- Counts from §7 may be committed. Money totals, customer names, phone numbers and remark text may not.

## 9. End-of-phase report template

```markdown
## Phase N — <name> (milestone Mx)
What changed: <files and one line each>
How to run: <commands>
Checks (exact output): <tests, console runChecks, browser checks>
Eco numbers: first-load KB, font KB, Lighthouse (if run)
Screens checked: 360 / 390 / 820 / 1180 / 1440 px × light / dark × TH / EN
Deviations from docs: <or "none">
Open questions for the client / instructor:
Draft progress.md entry: <ready to paste>
Explain-it-simply (Thai, 5–10 lines) for the viva:
Waiting for approval before Phase N+1.
```

## 10. Commands

```bash
node build.cjs                 # build dist/index.html (offline single file)
node --test tests/             # unit tests (Node 18+)
npx serve -l 8000              # or: python -m http.server 8000  → http://localhost:8000
```

Service workers only run on `http://localhost` or `https://`, not on a double-clicked file.
