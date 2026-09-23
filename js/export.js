/* js/export.js — the CEO summary in three formats, built on this device.
 *
 *   CeoExport.xlsx(summary)        -> Uint8Array, an Excel workbook (.xlsx)
 *   CeoExport.reportHtml(summary)  -> HTML page, A4 report (print / Save as PDF)
 *   CeoExport.slidesHtml(summary)  -> HTML page, 16:9 slides (print / Save as PDF)
 *
 * No library and no network: an .xlsx file is a zip of a few XML files, so this
 * file writes that zip itself (stored, not compressed) with a CRC-32 per entry.
 * It only formats the `summary` object that app.js builds from the numbers it
 * already shows; it calculates nothing new. Every text value is escaped.
 *
 * Units: money is always labelled and written in full in Thai (บาท, never
 * พัน/ล้าน), shortened only in English (k / M THB); forecast quantities always carry their own unit and are listed per
 * unit, never added or ranked across units.
 */
(function (root) {
  'use strict';

  /* ---------- shared helpers ---------- */

  const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const escXml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    // XML 1.0 forbids most control characters; drop them rather than write a broken file.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const finite = (v) => typeof v === 'number' && Number.isFinite(v);

  function fmt(lang) {
    const th = lang === 'th';
    const locale = th ? 'th-TH' : 'en-US';
    const number = (v, d = 0) => (finite(v) ? v.toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
    return {
      num: number,
      /* Full amount with its unit: "12,345,678.90 บาท" / "THB 12,345,678.90". */
      money: (v) => (finite(v) ? (th ? number(v, 2) + ' บาท' : 'THB ' + number(v, 2)) : '—'),
      pct: (v, signed) => (finite(v) ? (signed && v > 0 ? '+' : '') + number(v * 100, 1) + '%' : '—'),
      /* Short money. Thai is never shortened (พัน/ล้าน abbreviations are easy to
         misread), so in Thai this is the full amount in baht; English uses
         "12.35 M THB" / "123.4 k THB". */
      compact: (v) => {
        if (!finite(v)) return '—';
        if (th) return number(v, 2) + ' บาท';
        if (Math.abs(v) >= 1e6) return number(v / 1e6, 2) + ' M THB';
        if (Math.abs(v) >= 1e3) return number(v / 1e3, 1) + ' k THB';
        return number(v, 0) + ' THB';
      },
      /* Chart bar labels and heat-map cells (unit stated in the title):
         Thai = whole baht, English = millions / thousands. */
      millions: (v) => (finite(v) ? (th ? number(v, 0) : number(v / 1e6, 2)) : '—'),
      thousands: (v) => (finite(v) ? (th ? number(v, 0) : number(v / 1e3, 0)) : '—'),
    };
  }

  const words = {
    th: {
      report: 'รายงานสรุปยอดขายสำหรับผู้บริหาร', slides: 'สรุปยอดขายสำหรับผู้บริหาร', period: 'ช่วงข้อมูล', generated: 'จัดทำเมื่อ',
      print: 'พิมพ์ / บันทึกเป็น PDF', printHint: 'กดปุ่มแล้วเลือกปลายทาง “บันทึกเป็น PDF”',
      sales: 'ยอดขาย', invoices: 'ใบกำกับ', customers: 'ลูกค้า', average: 'เฉลี่ยต่อใบกำกับ', change: 'เทียบช่วงก่อนหน้า',
      monthly: 'ยอดขายรายเดือน', monthlyUnit: 'หน่วย: บาท ปัดเศษสตางค์', sellers: 'ยอดขายตามพนักงานขาย', topCustomers: 'ลูกค้ายอดขายสูงสุด', topProducts: 'สินค้ายอดขายสูงสุด',
      groups: 'สัดส่วนยอดขายตามกลุ่มสินค้า', forecast: 'คาดการณ์เดือนถัดไป (ระดับกลุ่มสินค้า)', accuracy: 'เชื่อการคาดการณ์ได้แค่ไหน',
      insights: 'ประเด็นสำคัญ', notes: 'ที่มา หน่วย และข้อจำกัด', name: 'ชื่อ', share: 'สัดส่วน', quantity: 'จำนวน', group: 'กลุ่ม',
      value: 'คาดการณ์', range: 'ช่วงที่น่าจะเป็น', grade: 'ระดับ', months: 'เดือนที่ทดสอบ', rank: 'อันดับ', sku: 'รหัส',
      month: 'เดือน', item: 'รายการ', thanks: 'ข้อมูลอ่านจากไฟล์ Express บนเครื่องนี้ ไม่มีการส่งขึ้นเซิร์ฟเวอร์',
      summarySheet: 'สรุป', monthlySheet: 'รายเดือน', sellersSheet: 'พนักงานขาย', customersSheet: 'ลูกค้า', productsSheet: 'สินค้า',
      groupsSheet: 'กลุ่มสินค้า', forecastSheet: 'คาดการณ์', channelSheet: 'ช่องทาง', heatGroupSheet: 'กลุ่ม×เดือน', heatSellerSheet: 'พนักงาน×เดือน', heatWeekdaySheet: 'วัน×เดือน',
      source: 'แหล่งข้อมูล', unit: 'หน่วย', of: 'จาก', baht: 'บาท', value2: 'ค่า',
      channels: 'ช่องทางการขาย', concentration: 'การกระจุกตัวของลูกค้า', top1: 'ลูกค้ารายใหญ่สุด', top10: 'ลูกค้า 10 อันดับแรก', for80: 'จำนวนลูกค้าที่ทำยอด 80%',
      heatGroup: 'ยอดขายตามกลุ่มสินค้า × เดือน', heatSeller: 'ยอดขายตามพนักงานขาย × เดือน', heatWeekday: 'ยอดขายตามวันในสัปดาห์ × เดือน',
      heatNote: 'หน่วยในตาราง: บาท ปัดเศษสตางค์ · สีเข้ม = ยอดสูงกว่าในตารางเดียวกัน',
      growth: 'กลุ่มสินค้าที่เปลี่ยนแปลงมากที่สุด เทียบช่วงก่อนหน้า', before: 'ช่วงก่อน', now: 'ช่วงนี้', diff: 'เปลี่ยนแปลง',
      verdict: 'สรุป', vsLast: 'เทียบเดือนล่าสุด', lowBase: 'เดือนล่าสุดขายน้อยผิดปกติ', unitOnly: 'นับเฉพาะหน่วยหลัก',
      avgInvoice: 'เฉลี่ยต่อใบกำกับ', lastMonth: 'ยอดเดือนล่าสุด',
      metricHelp: 'WAPE = คลาดเคลื่อนรวมเทียบยอดรวม (ตัวหลัก) · MAPE = คลาดเคลื่อนเฉลี่ยรายเดือน · MAE/RMSE = คลาดเคลื่อนในหน่วยสินค้า · Bias + = คาดสูงเกิน · MASE < 1 = ดีกว่าการเดาเท่าเดือนก่อน',
      verdictHelp: 'เชื่อได้ = ทดสอบอย่างน้อย 3 เดือน คลาดเคลื่อนไม่เกิน 15% และดีกว่าการเดาเท่าเดือนก่อน · ใช้ประกอบ = คลาดเคลื่อนไม่เกิน 25% หรือยังไม่ดีกว่าการเดาเท่าเดือนก่อน หรือทดสอบน้อยกว่า 3 เดือน · อย่าเพิ่งใช้ = คลาดเคลื่อนเกิน 25%',
      confidential: 'ข้อมูลภายใน มีชื่อลูกค้าและยอดเงิน โปรดเก็บเป็นความลับ',
    },
    en: {
      report: 'Executive sales summary', slides: 'Executive sales summary', period: 'Period', generated: 'Generated',
      print: 'Print / Save as PDF', printHint: 'Press the button, then choose “Save as PDF” as the destination',
      sales: 'Sales', invoices: 'Invoices', customers: 'Customers', average: 'Average invoice', change: 'vs previous period',
      monthly: 'Monthly sales', monthlyUnit: 'Unit: million THB', sellers: 'Sales by salesperson', topCustomers: 'Top customers', topProducts: 'Top products',
      groups: 'Sales share by product group', forecast: 'Next-month forecast (product groups)', accuracy: 'How far can each forecast be trusted',
      insights: 'Key points', notes: 'Source, units and limitations', name: 'Name', share: 'Share', quantity: 'Quantity', group: 'Group',
      value: 'Forecast', range: 'Likely range', grade: 'Grade', months: 'Months tested', rank: 'Rank', sku: 'SKU',
      month: 'Month', item: 'Item', thanks: 'Read from the Express files on this device; nothing was sent to a server.',
      summarySheet: 'Summary', monthlySheet: 'Monthly', sellersSheet: 'Salespeople', customersSheet: 'Customers', productsSheet: 'Products',
      groupsSheet: 'Product groups', forecastSheet: 'Forecast', channelSheet: 'Channels', heatGroupSheet: 'Group x month', heatSellerSheet: 'Salesperson x month', heatWeekdaySheet: 'Weekday x month',
      source: 'Source', unit: 'Unit', of: 'of', baht: 'THB', value2: 'Value',
      channels: 'Sales channels', concentration: 'Customer concentration', top1: 'Largest customer', top10: 'Top 10 customers', for80: 'Customers making up 80% of sales',
      heatGroup: 'Sales by product group × month', heatSeller: 'Sales by salesperson × month', heatWeekday: 'Sales by weekday × month',
      heatNote: 'Values in thousand THB · darker = higher within the same table',
      growth: 'Product groups that changed most vs the previous period', before: 'Before', now: 'Now', diff: 'Change',
      verdict: 'Verdict', vsLast: 'vs last month', lowBase: 'last month sold unusually little', unitOnly: 'main unit only',
      avgInvoice: 'Average invoice', lastMonth: 'Last month',
      metricHelp: 'WAPE = total miss vs total sales (headline) · MAPE = average monthly miss · MAE/RMSE = miss in product units · Bias + = forecast too high · MASE < 1 = better than repeating last month',
      verdictHelp: 'Reliable = at least 3 months tested, error within 15%, better than repeating last month · Guide only = error up to 25%, not better than repeating last month, or fewer than 3 months tested · Do not rely = error above 25%',
      confidential: 'Internal: contains customer names and amounts. Keep confidential.',
    },
  };

  /* Forecast rows split by unit, so no table mixes metres with pieces. */
  function byUnit(rows) {
    const map = new Map();
    for (const r of rows) { if (!map.has(r.unit)) map.set(r.unit, []); map.get(r.unit).push(r); }
    return [...map.entries()];
  }

  /* ---------- .xlsx (zip of XML) ---------- */

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  /* A zip with every entry stored (method 0). Fixed 1980-01-01 timestamps keep
     the output identical for identical input. */
  function zip(entries) {
    const encoder = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    for (const entry of entries) {
      const name = encoder.encode(entry.name);
      const data = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
      const crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); // UTF-8 names
      local.setUint16(8, 0, true); local.setUint16(10, 0, true); local.setUint16(12, 0x21, true);
      local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), name, data);
      const dir = new DataView(new ArrayBuffer(46));
      dir.setUint32(0, 0x02014b50, true); dir.setUint16(4, 20, true); dir.setUint16(6, 20, true); dir.setUint16(8, 0x0800, true);
      dir.setUint16(10, 0, true); dir.setUint16(12, 0, true); dir.setUint16(14, 0x21, true);
      dir.setUint32(16, crc, true); dir.setUint32(20, data.length, true); dir.setUint32(24, data.length, true);
      dir.setUint16(28, name.length, true); dir.setUint16(30, 0, true); dir.setUint16(32, 0, true);
      dir.setUint16(34, 0, true); dir.setUint16(36, 0, true); dir.setUint32(38, 0, true); dir.setUint32(42, offset, true);
      central.push(new Uint8Array(dir.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const centralSize = central.reduce((sum, p) => sum + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((sum, p) => sum + p.length, 0));
    let at = 0;
    for (const p of all) { out.set(p, at); at += p.length; }
    return out;
  }

  /* Cell styles (index into cellXfs below). */
  const STYLE = { text: 0, header: 1, money: 2, pct: 3, int: 4, num1: 5, ratio: 6, title: 7, label: 8 };
  const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="5"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="0.0%"/><numFmt numFmtId="166" formatCode="#,##0"/><numFmt numFmtId="167" formatCode="#,##0.0"/><numFmt numFmtId="168" formatCode="0.00"/></numFmts>' +
    '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EFF9"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="9">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="168" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  const colName = (i) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

  /* rows: arrays of cells; a cell is null, a string, or {v, s} with s a STYLE key. */
  function sheetXml(sheet) {
    const cols = (sheet.widths || []).map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('');
    const rows = sheet.rows.map((row, r) => '<row r="' + (r + 1) + '">' + row.map((cell, c) => {
      if (cell === null || cell === undefined || cell === '') return '';
      const ref = colName(c) + (r + 1);
      const value = typeof cell === 'object' ? cell.v : cell;
      const style = typeof cell === 'object' && cell.s ? STYLE[cell.s] : 0;
      if (typeof value === 'number') return finite(value) ? '<c r="' + ref + '" s="' + style + '"><v>' + value + '</v></c>' : '';
      /* Inline strings are never read as formulas, so text that starts with
         = + - @ cannot run in Excel. */
      return '<c r="' + ref + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">' + escXml(value) + '</t></is></c>';
    }).join('') + '</row>').join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      (cols ? '<cols>' + cols + '</cols>' : '') + '<sheetData>' + rows + '</sheetData>' +
      /* Heat-map sheets: Excel shades the range itself (white -> brand blue). */
      (sheet.colorScale ? '<conditionalFormatting sqref="' + sheet.colorScale + '"><cfRule type="colorScale" priority="1"><colorScale><cfvo type="min"/><cfvo type="max"/><color rgb="FFF3F6FA"/><color rgb="FF3F5A94"/></colorScale></cfRule></conditionalFormatting>' : '') +
      '</worksheet>';
  }

  const safeSheetName = (name, used) => {
    let base = String(name).replace(/[\[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet';
    let candidate = base, n = 2;
    while (used.has(candidate)) candidate = base.slice(0, 28) + ' ' + n++;
    used.add(candidate);
    return candidate;
  };

  function workbook(sheets) {
    const used = new Set();
    const names = sheets.map((s) => safeSheetName(s.name, used));
    const entries = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + names.map((n, i) => '<sheet name="' + escXml(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: STYLES_XML },
      ...sheets.map((s, i) => ({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s) })),
    ];
    return zip(entries);
  }


  function xlsx(summary) {
    const w = words[summary.lang] || words.th;
    const h = (text) => ({ v: text, s: 'header' });
    const money = (v) => ({ v, s: 'money' }), pct = (v) => ({ v, s: 'pct' }), int = (v) => ({ v, s: 'int' }), num1 = (v) => ({ v, s: 'num1' }), ratio = (v) => ({ v, s: 'ratio' });
    const k = summary.kpis, c = summary.concentration;
    const baht = ' (' + w.baht + ')';
    /* A heat-map sheet: rows x months in baht, shaded by Excel's colour scale. */
    const heatSheet = (name, title, rows) => ({
      name, widths: [30, ...summary.heatmaps.months.map(() => 14), 16],
      colorScale: rows.length && summary.heatmaps.months.length ? 'B3:' + colName(summary.heatmaps.months.length) + (rows.length + 2) : '',
      rows: [
        [{ v: title + baht, s: 'label' }],
        [h(''), ...summary.heatmaps.months.map(h), h((summary.lang === 'th' ? 'รวม' : 'Total') + baht)],
        ...rows.map((r) => [r.name, ...r.values.map(money), money(r.values.reduce((a, b) => a + b, 0))]),
      ],
    });
    const sheets = [
      {
        name: w.summarySheet, widths: [40, 60],
        rows: [
          [{ v: summary.company, s: 'title' }],
          [{ v: w.report, s: 'label' }],
          [w.period, summary.period.label],
          [w.generated, summary.generatedLabel],
          [w.source, summary.sourceLabel],
          [],
          [h(w.item), h(w.value2)],
          [w.sales + baht, money(k.sales)],
          [w.invoices, int(k.invoices)],
          [w.customers, int(k.customers)],
          [w.average + baht, money(k.average)],
          [w.change + ' (' + k.priorLabel + ')', k.change === null ? '—' : pct(k.change)],
          [w.top1, pct(c.top1)],
          [w.top10, pct(c.top10)],
          [w.for80, c.customersFor80 + ' ' + w.of + ' ' + c.customerCount],
          [],
          [{ v: w.insights, s: 'label' }],
          ...summary.insights.map((line) => ['•', line]),
          [],
          [{ v: w.notes, s: 'label' }],
          ...summary.notes.map((line) => ['•', line]),
          ['', w.confidential],
        ],
      },
      {
        name: w.monthlySheet, widths: [18, 20, 12, 20],
        rows: [[h(w.month), h(w.sales + baht), h(w.invoices), h(w.avgInvoice + baht)], ...summary.monthly.map((m) => [m.label, money(m.sales), int(m.invoices), money(m.average)])],
      },
      {
        name: w.channelSheet, widths: [20, 20, 12, 12, 10],
        rows: [[h(w.channels), h(w.sales + baht), h(w.invoices), h(w.customers), h(w.share)], ...summary.channels.map((r) => [r.name, money(r.sales), int(r.invoices), int(r.customers), pct(r.share)])],
      },
      heatSheet(w.heatGroupSheet, w.heatGroup, summary.heatmaps.groupMonth),
      heatSheet(w.heatSellerSheet, w.heatSeller, summary.heatmaps.sellerMonth),
      heatSheet(w.heatWeekdaySheet, w.heatWeekday, summary.heatmaps.weekdayMonth),
      {
        name: w.sellersSheet, widths: [28, 20, 12, 10],
        rows: [[h(w.name), h(w.sales + baht), h(w.invoices), h(w.share)], ...summary.sellers.map((r) => [r.name, money(r.sales), int(r.invoices), pct(r.share)])],
      },
      {
        name: w.customersSheet, widths: [8, 44, 20, 12, 10],
        rows: [[h(w.rank), h(w.name), h(w.sales + baht), h(w.invoices), h(w.share)], ...summary.allCustomers.map((r, i) => [int(i + 1), r.name, money(r.sales), int(r.invoices), pct(r.share)])],
      },
      {
        name: w.productsSheet, widths: [8, 12, 50, 20, 14, 10, 10],
        rows: [[h(w.rank), h(w.sku), h(w.name), h(w.sales + baht), h(w.quantity), h(w.unit), h(w.share)], ...summary.allProducts.map((r, i) => [int(i + 1), r.sku, r.name, money(r.sales), num1(r.quantity), r.unit, pct(r.share)])],
      },
      {
        name: w.groupsSheet, widths: [36, 20, 10, 20, 20],
        rows: [[h(w.group), h(w.sales + baht), h(w.share), h(w.before + baht), h(w.diff + baht)], ...summary.groups.map((r) => { const g = summary.growth.find((x) => x.name === r.name); return [r.name, money(r.sales), pct(r.share), g ? money(g.before) : '—', g ? money(g.diff) : '—']; })],
      },
      {
        name: w.forecastSheet, widths: [30, 10, 14, 16, 14, 14, 20, 22, 9, 9, 12, 12, 9, 9, 12, 14],
        rows: [
          [{ v: w.forecast + ' · ' + summary.forecast.monthLabel, s: 'label' }],
          [h(w.group), h(w.unit), h(w.value), h(w.lastMonth), h(w.vsLast), h(w.range + ' ↓'), h(w.range + ' ↑'), h(w.verdict), h('WAPE'), h('MAPE'), h('MAE'), h('RMSE'), h('Bias'), h('MASE'), h(w.months), h(w.unitOnly)],
          ...summary.forecast.rows.map((r) => [r.name, r.unit, num1(r.value), num1(r.lastValue), r.lowBase ? w.lowBase : pct(r.change), num1(r.low), num1(r.high), r.verdict, pct(r.wape), pct(r.mape), num1(r.mae), num1(r.rmse), pct(r.bias), ratio(r.mase), int(r.n), pct(r.unitShare)]),
          [],
          [w.verdictHelp],
          [w.metricHelp],
        ],
      },
    ];
    return workbook(sheets);
  }

  /* ---------- charts and tables for the printable pages ---------- */

  function barChart(items, { width = 680, height = 220, color = '#3f5a94', valueText = (v) => v } = {}) {
    if (!items.length) return '';
    const max = Math.max(1, ...items.map((i) => i.value));
    const pad = { l: 8, r: 8, t: 22, b: 30 }, gap = 8;
    const barW = (width - pad.l - pad.r - gap * (items.length - 1)) / items.length;
    const inner = height - pad.t - pad.b;
    const bars = items.map((item, i) => {
      const bh = Math.max(item.value > 0 ? 2 : 0, item.value / max * inner), x = pad.l + i * (barW + gap), y = pad.t + inner - bh;
      return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="3" fill="' + color + '"/>' +
        (items.length <= 14 ? '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" text-anchor="middle" class="v">' + escHtml(valueText(item.value)) + '</text>' : '') +
        '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (height - 10) + '" text-anchor="middle" class="l">' + escHtml(item.label) + '</text>';
    }).join('');
    return '<svg viewBox="0 0 ' + width + ' ' + height + '" class="chart" role="img">' + bars + '</svg>';
  }

  function hBars(items, valueText, { color = '#3f5a94' } = {}) {
    const max = Math.max(1, ...items.map((i) => i.value));
    return '<div class="hbars">' + items.map((item) => '<div class="hbar"><span class="hbar-name">' + escHtml(item.name) + '</span><span class="hbar-track"><i style="width:' + (Math.max(0, item.value) / max * 100).toFixed(1) + '%;background:' + color + '"></i></span><span class="hbar-value">' + escHtml(valueText(item)) + '</span></div>').join('') + '</div>';
  }

  /* Heat map as a table: one shade scale for the whole table (all cells are baht),
     five steps from light to brand blue; the value is whole baht in Thai,
   thousand baht in English. */
  function heatTable(title, months, rows, f, w) {
    if (!rows.length || !months.length) return '';
    const max = Math.max(1, ...rows.flatMap((r) => r.values));
    const steps = ['#f3f6fa', '#d6e0ee', '#a9bcd9', '#6f8cbd', '#3f5a94'];
    const cell = (v) => {
      if (!(v > 0)) return '<td class="hm0">–</td>';
      const i = Math.min(4, Math.floor(v / max * 4.999));
      return '<td style="background:' + steps[i] + ';color:' + (i >= 3 ? '#fff' : '#1f2f3d') + '">' + f.thousands(v) + '</td>';
    };
    return '<div class="heat' + (w === words.th ? ' heat-full' : '') + '"><h3>' + escHtml(title) + '</h3><table class="hm"><tr><th></th>' + months.map((m) => '<th>' + escHtml(m) + '</th>').join('') + '</tr>' +
      rows.map((r) => '<tr><th class="rh">' + escHtml(r.name) + '</th>' + r.values.map(cell).join('') + '</tr>').join('') + '</table></div>';
  }

  const verdictBadge = (r) => '<span class="grade g-' + escHtml(r.verdictTone || 'warn') + '">' + escHtml(r.verdict || r.gradeLabel) + '</span>';

  /* Forecast tables, one per unit. */
  function forecastTables(rows, w, f, { metrics = true } = {}) {
    return byUnit(rows).map(([unit, list]) => {
      const head = '<tr><th>' + w.group + '</th><th class="n">' + w.value + ' (' + escHtml(unit) + ')</th><th class="n">' + w.vsLast + '</th><th class="n">' + w.range + ' (' + escHtml(unit) + ')</th><th>' + w.verdict + '</th>' + (metrics ? '<th class="n">WAPE</th><th class="n">MAPE</th><th class="n">Bias</th><th class="n">MASE</th><th class="n">' + w.months + '</th>' : '') + '</tr>';
      const body = list.map((r) => '<tr><td>' + escHtml(r.name) + (r.unitShare < 0.995 ? ' <small class="muted">(' + w.unitOnly + ' ' + f.pct(r.unitShare) + ')</small>' : '') + '</td><td class="n"><strong>' + f.num(r.value, 1) + '</strong></td><td class="n">' + (r.lowBase ? '<small>' + w.lowBase + '</small>' : f.pct(r.change, true)) + '</td><td class="n">' + f.num(r.low, 0) + ' – ' + f.num(r.high, 0) + '</td><td>' + verdictBadge(r) + '</td>' +
        (metrics ? '<td class="n">' + f.pct(r.wape) + '</td><td class="n">' + f.pct(r.mape) + '</td><td class="n">' + f.pct(r.bias, true) + '</td><td class="n">' + f.num(r.mase, 2) + '</td><td class="n">' + f.num(r.n) + '</td>' : '') + '</tr>').join('');
      return '<h3 class="unit-head">' + w.unit + ': ' + escHtml(unit) + '</h3><table class="fc">' + head + body + '</table>';
    }).join('');
  }

  const PAGE_CSS = `
  :root{--ink:#1f2f3d;--muted:#5d6f80;--line:#dde4ea;--accent:#3f5a94;--soft:#f3f6fa}
  *{box-sizing:border-box}html,body{margin:0;background:#e9edf1;color:var(--ink);font:13px/1.5 system-ui,-apple-system,"Segoe UI","Leelawadee UI","Sukhumvit Set","Noto Sans Thai","Noto Sans",Tahoma,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .toolbar{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center;padding:12px;background:#1f2f3d;color:#fff}
  .toolbar button{min-height:44px;padding:10px 20px;border:0;border-radius:999px;background:#fff;color:#1f2f3d;font:inherit;font-weight:700;cursor:pointer}
  .toolbar small{color:#cbd6e0}
  h1,h2,h3{margin:0;line-height:1.25}h2{font-size:17px;margin:0 0 10px}h3{font-size:13.5px;margin:0 0 6px}
  .muted{color:var(--muted)}.unit{font-size:11.5px;color:var(--muted);font-weight:400}
  table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:5px 7px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{background:var(--soft);font-weight:700}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kpi{padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff}.kpi small{display:block;color:var(--muted)}.kpi strong{display:block;font-size:19px;font-variant-numeric:tabular-nums}
  .chart{width:100%;height:auto}.chart .v{font-size:11px;fill:var(--muted)}.chart .l{font-size:11px;fill:var(--muted)}
  .hbars{display:grid;gap:6px}.hbar{display:grid;grid-template-columns:minmax(0,1.4fr) 2fr auto;gap:10px;align-items:center}.hbar-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hbar-track{height:10px;background:var(--soft);border-radius:99px;overflow:hidden}.hbar-track i{display:block;height:100%;border-radius:99px}.hbar-value{font-variant-numeric:tabular-nums;white-space:nowrap}
  .grade{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;white-space:nowrap}.g-good{background:#e3f2e6;color:#1f5a2c}.g-warn{background:#fff2d6;color:#6f4a00}.g-bad{background:#fde4e1;color:#8f2a21}
  table.hm{font-size:11px;table-layout:fixed}table.hm th,table.hm td{padding:3px 3px;text-align:center;border-bottom:2px solid #fff;border-right:2px solid #fff;font-variant-numeric:tabular-nums}table.hm th.rh{text-align:left;background:#fff;font-weight:600;width:27%;white-space:normal;line-height:1.25}table.hm td.hm0{color:#9aa7b4;background:#fafbfc}
  .heat{margin-bottom:12px;break-inside:avoid}.heat-full table.hm{font-size:9.5px}.heat-full table.hm th,.heat-full table.hm td{padding:3px 1px}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.stat{padding:10px;border:1px solid var(--line);border-radius:10px}.stat small{display:block;color:var(--muted)}.stat strong{font-size:17px}
  .unit-head{margin:10px 0 4px;color:var(--accent)}
  table:not(.hm) td:first-child{min-width:30mm}
  .sheet table:not(.hm){font-size:10.5px}.sheet table:not(.hm) th,.sheet table:not(.hm) td{padding:4px 3px}
  /* Forecast table on A4: ten columns, so the range wraps under itself if needed. */
  .sheet table.fc th.n,.sheet table.fc td.n{white-space:normal}
  ul.points{margin:0;padding-left:18px}ul.points li{margin:4px 0}
  .confidential{color:#8f2a21;font-weight:600}
  `;

  function page(title, css, body, lang) {
    const w = words[lang] || words.th;
    return '<!doctype html><html lang="' + (lang === 'en' ? 'en' : 'th') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + escHtml(title) + '</title><style>' + PAGE_CSS + css + '</style></head><body>' +
      '<div class="toolbar no-print"><button type="button" data-print onclick="window.print()">' + escHtml(w.print) + '</button><small>' + escHtml(w.printHint) + '</small></div>' + body + '</body></html>';
  }

  function channelBlock(summary, w, f) {
    const c = summary.concentration;
    return '<div class="stats">' + summary.channels.map((ch) => '<div class="stat"><small>' + escHtml(ch.name) + '</small><strong>' + f.compact(ch.sales) + '</strong><small>' + f.pct(ch.share) + ' · ' + f.num(ch.invoices) + ' ' + w.invoices + '</small></div>').join('') +
      '<div class="stat"><small>' + w.for80 + '</small><strong>' + f.num(c.customersFor80) + ' ' + w.of + ' ' + f.num(c.customerCount) + '</strong><small>' + w.top10 + ' ' + f.pct(c.top10) + ' · ' + w.top1 + ' ' + f.pct(c.top1) + '</small></div></div>';
  }

  function growthBlock(summary, w, f) {
    if (!summary.growth.length) return '';
    const top = summary.growth.slice(0, 3), bottom = summary.growth.slice(-3).reverse().filter((g) => !top.includes(g));
    const rows = [...top, ...bottom].map((g) => '<tr><td>' + escHtml(g.name) + '</td><td class="n">' + f.compact(g.before) + '</td><td class="n">' + f.compact(g.now) + '</td><td class="n"><strong style="color:' + (g.diff < 0 ? '#8f2a21' : '#1f5a2c') + '">' + (g.diff > 0 ? '+' : '') + f.compact(g.diff) + '</strong></td></tr>').join('');
    return '<h2>' + w.growth + '</h2><table><tr><th>' + w.group + '</th><th class="n">' + w.before + '</th><th class="n">' + w.now + '</th><th class="n">' + w.diff + '</th></tr>' + rows + '</table>';
  }

  /* ---------- A4 report (6 pages) ---------- */

  function reportHtml(summary) {
    const lang = summary.lang, w = words[lang] || words.th, f = fmt(lang), k = summary.kpis, hm = summary.heatmaps;
    const css = `
    .sheet{width:210mm;min-height:297mm;margin:16px auto;padding:13mm 13mm 11mm;background:#fff;box-shadow:0 6px 24px rgb(0 0 0/.12)}
    .sheet+.sheet{margin-top:24px}
    header.top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;padding-bottom:8px;margin-bottom:12px;border-bottom:3px solid var(--accent)}
    header.top h1{font-size:20px}section{margin:0 0 14px;break-inside:avoid}
    .two{display:grid;grid-template-columns:1fr 1fr;gap:18px}
    footer{margin-top:12px;padding-top:8px;border-top:1px solid var(--line);font-size:11px;color:var(--muted)}
    @page{size:A4;margin:0}
    @media print{html,body{background:#fff}.no-print{display:none}.sheet,.sheet+.sheet{margin:0;box-shadow:none;min-height:0;page-break-after:always}.sheet:last-child{page-break-after:auto}}
    @media screen and (max-width:800px){.sheet{width:auto;min-height:0;margin:8px;padding:16px}.kpis,.stats{grid-template-columns:repeat(2,1fr)}.two{grid-template-columns:1fr}}
    `;
    const header = '<header class="top"><div><div class="muted">' + escHtml(summary.company) + '</div><h1>' + escHtml(w.report) + '</h1></div><div class="muted" style="text-align:right">' + escHtml(w.period) + ': <strong>' + escHtml(summary.period.label) + '</strong><br>' + escHtml(w.generated) + ': ' + escHtml(summary.generatedLabel) + '</div></header>';
    const foot = '<footer>' + escHtml(w.thanks) + ' · <span class="confidential">' + escHtml(w.confidential) + '</span></footer>';
    const kpis = '<div class="kpis"><div class="kpi"><small>' + w.sales + '</small><strong>' + f.money(k.sales) + '</strong></div><div class="kpi"><small>' + w.invoices + '</small><strong>' + f.num(k.invoices) + '</strong><small>' + w.average + ' ' + f.money(k.average) + '</small></div><div class="kpi"><small>' + w.customers + '</small><strong>' + f.num(k.customers) + '</strong></div><div class="kpi"><small>' + w.change + '</small><strong>' + (k.change === null ? '—' : f.pct(k.change, true)) + '</strong><small>' + escHtml(k.priorLabel) + '</small></div></div>';
    const monthly = barChart(summary.monthly.map((m) => ({ label: m.shortLabel, value: m.sales })), { valueText: f.millions });
    const page1 = '<div class="sheet">' + header +
      '<section>' + kpis + '</section>' +
      '<section><h2>' + w.insights + '</h2><ul class="points">' + summary.insights.map((i) => '<li>' + escHtml(i) + '</li>').join('') + '</ul></section>' +
      '<section><h2>' + w.monthly + ' <span class="unit">(' + w.monthlyUnit + ')</span></h2>' + monthly + '</section>' + foot + '</div>';
    const page2 = '<div class="sheet">' + header +
      '<section><h2>' + w.channels + ' · ' + w.concentration + '</h2>' + channelBlock(summary, w, f) + '</section>' +
      /* One column: full baht amounts are too wide for two side-by-side lists. */
      '<section><div><h2>' + w.sellers + '</h2>' + hBars(summary.sellers.map((s) => ({ name: s.name, value: s.sales, share: s.share })), (i) => f.compact(i.value) + ' · ' + f.pct(i.share)) + '</div>' +
      '<div style="margin-top:14px"><h2>' + w.groups + '</h2>' + hBars(summary.groups.slice(0, 10).map((g) => ({ name: g.name, value: g.sales, share: g.share })), (i) => f.pct(i.share), { color: '#6a8f3a' }) + '</div></section>' +
      '<section>' + growthBlock(summary, w, f) + '</section>' + foot + '</div>';
    const page3 = '<div class="sheet">' + header + '<p class="muted" style="margin:0 0 8px">' + escHtml(w.heatNote) + '</p>' +
      heatTable(w.heatGroup, hm.months, hm.groupMonth.slice(0, 12), f, w) + heatTable(w.heatSeller, hm.months, hm.sellerMonth, f, w) + heatTable(w.heatWeekday, hm.months, hm.weekdayMonth, f, w) + foot + '</div>';
    const customers = '<table><tr><th>#</th><th>' + w.name + '</th><th class="n">' + w.sales + ' (' + w.baht + ')</th><th class="n">' + w.invoices + '</th><th class="n">' + w.share + '</th></tr>' + summary.customers.map((r, i) => '<tr><td>' + (i + 1) + '</td><td>' + escHtml(r.name) + '</td><td class="n">' + f.num(r.sales, 2) + '</td><td class="n">' + f.num(r.invoices) + '</td><td class="n">' + f.pct(r.share) + '</td></tr>').join('') + '</table>';
    const products = '<table><tr><th>#</th><th>' + w.item + '</th><th class="n">' + w.sales + ' (' + w.baht + ')</th><th class="n">' + w.quantity + '</th></tr>' + summary.products.map((r, i) => '<tr><td>' + (i + 1) + '</td><td>' + escHtml(r.sku + ' · ' + r.name) + '</td><td class="n">' + f.num(r.sales, 2) + '</td><td class="n">' + f.num(r.quantity, 1) + ' ' + escHtml(r.unit) + '</td></tr>').join('') + '</table>';
    const page4 = '<div class="sheet">' + header +
      '<section><h2>' + w.topCustomers + ' (' + summary.customers.length + ' ' + w.of + ' ' + f.num(summary.customerCount) + ')</h2>' + customers + '</section>' +
      '<section><h2>' + w.topProducts + '</h2>' + products + '</section>' + foot + '</div>';
    /* Forecast: the unit with the most groups on its own page, the other units
       and the notes on the next, so neither page overflows A4. */
    const units = byUnit(summary.forecast.rows).sort((a, b) => b[1].length - a[1].length);
    const mainRows = units[0] ? units[0][1] : [], otherRows = units.slice(1).flatMap(([, list]) => list);
    const help = '<p class="muted" style="font-size:11px;margin-top:6px">' + escHtml(w.verdictHelp) + '<br>' + escHtml(w.metricHelp) + '</p>';
    const page5 = '<div class="sheet">' + header +
      '<section><h2>' + w.forecast + ' · ' + escHtml(summary.forecast.monthLabel) + '</h2>' + forecastTables(mainRows, w, f) + help + '</section>' + foot + '</div>';
    const page6 = '<div class="sheet">' + header +
      (otherRows.length ? '<section><h2>' + w.forecast + ' · ' + escHtml(summary.forecast.monthLabel) + '</h2>' + forecastTables(otherRows, w, f) + '</section>' : '') +
      '<section><h2>' + w.notes + '</h2><ul class="points">' + summary.notes.map((n) => '<li>' + escHtml(n) + '</li>').join('') + '</ul></section>' + foot + '</div>';
    return page(w.report + ' · ' + summary.period.label, css, page1 + page2 + page3 + page4 + page5 + page6, lang);
  }

  /* ---------- 16:9 slides ---------- */

  function slidesHtml(summary) {
    const lang = summary.lang, w = words[lang] || words.th, f = fmt(lang), k = summary.kpis, hm = summary.heatmaps;
    const css = `
    .slide{position:relative;width:254mm;height:142.875mm;margin:16px auto;padding:11mm 14mm 12mm;background:#fff;box-shadow:0 6px 24px rgb(0 0 0/.14);overflow:hidden;display:flex;flex-direction:column}
    .slide h2{font-size:21px;margin-bottom:6mm;color:var(--accent)}
    .slide .foot{position:absolute;left:14mm;right:14mm;bottom:5mm;display:flex;justify-content:space-between;font-size:10px;color:var(--muted)}
    .title{background:linear-gradient(135deg,#1f2f3d,#3f5a94);color:#fff;justify-content:center}
    .title h1{font-size:34px;margin:4mm 0}.title .muted{color:#cfdbe8}
    .big{display:grid;grid-template-columns:repeat(2,1fr);gap:7mm}.big .kpi{padding:5mm;border-radius:14px}.big .kpi strong{font-size:28px}.big .kpi small{font-size:13px}
    .slide ul.points{font-size:15.5px;line-height:1.6}
    .slide .hbars{font-size:14px;gap:10px}.slide .hbar-track{height:14px}
    .slide table{font-size:12px}.slide table.hm{font-size:11px}
    .slide .stats{grid-template-columns:repeat(3,1fr)}.slide .stat strong{font-size:22px}
    .cols{display:grid;grid-template-columns:1fr 1fr;gap:10mm;flex:1}
    @page{size:254mm 142.875mm;margin:0}
    @media print{html,body{background:#fff}.no-print{display:none}.slide{margin:0;box-shadow:none;page-break-after:always}.slide:last-child{page-break-after:auto}}
    @media screen and (max-width:1000px){.slide{width:auto;height:auto;min-height:0;margin:8px;padding:18px 18px 34px}.big,.cols,.slide .stats{grid-template-columns:1fr}}
    `;
    const slides = [];
    const add = (html) => slides.push(html);
    const foot = () => '<div class="foot"><span>' + escHtml(summary.company + ' · ' + summary.period.label) + '</span><span>' + (slides.length + 1) + '</span></div>';
    add('<section class="slide title"><div class="muted">' + escHtml(summary.company) + '</div><h1>' + escHtml(w.slides) + '</h1><div style="font-size:18px">' + escHtml(w.period) + ': ' + escHtml(summary.period.label) + '</div><div class="muted" style="margin-top:6mm">' + escHtml(w.generated) + ' ' + escHtml(summary.generatedLabel) + ' · ' + escHtml(w.confidential) + '</div></section>');
    add('<section class="slide"><h2>' + escHtml(w.sales) + ' · ' + escHtml(summary.period.label) + '</h2><div class="big">' +
      '<div class="kpi"><small>' + w.sales + '</small><strong>' + f.compact(k.sales) + '</strong><small>' + f.money(k.sales) + '</small></div>' +
      '<div class="kpi"><small>' + w.change + '</small><strong>' + (k.change === null ? '—' : f.pct(k.change, true)) + '</strong><small>' + escHtml(k.priorLabel) + '</small></div>' +
      '<div class="kpi"><small>' + w.invoices + '</small><strong>' + f.num(k.invoices) + '</strong><small>' + w.average + ' ' + f.money(k.average) + '</small></div>' +
      '<div class="kpi"><small>' + w.customers + '</small><strong>' + f.num(k.customers) + '</strong></div></div>' + foot() + '</section>');
    add('<section class="slide"><h2>' + w.insights + '</h2><ul class="points">' + summary.insights.map((i) => '<li>' + escHtml(i) + '</li>').join('') + '</ul>' + foot() + '</section>');
    add('<section class="slide"><h2>' + w.monthly + ' <span class="unit">(' + w.monthlyUnit + ')</span></h2>' + barChart(summary.monthly.map((m) => ({ label: m.shortLabel, value: m.sales })), { width: 860, height: 290, valueText: f.millions }) + foot() + '</section>');
    add('<section class="slide"><h2>' + w.channels + ' · ' + w.concentration + '</h2>' + channelBlock(summary, w, f) + foot() + '</section>');
    add('<section class="slide"><h2>' + w.sellers + '</h2>' + hBars(summary.sellers.map((s) => ({ name: s.name, value: s.sales, share: s.share })), (i) => f.compact(i.value) + ' · ' + f.pct(i.share)) + foot() + '</section>');
    add('<section class="slide"><h2>' + w.heatSeller + '</h2><p class="muted" style="margin:-3mm 0 3mm">' + escHtml(w.heatNote) + '</p>' + heatTable('', hm.months, hm.sellerMonth, f, w) + foot() + '</section>');
    add('<section class="slide"><h2>' + w.heatWeekday + '</h2><p class="muted" style="margin:-3mm 0 3mm">' + escHtml(w.heatNote) + '</p>' + heatTable('', hm.months, hm.weekdayMonth, f, w) + foot() + '</section>');
    add('<section class="slide"><h2>' + w.heatGroup + '</h2><p class="muted" style="margin:-3mm 0 3mm">' + escHtml(w.heatNote) + '</p>' + heatTable('', hm.months, hm.groupMonth.slice(0, 10), f, w) + foot() + '</section>');
    add('<section class="slide"><h2>' + w.topCustomers + ' · ' + w.topProducts + '</h2><div class="cols"><div>' + hBars(summary.customers.slice(0, 8).map((c) => ({ name: c.name, value: c.sales, share: c.share })), (i) => f.compact(i.value)) + '</div><div>' + hBars(summary.products.slice(0, 8).map((p) => ({ name: p.sku + ' · ' + p.name, value: p.sales })), (i) => f.compact(i.value), { color: '#6a8f3a' }) + '</div></div>' + foot() + '</section>');
    add('<section class="slide"><h2>' + w.groups + '</h2>' + hBars(summary.groups.slice(0, 10).map((g) => ({ name: g.name, value: g.sales, share: g.share })), (i) => f.pct(i.share) + ' · ' + f.compact(i.value), { color: '#6a8f3a' }) + foot() + '</section>');
    /* Forecast: one slide per unit so no slide mixes units; the largest unit first. */
    for (const [unit, list] of byUnit(summary.forecast.rows).sort((a, b) => b[1].length - a[1].length).slice(0, 2)) {
      add('<section class="slide"><h2>' + w.forecast + ' · ' + escHtml(summary.forecast.monthLabel) + ' <span class="unit">(' + w.unit + ': ' + escHtml(unit) + ')</span></h2>' + forecastTables(list.slice(0, 9), w, f, { metrics: false }) + foot() + '</section>');
    }
    const accRows = summary.forecast.rows.slice(0, 8).map((r) => '<tr><td>' + escHtml(r.name) + '</td><td>' + verdictBadge(r) + '</td><td class="n">' + f.pct(r.wape) + '</td><td class="n">' + f.pct(r.mape) + '</td><td class="n">' + f.pct(r.bias, true) + '</td><td class="n">' + f.num(r.mase, 2) + '</td><td class="n">' + f.num(r.n) + '</td></tr>').join('');
    add('<section class="slide"><h2>' + w.accuracy + '</h2><table><tr><th>' + w.group + '</th><th>' + w.verdict + '</th><th class="n">WAPE</th><th class="n">MAPE</th><th class="n">Bias</th><th class="n">MASE</th><th class="n">' + w.months + '</th></tr>' + accRows + '</table><p class="muted" style="font-size:10.5px;margin-top:3mm">' + escHtml(w.verdictHelp) + '</p>' + foot() + '</section>');
    return page(w.slides + ' · ' + summary.period.label, css, slides.join(''), lang);
  }

  const CeoExport = { xlsx, reportHtml, slidesHtml, zip, crc32 };
  root.CeoExport = CeoExport;
  if (typeof module !== 'undefined') module.exports = CeoExport;
})(typeof window !== 'undefined' ? window : globalThis);
