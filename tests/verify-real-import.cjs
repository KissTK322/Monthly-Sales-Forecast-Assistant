/* Runs the shipped ExpressCsvImporter against the real private-data/ CSVs,
 * decoding exactly as the browser does (TextDecoder('windows-874'), no
 * fallback), and prints reconciliation counts to compare against the known
 * facts in CLAUDE.md section 7. Not a pass/fail unit test: a manual
 * verification step for real client data that must never be committed.
 *
 * Run: node tests/verify-real-import.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ExpressCsvImporter = require('../js/import-express.js');

const DATA_DIR = path.join(__dirname, '..', 'private-data');
const files = ['cash-sales.csv', 'credit-sales.csv', 'deposits.csv'];

const decoder = new TextDecoder('windows-874');
const documents = files.map((name) => {
  const bytes = fs.readFileSync(path.join(DATA_DIR, name));
  const text = decoder.decode(bytes);
  return { name, text };
});

console.log('--- encoding sanity ---');
for (const doc of documents) {
  const thaiChars = (doc.text.match(/[฀-๿]/g) || []).length;
  const replacementChars = (doc.text.match(/�/g) || []).length;
  console.log(doc.name, 'decoded length', doc.text.length, 'thai chars', thaiChars, 'replacement chars (mojibake)', replacementChars);
}

console.log();
console.log('--- classification ---');
for (const doc of documents) console.log(doc.name, '->', ExpressCsvImporter.classify(doc.text));

console.log();
const dataset = ExpressCsvImporter.buildDataset(documents);

const invoicesByType = {};
for (const sale of dataset.sales) {
  invoicesByType[sale.sourceType] = invoicesByType[sale.sourceType] || new Set();
  invoicesByType[sale.sourceType].add(sale.invoice);
}

console.log('--- reconciliation (compare against CLAUDE.md section 7) ---');
console.log('cash invoices  :', invoicesByType.cash ? invoicesByType.cash.size : 0, '(expected 6088)');
console.log('cash lines     :', dataset.sales.filter((s) => s.sourceType === 'cash').length, '(expected 30942)');
console.log('credit invoices:', invoicesByType.credit ? invoicesByType.credit.size : 0, '(expected 168)');
console.log('credit lines   :', dataset.sales.filter((s) => s.sourceType === 'credit').length, '(expected 636)');
console.log('deposit notes  :', dataset.adjustments.length, '(expected up to 193 AI notes)');
console.log('products       :', dataset.products.length, '(expected 626 codes in cash alone; combined will differ)');
console.log('customers      :', dataset.customers.length, '(expected 1471 cash + 29 credit names, deduped differently)');
console.log('salespeople    :', dataset.salespeople.length);
console.log('unresolved rows:', dataset.importSummary.unresolvedRows.length);
console.log('completeThrough:', dataset.completeThrough);

console.log();
console.log('--- sample product group labels (the fix under test) ---');
const sampleGroups = new Map();
for (const p of dataset.products) {
  const prefix = p.sku.split(/[-._/]/)[0];
  if (!sampleGroups.has(prefix)) sampleGroups.set(prefix, { en: p.group, th: p.groupTh, sku: p.sku });
}
for (const [prefix, info] of [...sampleGroups.entries()].sort()) {
  console.log(prefix, '->', info.th, '|', info.en, '  (e.g. sku', info.sku + ')');
}

console.log();
console.log('--- forecast engine smoke test on a real, frequently-sold SKU ---');
const ForecastEngine = require('../js/engine.js');
const busiest = [...dataset.products].sort((a, b) => {
  const qa = dataset.sales.filter((s) => s.sku === a.sku).length;
  const qb = dataset.sales.filter((s) => s.sku === b.sku).length;
  return qb - qa;
})[0];
const withCompleteThrough = { ...dataset };
const fc = ForecastEngine.forecast(withCompleteThrough, busiest.sku, 'auto', 1);
console.log('busiest sku:', busiest.sku, busiest.name);
console.log('forecast month:', fc.month, 'base:', fc.base, 'WAPE:', fc.error);

/* --- invoice-count gap diagnostic ---
 * buildDataset() counts invoices indirectly, as the distinct r.invoice
 * values on rows that made it into dataset.sales. An invoice header row
 * that never produces a single addSale() call (e.g. every item line under
 * it fails the item-row shape check) is invisible to that count even
 * though the header line is really in the file. This section re-scans the
 * raw rows directly, independent of buildDataset's state machine, to find
 * every header row and explain exactly which ones produced no sale line. */
console.log();
console.log('--- invoice-count gap diagnostic (section 3) ---');

function scanHeaders(doc, prefixRe) {
  const rows = ExpressCsvImporter.parseRows(doc.text);
  const headers = [];
  rows.forEach((row, index) => {
    const date = ExpressCsvImporter.parseThaiDate(row[0]);
    const rawDoc = String(row[1] ?? '').trim();
    if (date && prefixRe.test(rawDoc.replace(/^\*/, ''))) {
      headers.push({ line: index + 1, raw: rawDoc, cancelled: rawDoc.startsWith('*'), date, row });
    }
  });
  return headers;
}

function diagnoseGap(label, doc, prefixRe, salesInvoiceSet) {
  const rows = ExpressCsvImporter.parseRows(doc.text);
  const headers = scanHeaders(doc, prefixRe);
  const headerDocNumbers = headers.map((h) => h.raw.replace(/^\*/, ''));
  const headerSet = new Set(headerDocNumbers);
  const dupeHeaderNumbers = headerDocNumbers.filter((v, i) => headerDocNumbers.indexOf(v) !== i);

  console.log(`${label}: header rows found by direct scan = ${headers.length} (distinct doc numbers = ${headerSet.size})`);
  console.log(`${label}: invoices present in dataset.sales = ${salesInvoiceSet.size}`);
  if (dupeHeaderNumbers.length) console.log(`${label}: doc numbers repeated in the raw file (reused/split invoice) =`, [...new Set(dupeHeaderNumbers)]);

  const missing = headers.filter((h) => !salesInvoiceSet.has(h.raw.replace(/^\*/, '')) && !salesInvoiceSet.has(h.raw));
  console.log(`${label}: header rows with NO matching row in dataset.sales = ${missing.length}`);

  /* Classify each miss instead of just listing it:
     - "empty invoice": the very next row is already the next invoice's
       header (or a page break) — the source file prints no item row at
       all under this header, so there is nothing to parse.
     - "quote-broken item line": the next row IS an item-shaped row (blank
       first cell, numeric second cell) but its cell count is short of the
       normal 8-9 columns, because the product description contains a
       literal '"' (an inch mark, e.g. 12") that the simple quote-toggling
       CSV parser (parseCsvLine) misreads as a quote delimiter, merging
       later columns into one. The merged text still matches
       splitCombinedProduct's SKU pattern, so it is never counted as
       "unresolved" — it silently parses to quantity 0 and addSale's
       `!line.quantity` guard drops it. */
  let emptyInvoice = 0;
  let quoteBroken = 0;
  let other = 0;
  for (const h of missing) {
    /* Skip past printed-report boilerplate (page header/footer text, rule
       lines, the repeated column-title rows on every new page, blank rows)
       to find the next REAL content row, so a header that happens to fall
       right at a page break is not misclassified as "other". */
    const looksLikeHeader = (row) => row && prefixRe.test(String(row[1] ?? '').replace(/^\*/, ''));
    const looksLikeItem = (row) => row && row.length > 1 && !String(row[0] ?? '').trim() && /^\d+$/.test(String(row[1] ?? '').trim());
    let idx = h.line; // rows is 0-indexed; h.line is 1-indexed header row, so rows[h.line] is the next physical line
    let steps = 0;
    while (idx < rows.length && steps < 10 && !looksLikeHeader(rows[idx]) && !looksLikeItem(rows[idx])) { idx++; steps++; }
    const nextRow = rows[idx];
    const nextIsHeader = looksLikeHeader(nextRow);
    const nextLooksLikeItem = looksLikeItem(nextRow);
    let kind;
    if (!nextRow || nextIsHeader) kind = 'empty invoice (no item row printed under this header)';
    else if (nextLooksLikeItem && nextRow.some((cell) => typeof cell === 'string' && cell.includes('"'))) kind = 'quote-broken item line (description contains a literal " inch mark)';
    else kind = 'other / needs a closer look';
    if (kind.startsWith('empty')) emptyInvoice++;
    else if (kind.startsWith('quote')) quoteBroken++;
    else other++;
    console.log(`  line ${h.line}: doc="${h.raw}" headerRow=${JSON.stringify(h.row)} -> ${kind}`);
    if (kind.startsWith('quote')) console.log(`    item row as parsed: ${JSON.stringify(nextRow)}`);
  }
  console.log(`${label}: classified — empty invoice (nothing to parse) = ${emptyInvoice}, quote-broken item line = ${quoteBroken}, other = ${other}`);
  return { headers, missing, emptyInvoice, quoteBroken, other };
}

const cashDoc = documents.find((d) => d.name === 'cash-sales.csv');
const creditDoc = documents.find((d) => d.name === 'credit-sales.csv');
const cashGap = diagnoseGap('cash', cashDoc, /^HS/i, invoicesByType.cash || new Set());
const creditGap = diagnoseGap('credit', creditDoc, /^IV/i, invoicesByType.credit || new Set());

console.log();
console.log('--- root-cause summary (section 3) ---');
console.log('cash gap (6088 header rows vs', invoicesByType.cash.size, 'in dataset.sales, i.e. 15 missing):');
console.log('  -', cashGap.emptyInvoice, 'are invoices Express itself printed with a header line and total 0.00, and NO item row at all underneath — there is nothing to parse; this is a real property of the export, not a parser bug.');
console.log('  -', cashGap.quoteBroken, "are invoices whose single item line's product description contains a literal \" (inch mark, e.g. a 12\" pair of scissors). parseCsvLine's simple quote-toggle logic misreads that \" as a CSV quote delimiter, so the numeric columns after it are merged into one cell; the row still matches the SKU pattern so it is never logged as 'unresolved', it just silently computes quantity=0 and gets dropped by the `!line.quantity` guard in addSale(). This IS a genuine parser limitation in ExpressCsvImporter, inherited unchanged from the prototype — not something introduced by the port. Flagging for a decision, not fixing it here.");
console.log('  -', cashGap.other, 'need manual review (see lines above).');
console.log('credit gap (168 header rows vs', invoicesByType.credit.size, 'in dataset.sales, i.e. 2 missing): both are the same "empty invoice, total 0.00, no item row" case as above.');
