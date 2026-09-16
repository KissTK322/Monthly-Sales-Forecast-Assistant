# Architecture: Monthly Sales Forecast Assistant

PRD baseline: 1.3 | 2026-09-16

## 1. High-level flow

```text
Three Express CSV reports (Windows-874) / CSV-paste / versioned JSON backup
  -> local file reader, decoded on the device, parsed in a Web Worker
  -> row classifier and field normalizer
  -> reconciliation preview and unresolved-row report
  -> validated canonical dataset
       -> reporting filters -> management views
       -> closed monthly series per product      -> demand classification (A6)
       -> customer invoice intervals             -> repurchase / lapse scores (B1)
       -> parsed description attributes, monthly -> attribute demand forecast (B3)
       -> closed monthly product history         -> observed best sellers (C1-lite)
       -> local save / backup / reviewed CSV export
```

Each of the four predictive branches reads the same validated canonical dataset and writes nothing back to it. A branch that cannot run on a given series returns a stated reason, never a substituted number.

The replenishment branch of version 1.2 (`reconciled stock + dated supply/demand -> replenishment review`) is removed from this flow. It has no inputs: the company has supplied no stock data. It returns as M8+ work; see PRD section 11.1.

The current prototype performs calculations in one browser and uses fictional seed or compatible JSON. The Express adapter, accuracy log, and production server are planned components.

## 2. Technology decisions

| Concern | Decision | Reason / boundary |
| --- | --- | --- |
| Primary distribution | Hosted progressive web app on GitHub Pages | Installs on iOS, Android, macOS, and Windows; opens offline after the first visit; a service worker only runs over `http://localhost` or `https://` |
| Secondary distribution | Generated single file `dist/index.html`, no service worker | Opens from a folder with no server at all, for review on a machine that cannot or should not install anything. The two are the same source, not two products |
| Editable source | HTML, CSS, JavaScript, packaging script | Keeps logic testable while producing one end-user file |
| Express import | Three CSV adapters plus a deterministic row classifier, decoded with `TextDecoder('windows-874')` | The real sources are three printed-style reports exported to CSV, each with its own layout, none of them a clean table |
| Import execution | Web Worker with progress reporting | 30,942 item lines must not freeze the interface on a phone |
| Fonts | System fonts only | 0 KB downloaded, and Thai renders natively on every target platform |
| Storage | IndexedDB for datasets, import batches, and forecast records; localStorage for language and theme only | Datasets are far too large for localStorage, and a quota failure there is silent data loss |
| Icons | Hand-made PNG set, including maskable and apple-touch | Android masks icons and iOS ignores the manifest icons |
| Calculations | Pure JavaScript functions | Explainable and hand-testable |
| Demand classification | Syntetos-Boylan ADI / CV-squared, computed in `engine.js` | Two ratios and two cut-offs; checkable on paper |
| Attribute forecasting | MA3 and SES over monthly attribute series | Arithmetic a reviewer can reproduce in a spreadsheet |
| Repurchase model | Logistic regression implemented in plain JavaScript, no library | The eco budget and dependency ban rule out a ML package; 5 features and about 1,500 rows fit comfortably in the browser |
| Model transparency | Fitted coefficients, standardisation values, cutoff, and training-row count are part of the model record and rendered on screen | The one method a reviewer cannot redo by hand must be inspectable instead |
| Prototype persistence | Browser storage plus downloaded JSON backup | Single-device review only |
| Production identity | Future authenticated server roles | Browser-only controls cannot protect company data |

The editable files are intentionally separated so calculation and import logic can be tested without the interface. `build.cjs` then produces `dist/index.html` for offline review. This differs from a one-file authoring prompt, but preserves a single-file deliverable while keeping maintainable source and automated tests.

`dist/index.html` deliberately has **no** service worker and no install path. A service worker cannot be registered from `file://`, so inlining one would produce a file that looks installable and is not. The single file is for reading the app offline; the hosted app is for using it.

## 3. Repository layout

```text
/
  prd.md  AGENTS.md  architecture.md  schema.md
  implementation-plan.md  progress.md  README.md  CLAUDE.md
  index.html  manifest.webmanifest  sw.js  .nojekyll
  css/styles.css
  js/app.js  js/i18n.js  js/theme.js  js/pwa.js
  js/engine.js  js/model.js  js/storage.js
  js/import-express.js  js/import-csv.js  js/import-worker.js
  js/views/*.js
  icons/          icon-192.png, icon-512.png, icon-maskable-512.png,
                  apple-touch-icon.png, favicon-32.png
  tests/          unit tests and synthetic fixtures
  build.cjs       dist/index.html (generated)
```

`index.html` and `sw.js` sit at the repository root because GitHub Pages serves from the root and a service worker can only control pages at or below its own path. Every path in the application is relative, because the site is served from `/Monthly-Sales-Forecast-Assistant/` and an absolute path would resolve to the wrong origin root. `.nojekyll` stops GitHub Pages from reinterpreting the files.

There is no `js/vendor/` directory. The MVP has no runtime dependency; `.xlsx` import and SheetJS are M8+ work (PRD 11.1).

Application source and tests must be committed. A ZIP is only a convenience artifact, never the source of record.

### 3.1 Navigation

Seven tabs, in this order:

| # | Tab | Contains |
| --- | --- | --- |
| 1 | Overview | Revenue, invoices, customers, averages, period comparison, heatmap |
| 2 | Predictions | Demand classes (A6), attribute forecast (B3), repurchase and lapse (B1), observed best sellers (C1-lite) |
| 3 | Products | Product and group rankings, Top 5 by revenue or by compatible quantity |
| 4 | Sales team | Salesperson comparison, average per invoice, leading product |
| 5 | Customers | Customer and group analysis, Top 10, connected salespeople |
| 6 | Stock | M8+ placeholder, **hidden** until stock data exists |
| 7 | Data & guide | Import the three CSV reports, reconciliation preview, backup and restore, export, install help, device data, method explanations |

Six tabs are visible in the MVP. The Stock tab is defined here so that its place in the order is fixed now and adding it later does not renumber the others; it is not rendered while no stock dataset exists, because a permanently empty tab teaches users to ignore a tab.

One judgement call worth recording: the repurchase list (B1) is customer data but lives under **Predictions**, beside the other predicted outputs, so that everything carrying a method and an error sits together and nothing predicted hides inside a descriptive tab. Customers links across to it.

## 4. Express adapter boundary

`import-express.js` holds three adapters, one per report, over one shared row classifier. Each classifies repeated headings, invoice headers, item lines, adjustment/deposit rows, totals, blank rows, and unresolved rows; converts Buddhist Era dates; carries verified invoice context to its lines; preserves source line numbers; and outputs invoice, line, adjustment, and deposit records. The existing local Sales Compass row-classification logic is a reusable reference, but the canonical output must follow `schema.md` and PRD 1.3.

Decoding happens before classification: the bytes are read with `TextDecoder('windows-874')`, and UTF-8 is used only when a byte-order mark is present. This is a one-way door. Decoding Thai text as UTF-8 by mistake produces replacement characters that no later step can undo, so the encoding is decided once, at the boundary, and recorded on the import batch.

The three layouts differ enough that sharing more than the classifier would cost more than it saves: the cash report has a customer code, the credit report has a name, a due date, a collected flag, and its description in a separate column, and the deposit report is grouped by customer with a link block. Each adapter therefore declares its own column map and its own reconciliation targets.

No imported dataset becomes active until reconciliation checks and required relationships pass. Unknown rows remain visible; they are not silently discarded. A failed import leaves the previous dataset in place, which is why parsing completes into a staging result before anything is written to IndexedDB.

## 4.1 PWA layer

`sw.js` and `js/pwa.js` are adapted from the Sales Compass PWA, which passed its Chromium checks; the parts reused are the registration and update flow, the platform-specific install help, the offline badge, and the file-picker fallback.

- **Cache:** one versioned cache name, `monthly-forecast-<VERSION>`. On activate, every cache with the prefix and a different version is deleted. App files are cache-first; navigations are served the cached `index.html` so the app opens offline.
- **Update flow:** a new worker installs while the old one still controls the page, the app shows "a new version is available" with a Reload button, and only a deliberate tap posts `SKIP_WAITING`. Updates are never forced under a user mid-import.
- **Release rule:** the version constant appears in `sw.js` and `js/pwa.js`, and a new file must be added to the precache list. Getting this wrong is the most common way to ship an app that will not update, so the release step is written into the runbook.
- **Install help** is per platform because iOS offers no install prompt: Safari Share to Add to Home Screen on iOS; the deferred `beforeinstallprompt` on Android, Edge, and Chrome; File to Add to Dock on macOS Safari.
- **Imported files never pass through the service worker.** They are read from a `File` object in the page and go straight to the worker.
- **File picking on phones:** the file input declares both extensions and MIME types, and a second input with no `accept` attribute is offered for the case where the file appears greyed out in the iOS or Android picker. The application validates the file itself either way, because the picker's filter cannot be trusted.
- **CSV export on installed iOS apps** uses the share sheet when `navigator.canShare` accepts the file, and falls back to a download link elsewhere.

## 4.2 Storage layer

`js/storage.js` is the only module that touches persistence.

- **IndexedDB** holds datasets, import batches, derived results, and forecast records.
- **localStorage** holds language, theme, and small interface preferences only. Every read and write is wrapped, because it throws in private mode and can return empty after a browser clears site data.
- **JSON backup v2** is the interchange format; v1 backups from the prototype are migrated on load, and the backup records its own schema version so a future v3 can do the same.
- Nothing is stored anywhere else. There is no server, so a downloaded backup is the only copy that survives a cleared browser, and the interface says so wherever it offers one.

## 5. Reporting and forecasting boundaries

- Invoice KPIs use invoice-level measures; product views use line-level measures.
- Product-filtered line revenue must not be labelled as whole-invoice net revenue.
- Forecasting uses only confirmed complete months.
- The methods are explainable statistics, not trained AI, with one bounded exception: the repurchase logistic regression (5.3).
- Replenishment is not implemented; see PRD section 11.1.

Forecast interval formula for the attribute forecast, where `k` is the approved error multiplier:

```text
low = max(0, base - MAE * k)
high = base + MAE * k
```

`k` defaults to 1 and is shown beside the range. The prototype used the same formula with an implicit `k` of 1 and never stated it.

## 5.1 Engine module design

All four methods live in `js/engine.js` as pure functions: canonical records in, plain result objects out, no DOM access, no storage access, no clock reads except a cutoff passed in as an argument. Each is callable from `node --test` without a browser.

```text
engine.js
  buildMonthlySeries(lines, keyFn, unit, calendar)   -> { key, unit, periods[], quantities[] }
  classifyDemand(series, options)                    -> A6  (5.2)
  buildCustomerIntervals(invoices, options)          -> per-customer gap history
  scoreRepurchase(intervals, model, asOf)            -> B1  (5.3)
  fitLogistic(rows, options)                         -> model record with coefficients
  forecastAttribute(series, method, options)         -> B3  (5.4)
  backtest(series, method, cutoffs)                  -> WAPE, MAPE, skipped-period count
  observedBestSellers(lines, month, measure)         -> C1-lite (5.5)
```

Shared rules for every entry point:

- The caller passes the cutoff date. No function reads `Date.now()`, so every result is reproducible and every backtest is honest by construction.
- A function that cannot produce a result returns `{ value: null, reason: '<code>' }`. The view renders the reason. Null is never coerced to zero.
- Every result carries `method`, `inputWindow`, `cutoff`, `unit`, and `n` so the interface can satisfy FR21 without recomputing anything.

### 5.2 Demand classification (A6)

Input is one monthly quantity series per product series, including explicit zeros for complete months with no sales. Output is `{ adi, cv2, class, advice, periodType, periods, nonZeroPeriods }`.

- ADI = periods / periods with demand. CV-squared = (sd / mean) squared over **non-zero** period quantities.
- Cut-offs 1.32 and 0.49, held in one exported constant so a reviewer can find them in one place.
- Guard first: fewer than 6 complete periods or fewer than 3 non-zero periods returns class `too-sparse` with no advice. With 9 months of history this guard will fire often, which is the correct outcome, not a defect.
- The period type (month or week) is part of the result, because ADI computed over 9 monthly periods and over 39 weekly periods are different statements about the same product.

### 5.3 Repurchase and lapse (B1)

Two independent outputs for the same customer, presented side by side:

- **Rule:** `ratio = daysSinceLast / medianGap`, banded at 1.5 and 2.0. Pure arithmetic, hand-checkable, and the fallback whenever the model is unavailable or its training set is too small.
- **Model:** logistic regression on five features — `log(recency)`, `log(medianGap)`, `log(invoiceCount)`, `log(revenue)`, `recency / medianGap` — predicting purchase within 30 days of the cutoff.

Training is deterministic and self-contained:

- Features are standardised; the means and standard deviations are stored with the model so a score can be reproduced exactly.
- Gradient descent with L2 regularisation, fixed iteration cap and tolerance, both recorded in the model record. No random initialisation, so two runs on the same data give the same coefficients.
- Labels come only from invoices dated after the cutoff; features only from invoices dated before it. This is enforced in `fitLogistic`, not in the caller.
- The model record is written to storage and rendered in the interface: coefficients, intercept, standardisation values, cutoff, training rows, iterations, and measured AUC.

Scoring never mutates customer records. A score is an output of the current model against the current history, recomputed when either changes.

### 5.4 Attribute demand forecast (B3)

- `buildMonthlySeries` aggregates line quantities by parsed attribute value, filtered to a single unit (metres for the MVP). Lines in other units are counted and reported, never converted.
- MA3 = mean of the last 3 complete months. SES = standard exponential smoothing with `alpha` passed in, defaulting to 0.3, shown in the interface and editable.
- Both methods run on every series; the view shows both with their errors. The engine never picks one silently.
- `backtest` walks cutoffs forward, predicting each period from prior periods only, and returns WAPE, MAPE, and the count of zero-actual periods MAPE had to skip.
- Attribute parsing lives in the import layer, not here. The engine receives attribute values already normalised, plus the count of raw values that could not be mapped, and passes that count through to the result so the view can display it.

### 5.5 Observed best sellers (C1-lite)

- A pure ranking of actual monthly data by revenue or by quantity within one unit. No estimation, no smoothing.
- The result object carries `observedOnly: true`, and the view renders the "observed history, not a seasonal pattern" label from that flag rather than from a hard-coded string in one template. A future seasonal method sets the flag false in exactly one place.
- Optional Delphi-lite ratings are stored and displayed separately and are never inputs to any engine function.

## 6. Security and deployment boundary

The MVP has one view, for management, and an optional local privacy lock. The lock stops a passer-by reading the screen on a shared device; it is not authentication, and the interface says so in plain words wherever it appears. Salesperson and supervisor views and the tech-support role are M8+ and arrive together, because splitting them would imply a boundary the browser cannot hold.

Production use requires authenticated accounts, server-enforced roles, audit records, backups, encrypted transport, and an approved hosting environment. The production stack is not selected in this phase.

Two further rules follow from the data rather than the deployment: text taken from an imported file is escaped before insertion into the page, and CSV cells beginning with `=`, `+`, `-`, or `@` are prefixed on export so a spreadsheet cannot execute them.

## 7. GitHub Pages deployment

1. Deploy from the `main` branch and repository root with fake/anonymized data only.
2. Keep `index.html`, `manifest.webmanifest`, `sw.js`, `.nojekyll`, and all referenced assets in the committed release.
3. Open the public URL on a second device and on mobile data, not office Wi-Fi. If it only works on the developer's machine, it is not deployed.
4. Install it on each target platform, then turn the network off and open it again.
5. Never publish the real Express export, browser backups, credentials, or client-identifying records.
6. Tag the tested release `v1.0-mvp` only after live-URL sign-off.

Paths behave differently once hosted under a repository sub-path, which is why every path is relative and the checks are rerun on the live URL rather than trusted from localhost.

GitHub Pages is a review environment, not a production security boundary. Real data remains local until authenticated hosting is approved.

## 8. Verification

- Unit tests for date conversion, row classification, reconciliation, and forecast arithmetic.
- Demand classification: a hand-worked series for each of the five classes, including the two boundary cases at ADI 1.32 and CV-squared 0.49, and a series that trips each half of the sparsity guard.
- Repurchase: a customer whose gaps are known by hand for each of the three rule states; a logistic fit on a small fixed matrix checked against coefficients computed independently; a leakage test asserting that an invoice dated after the cutoff cannot change a feature value.
- Attribute forecast: MA3 and SES on a hand-worked series; a WAPE and a MAPE computed by hand, including a zero-actual period that MAPE must skip and count.
- Determinism: every engine function called twice on the same input returns identical output, including the fitted model.
- Reported-versus-reproduced: the backtest tests assert the ranges in PRD section 12.1. Until those tests run and pass, the numbers stay labelled as reported, not measured.
- Fixture checks against the counts in PRD 7.2: cash 6,088 invoices and 30,942 item lines, credit 168 and 636, deposits 193 notes with 188 matched, plus the product, customer, unit, and exception counts, and each report's footer totals.
- Encoding: the same fixture in Windows-874 and in UTF-8 with a byte-order mark parses identically; a UTF-8 file without a mark is rejected rather than mangled; a line with unbalanced quotes is reported and does not shift later rows.
- Browser tests for import preview, filters, language, theme, accessibility, responsive layout, local save, and exports.
- PWA: install on each target platform, open offline, update banner appears after a version bump and only reloads when tapped, imported files never reach the service worker.
- Performance fixture at full scale, 9 months, and multiplied to 24 months for the M8+ path.
- Eco numbers measured and recorded in `progress.md` at the end of every phase.

## 9. Architecture gates

1. Approve revenue definitions and adjustment handling.
2. Approve product-variant and unit identity (M8+ dependency; the MVP forecasts attributes, not SKUs).
3. Obtain multi-month cash/credit sales, stock, commitments, incoming orders, and customer groups.
4. Approve production roles and hosting before server work.
5. Approve the attribute normalisation tables, colour first, before the attribute forecast is accepted.
6. Reproduce the PRD 12.1 ranges from committed tests before any predictive requirement is accepted.

## 10. Open architecture questions

1. Will the production system run beside the company's Express server, on an internal server, or on another approved platform?
2. Which roles may see company-wide sales, customer details, stock, and forecast exports? (M8+, with the roles themselves.)
3. Should production authentication connect to existing company accounts or use a separate identity service?
4. Is the default protection period too high? With ordinary lead time of 1-2 days, review 7 days, and buffer 7 days, the plan can cover about 15-16 days and may conflict with the goal of limiting factory stock. (M8+, with the rest of replenishment.)
5. Will the root multi-file application remain the production form, or will a framework/server build be approved after the prototype phase?
6. Should the demand class be computed on monthly or weekly periods by default? Monthly matches the decision cycle but gives only 9 observations; weekly gives about 39 but counts a quiet week as a zero-demand period, which pushes ADI up and reclassifies items as intermittent.
7. Is scoring every eligible customer on each load fast enough at the real customer count, or must scores be cached with the model record and recomputed only when the model or the data changes?
8. Where does the fitted model belong on re-import: retrained automatically from the new history, or kept until a reviewer retrains it deliberately? Automatic retraining changes yesterday's follow-up list without anyone asking for it.