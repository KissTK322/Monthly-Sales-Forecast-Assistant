(function (root) {
  'use strict';

  const clean = value => String(value ?? '').replace(/ /g, ' ').trim();

  /* --- encoding boundary ---
   * The Express reports are Windows-874 (TIS-620) with no byte-order mark.
   * A naive "try UTF-8 with fatal:true, fall back to windows-874 on throw"
   * is unsafe: short or ASCII-heavy windows-874 byte runs can, by chance,
   * also be well-formed UTF-8 (e.g. the two bytes for the Thai word "ยก"
   * are 0xC2 0xA1, which is also a perfectly valid UTF-8 encoding of "¡").
   * Strict UTF-8 decoding does not throw on that input, so a throw/no-throw
   * decision silently picks the wrong encoding and produces readable-looking
   * but wrong text — worse than an outright decode failure, because nothing
   * signals the mistake. Decide from the decoded CONTENT instead: decode
   * both ways and keep whichever reads as more Thai text, never by whether
   * one of the two happened not to throw. */

  function countThaiChars(text) {
    let count = 0;
    for (const ch of text) {
      const code = ch.codePointAt(0);
      if (code >= 0x0e00 && code <= 0x0e7f) count++;
    }
    return count;
  }

  function countReplacementChars(text) {
    let count = 0;
    for (const ch of text) if (ch === '�') count++;
    return count;
  }

  /* Higher is more plausibly correct Thai text. A replacement character is
     never something a correct decode of this data should produce, so it
     outweighs any number of Thai characters elsewhere in the same text. */
  function thaiReadabilityScore(text) {
    return countThaiChars(text) - countReplacementChars(text) * 1000;
  }

  function hasUtf8Bom(bytes) {
    return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  }

  /* bytes: a Uint8Array, or anything a Uint8Array can be built from
     (ArrayBuffer, Node Buffer). Returns the decoded text. */
  function decodeExpressBytes(bytes) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (hasUtf8Bom(view)) return new TextDecoder('utf-8').decode(view);

    let utf8Text = null;
    try {
      utf8Text = new TextDecoder('utf-8', { fatal: true }).decode(view);
    } catch {
      /* Not even well-formed UTF-8: windows-874 is the only candidate. */
    }
    const thaiText = new TextDecoder('windows-874').decode(view);
    if (utf8Text === null) return thaiText;

    return thaiReadabilityScore(utf8Text) > thaiReadabilityScore(thaiText) ? utf8Text : thaiText;
  }

  function parseCsvLine(line) {
    const cells = [];
    let value = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (ch === ',' && !quoted) {
        cells.push(clean(value));
        value = '';
      } else {
        value += ch;
      }
    }
    cells.push(clean(value));
    return cells;
  }

  function parseRows(text) {
    return String(text).replace(/^﻿/, '').split(/\r?\n/).map(parseCsvLine);
  }

  const NON_MATERIAL_GROUPS = ['77', '88', '99'];

  /* Roofing/walling/fencing product descriptions follow
     "{profile}/{colour}/{thickness}[annotation]/{length}ม/{sheets}ผ", split
     by '/', but the export truncates many descriptions (Express's own
     printed column width, not a parsing defect), so trailing segments are
     often missing. Returns null — counted as unmapped, never guessed at —
     when the description does not have this shape at all: hardware,
     screws, tools and services (groups outside the roofing/walling/fencing
     families) do not, and are excluded by prd.md section 12.1 anyway. */
  function parseRoofingAttributes(description, group) {
    if (NON_MATERIAL_GROUPS.includes(String(group))) return null;
    const segments = String(description ?? '').split('/');
    if (segments.length < 3) return null;
    const profile = segments[0].trim();
    const color = segments[1].trim();
    const thicknessMatch = segments[2].match(/(\d+(?:\.\d+)?)/);
    if (!profile || !color || !thicknessMatch) return null;
    return { profile, color, thicknessMm: Number(thicknessMatch[1]) };
  }

  function parseNumber(value) {
    const normalized = clean(value).replace(/,/g, '').replace(/\s+/g, '');
    if (!normalized) return 0;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function normalizeStaffCode(value) {
    const raw = clean(value);
    if (!raw) return 'UNASSIGNED';
    if (/^\d+$/.test(raw)) return String(Number(raw)).padStart(2, '0');
    return raw.toUpperCase();
  }

  function parseThaiDate(value) {
    const match = clean(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!match) return '';
    let year = Number(match[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    if (year > 2400) year -= 543;
    const month = Number(match[2]);
    const day = Number(match[1]);
    const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const parsed = new Date(`${iso}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : '';
  }

  function stableId(value, prefix) {
    let hash = 2166136261;
    for (const ch of clean(value).toLowerCase()) {
      hash ^= ch.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return `${prefix}-${(hash >>> 0).toString(36).toUpperCase()}`;
  }

  function classify(text) {
    const sample = String(text).slice(0, 12000);
    if (sample.includes('รายงานขายเงินสด')) return 'cash';
    if (sample.includes('รายงานใบกำกับสินค้า')) return 'credit';
    if (sample.includes('รายงานใบรับมัดจำ')) return 'deposit';
    return 'unknown';
  }

  function splitCombinedProduct(value) {
    const match = clean(value).match(/^([A-Z0-9]+(?:[-._/][A-Z0-9]+)+)\s*-\s*(.*)$/i);
    return match ? { sku: match[1].toUpperCase(), description: clean(match[2]) } : null;
  }

  function monthEnd(month) {
    const [year, value] = month.split('-').map(Number);
    return `${month}-${String(new Date(Date.UTC(year, value, 0)).getUTCDate()).padStart(2, '0')}`;
  }

  /* Temporary product-group names by SKU prefix, analysed from the real
     Express data pending client confirmation (see prd.md S13). Prefixes not
     in this table fall back to the plain "SKU <prefix>" label as before. */
  const GROUP_NAMES = {
    '01': { en: 'Bare zinc/galvanized sheet', th: 'สังกะสีเปลือย' },
    '02': { en: 'Standard coated paint', th: 'สีเคลือบมาตรฐาน' },
    '03': { en: 'Branded coated paint', th: 'สีเคลือบมีแบรนด์' },
    '04': { en: 'Special / imported paint', th: 'สีพิเศษ/นำเข้า' },
    '08': { en: 'Ceiling panel', th: 'แผ่นฝ้า' },
    '13': { en: 'Fencing', th: 'รั้ว' },
    '88': { en: 'PU foam insulation', th: 'ฉนวน PU' },
    '77': { en: 'Service fee', th: 'ค่าบริการ' },
  };
  function groupName(prefix, lang) {
    const known = GROUP_NAMES[prefix];
    if (!known) return lang === 'th' ? `กลุ่ม ${prefix}` : `SKU ${prefix}`;
    return `${prefix} · ${known[lang]} *`;
  }

  /* documents: the newly selected files. existing: the currently loaded
     dataset (optional) — only ever consulted when the new files contain no
     cash/credit sales, to allow adding deposit receipts on their own after
     sales are already loaded. When sales documents ARE present, this is a
     fresh, from-scratch rebuild exactly as before, and `existing` is not
     read at all — importing sales has always replaced the dataset. */
  function buildDataset(documents, existing) {
    const recognized = documents.map(document => ({
      ...document,
      type: classify(document.text),
      rows: parseRows(document.text),
    }));
    const unknown = recognized.filter(document => document.type === 'unknown');
    if (unknown.length) throw new Error(`Unsupported Express CSV: ${unknown.map(document => document.name).join(', ')}`);

    const hasSalesDocs = recognized.some(document => document.type === 'cash' || document.type === 'credit');
    const hasDepositDocs = recognized.some(document => document.type === 'deposit');
    const depositOnlyMerge = !hasSalesDocs && hasDepositDocs && !!existing;

    if (!hasSalesDocs && !hasDepositDocs) {
      throw new Error('Select at least one cash-sales or credit-sales CSV file.');
    }
    if (!hasSalesDocs && hasDepositDocs && !existing) {
      throw new Error('Deposit receipts alone cannot start a new dataset: they carry no sales date to set the reporting month from. Import at least one cash-sales or credit-sales CSV first, then add deposit files afterwards.');
    }

    const products = new Map((depositOnlyMerge ? existing.products : []).map(p => [p.sku, { ...p }]));
    const customers = new Map((depositOnlyMerge ? existing.customers : []).map(c => [c.id, { ...c }]));
    const customerByName = new Map((depositOnlyMerge ? existing.customers : []).map(c => [c.name.toLowerCase(), c.id]));
    const salespeople = new Map((depositOnlyMerge ? existing.salespeople : []).map(p => [p.id, { ...p }]));
    const sales = depositOnlyMerge ? [...existing.sales] : [];
    const adjustments = depositOnlyMerge ? [...existing.adjustments] : [];
    const unresolved = [];

    function ensureCustomer(id, name) {
      const customerName = clean(name) || clean(id) || 'Unknown customer';
      const customerId = clean(id) || stableId(customerName, 'EXP-C');
      if (!customers.has(customerId)) {
        customers.set(customerId, {
          id: customerId,
          name: customerName,
          segment: 'Express import',
          segmentTh: 'นำเข้าจาก Express',
        });
      } else if (customers.get(customerId).name === customerId && customerName !== customerId) {
        customers.get(customerId).name = customerName;
      }
      customerByName.set(customerName.toLowerCase(), customerId);
      return customerId;
    }

    function ensureSalesperson(code) {
      const staffId = normalizeStaffCode(code);
      const id = `EXP-S-${staffId}`;
      if (!salespeople.has(id)) {
        salespeople.set(id, {
          id,
          staffId,
          name: staffId === 'UNASSIGNED' ? 'Unassigned salesperson' : `Salesperson ${staffId}`,
          th: staffId === 'UNASSIGNED' ? 'ไม่ระบุพนักงานขาย' : `พนักงาน ${staffId}`,
        });
      }
      return id;
    }

    function ensureProduct(sku, description, unit, price) {
      const code = clean(sku).toUpperCase();
      const productName = clean(description) || code;
      const productUnit = clean(unit) || 'unit';
      const prefix = code.split(/[-._/]/)[0] || 'Imported';
      if (!products.has(code)) {
        products.set(code, {
          sku: code,
          name: productName,
          th: productName,
          group: groupName(prefix, 'en'),
          groupTh: groupName(prefix, 'th'),
          unit: productUnit,
          unitTh: productUnit,
          base: 0,
          price: parseNumber(price),
          leadDays: 0,
          pack: 1,
          onHand: 0,
          committed: 0,
          inbound: 0,
          stockDate: '2000-01-01',
          inboundDue: null,
        });
      } else {
        const product = products.get(code);
        if (product.name === code && productName !== code) product.name = product.th = productName;
        if (product.unit === 'unit' && productUnit !== 'unit') product.unit = product.unitTh = productUnit;
        if (!product.price && parseNumber(price)) product.price = parseNumber(price);
      }
      return code;
    }

    function addSale(context, line, source) {
      if (!context || !line.sku || !line.quantity) return;
      const sku = ensureProduct(line.sku, line.description, line.unit, line.price);
      sales.push({
        id: `EXP-L-${sales.length + 1}`,
        invoice: context.invoice,
        date: context.date,
        sku,
        customer: context.customer,
        salesperson: context.salesperson,
        quantity: line.quantity,
        amount: line.amount,
        sourceType: context.type,
        sourceFile: source.name,
        sourceLine: source.line,
        qualityFlags: line.amount === 0 ? ['free-or-zero-value-line'] : [],
      });
    }

    for (const document of recognized.filter(item => item.type === 'cash')) {
      let context = null;
      document.rows.forEach((row, index) => {
        const date = parseThaiDate(row[0]);
        if (date && /^HS/i.test(clean(row[1]))) {
          const customer = ensureCustomer(row[2], row[3]);
          context = { type: 'cash', date, invoice: clean(row[1]), customer, salesperson: ensureSalesperson(row[4]) };
          return;
        }
        if (context && !clean(row[0]) && /^\d+$/.test(clean(row[1]))) {
          const product = splitCombinedProduct(row[2]);
          if (!product) {
            unresolved.push({ file: document.name, line: index + 1, reason: 'Unrecognized cash-sale product line' });
            return;
          }
          addSale(context, {
            ...product,
            quantity: parseNumber(row[3]),
            unit: row[4],
            price: row[5],
            amount: parseNumber(row[7]),
          }, { name: document.name, line: index + 1 });
        }
      });
    }

    for (const document of recognized.filter(item => item.type === 'credit')) {
      let context = null;
      document.rows.forEach((row, index) => {
        const date = parseThaiDate(row[0]);
        if (date && /^IV/i.test(clean(row[1]))) {
          const customerName = clean(row[2]);
          const existingId = customerByName.get(customerName.toLowerCase());
          const customer = ensureCustomer(existingId || stableId(customerName, 'EXP-C'), customerName);
          context = { type: 'credit', date, invoice: clean(row[1]), customer, salesperson: ensureSalesperson(row[3]) };
          return;
        }
        if (context && !clean(row[0]) && /^\d+$/.test(clean(row[1]))) {
          const product = splitCombinedProduct(row[2]);
          if (!product) {
            unresolved.push({ file: document.name, line: index + 1, reason: 'Unrecognized credit-sale product line' });
            return;
          }
          addSale(context, {
            sku: product.sku,
            description: clean(row[3]) || product.description,
            quantity: parseNumber(row[4]),
            unit: row[5],
            price: row[6],
            amount: parseNumber(row[8]),
          }, { name: document.name, line: index + 1 });
        }
      });
    }

    for (const document of recognized.filter(item => item.type === 'deposit')) {
      let customer = '';
      document.rows.forEach((row, index) => {
        if (row.length === 1) {
          const value = clean(row[0]);
          const match = value.match(/^(.+?)\s*\/\s*([^/\s]+)\s*$/);
          if (match && !value.startsWith('รวม ')) customer = ensureCustomer(match[2], match[1]);
          return;
        }
        const documentNumber = clean(row[1]);
        const date = parseThaiDate(row[2]);
        if (customer && /^AI/i.test(documentNumber) && date) {
          adjustments.push({
            id: `EXP-A-${adjustments.length + 1}`,
            kind: 'deposit',
            document: documentNumber,
            date,
            customer,
            salesperson: ensureSalesperson(row[3]),
            amount: parseNumber(row[7]) || parseNumber(row[5]),
            sourceFile: document.name,
            sourceLine: index + 1,
          });
        }
      });
    }

    if (depositOnlyMerge) {
      /* sales, products and completeThrough all carry over from the
         existing dataset unchanged — nothing here re-derives them, since
         a deposit file has no sale date to derive them from. Only
         customers, salespeople and adjustments can have grown. */
      const usedSalespeople = new Set([...sales.map(row => row.salesperson), ...adjustments.map(row => row.salesperson)]);
      return {
        version: 1,
        demo: false,
        completeThrough: existing.completeThrough,
        products: [...products.values()].sort((a, b) => a.sku.localeCompare(b.sku)),
        salespeople: [...salespeople.values()].filter(person => usedSalespeople.has(person.id)).sort((a, b) => a.staffId.localeCompare(b.staffId)),
        customers: [...customers.values()].sort((a, b) => a.id.localeCompare(b.id)),
        sales,
        adjustments,
        importSummary: {
          format: 'express-csv',
          files: [...(existing.importSummary?.files || []), ...recognized.map(document => ({ name: document.name, type: document.type }))],
          unresolvedRows: [...(existing.importSummary?.unresolvedRows || []), ...unresolved],
        },
      };
    }

    if (!sales.length) throw new Error('No sale lines were found in the selected Express CSV files.');
    const dates = sales.map(row => row.date).sort();
    const completeThrough = dates.at(-1).slice(0, 7);
    const stockDate = monthEnd(completeThrough);
    for (const product of products.values()) product.stockDate = stockDate;

    const usedSalespeople = new Set(sales.map(row => row.salesperson));
    return {
      version: 1,
      demo: false,
      completeThrough,
      products: [...products.values()].sort((a, b) => a.sku.localeCompare(b.sku)),
      salespeople: [...salespeople.values()].filter(person => usedSalespeople.has(person.id)).sort((a, b) => a.staffId.localeCompare(b.staffId)),
      customers: [...customers.values()].sort((a, b) => a.id.localeCompare(b.id)),
      sales,
      adjustments,
      importSummary: {
        format: 'express-csv',
        files: recognized.map(document => ({ name: document.name, type: document.type })),
        unresolvedRows: unresolved,
      },
    };
  }

  root.ExpressCsvImporter = { parseCsvLine, parseRows, parseThaiDate, classify, buildDataset, decodeExpressBytes, parseRoofingAttributes };
  if (typeof module !== 'undefined') module.exports = root.ExpressCsvImporter;
})(typeof window === 'undefined' ? globalThis : window);
