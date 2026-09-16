# Monthly Sales Forecast Assistant

A Thai/English sales and demand dashboard for the management team of a domestic metal-roofing manufacturer. It reads the company's three Express reports, shows how sales, products, customers and salespeople relate, and predicts what the available history actually supports.

**Your files stay on your device.** The reports are read in the browser. There is no server, no account, and no analytics.

University workshop project ("Vibe Coding"). Team: Titan and Tonkla.

## What it does

| | |
| --- | --- |
| Overview, Products, Sales team, Customers | Revenue, invoices, averages, rankings, period comparison, cash / credit / combined |
| Demand class per product | Smooth, erratic, intermittent, lumpy, or too sparse — which items are worth holding and which are ordered to demand |
| Repurchase and lapse alerts | Repeat customers ranked by the chance they buy in the next 30 days, from a plain gap rule and a logistic model whose coefficients are shown |
| Attribute demand | Next month's metres by profile, thickness and colour, parsed from the item descriptions |
| Observed best sellers | What actually sold best each month, labelled as history rather than as a seasonal pattern |

Every predicted figure shows its method, input window, data cutoff, unit and measured error. A series that cannot be predicted says why instead of showing a number.

**Not in this version:** stock planning and reorder quantities, per-SKU forecasts, revenue forecasting and seasonal models. They need stock data or 24 months of history, neither of which exists yet. See `prd.md` section 11.1.

## Install it

Open the published address, then:

| Device | Browser | How |
| --- | --- | --- |
| iPhone / iPad | Safari | Share → Add to Home Screen |
| Android | Chrome | Install banner, or ⋮ → Install app |
| Windows | Edge / Chrome | Install icon in the address bar |
| Mac | Safari | File → Add to Dock |

After the first visit it opens offline. The app shows the steps for whichever device you are on.

## Run it locally

A service worker does not run from a double-clicked file, so use a local server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

```bash
node --test tests/
```

```bash
node build.cjs
```

`build.cjs` produces `dist/index.html`, a single self-contained file that opens straight from a folder with no server. It has no service worker and cannot be installed — it is for reading the app offline, not for using it day to day.

## Importing the reports

Data & guide → choose the file. The app expects the three Express exports:

| Report | Thai title |
| --- | --- |
| Cash sales | รายงานขายเงินสด เรียงตามวันที่ |
| Credit sales | รายงานใบกำกับสินค้า เรียงตามวันที่ |
| Deposit receipts | รายงานใบรับมัดจำ แยกตามลูกค้า |

They are Windows-874 encoded and the app decodes them for you. Before anything is accepted you get a reconciliation preview — counts, totals, and every row the parser could not classify. A failed import never replaces the data you already had.

On a phone, if the file appears greyed out in the picker, use **My file is greyed out** to open a picker with no file-type filter.

## Documents

| File | What it is |
| --- | --- |
| `prd.md` | Scope authority. Start here |
| `AGENTS.md` | Standing rules for anyone, or anything, working on the code |
| `architecture.md` | Flow, technical decisions, file layout |
| `schema.md` | Data model |
| `implementation-plan.md` | Milestones and dates |
| `progress.md` | What is actually done, and what broke |

## Limitations

- 9 months of history (December 2025 to August 2026) and no stock data. This is the reason for most of what the app does not do.
- The colour attribute covers about 61% of metres and has the weakest error of the three; the app shows the covered share beside every figure.
- The optional local lock is a privacy screen for a shared device, not authentication. Anyone with the address can open the app — it simply contains no data until a file is chosen.
- Predictions are decision support. Check the stock and the supplier before acting on anything here.
- The published version carries fake data only. Real client data never leaves the client's device.
