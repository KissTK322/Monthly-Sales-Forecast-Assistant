# Data Model: Monthly Sales Forecast Assistant

PRD baseline: 1.3 | 2026-09-16

## 1. Overview

The canonical model separates invoice totals, product lines, adjustments, product variants, customers, salespeople, stock snapshots, commitments, and incoming supply. This is necessary because the real Express report mixes row types and invoice totals do not always equal the sum of product lines.

Three groups of tables sit on top of that imported core:

- **Imported** — invoices, lines, adjustments, variants, customers, salespeople. Written only by an accepted import.
- **Curated** — attribute normalisation, customer groups, judgement ratings. Written by a reviewer; an import never overwrites them.
- **Derived** — demand classes, repurchase scores, attribute series, forecast records. Computed from imported and curated data, reproducible from them, and safe to discard and rebuild. Only `forecast_records` is deliberately immutable once issued, because an accuracy log that can be recomputed is not evidence.

The stock tables remain defined but are not populated in the MVP; see PRD section 11.1.

## 2. Core tables

### `invoices`

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | PK; source document number |
| `channel` | enum | `cash` (`HS`) or `credit` (`IV`); every revenue figure states the channel it used |
| `date` | date | Gregorian `YYYY-MM-DD`; converted from source BE date |
| `customerId` | string/null | FK -> customers.id; **null is legal for credit invoices**, which carry no customer code |
| `customerNameRaw` | string/null | Required when `customerId` is null; the name exactly as printed |
| `customerMapped` | boolean | False while a credit customer has no confirmed code; false rows are shown flagged, never merged by name similarity |
| `salespersonId` | string/null | FK -> salespeople.id; normalized to two digits (`3` and ` 3` become `03`). Null is legal and counted: 11 cash invoices have a blank salesperson. Never inferred |
| `discountAmount` | decimal | Invoice-level discount; 183 cash invoices carry one |
| `goodsAmount` | decimal | Goods value as printed, **after** deposit deductions on cash invoices |
| `vatAmount` | decimal | Printed VAT column; a separate amount, not an adjustment |
| `grossAmount` | decimal | Report amount before deposits/adjustments |
| `adjustmentAmount` | decimal | Sum of linked adjustments; signed |
| `netAmount` | decimal | Amount used for invoice-net revenue; reconciliation rule required |
| `lineSumVariance` | decimal | `sum(lines) - discount - deposits - goodsAmount`; non-zero on 41 invoices and always displayed, never corrected away |
| `dueDate` | date/null | Credit invoices only |
| `overdue` | boolean | Credit invoices; the source marks it with a `*` after the due date |
| `collected` | boolean/null | Credit invoices only; 15 are not yet collected |
| `cancelled` | boolean | True when the source document number begins with `*`; none in this export |
| `sourceFile` | string | Which of the three reports this came from |
| `sourceRow` | integer | Original source line number |

Example: `{"id":"HS6907/0001","channel":"cash","date":"2026-07-01","customerId":"C001","customerNameRaw":null,"customerMapped":true,"salespersonId":"01","discountAmount":0,"goodsAmount":1000,"vatAmount":0,"grossAmount":1200,"adjustmentAmount":-200,"netAmount":1000,"lineSumVariance":0,"dueDate":null,"overdue":false,"collected":null,"cancelled":false,"sourceFile":"cash-sales.csv","sourceRow":18}`

### `invoice_lines`

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | PK; stable generated/source line ID |
| `invoiceId` | string | FK -> invoices.id |
| `productVariantId` | string | FK -> product_variants.id |
| `quantity` | decimal | Nonnegative |
| `unit` | string | Required source unit |
| `unitPrice` | decimal/null | Null when no price is recorded |
| `lineAmount` | decimal | Zero allowed for flagged free/no-price lines |
| `freeOrNoPrice` | boolean | True for the 4,910 cash and 63 credit no-price/no-amount lines |
| `stockEligible` | boolean | False for approved service/non-stock variants |
| `sourceRow` | integer | Original Excel row |

Example: `{"id":"L0001","invoiceId":"HS6907/0001","productVariantId":"PV-02-403-L760-M","quantity":10,"unit":"เมตร","unitPrice":120,"lineAmount":1200,"freeOrNoPrice":false,"stockEligible":true,"sourceRow":19}`

### `invoice_adjustments`

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | PK |
| `invoiceId` | string | FK -> invoices.id |
| `type` | enum | `deposit`, `discount`, `rounding`, `tax`, `other` |
| `reference` | string/null | Deposit/credit reference when present |
| `amount` | decimal | Signed; deductions negative |
| `sourceRow` | integer | Original Excel row |

Example: `{"id":"A0001","invoiceId":"HS6907/0001","type":"deposit","reference":"AI6907/0001","amount":-200,"sourceRow":25}`

### `deposit_receipts`

The `AI` deposit-receipt report, which version 1.2 collapsed into `invoice_adjustments`. It needs its own table: a receipt exists before any invoice uses it, may be used by several invoices, and carries an outstanding balance of its own.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | PK; deposit document number, prefix `AI` |
| `customerId` | string | FK -> customers.id; this report is grouped by customer and does carry codes |
| `date` | date | Receipt date; **may precede the reporting period** |
| `salespersonId` | string/null | Normalized to two digits |
| `value` | decimal | Amount before VAT |
| `vatAmount` | decimal | Printed VAT |
| `totalAmount` | decimal | Printed total |
| `dueDate` | date/null | As printed |
| `outstanding` | decimal | Remaining balance as printed |
| `fullyUsed` | boolean | Source `Y`/`N` |
| `sourceRow` | integer | Original source line number |

Example: `{"id":"AI6812/0004","customerId":"C001","date":"2025-12-14","salespersonId":"03","value":1000,"vatAmount":70,"totalAmount":1070,"dueDate":null,"outstanding":0,"fullyUsed":true,"sourceRow":42}`

### `deposit_links`

The `เอกสารที่ตัด:` block: which invoices consumed which receipt.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | PK |
| `depositReceiptId` | string/null | FK -> deposit_receipts.id; null when a deduction has no matching receipt |
| `invoiceId` | string | FK -> invoices.id; `HS` and `IV` both occur |
| `amount` | decimal | Amount deducted |
| `notePrefix` | enum | `AI` or `SR` |
| `matchState` | enum | `matched`, `unmatched-amount`, `unmatched-document` |
| `sourceRow` | integer | Original source line number |

Example: `{"id":"DL-0001","depositReceiptId":"AI6812/0004","invoiceId":"HS6907/0001","amount":200,"notePrefix":"AI","matchState":"matched","sourceRow":25}`

`SR` deposit notes (79 of them) have no receipt in any supplied report, so they are stored with `depositReceiptId: null` and `matchState: unmatched-document` until the client explains what an `SR` document is. They are never invented as receipts.

Totals note: deposits received and deposits deducted are different quantities, because a receipt dated before December 2025 may be used inside the period. Both are reported; neither is reconciled into the other.

### `product_variants`

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | PK; approved forecast identity |
| `productCode` | string | Express code; not necessarily unique as a forecast item |
| `descriptionRaw` | string | Original description |
| `productType` | string/null | Parsed/confirmed type |
| `profileRaw` | string/null | Profile exactly as it appears in the description |
| `profileId` | string/null | FK -> attribute_values.id; null when unmapped |
| `colourRaw` | string/null | Colour exactly as it appears in the description |
| `colourId` | string/null | FK -> attribute_values.id; null when unmapped |
| `thicknessRaw` | string/null | Thickness exactly as it appears in the description |
| `thicknessId` | string/null | FK -> attribute_values.id; null when unmapped |
| `colour` | string/null | Retained from 1.2; superseded by `colourRaw` / `colourId` |
| `thickness` | string/null | Retained from 1.2; superseded by `thicknessRaw` / `thicknessId` |
| `length` | string/null | Parsed attribute |
| `unit` | string | Part of identity when a code has multiple units |
| `stockEligible` | boolean | Services excluded only by approved rule |

Example: `{"id":"PV-02-403-L760-M","productCode":"02-403","descriptionRaw":"ลอน760 ...","productType":"ลอน760","profileRaw":"ลอน760","profileId":"AV-PROFILE-760","colourRaw":null,"colourId":null,"thicknessRaw":"0.35","thicknessId":"AV-THK-035","colour":null,"thickness":null,"length":null,"unit":"เมตร","stockEligible":true}`

Every attribute is stored twice: the raw text exactly as parsed, and a foreign key to an approved value. The raw text is never edited in place, so a corrected normalisation table can be re-applied to old imports without re-importing. A null `*Id` means unmapped, and unmapped is a reportable state, not a silent fallback to a nearby value.

### `salespeople`

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | PK; official Express salesperson code, normalized to two digits. Observed: 01, 03, 04, 06, 08 |
| `name` | string/null | Null until the client supplies names; the code alone identifies the person |
| `active` | boolean | Inactive people retain historical relationships |

Example: `{"id":"01","name":null,"active":true}`

Invoices with a blank salesperson are **not** assigned to a placeholder person. `invoices.salespersonId` stays null and the count is reported, because inventing an "unknown" salesperson would put that person into team comparisons.

### `customers`

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | PK; stable source code, or a generated `CN-` key for a credit customer known only by name |
| `name` | string | Required nonblank |
| `hasSourceCode` | boolean | False for credit-only customers; such a customer is labelled unmapped everywhere it appears |
| `customerGroupId` | string/null | FK -> customer_groups.id; null until confirmed |

Example: `{"id":"C001","name":"North Build","hasSourceCode":true,"customerGroupId":null}`

A generated `CN-` key is keyed on the exact printed name. Two spellings of one company therefore produce two customers, which is correct: merging them is a client decision, not a string-similarity decision.

### `customer_groups`

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | PK |
| `nameTh` | string | Required |
| `nameEn` | string | Required |

Example: `{"id":"CG01","nameTh":"ผู้รับเหมา","nameEn":"Contractor"}`

### `attribute_values` (curated)

The approved list of attribute values, and the mapping from raw description text onto it. Required by FR19; colour is the case that makes it necessary, with about 530 raw variants observed.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | PK |
| `kind` | enum | `profile`, `thickness`, `colour` |
| `valueTh` | string | Approved Thai label |
| `valueEn` | string | Approved English label |
| `sortOrder` | integer/null | Display order; thickness sorts numerically, not alphabetically |
| `status` | enum | `approved`, `proposed`; only `approved` values may be forecast |

Example: `{"id":"AV-THK-035","kind":"thickness","valueTh":"0.35 มม.","valueEn":"0.35 mm","sortOrder":35,"status":"approved"}`

### `attribute_aliases` (curated)

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | PK |
| `kind` | enum | `profile`, `thickness`, `colour` |
| `rawText` | string | Normalized-for-matching raw text; unique with `kind` |
| `attributeValueId` | string/null | FK -> attribute_values.id; null records a raw value seen and deliberately left unmapped |
| `source` | enum | `client`, `team-proposed` |
| `confirmedAt` | datetime/null | Set when the client approves the mapping |

Example: `{"id":"AL-0007","kind":"colour","rawText":"แดงอิฐ","attributeValueId":"AV-COL-BRICKRED","source":"team-proposed","confirmedAt":null}`

A raw value with no alias row is unmapped and counted in every result that depends on it. A team-proposed mapping is usable but is labelled unconfirmed until `confirmedAt` is set.

### `attribute_month_series` (derived)

| Field | Type | Rules |
| --- | --- | --- |
| `kind` | enum | `profile`, `thickness`, `colour`; composite PK with the next three fields |
| `attributeValueId` | string | FK -> attribute_values.id |
| `unit` | string | One unit per series; the MVP forecasts metres only |
| `month` | string | Gregorian `YYYY-MM` |
| `quantity` | decimal | Sum of line quantities in that unit |
| `lineCount` | integer | Contributing lines; supports the sampled row audit |
| `monthComplete` | boolean | False for a partial month; a partial month is never an input |

Example: `{"kind":"thickness","attributeValueId":"AV-THK-035","unit":"เมตร","month":"2026-07","quantity":18400,"lineCount":212,"monthComplete":true}`

A month with no sales for a complete month is stored explicitly with `quantity: 0`. A month with no report is absent. The difference matters: absent is unknown, zero is measured.

### `demand_classes` (derived)

Result of FR17. Rebuilt whenever the dataset or the period setting changes.

| Field | Type | Rules |
| --- | --- | --- |
| `seriesKey` | string | PK with `periodType` and `computedAt`; product variant or product code |
| `periodType` | enum | `month` or `week` |
| `unit` | string | Series unit |
| `periods` | integer | Complete periods in the window |
| `nonZeroPeriods` | integer | Periods with demand |
| `adi` | decimal/null | Null when the sparsity guard fires |
| `cv2` | decimal/null | Squared coefficient of variation of non-zero demand sizes |
| `class` | enum | `smooth`, `erratic`, `intermittent`, `lumpy`, `too-sparse` |
| `reason` | string/null | Required when `class` is `too-sparse` |
| `windowStart` | string | First period in the window, `YYYY-MM` |
| `cutoff` | date | Latest source date used |
| `computedAt` | datetime | Audit |

Example: `{"seriesKey":"PV-02-403-L760-M","periodType":"month","unit":"เมตร","periods":8,"nonZeroPeriods":7,"adi":1.14,"cv2":0.31,"class":"smooth","reason":null,"windowStart":"2025-12","cutoff":"2026-08-31","computedAt":"2026-09-16T10:00:00+07:00"}`

The advice text is not stored. It is a fixed translation of `class` and belongs in the interface layer, so advice wording can change without invalidating stored results.

### `repurchase_models` (derived, retained)

One row per fitted logistic model (FR18). Retained rather than recomputed, so a list issued last week can be explained this week.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | PK |
| `trainedAt` | datetime | Audit |
| `cutoff` | date | Features use data before this date; labels after it |
| `horizonDays` | integer | Label window; 30 in the MVP |
| `featureNames` | string[] | Ordered; must match `coefficients` |
| `coefficients` | decimal[] | Fitted weights on standardised features |
| `intercept` | decimal | Fitted intercept |
| `featureMeans` | decimal[] | Standardisation; required to reproduce a score |
| `featureStdDevs` | decimal[] | Standardisation; zero variance is rejected, not divided by |
| `iterations` | integer | Actual iterations run |
| `converged` | boolean | False is displayed, not hidden |
| `l2` | decimal | Regularisation strength |
| `trainingRows` | integer | Eligible customers at the cutoff |
| `positiveRows` | integer | Training rows that bought within the horizon |
| `auc` | decimal/null | Measured on the evaluation cutoff, not on the training data |

Example: `{"id":"RM-2026-08-31","trainedAt":"2026-09-16T10:05:00+07:00","cutoff":"2026-08-31","horizonDays":30,"featureNames":["logRecency","logMedianGap","logInvoiceCount","logRevenue","recencyOverGap"],"coefficients":[-0.81,0.44,0.37,0.12,-0.63],"intercept":-0.52,"featureMeans":[3.9,3.4,1.6,11.2,1.1],"featureStdDevs":[0.8,0.7,0.5,1.3,0.9],"iterations":400,"converged":true,"l2":0.01,"trainingRows":900,"positiveRows":270,"auc":0.79}`

The example values are illustrative, not fitted results.

### `customer_repurchase_scores` (derived)

| Field | Type | Rules |
| --- | --- | --- |
| `customerId` | string | FK -> customers.id; PK with `asOf` |
| `channel` | enum | `cash` or `credit`; credit requires a confirmed name-to-code mapping |
| `asOf` | date | Score date |
| `invoiceCount` | integer | At least 3 for eligibility |
| `firstPurchase` | date | Audit |
| `lastPurchase` | date | Audit |
| `medianGapDays` | decimal | Median of consecutive invoice gaps |
| `daysSinceLast` | integer | `asOf` minus `lastPurchase` |
| `ratio` | decimal | `daysSinceLast / medianGapDays` |
| `ruleState` | enum | `expected`, `overdue`, `lapsed` |
| `probability` | decimal/null | Model output 0-1; null when no model applies |
| `modelId` | string/null | FK -> repurchase_models.id |
| `eligible` | boolean | False rows are kept with a reason so exclusions are auditable |
| `ineligibleReason` | string/null | Required when `eligible` is false |

Example: `{"customerId":"C001","channel":"cash","asOf":"2026-08-31","invoiceCount":7,"firstPurchase":"2025-12-09","lastPurchase":"2026-07-20","medianGapDays":34,"daysSinceLast":42,"ratio":1.24,"ruleState":"expected","probability":0.61,"modelId":"RM-2026-08-31","eligible":true,"ineligibleReason":null}`

Rule state and probability are stored separately and are never reconciled into one number. They can disagree; the interface shows both.

No field on this table holds free-text remarks from the source reports. Remark rows may contain personal data and are excluded from this feature entirely.

### `judgement_ratings` (curated, optional)

The Delphi-lite adjustment log for FR20. Kept only if the optional rating feature is built; it has no dependants, so it can be dropped without touching another table.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | PK |
| `subjectKind` | enum | `month` or `productVariant` |
| `subjectKey` | string | `YYYY-MM` or a variant ID |
| `raterId` | string | Local salesperson/reviewer ID; not an authenticated identity |
| `round` | integer | 1 or 2; a second round after seeing the spread |
| `rating` | integer | Agreed ordinal scale, 1-5 |
| `note` | string/null | Rater's reason, shown with the rating |
| `recordedAt` | datetime | Audit |

Example: `{"id":"JR-0001","subjectKind":"month","subjectKey":"2026-10","raterId":"S03","round":1,"rating":4,"note":"ปลายฝน งานหลังคาเร่ง","recordedAt":"2026-09-16T11:00:00+07:00"}`

Ratings are opinion. They are displayed beside observed data, are never averaged into a computed figure, and never enter an engine function.

### `stock_snapshots`

Defined, not populated in the MVP. Replenishment is M8+ (PRD 11.1).

| Field | Type | Rules |
| --- | --- | --- |
| `productVariantId` | string | FK; composite PK with `snapshotDate` |
| `snapshotDate` | date | Physical/confirmed count date |
| `onHand` | decimal | Nonnegative |
| `source` | string | Express, physical count, or approved source |

Example: `{"productVariantId":"PV-02-403-L760-M","snapshotDate":"2026-07-31","onHand":850,"source":"physical-count"}`

### `commitments`

Defined, not populated in the MVP. Replenishment is M8+ (PRD 11.1).

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | PK |
| `productVariantId` | string | FK |
| `quantity` | decimal | Positive |
| `dueDate` | date | Determines whether it falls within planning horizon |

Example: `{"id":"COM001","productVariantId":"PV-02-403-L760-M","quantity":120,"dueDate":"2026-08-05"}`

### `incoming_supply`

Defined, not populated in the MVP. Replenishment is M8+ (PRD 11.1).

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | PK |
| `productVariantId` | string | FK |
| `quantity` | decimal | Positive |
| `dueDate` | date | Expected receipt date |

Example: `{"id":"IN001","productVariantId":"PV-02-403-L760-M","quantity":400,"dueDate":"2026-08-03"}`

### `forecast_records`

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | PK; immutable issued forecast ID |
| `seriesKind` | enum | `attribute` in the MVP; `productVariant` when per-SKU forecasting returns (M8+) |
| `seriesKey` | string | Attribute value ID or product-variant ID, per `seriesKind` |
| `productVariantId` | string/null | FK -> product_variants.id; null for attribute series |
| `targetMonth` | string | Gregorian `YYYY-MM` |
| `issuedAt` | datetime | Saved before the target period closes |
| `dataCutoff` | date | Latest source date available when issued |
| `method` | enum | `ma3` or `ses`; `recent3` and `seasonalTrend` are retained for migration and are not issued by the MVP |
| `methodParams` | object/null | Method settings, e.g. `{"alpha":0.3}` for SES |
| `unit` | string | Must match the forecast series |
| `baseQty` | decimal | Issued point estimate |
| `lowQty` | decimal | Issued lower planning value |
| `highQty` | decimal | Issued upper planning value |
| `inputSnapshot` | object | Versioned parameters/history needed to reproduce result |
| `actualQty` | decimal/null | Added only after the month is confirmed complete |
| `actualRecordedAt` | datetime/null | Audit time for actual attachment |

Example: `{"id":"F-2026-09-AV-THK-035","seriesKind":"attribute","seriesKey":"AV-THK-035","productVariantId":null,"targetMonth":"2026-09","issuedAt":"2026-08-31T16:00:00+07:00","dataCutoff":"2026-08-31","method":"ma3","methodParams":null,"unit":"เมตร","baseQty":18000,"lowQty":14200,"highQty":21800,"inputSnapshot":{"schemaVersion":2},"actualQty":null,"actualRecordedAt":null}`

## 3. Relationships and re-import

| From | To | Type | Re-import behavior |
| --- | --- | --- | --- |
| invoices.customerId | customers.id | many-to-one | Cash: reject an unresolved code. Credit: null is legal with `customerNameRaw` set and `customerMapped` false |
| invoices.salespersonId | salespeople.id | many-to-one | Flag an unknown code for mapping; null is legal and counted, never replaced by a placeholder |
| deposit_links.invoiceId | invoices.id | many-to-one | Replaced with the source invoice import |
| deposit_links.depositReceiptId | deposit_receipts.id | many-to-one | Null allowed; an unmatched deduction is kept with its `matchState` |
| deposit_receipts.customerId | customers.id | many-to-one | Imported from its own report; a sales report never creates a receipt |
| invoice_lines.invoiceId | invoices.id | many-to-one | Replace lines for the re-imported invoice atomically |
| invoice_lines.productVariantId | product_variants.id | many-to-one | Require approved mapping or unresolved status |
| invoice_adjustments.invoiceId | invoices.id | many-to-one | Replace adjustments with the source invoice import |
| customers.customerGroupId | customer_groups.id | many-to-one | Preserve curated group unless approved source supplies it |
| stock/commitments/incoming.productVariantId | product_variants.id | many-to-one | Imported by their own dated source; never overwritten by a sales report |
| forecast_records.productVariantId | product_variants.id | many-to-one | Issued record is immutable; actual fields are appended with audit time |
| product_variants.profileId / colourId / thicknessId | attribute_values.id | many-to-one | Re-applied from the alias table on re-import; raw text is never overwritten |
| attribute_aliases.attributeValueId | attribute_values.id | many-to-one | Curated; an import never adds, edits, or removes an alias |
| attribute_month_series.attributeValueId | attribute_values.id | many-to-one | Fully rebuilt after an accepted import; never patched in place |
| demand_classes.seriesKey | product_variants.id or productCode | many-to-one | Rebuilt on import or when the period setting changes |
| customer_repurchase_scores.customerId | customers.id | many-to-one | Rebuilt on import or when the model changes; rows for ineligible customers are kept with a reason |
| customer_repurchase_scores.modelId | repurchase_models.id | many-to-one | A score keeps its model; deleting a model that scores reference is refused |
| judgement_ratings.subjectKey | month or product_variants.id | many-to-one | Curated; survives re-import and is never merged into computed figures |

## 4. Indexes

Future persistent store: invoice date, salesperson/date, customer/date, productVariant/date, invoice ID, product code/unit, commitment due date, incoming due date, and stock snapshot date. The browser prototype may build equivalent in-memory Maps.

Added for the predictive features: customer/invoice-date (the repurchase gap calculation walks every customer's invoices in date order), attribute kind + value + month, and alias kind + raw text.

## 5. Import audit fields

Every normalized record retains `sourceFile`, `sourceRow` (the line number in the CSV), and an import-batch ID. `sourceSheet` is dropped: the sources are CSV files with no worksheets, and it returns only if `.xlsx` import does (PRD 11.1).

The import batch stores the source hash, the report type, the **decoded encoding** (`windows-874` or `utf-8-bom`), counts, totals, warnings, malformed lines, unresolved rows, and reconciliation status. Encoding is recorded rather than assumed, because a file decoded the wrong way produces text that looks like data and cannot be repaired afterwards.

### 5.1 Storage and versioning

| Store | Holds | Notes |
| --- | --- | --- |
| IndexedDB | Datasets, import batches, derived results, forecast records, models | The only home for anything large |
| localStorage | Language, theme, small interface preferences | Every access wrapped; it throws in private mode |
| JSON backup v2 | Everything needed to restore a device | Carries `backupVersion: 2`; prototype v1 files migrate on load |

`backupVersion` (the file format) and `inputSnapshot.schemaVersion` (how one forecast record was produced) are separate numbers and must not be conflated; a backup can be re-versioned without invalidating stored forecasts.

## 6. Prototype trade-offs and volume tests

The earliest local prototype stored current stock fields beside product master data. That is simple for one snapshot but cannot represent history or prove which balance a recommendation used. The canonical model therefore uses `stock_snapshots`; the interface may cache the latest snapshot on a product view, but it is derived rather than authoritative.

The small fictional demonstration dataset is not a performance test. M1 must include a **synthetic** fixture generator reproducing all three report layouts at full scale over the 9-month period: 6,088 cash invoices and 30,942 item lines, 168 credit invoices and 636 lines, 193 deposit receipts, 626 product codes in 19 groups, 1,471 customer codes, 5 salesperson codes with blanks, and 27 units with blanks.

The fixtures must be generated, not derived from the client files: Windows-874 encoded, with invented customer names, no phone numbers, and no remark text. They carry the real *shape* and the real *counts*, never real records. Longer-history tests multiply the same generator to 24 months for the M8+ path.

## 7. Open questions

1. Approve the product-variant key for multi-description/multi-unit codes.
2. Approve invoice gross/net and adjustment formulas.
3. Confirm treatment of the free/no-price lines (4,910 cash, 63 credit).
4. Approve service/non-stock classification.
5. Confirm customer-group source.
6. Confirm dated commitment and incoming-order sources.
7. Confirm whether code + normalized product type + unit is sufficient when descriptions also vary by colour, thickness, length, and sheet count.
8. Confirm which invoice-level measure drives each KPI and how the 41 invoices with a non-zero `lineSumVariance` are classified.
9. Approve the attribute value lists for profile, thickness, and colour, and the alias mappings onto them. Colour is the blocker: about 530 raw variants.
10. Is thickness an attribute value from a fixed list, or a number that should be stored and sorted numerically? The schema currently treats it as a list entry with a numeric `sortOrder`.
11. Keep the optional `judgement_ratings` table, or drop the Delphi-lite rating from the MVP? It is the only table here with no dependants.
12. Is `raterId` allowed to be a local salesperson ID, given that local roles are a privacy feature and not authentication? A rating attributed to a named colleague carries more weight than the login behind it can support.
13. How long are `customer_repurchase_scores` rows kept? They name customers and accumulate one row per customer per scoring date.
14. Confirm the retained 1.2 fields `product_variants.colour` and `.thickness` may be dropped once the `*Raw` / `*Id` pairs are populated, or must be kept for the JSON v1 migration.