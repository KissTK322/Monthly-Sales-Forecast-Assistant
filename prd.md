# Monthly Sales Forecast Assistant - Product Requirements Document

Status: Reviewed specification  
Owner: Tonkla - Titan  
Version: 1.3  
Last updated: 2026-09-16

## 1. What

Monthly Sales Forecast Assistant is a Thai/English decision-support dashboard for the management team of a domestic metal-roofing company. It combines sales, products, customer relationships, salesperson performance, and product attributes so management can review performance and prepare for next month.

It is a static, installable web application. Nothing is uploaded: the three Express CSV reports are read on the user's own device, in the browser, and the results are stored only on that device.

The available history is **9 complete months, December 2025 to August 2026**, and there is no stock data. The MVP therefore predicts only what that data supports: how each product series behaves over time, which repeat customers are due or overdue to buy, and next-month demand by product attribute. Per-SKU quantity forecasts, revenue projections, seasonal models, and replenishment quantities need history or stock data the company has not supplied yet; they are recorded in section 11 as M8+ work rather than promised here.

A working prototype exists as a standalone HTML file on a local device. Its verified calculations and interface ideas are reused; its data model is not. The application is delivered in two forms, both from the same source (architecture section 2): a hosted progressive web app that installs and runs offline, and a generated single-file `dist/index.html` for offline review without a server.

## 2. Why

The company currently exports separate text-style reports from Express and combines information manually. Pulling an individual report is quick, but entering detailed master data and combining several reports takes time. The current process makes it difficult to see relationships among products, customer groups, salespeople, invoice value, seasonality, and stock.

Poor replenishment decisions can leave stock sitting in the factory or cause shortages that delay customer orders. Stock movements can also differ from the recorded balance, so physical and Express stock are reconciled monthly.

### 2.1 Decision statements

The MVP supports three decisions, each answerable from 9 months of sales history alone:

| # | Decision | Supported by |
| --- | --- | --- |
| D1 | **Which repeat customers should the sales team follow up this month, and which have lapsed?** | FR18 (repurchase and lapse alerts) |
| D2 | **Which profiles, thicknesses, and colours should production prepare for next month?** | FR19 (attribute demand forecast) |
| D3 | **Which items should be ordered to demand rather than held in stock?** | FR17 (demand classification) |

### 2.2 Decision deferred to M8+

**Which products should management replenish for next month, in what quantity, based on confirmed stock, commitments, and supplier lead times?**

This was the original decision statement in version 1.2. It cannot be answered without stock snapshots, dated commitments, incoming supply, pack sizes, and per-item lead times, none of which the company has supplied. It remains the intended direction of the product and returns as M8+ work when that data arrives (section 11).

## 3. Who

The MVP has **one user group: management**. The client stated in the interview that the application is for the management team (เฉพาะทีมบริหาร). Building one view for one audience removes a whole class of access questions from the MVP, and the browser cannot enforce the others honestly anyway.

| User | In the MVP | Confirmed context | Primary decisions |
| --- | --- | --- | --- |
| CEO / management | **Yes** | Uses Windows; wants dashboard access on computer and phone; has full accounting access in Express | Overall sales direction, product demand, customer follow-up, salesperson performance |
| Sales supervisor | M8+ | Express access includes returns, stock, and product codes | Compare the team, customer groups, sales per invoice, and exceptions |
| Salesperson | M8+ | Has an official salesperson ID and limited sales access in Express | Review own sales and record or verify sales information in a future shared system |
| Stock / purchasing staff | M8+ | Input ownership still needs confirmation | Confirm physical stock, commitments, incoming deliveries, and supplier timing |

The MVP offers an optional local privacy lock on the management view. It is a privacy feature for a shared device, not authentication, and the interface says so.

The interview did not establish ages, exact technical skill levels, or a measured task-time baseline. These must not be invented. The requested access hierarchy is salesperson, sales supervisor, and management; it returns as M8+ work together with the tech-support role, and production permissions require confirmation before server development.

## 4. Requirement sources

1. **Client meeting, 2026-09:** supplied meeting transcript covering Express reporting, sales/customer/product relationships, salesperson IDs and access levels, next-month forecasting, monthly stock reconciliation, usual 1-2 day lead time, 30-40 day special-product lead time, and an agreed approximately one-week review cycle for this phase because the company has no fixed ordering cycle.
2. **Project-owner prototype reviews, Titan, 2026-09-15 to 2026-09-16:** Thai/English switching, inclusive date filters, selectable salesperson comparisons, clickable product/customer views, Top 5 products, daily charts and heatmap, average lines, CEO/salesperson views, local CEO lock, salesperson maintenance, dark mode, and interaction refinements.
3. **Three real Express CSV exports, December 2025 to August 2026:** cash sales, credit sales, and deposit receipts, described in section 7. They are printed-style reports exported to CSV, Windows-874 encoded, with Thai Buddhist Era dates. The counts are in section 7.2. All money totals stay in the team's private reconciliation notes and never appear in this repository.
4. **`vibe-coding-workshop.pdf`, slides 27-29, 35-40, and 54-56:** the six-document structure, PRD authority, milestone sequence, deployment, three-round user testing, and measurable success criteria. The workshop's Track A feature list is **not** a requirement of this product; see the instructor decision below.
5. **Phase-0 modelling study on the three Express CSV reports, 2026-09-16:** candidate predictive methods were tested locally against the 9 complete months of history. The results decide the MVP scope in section 8.2, the targets in section 12, and the M8+ list in section 11. The study ran on private client data outside the repository and has **not yet been reproduced by committed code or tests**; M4 and M5 must reproduce every number before the matching requirement is accepted.
6. **Client review answers, 2026-09-16:** platform requirements (installable offline app on iOS, Android, macOS, and Windows; responsive from 360 px; report upload from phones and tablets; Thai/English; light/dark/system theme; an eco budget), management-only MVP, combined cash and credit revenue by default, and the scope decisions recorded throughout this version.

**Instructor decision, 2026-09-16:** the team may design its own approach instead of following workshop Track A. Track A's six features (load history, month to date, month-end projection, direction signal, breakdown, accuracy log) are therefore not requirements. The workshop's method still applies: six consistent documents, small verifiable milestones, hand-checkable arithmetic, deployment, three test rounds, and measured results.

Where prototype-review feedback extends the meeting scope, it is identified above instead of being presented as interview evidence.

## 5. Functional requirements

| ID | User story / requirement | Status |
| --- | --- | --- |
| FR01 | As a user, I can switch Thai/English and light/dark/system theme while keeping the current view state, and both choices are remembered on this device | Extended in 1.3; default language Thai, default theme system |
| FR02 | As management, I can select inclusive From/To dates and filter reporting by salesperson, customer group, product group, and SKU | Done locally; not yet in repository |
| FR03 | As management, I can see revenue, distinct invoices/customers, average daily sales, and change versus the preceding equal-length period | Done locally; not yet in repository |
| FR04 | As management, I can read exact chart values by tap, pointer, or keyboard, and compare two selected dates or sales points | Reworded in 1.3; hover alone is not acceptable |
| FR05 | As management, I can compare salespeople and inspect revenue, invoice count, customer count, average invoice value, and leading product | Done locally; not yet in repository |
| FR06 | As management, I can inspect product groups and rank Top 5 products by revenue or by quantity within one unit | Done locally; not yet in repository |
| FR07 | As management, I can inspect customer-group sales, filter the Top 10 customer list by group/SKU/salesperson, and see connected salespeople | Done locally; not yet in repository |
| FR08 | As management, I can see **average sales per invoice by salesperson and by customer group** to identify where higher-value invoices occur | Partly done locally for salesperson; customer-group comparison must be completed |
| FR09 | As a planner, I can compare a 3-month moving average and single exponential smoothing for next-month quantity on a supported series | Replaces the seasonal baseline; seasonal needs 24 months (M8+) |
| FR10 | As a planner, I can inspect historical forecast error (WAPE and MAPE) and a clearly labelled low/base/high planning range | Method retained; validated on 9 months only |
| FR11 | As a planner, I can edit stock assumptions and review a pack-rounded replenishment suggestion using the agreed approximately 7-day review cycle | **Moved to M8+**; requires stock data the company has not supplied |
| FR12 | As a reviewer, I can save locally, download a JSON backup, and export a stock-plan CSV | Done locally; not yet in repository |
| FR13 | As management, I can import the three printed-style Express CSV reports without manually cleaning repeated headings, mixed invoice/item rows, or deposit-note rows | Planned; `.xlsx` import moved to M8+ |
| FR14 | As management, I can see reconciled invoice-net revenue separately from item-line revenue and understand deposit/discount/rounding differences | Planned; mapping and accounting rules require client confirmation |
| FR15 | As a planner, I can preserve a forecast issued before a month starts and compare it with the final actual after closing | Planned accuracy log |
| FR16 | As authorized users, I see information appropriate to salesperson, supervisor, or management access | **Moved to M8+** with the tech-support role; the MVP is management-only with an optional local privacy lock |
| FR22 | As management, I can install the app on iPhone, iPad, Android, macOS, and Windows and open it offline after the first visit, with per-platform install help because iOS offers no install prompt | Planned (PWA) |
| FR23 | As management, I am told when a new version is available and can reload into it | Planned (versioned service-worker cache) |
| FR24 | As management, I can use every view on a 360 px phone, on a tablet in portrait, landscape, and Split View, and on a desktop, without sideways page scrolling | Planned (responsive) |
| FR25 | As management, I can choose the three CSV reports from iOS Files, iCloud Drive, Google Drive, or Android Downloads, including a fallback picker with no file-type filter when the file appears greyed out | Planned (mobile upload) |
| FR26 | As management, I can export a reviewed list to CSV, and on an installed iOS app the export opens the share sheet | Planned |
| FR27 | As management, I can see which dataset is loaded, when it was imported, and clear all data held on this device | Planned |
| FR17 | As a planner, I can see a demand class for each product series (smooth, erratic, intermittent, lumpy, or too sparse) with its ADI and CV-squared values and plain-language advice, so I know which items to order to demand instead of holding | Planned (A6); descriptive, no forecast claim |
| FR18 | As a salesperson or manager, I can see repeat customers ranked by the chance they buy in the next 30 days, each marked expected, overdue, or lapsed, from a simple gap rule and a logistic model whose coefficients are shown on screen | Planned (B1); cash-channel customers with at least 3 invoices |
| FR19 | As a planner, I can see next-month demand in metres by product attribute (profile, thickness, colour) parsed from item descriptions, with the method, the backtest error, and the number of unmapped raw values shown | Planned (B3); colour requires an approved normalisation table |
| FR20 | As management, I can see which products sold best in each month of the recorded history, labelled as observed history and not a seasonal pattern, and optionally record the sales team's own monthly rating beside it without it changing any computed figure | Planned (C1-lite); seasonal claims need 24 months |
| FR21 | As a reviewer, I can see for every predicted figure its method, input window, data cutoff, unit, measured error, and the reason a series produced no prediction | Planned; applies to FR09, FR10, FR17, FR18, FR19 |

## 6. Main user flow

1. Open the application, installed or in a browser, and identify whether the displayed data is sample, imported, or verified.
2. Import the Express CSV reports or a documented interchange file from Data & guide. The system previews the report type, date range, row classification, counts, totals, and unresolved rows before accepting it.
3. Confirm the import reconciliation: invoice count, pre-deposit total, deposit deductions, invoice-net total, item-line total, free/no-price lines, and unresolved rows.
4. Choose language, date range, and optional salesperson, customer-group, product-group, or SKU filters.
5. Review Overview, Products, Sales team, and Customers, including average value per invoice.
6. Review the demand class of each product series and the advice attached to it, to decide what is worth holding and what is ordered to demand.
7. Review next-month demand by profile, thickness, and colour, with the measured error of each series and the count of raw values not yet mapped.
8. Review the repurchase list: customers expected to buy, customers overdue, and customers now lapsed, with the model's inputs and coefficients visible.
9. Review the observed monthly best sellers, labelled as history, and optionally record the sales team's monthly rating beside them.
10. Export the reviewed lists. When forecast logging is implemented, save the issued figures and later attach the closed-month actual.

The seven tabs that carry this flow are listed in `architecture.md` section 3.1.

## 7. Express CSV import plan

The company exports three printed-style reports, not clean tables. All three are Windows-874 (TIS-620) encoded with CRLF line endings, carry a company header, repeated page headings, rule lines, footers, a remark block, and an end marker, and use Thai Buddhist Era dates. The adapter reuses the proven row-classification approach from the local Sales Compass parser and adapts its output to this product's schema.

| Report | File | Prefix | Period |
| --- | --- | --- | --- |
| Cash sales (รายงานขายเงินสด เรียงตามวันที่) | `cash-sales.csv` | `HS` | Dec 2025 - Aug 2026 |
| Credit sales (รายงานใบกำกับสินค้า เรียงตามวันที่) | `credit-sales.csv` | `IV` | Dec 2025 - Aug 2026 |
| Deposit receipts (รายงานใบรับมัดจำ แยกตามลูกค้า) | `deposits.csv` | `AI` | Dec 2025 - Aug 2026 |

The three layouts differ and need three adapters. Cash-sales invoice rows carry a customer code; credit-sales invoice rows carry a customer name only, plus a due date and a collected flag, and put the item description in its own column. Deposit receipts are grouped by customer and contain a `เอกสารที่ตัด:` block linking each deposit to the invoices that used it.

### 7.1 Import stages

1. Decode the file as Windows-874 in the browser; do not upload it. Accept UTF-8 only when a byte-order mark is present. Never decode as UTF-8 by default: Thai text becomes unrecoverable.
2. Parse line by line. Some rows have unbalanced quotes; a malformed line is reported, never allowed to crash or silently shift the columns of later rows.
3. Convert Thai Buddhist Era years to Gregorian dates (`2569 -> 2026`) while retaining the original source value for audit/debugging.
4. Classify rows as report heading, repeated page heading, invoice header, item line, deposit/adjustment note, subtotal/footer, blank, or unresolved.
5. Carry the active invoice header to its item lines; never infer a salesperson from quantity or another unrelated numeric column.
6. Parse product code and full description separately. Preserve description attributes such as product type, colour, thickness, length, and sheet count until the forecast identity rule is approved.
7. Preserve the item-line amount independently from invoice gross/net totals. Parse deposit deductions as invoice adjustments rather than product sales.
8. Keep free/no-price lines with `lineAmount = 0` and a quality flag so they contribute to quantity analysis but not revenue.
9. Mark service lines as non-stock candidates; exclude them from stock analysis only after a documented classification rule is approved. Groups `77-xxx` (roll-forming fees), `88-101` (PU foam), and `99-xxx` (transport, sets, free items) are the known cases.
10. Normalize salesperson codes to two digits (`3` and ` 3` become `03`). Never infer a missing salesperson; a blank one stays blank and is counted.
11. Link deposit notes to deposit receipts by document number, and record both the link and any unmatched note.
12. Show a reconciliation preview and block acceptance when required counts or row relationships fail agreed tolerances. A failed import never replaces the last valid dataset.

### 7.2 Minimum reconciliation output

Counts only. Money totals are reconciled against each report footer in the application and in the team's private notes, and are never written into this repository.

**Cash sales** (`HS`)

| Check | Target |
| --- | ---: |
| Invoices | 6,088 |
| Item lines | 30,942 |
| Product codes | 626 in 19 groups |
| Customer codes | 1,471 |
| Salesperson codes | 5 (01, 03, 04, 06, 08), plus 11 invoices with a blank salesperson |
| Units | 27, plus 34 lines with a blank unit |
| Lines without recorded price/amount | 4,910 |
| Invoices with an invoice-level discount | 183 |
| Invoices with VAT | 6 |
| Invoices with deposit notes | 272 |
| Cancelled documents | 0 in this export |
| Goods, VAT, total, deposit deductions, before-deposit total | Parsed sums match the footer exactly |

The cash-sales footer prints its invoice count as `***` because the field overflows. **That count cannot be used.** Reconciliation for this report is by totals and by the item-line, product, and customer counts above.

**Credit sales** (`IV`)

| Check | Target |
| --- | ---: |
| Invoices | 168, matching the footer `รวม 168 ใบ` |
| Item lines | 636 |
| Product codes | 88 |
| Customer names | 29 (no customer codes in this report) |
| Lines without amount | 63 |
| Invoices not yet collected | 15 |
| Deposit notes | 1 |

**Deposit receipts** (`AI`)

| Check | Target |
| --- | ---: |
| Deposit notes | 193, matching the footer `รวมทั้งสิ้น 193 ใบ` |
| Notes matched to a cash-sales deduction with the same amount | 188 of 193 |
| `SR` deposit notes in cash sales, absent from this report | 79 |

**Known differences that must stay visible, not be hidden or forced to zero:**

- Cash-sales invoice goods and total are stated **after** deposit deductions: `total + deposits = before-deposit total`.
- For **41 invoices**, `sum(lines) - discount - deposits` does not equal the stated goods value. Six of those carry VAT-inclusive prices; the rest are small adjustments. The difference is displayed per invoice.
- Deposits received before December 2025 may be used inside the period, so total deposits received and total deposits deducted legitimately differ. They are reported side by side and never reconciled into each other.
- What an `SR` document is has not been established. Until the client answers, `SR` deductions are parsed, counted, and shown as unmatched rather than guessed at.

The July 2026 part of the cash report equals the older `ExcelAssignment2.xlsx` (683 invoices, 3,283 item lines). That file is a subset, not a separate source, and is not used.

## 8. Functional rules and safeguards

### Reporting

- Reporting dates include both endpoints.
- Revenue KPIs must state whether they use `invoiceNetAmount`, `invoiceGrossAmount`, or `lineAmount`; these measures must not be silently mixed.
- Average sales per invoice = selected invoice-level net revenue / distinct selected invoices. If a product/SKU filter is active, label a line-based ratio clearly rather than calling it whole-invoice average.
- Quantity rankings compare only compatible units. Metres, pieces, sets, trips, and other units are never added together without an approved conversion.
- Free/no-price product lines count toward quantity only and remain visible as data-quality exceptions.
- Returns, cancellations, credit notes, deposits, discounts, and tax treatment require explicit mappings.
- Revenue views default to **combined cash and credit**, labelled as combined, with toggles for cash only and credit only. The channel in use is stated on every figure.
- Credit customers have no code in the source. They are shown by name and flagged unmapped until a client-confirmed name-to-code mapping exists, and an unmapped customer is never merged with a cash customer by name similarity.

### Safeguards

- All text taken from an imported file is escaped before it is inserted into the page.
- Cells beginning with `=`, `+`, `-`, or `@` are prefixed on CSV export so a spreadsheet cannot execute them.
- Free-text remark rows in the source reports may contain personal data such as names and phone numbers. They are never displayed, exported, logged, or used as a feature input.
- The local privacy lock is not authentication. The interface states this wherever the lock appears.
- GitHub Pages carries fake or anonymized data only. No real export, browser backup, or client-identifying record is ever published.

### Forecasting: general rules

- Predict the month after the latest confirmed complete month.
- Backtests must use only information available before each tested period. No method may read a value dated on or after its own cutoff.
- Missing reports are not zero sales. A verified complete month with no matching sales may be zero.
- The latest confirmed complete month is **August 2026**; the history is the 9 complete months from December 2025. The first predicted month is September 2026.
- Every predicted figure carries its method, input window, data cutoff, unit, and measured error. A series that cannot be predicted shows the reason, never a substituted number.
- **WAPE is the headline error measure.** MAPE is reported beside it for the workshop's measurement requirement, skips periods with zero actual demand, and always shows how many periods it skipped.
- Planning range: `low = max(0, base - MAE * k)` and `high = base + MAE * k`, with `k = 1`. The value of `k` is shown beside the range.
- Quantities are aggregated only within one unit. The attribute forecast (8.2.3) covers metres; other units are listed separately and never added.
- Forecast identity must be approved before any per-SKU forecasting, because one Express code may represent multiple descriptions and units. Candidate key: product code + normalized product type/description variant + unit. This is an M8+ dependency, not an MVP blocker, because the MVP forecasts attributes rather than SKUs.

### 8.2 Predictive scope of the MVP

Four methods are in scope. Each was chosen because 9 months of sales history without stock data is enough to support it, and each is arithmetic a reviewer can check by hand except where stated.

#### 8.2.1 Demand classification (A6)

- Classify each product series by the Syntetos-Boylan rule, using average inter-demand interval (ADI) and the squared coefficient of variation of non-zero demand sizes (CV-squared).
- ADI = number of periods in the window / number of periods with demand. CV-squared = (standard deviation of non-zero period quantities / mean of non-zero period quantities) squared.
- Cut-offs: ADI 1.32 and CV-squared 0.49.

  | Class | Condition | Advice shown |
  | --- | --- | --- |
  | Smooth | ADI < 1.32 and CV-squared < 0.49 | Regular demand; a moving average is meaningful |
  | Erratic | ADI < 1.32 and CV-squared >= 0.49 | Sells often, size varies; plan by value, not by quantity |
  | Intermittent | ADI >= 1.32 and CV-squared < 0.49 | Order to demand or hold a small minimum |
  | Lumpy | ADI >= 1.32 and CV-squared >= 0.49 | Order to demand only; do not forecast the quantity |
  | Too sparse | Below the minimum-observation rule | Not enough history to classify |

- The period is the calendar month by default and is configurable to the week. Nine monthly periods is a thin basis for ADI; the period used is shown beside every class.
- Minimum-observation rule: a series needs at least 6 complete periods in the window and at least 3 periods with demand, otherwise it is classified as too sparse.
- The Phase-0 study used a weaker guard of at least 2 periods with demand. The application uses 3, so its class counts will not match the study's, and the study's counts must not be quoted as this application's output. A two-observation CV-squared is not a measurement worth acting on.
- The class is descriptive. It states how a series has behaved; it does not predict a quantity and must never be presented as a forecast.

#### 8.2.2 Customer repurchase and lapse (B1)

- Eligible customers: at least 3 invoices in the history and a stable customer code. Credit-sales customers are eligible only once a name-to-code mapping exists (section 13).
- Usual gap = the median number of days between that customer's consecutive invoices. Recency = days since the last invoice.
- Rule states, from the ratio recency / usual gap:

  | State | Condition |
  | --- | --- |
  | Expected to buy | ratio <= 1.5 |
  | Overdue | 1.5 < ratio <= 2.0 |
  | Lapsed | ratio > 2.0 |

- The client specified the 1.5 and 2.0 thresholds. The band between them is labelled "overdue" as a team assumption pending client confirmation; both thresholds are editable and shown.
- Logistic regression, trained in the browser on the customer's own history, predicts purchase within the next 30 days. Features: log recency, log usual gap, log invoice count, log revenue, and recency / usual gap. The fitted coefficients, the standardisation values, the training cutoff, and the number of training rows are shown on screen.
- The model is the only non-hand-checkable method in the MVP. It is therefore shown beside the rule, never instead of it, and its coefficients are exported with any list that uses it.
- Ranking output is a follow-up list, not a promise about any individual customer. The interface must state that a lapse flag is a prompt to call, not a conclusion.
- The ranked customer list is visible in the management view only. CSV export is allowed and carries a warning that the file names customers and leaves the device unprotected. The published GitHub Pages build shows this feature on fake data only.
- Customer remark text from the source reports is never read into this feature, because remark rows may contain personal data such as phone numbers.

#### 8.2.3 Attribute demand forecast (B3)

- Parse profile, thickness, and colour from the item description, aggregate monthly quantity in metres per attribute value, and forecast the next month.
- Methods: 3-month moving average (MA3) and single exponential smoothing (SES). **MA3 is the default**, because it beat SES on this history in the Phase-0 study. Both are shown with their backtest error so the reviewer can see which fits a series better; neither is hidden.
- SES smoothing constant: chosen per series from {0.1, 0.2, 0.3, 0.5, 0.7} by lowest backtest error, with 0.3 as the fallback when the choice cannot be made. The chosen value is shown beside the figure, and the selection uses only pre-cutoff data like any other fitted parameter.
- Error is reported as WAPE (headline) and MAPE. MAPE skips periods with zero actual demand and shows how many periods it skipped.
- A raw attribute value with no approved mapping is counted and shown as unmapped. It is never merged into a neighbouring value by guesswork.
- Colour is the weakest series and must be labelled as such wherever it appears.

#### 8.2.4 Observed monthly best sellers (C1-lite)

- Tables of the best-selling products for each month of the recorded history, computed from actual data.
- Every such table carries the label "observed history, not a seasonal pattern". Seasonal claims require at least 24 complete months.
- An optional sales-team monthly rating (Delphi-lite) may be recorded beside the observed table: each rater enters an independent rating, the app shows the individual ratings and their spread, and the ratings are stored separately from imported data. A rating never changes a computed figure.

### Replenishment (M8+)

Replenishment is not in the MVP. It returns when the company supplies stock snapshots, dated commitments, incoming supply, pack sizes, and per-item lead times. The rules agreed in version 1.2 are preserved for that work:

- Use the approximately 7-day review interval agreed in the client meeting; keep it editable because the company has no fixed ordering cycle.
- Preserve 1-2 day ordinary lead times and 30-40 day special-product lead times by item.
- Use dated commitments and incoming deliveries so changing the horizon does not reinterpret a fixed undated quantity.
- Require a stock snapshot reconciled to the latest complete month before displaying an actionable suggestion.
- Suggestions support review only; no purchase order is sent automatically.

Until then the MVP answers the neighbouring question it can answer: which items behave as order-to-demand items (8.2.1).

## 9. Non-functional requirements

| ID | Requirement | Verification |
| --- | --- | --- |
| NFR01 | Thai and English labels; Gregorian stored dates; Thai source dates converted explicitly | Language and import fixtures |
| NFR02 | Usable from 360 px phones through tablets in portrait, landscape, and Split View to desktop, with no page-level sideways scrolling, tap targets at least 44 px, safe-area insets honoured, and touch inputs at least 16 px so iOS does not zoom | Browser checks at 360, 390, 820, 1180, and 1440 px, plus a client device trial |
| NFR03 | Keyboard-accessible controls, visible focus, chart/heatmap values available without pointer-only use | Keyboard walkthrough and accessibility review |
| NFR04 | No imported company data is transmitted anywhere. No backend, no analytics, no third-party requests at runtime | Network-request inspection with the app in use |
| NFR05 | Invalid imports never replace the last valid dataset | Negative import fixtures |
| NFR06 | Totals are traceable to source rows and reconciliation categories | Section 7.2 checks and sampled row audit |
| NFR07 | Forecast arithmetic is deterministic and explainable by hand, except the repurchase model, which is deterministic and inspectable instead | Pure-function tests and worked examples |
| NFR08 | Installable and usable offline after the first visit on iOS/iPadOS Safari, Android Chrome, macOS Safari and Chrome, and Windows Edge and Chrome; also openable as a single file without installation or paid services | Per-platform install and airplane-mode checks; offline check on `dist/index.html` |
| NFR09 | Production access controls must be enforced on the server; browser-only hiding is not security | Architecture/security review before deployment |
| NFR10 | Performance tested at full data scale and across the whole history | Volume fixture at or above 6,088 invoices and 30,942 item lines over 9 months |
| NFR11 | Source files decode as Windows-874; UTF-8 is accepted only with a byte-order mark; a malformed line is reported, never fatal | Encoding fixtures in both encodings and a malformed-line fixture |
| NFR12 | Importing keeps the interface responsive and shows progress | Import runs in a Web Worker; timed check at full scale |
| NFR13 | Datasets, import batches, and forecast records persist in IndexedDB; only small settings use localStorage; a JSON backup can be downloaded and restored, and v1 prototype backups migrate to v2 | Storage tests, migration fixture, restore check |
| NFR14 | First load at most 250 KB uncompressed for HTML, CSS, JS, and fonts; fonts 0 KB by using system fonts; repeat visits transfer about 0 KB | Measured and recorded every phase |
| NFR15 | No polling, no timers in hidden tabs, charts rendered only for the visible tab, `prefers-reduced-motion` honoured, dark theme available | Runtime inspection each phase |
| NFR16 | WCAG AA contrast in both light and dark themes, from one set of CSS variables | Contrast check on both themes |

## 10. Tech constraints

### Must use

- A static site: HTML, CSS, and plain JavaScript, served from the repository root so GitHub Pages can host it.
- Browser-side processing for all client files; the import runs in a Web Worker.
- Explainable JavaScript calculations separated from interface rendering.
- Stable source IDs and explicit joins among invoices, lines, products, customers, and salespeople.
- Versioned data contracts and tests for import reconciliation and forecasting rules.
- CSV import and paste-row support, plus the three Express CSV adapters required by the client data.
- System fonts, so no font bytes are downloaded and Thai renders natively on every target platform.
- Relative paths everywhere, because the site is served from a repository sub-path.

### Must not use

- A framework, a CDN, an analytics service, or any backend. A server needs a change to this document first.
- Any runtime dependency. The MVP ships with none; `.xlsx` import and its SheetJS dependency are M8+ (section 11.1).
- Paid APIs or services.
- Automatic supplier ordering or production scheduling.
- Client secrets or real records committed to the public repository.
- Browser-only role controls as a production security boundary.
- Silent conversion of missing data to zero.
- Forecast claims of 10-15% accuracy before evaluation on untouched client history.

## 11. Out of scope for the current phase

- Direct connection to the Express database.
- Automatic import of every possible Excel layout.
- Secure multi-user deployment and individual production accounts.
- Supplier API integration or automatic purchase orders.
- Production scheduling, bills of materials, or capacity planning.
- Multi-location inventory.
- Automatic conversion among incompatible units.
- Guaranteed forecast accuracy.
- Final accounting treatment of returns, tax, deposits, discounts, and credit sales before client confirmation.

### 11.1 Deferred to M8+ because the data is not available yet

| Item | Blocked by |
| --- | --- |
| A1 month-end projection for the running month | Needs a working-day calendar and agreement that a part-month projection is wanted |
| A2 next-month revenue forecast | 9 months is too short for a revenue series with this variance |
| A3 revenue forecast by customer group | No confirmed customer-group source |
| A4 per-SKU quantity forecast | Forecast identity unapproved; per-SKU series too sparse over 9 months |
| A5 reorder suggestions and quantities | No stock snapshots, commitments, incoming supply, pack sizes, or per-item lead times |
| `.xlsx` / `.xls` / `.xlsm` import and its SheetJS dependency (about 950 KB) | Client decision; the three CSV reports are the live source and the old July `.xlsx` is a subset of the cash CSV |
| Salesperson and supervisor views, the tech-support role, and its CEO-password rule | Client decision; they move together, and a browser cannot enforce them honestly |
| Prototype features held back: daily sales entry, add product, add customer | Client decision |
| Seasonal forecasting (same month last year, trend-adjusted) | Requires at least 24 complete months |
| Econometric models with external drivers | No external series agreed or available |
| LightGBM, gradient boosting, neural networks | Runtime dependency ban; training data far too small; not explainable at the viva |

### 11.2 Tested and rejected for now

Tested in the Phase-0 modelling study (section 4, source 5) and rejected on the evidence:

| Method | Why rejected |
| --- | --- |
| ARIMA | 9 monthly observations cannot identify or validate the model; it produced no usable improvement over a moving average |
| Linear trend | Fits the slope of a short window and extrapolates it; unstable and misleading on this history |
| k-nearest neighbours | Too few comparable periods for neighbours to mean anything |

These are recorded so the same ground is not covered twice. They can be revisited when the history is long enough.

## 12. Success criteria

| Criterion | Baseline and target | Evidence needed |
| --- | --- | --- |
| Import correctness | Every count in section 7.2 reproduced exactly, and every footer total matched within the approved rounding tolerance, for all three reports | Automated fixture plus sampled source-row audit |
| Manual reporting effort | Baseline not yet measured: client currently pulls Express reports one by one and combines them; target is a documented reduction after the same task is timed before and after | Observe and time at least 3 comparable reporting sessions |
| Review-to-plan usability | Baseline not yet measured; target agreed after first moderated trial | Completion time, errors, and confusion notes from 3 trials |
| Forecast accuracy | See the method targets in 12.1 | Backtests reproduced by committed tests on the client history |
| Forecast honesty | 100% of displayed predictions show method, cutoff, unit, range, and error availability; 100% of unpredictable series show a reason instead of a number | UI inspection and automated checks |
| Stock safety | No replenishment suggestion is displayed at all while stock data is absent (M8+) | Negative fixtures and CSV checks |
| User task success | Baseline established in R1; target above 80% of tasks completed without help by R3 | R1-R3 observation sheets |
| Time to decision | Baseline is the timed current Express-report workflow; target is a documented reduction for the same decisions | Stopwatch timing for current method and app |
| Voluntary use | Baseline zero before pilot; target is measured, not assumed | Count unprompted openings during the two-week R3 period |
| Device/language usability | No blocking overflow or error at 360, 390, 820, 1180, and 1440 px, in light and dark, in Thai and English | Automated checks plus client device trial |
| Installability and offline use | Installs and opens offline on all four target platforms; a new version is offered, not forced | Per-platform install and airplane-mode checks |
| Eco budget | First load at most 250 KB uncompressed, 0 KB of fonts, about 0 KB on repeat visits | Measured and recorded in `progress.md` every phase |

### 12.1 Method targets from the Phase-0 modelling study

The percentages below are the results the Phase-0 study obtained on the client history (section 4, source 5). They are recorded as the acceptance targets for M4 and M5: a committed test must reproduce a figure inside each stated range before the matching requirement is accepted.

**They have not yet been reproduced from committed code in this repository. Until M4 and M5 run, they are reported results, not verified ones, and no screen or report may present them as measured performance of this application.**

| Requirement | Measure | Target range |
| --- | ---: | ---: |
| FR18 repurchase | Base rate of purchase in the 30-day window | 28-33% |
| FR18 repurchase | Precision of the simple gap rule | 42-47% |
| FR18 repurchase | Logistic model AUC | 0.78-0.81 |
| FR18 repurchase | Precision within the top 100 ranked customers | 59-74% |
| FR18 lapse flag | Customers flagged lapsed who bought anyway (lower is better) | 15-18% |
| FR19 attribute forecast | WAPE by profile | about 18% |
| FR19 attribute forecast | WAPE by thickness | about 21% |
| FR19 attribute forecast | WAPE by colour | about 32% |

Backtest protocol: two cutoffs, July and August 2026, each evaluated over the following 30 days for FR18 and the following complete month for FR19, using only data dated before the cutoff.

**Scope of the FR19 figures.** They are not whole-report errors. Each is measured on the **12 largest values** of that attribute, in **metres only**, **excluding product groups 77, 88, and 99** (roll-forming fees, PU foam, transport, sets, and free items). Those 12 values cover **89% of metres for profile, 100% for thickness, and 61% for colour**. Colour therefore has both the worst error and the worst coverage, and the interface must show the covered share beside the error so a 32% figure on 61% of metres is never read as a 32% figure on everything. The application reports the same three numbers under the same restriction, or it reports different numbers and says so.

The client's stated 10-15% tolerance (section 4, source 1) is not met by any series here except, at best, the profile series. That gap is reported to the client rather than hidden, and it is the reason revenue and per-SKU forecasting were deferred instead of shipped.

## 13. Open questions for the client

One numbered list, ordered by how much it blocks. Q1 to Q4 are data requests; the rest are decisions. Nothing here is guessed at in the meantime: each item names what the application does while the answer is missing.

### Data the client must supply

1. **15 further months of the same three reports** (September 2024 to November 2025), giving 24 complete months. This single delivery unlocks seasonal forecasting, per-SKU series, revenue and month-end projection, customer-group revenue, and a real backtest. It is the highest-value missing item by a wide margin. *Meanwhile:* those features stay in section 11.1 and the interface does not offer them.
2. **Stock data:** stock snapshots with their count dates, dated commitments, incoming supply, pack sizes, and per-item lead times. *Meanwhile:* no replenishment screen exists and the Stock tab stays hidden.
3. **Colour normalisation table.** The descriptions contain about 530 raw colour variants. Who confirms the mapping to an approved colour list, and in what form? *Meanwhile:* colour demand shows its unmapped count and its 61% coverage beside the figure.
4. **Confirmed customer groups.** The cash-sales export does not contain them. *Meanwhile:* customer-group views are not built.

### Decisions about the data

5. Are the parsed **profile and thickness** values correct, and is there an official list to check them against? A parsed attribute the client does not recognise is worse than no attribute.
6. What is an **`SR` document**? 79 `SR` deposit deductions appear in cash sales and in no other report. *Meanwhile:* they are parsed, counted, and shown as unmatched.
7. **Credit-customer codes.** Credit sales carry a customer name only. Can the client supply a name-to-code mapping? *Meanwhile:* credit customers are shown by name, flagged unmapped, and never merged with cash customers by name similarity.
8. Which **revenue measure** drives each KPI: item-line amount, invoice total before deposits, or invoice net after deposits?
9. How are **credit notes, returns, cancellations, discounts, tax, rounding, and deposits** represented? In particular, how should the 41 invoices whose lines do not sum to the stated goods value be classified?
10. Which of the **27 units** are compatible, and which product codes legitimately use more than one unit?
11. Should **free/no-price lines** (4,910 of them) affect quantity analysis, and which service groups must be excluded from it?
12. What is the approved **forecast identity** for a product code with multiple descriptions or units? *Meanwhile:* the MVP forecasts attributes, not SKUs, so this blocks only M8+ work.

### Decisions about the predictions

13. Is **"overdue"** the right label for the band between 1.5 and 2.0 usual gaps, and are those two thresholds right for this business?
14. Is **30 days** the right horizon for the repurchase prediction, given the 1-2 day ordinary lead time and no fixed ordering cycle?
15. Should the demand class be computed on **monthly or weekly** periods? Monthly matches the decision cycle but gives only 9 observations per series.
16. Is the optional **Delphi-lite monthly rating** wanted at all, and if so, who rates and on what scale?

### Decisions about roles and process

17. Which roles may **import data, view company-wide information, and export results** when roles return in M8+? The repurchase list ranks named customers, so this question applies to it directly.
18. Can the team **measure the current Express-report combining time** before the pilot, so a meaningful time-saving target can be set? Without it, the time-saving success criterion has no baseline.

### Answered in this version

| Was | Answer |
| --- | --- |
| How much history is available? | 9 complete months, December 2025 to August 2026 |
| Is there a credit-sales report, and are channels combined? | Yes; combined by default, labelled, with toggles (section 8) |
| Does the instructor require workshop Track A? | No; the team may design its own approach (section 4) |
| Is `.xlsx` import required? | No; CSV is the source and `.xlsx` moves to M8+ |
| Who uses the MVP? | Management only, with an optional local privacy lock (section 3) |