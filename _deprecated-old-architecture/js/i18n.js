/* i18n.js — Thai and English strings.
 *
 * One in-file object, flat dot keys, data-i18n attributes on static nodes.
 * A key present in one language and missing from the other is a test failure.
 * Thai is the default language and still needs a team member's sign-off.
 */
(function (MSFA) {
  'use strict';

  var DEFAULT_LANG = 'th';
  var LANGS = ['th', 'en'];

  var STRINGS = {
    th: {
      'app.title': 'ผู้ช่วยคาดการณ์ยอดขายรายเดือน',
      'app.subtitle': 'อ่านไฟล์ในเครื่องของคุณ ไม่มีการส่งข้อมูลออก',
      'app.noscript': 'แอปนี้ต้องใช้ JavaScript กรุณาเปิดใช้งานแล้วโหลดหน้านี้ใหม่',
      'app.versionLabel': 'เวอร์ชัน',
      'app.localOnly': 'ข้อมูลทั้งหมดอยู่ในเครื่องนี้เท่านั้น',
      'app.distNote': 'สำเนาไฟล์เดียวสำหรับตรวจงานแบบออฟไลน์ ไม่มีการติดตั้งและไม่มีการอัปเดตอัตโนมัติ',

      'a11y.skip': 'ข้ามไปยังเนื้อหาหลัก',
      'a11y.mainNav': 'เมนูหลัก',

      'settings.language': 'ภาษา',
      'settings.theme': 'ธีม',
      'lang.th': 'ไทย',
      'lang.en': 'English',
      'theme.system': 'ตามระบบ',
      'theme.light': 'สว่าง',
      'theme.dark': 'มืด',

      'nav.overview': 'ภาพรวม',
      'nav.products': 'สินค้า',
      'nav.salesteam': 'ทีมขาย',
      'nav.forecast': 'คาดการณ์',
      'nav.customers': 'ลูกค้า',
      'nav.data': 'ข้อมูลและคู่มือ',
      'nav.short.overview': 'ภาพรวม',
      'nav.short.products': 'สินค้า',
      'nav.short.salesteam': 'ทีมขาย',
      'nav.short.forecast': 'คาดการณ์',
      'nav.short.customers': 'ลูกค้า',
      'nav.short.data': 'ข้อมูล',

      'empty.noData': 'ยังไม่มีชุดข้อมูลในเครื่องนี้',
      'empty.action': 'ไปที่ข้อมูลและคู่มือ',
      'empty.later': 'ส่วนนี้จะแสดงผลหลังจากนำเข้าข้อมูลแล้ว',
      'empty.overview.body': 'หน้านี้จะแสดงยอดขาย จำนวนบิล ค่าเฉลี่ยต่อบิล สัดส่วนกลุ่มสินค้า และแนวโน้มรายเดือน เมื่อมีข้อมูลแล้ว',
      'empty.products.body': 'หน้านี้จะแสดงอันดับสินค้า อัตราการใช้ต่อวัน และจำนวนวันที่ของคงเหลือจะพอขาย เมื่อมีข้อมูลแล้ว',
      'empty.salesteam.body': 'หน้านี้จะเปรียบเทียบพนักงานขายและแสดงตารางพนักงานขายกับกลุ่มสินค้า เมื่อมีข้อมูลแล้ว',
      'empty.forecast.body': 'หน้านี้จะแสดงการคาดการณ์เดือนถัดไปรายกลุ่มสินค้า พร้อมค่าความคลาดเคลื่อนที่วัดได้ เมื่อมีข้อมูลแล้ว',
      'empty.customers.body': 'หน้านี้จะแสดงอันดับลูกค้า ยอดรวม จำนวนบิล และค่าเฉลี่ยต่อบิล เมื่อมีข้อมูลแล้ว',

      'change.up': 'เพิ่มขึ้น',
      'change.down': 'ลดลง',
      'change.flat': 'เท่าเดิม',
      'change.vsPrevious': 'เทียบช่วงก่อนหน้า',

      'table.scrollHint': 'เลื่อนตารางไปทางข้างเพื่อดูคอลัมน์ที่เหลือ',
      'table.view': 'ดูเป็นตาราง',
      'filter.barLabel': 'ตัวกรอง',
      'toast.dismiss': 'ปิด',

      'chart.other': 'อื่น ๆ',
      'chart.actual': 'ยอดจริง',
      'chart.forecast': 'คาดการณ์',
      'chart.cutoff': 'ข้อมูลถึงวันที่',

      'range.label': 'ช่วงเวลา',
      'range.thisMonth': 'เดือนนี้',
      'range.3m': '3 เดือน',
      'range.6m': '6 เดือน',
      'range.all': 'ทั้งหมด',
      'range.custom': 'กำหนดเอง',
      'range.from': 'ตั้งแต่',
      'range.to': 'ถึง',
      'range.partial': 'เดือนนี้ยังไม่ครบเดือน',
      'range.perDayNote': 'ช่วงเวลาต่างกันเทียบยอดรวมกันไม่ได้ จึงแสดงอัตราต่อวันควบคู่เสมอ',

      'kpi.sales': 'ยอดขาย',
      'kpi.invoices': 'จำนวนบิล',
      'kpi.averagePerInvoice': 'เฉลี่ยต่อบิล',
      'kpi.perDay': 'ต่อวัน',
      'kpi.customers': 'จำนวนลูกค้า',
      'unit.baht': 'บาท',
      'unit.metre': 'เมตร',
      'unit.perDay': '/วัน',

      'channel.label': 'ประเภทการขาย',
      'channel.combined': 'รวมเงินสดและเงินเชื่อ',
      'channel.cash': 'เงินสดเท่านั้น',
      'channel.credit': 'เงินเชื่อเท่านั้น',

      'overview.groupSplit': 'สัดส่วนกลุ่มสินค้า',
      'overview.monthly': 'ยอดขายรายเดือน',
      'overview.title': 'ภาพรวม',

      'product.title': 'สินค้า',
      'product.code': 'รหัส',
      'product.description': 'รายละเอียด',
      'product.quantity': 'จำนวน',
      'product.ratePerDay': 'อัตราต่อวัน',
      'product.share': 'สัดส่วน',
      'product.stockOnHand': 'ของคงเหลือ (กรอกเอง)',
      'product.daysOfCover': 'พอขายได้ (วัน)',
      'product.stockNote': 'ตัวเลขของคงเหลือเป็นการกรอกเอง ไม่ได้เชื่อมกับระบบสต็อก',
      'product.urgent': 'ควรเติมด่วน',
      'product.byColour': 'ตามสี',
      'product.byThickness': 'ตามความหนา',
      'product.byProfile': 'ตามลอน',
      'product.byCode': 'ตามรหัสสินค้า',
      'product.attributeNote': 'แสดงชื่อตามที่พิมพ์ในรายงานจริง ยังไม่รวมชื่อที่สะกดต่างกัน',
      'product.duplicateWarning': 'พบชื่อที่อาจซ้ำกัน รอตารางมาตรฐานจากลูกค้า',
      'product.unmapped': 'ไม่ระบุ',

      'class.regular': 'ขายสม่ำเสมอ',
      'class.irregular': 'ขายไม่สม่ำเสมอ',
      'class.sparse': 'ขายนาน ๆ ครั้ง',
      'class.insufficient': 'ข้อมูลไม่พอ',
      'class.label': 'รูปแบบการขาย',

      'team.title': 'ทีมขาย',
      'team.salesperson': 'พนักงานขาย',
      'team.share': 'สัดส่วนยอดขาย',
      'team.matrix': 'พนักงานขาย × กลุ่มสินค้า',
      'team.matrixNote': 'ตารางนี้แสดงว่าพนักงานแต่ละคนขายกลุ่มสินค้าใด',
      'team.blank': 'ไม่ระบุพนักงานขาย',

      'forecast.title': 'คาดการณ์เดือนถัดไป',
      'forecast.group': 'กลุ่มสินค้า',
      'forecast.value': 'คาดการณ์',
      'forecast.range': 'ช่วงที่เป็นไปได้',
      'forecast.error': 'ความคลาดเคลื่อน (WAPE)',
      'forecast.window': 'หน้าต่างข้อมูล',
      'forecast.months': 'เดือน',
      'forecast.method': 'วิธี',
      'forecast.methodName': 'อัตราการใช้ต่อวัน',
      'forecast.cutoff': 'ข้อมูลถึง',
      'forecast.n': 'จำนวนเดือนที่ทดสอบ',
      'forecast.noFigure': 'ไม่แสดงตัวเลข',
      'forecast.reason.error-too-high': 'ความคลาดเคลื่อนสูงเกินกว่าจะใช้ตัดสินใจ',
      'forecast.reason.too-few-months': 'มีเดือนที่ขายน้อยเกินไป แสดงระยะห่างเฉลี่ยระหว่างการขายแทน',
      'forecast.reason.not-enough-data': 'ข้อมูลไม่พอ',
      'forecast.reason.mixed-units': 'หน่วยนับปนกัน',
      'forecast.reason.no-backtest': 'ทดสอบย้อนหลังไม่ได้',
      'forecast.warning.error-above-tolerance': 'ความคลาดเคลื่อนสูงกว่าที่ยอมรับ ใช้ประกอบการตัดสินใจอย่างระมัดระวัง',
      'forecast.warning.irregular-demand': 'สินค้ากลุ่มนี้ขายไม่สม่ำเสมอ',
      'forecast.averageGap': 'ระยะห่างเฉลี่ยระหว่างการขาย',
      'forecast.days': 'วัน',
      'forecast.seasonalOff': 'วิธีตามฤดูกาลยังปิดอยู่ ต้องมีข้อมูลอย่างน้อย 12 เดือน',
      'forecast.noSkuNote': 'ไม่คาดการณ์รายรหัสสินค้า เพราะทดสอบแล้วคลาดเคลื่อนสูงเกินไป',
      'forecast.backtest': 'ผลการทดสอบย้อนหลัง',

      'customer.title': 'ลูกค้า',
      'customer.name': 'ชื่อลูกค้า',
      'customer.total': 'ยอดรวม',
      'customer.invoices': 'จำนวนบิล',
      'customer.average': 'เฉลี่ยต่อบิล',
      'customer.unmapped': 'ยังไม่จับคู่รหัส',

      'data.import.title': 'นำเข้ารายงาน',
      'data.import.reports': 'รายงานที่รองรับ: ขายเงินสด, ขายเงินเชื่อ (ใบกำกับสินค้า) และใบรับมัดจำ',
      'data.import.choose': 'เลือกไฟล์ CSV',
      'data.import.greyedOut': 'ถ้าไฟล์เป็นสีจาง ให้เลือกที่นี่',
      'data.import.reading': 'กำลังอ่านไฟล์…',
      'data.import.failed': 'นำเข้าไม่สำเร็จ ข้อมูลเดิมยังอยู่ครบ',
      'data.import.done': 'นำเข้าข้อมูลเรียบร้อย',
      'data.import.onDevice': 'ไฟล์ถูกอ่านในเครื่องนี้ ไม่มีการส่งออกไปที่ใด',
      'data.reconciliation': 'ผลการตรวจสอบยอด',
      'data.export': 'ส่งออกเป็น CSV',
      'data.exportWarning': 'ไฟล์ที่ส่งออกมีชื่อลูกค้า และไม่มีการเข้ารหัส',
      'data.clear': 'ลบข้อมูลในเครื่องนี้',
      'data.cleared': 'ลบข้อมูลแล้ว',
      'data.install.title': 'ติดตั้งแอปบนเครื่องนี้',
      'data.device.title': 'ข้อมูลเครื่องนี้',
      'data.device.language': 'ภาษา',
      'data.device.theme': 'ธีมที่ใช้อยู่',
      'data.device.online': 'สถานะเครือข่าย',
      'data.device.installed': 'เปิดแบบติดตั้งแล้ว',
      'data.device.storage': 'บันทึกการตั้งค่าในเครื่อง',
      'data.device.persisted': 'ระบบอนุญาตให้เก็บข้อมูลถาวร',
      'data.yes': 'ใช่',
      'data.no': 'ไม่',
      'data.online': 'ออนไลน์',
      'data.offline': 'ออฟไลน์',
      'data.rows.invoices': 'บิล',
      'data.rows.lines': 'รายการสินค้า',
      'data.rows.products': 'รหัสสินค้า',
      'data.rows.customers': 'ลูกค้า',
      'data.rows.salespeople': 'พนักงานขาย',
      'data.rows.deposits': 'ใบรับมัดจำ',
      'data.rows.unresolved': 'แถวที่อ่านไม่ได้',
      'data.rows.malformed': 'บรรทัดที่รูปแบบผิด',
      'data.rows.blankSalesperson': 'บิลที่ไม่ระบุพนักงานขาย',
      'data.rows.freeLines': 'รายการที่ไม่มีราคา',

      'storage.warningTitle': 'ข้อมูลอาจถูกลบโดยระบบ',
      'storage.warningBody': 'บน iPhone และ iPad ระบบอาจลบข้อมูลของแอปนี้ ถ้าไม่ได้เพิ่มลงหน้าจอโฮมและไม่ได้เปิดใช้งานประมาณหนึ่งสัปดาห์ ทั้งโปรไฟล์และข้อมูลที่นำเข้าจะหายไปพร้อมกัน',

      'profile.title': 'เลือกผู้ใช้งาน',
      'profile.select': 'เลือกชื่อของคุณ',
      'profile.passcode': 'รหัสผ่าน',
      'profile.unlock': 'เข้าใช้งาน',
      'profile.create': 'สร้างโปรไฟล์',
      'profile.createFirst': 'สร้างโปรไฟล์แรก (เป็นทีมบริหารเสมอ)',
      'profile.displayName': 'ชื่อที่แสดง',
      'profile.role': 'บทบาท',
      'profile.salespersonCode': 'รหัสพนักงานขาย',
      'profile.wrong': 'รหัสผ่านไม่ถูกต้อง',
      'profile.wait': 'ลองใหม่อีกครั้งในอีกสักครู่',
      'profile.reset': 'ล้างโปรไฟล์ทั้งหมด',
      'profile.resetExplain': 'ล้างเฉพาะโปรไฟล์ ข้อมูลที่นำเข้าจะไม่ถูกลบ',
      'profile.resetNotice': 'โปรไฟล์ทั้งหมดถูกล้างเมื่อ',
      'profile.resetAcknowledge': 'รับทราบ',
      'profile.noRecovery': 'ถ้าลืมรหัสผ่าน จะกู้คืนไม่ได้ ต้องให้ทีมบริหารคนอื่นลบโปรไฟล์แล้วสร้างใหม่',
      'profile.passcodeRule': 'อย่างน้อย 6 ตัวอักษร ห้ามเลขซ้ำหรือเรียงกัน',
      'profile.passcodeWhy': 'ระบบเข้ารหัสรหัสผ่านแบบช้าเพื่อปกป้อง "ตัวรหัสผ่าน" เพราะหลายคนใช้รหัสเดียวกับโทรศัพท์หรือบัตรธนาคาร ไม่ได้ปกป้องตัวข้อมูล',
      'profile.notEncryptedTitle': 'ข้อมูลในเครื่องนี้ไม่ได้เข้ารหัส',
      'profile.notEncryptedBody': 'ผู้ที่เข้าถึงไฟล์ในเครื่องนี้ได้ จะอ่านข้อมูลทั้งหมดได้ ไม่ว่าจะมีรหัสผ่านหรือไม่ ระบบนี้ช่วยแยกสิ่งที่เพื่อนร่วมงานเห็น และกันคนที่เดินผ่านมาหยิบแท็บเล็ตที่เปิดค้างไว้ แต่ไม่ได้ป้องกันผู้ที่ตั้งใจและมีเครื่องอยู่ในมือ',
      'profile.reject.too-short': 'สั้นเกินไป',
      'profile.reject.repeated': 'ห้ามใช้ตัวอักษรซ้ำทั้งหมด',
      'profile.reject.sequential': 'ห้ามใช้ตัวเลขเรียงกัน',
      'profile.signOut': 'ออกจากโปรไฟล์',
      'profile.currentlyUsing': 'กำลังใช้งานในชื่อ',

      'role.sales': 'พนักงานขาย',
      'role.supervisor': 'หัวหน้าฝ่ายขาย',
      'role.management': 'ทีมบริหาร',
      'role.pinnedFilter': 'แสดงเฉพาะข้อมูลของคุณ',

      'pwa.updateAvailable': 'มีเวอร์ชันใหม่พร้อมใช้งาน',
      'pwa.reload': 'โหลดใหม่',
      'pwa.offline': 'ออฟไลน์',
      'pwa.install.installed': 'ติดตั้งแอปนี้บนเครื่องนี้แล้ว',
      'pwa.install.insecure': 'การติดตั้งต้องเปิดผ่านที่อยู่เว็บ (https) ไฟล์ที่เปิดจากโฟลเดอร์ติดตั้งไม่ได้',
      'pwa.install.prompt': 'ติดตั้งแอปนี้บนเครื่องนี้',
      'pwa.install.button': 'ติดตั้งแอป',
      'pwa.install.iosSafari': 'ติดตั้งจาก Safari:',
      'pwa.install.iosStep1': 'แตะปุ่มแชร์ในแถบเครื่องมือ Safari',
      'pwa.install.iosStep2': 'เลือก "เพิ่มไปยังหน้าจอโฮม"',
      'pwa.install.iosStep3': 'แตะ "เพิ่ม" ไอคอนแอปจะอยู่บนหน้าจอโฮม',
      'pwa.install.iosOther': 'บน iPhone และ iPad ให้เปิดหน้านี้ใน Safari เพื่อติดตั้ง',
      'pwa.install.macSafari': 'ติดตั้งจาก Safari บน Mac: เลือกเมนู File แล้วเลือก "Add to Dock"',
      'pwa.install.chromium': 'ใช้ไอคอนติดตั้งในแถบที่อยู่ หรือเมนูของเบราว์เซอร์ เพื่อติดตั้งแอปนี้',
      'pwa.install.other': 'เปิดหน้านี้ใน Chrome หรือ Edge เพื่อติดตั้ง'
    },

    en: {
      'app.title': 'Monthly Sales Forecast Assistant',
      'app.subtitle': 'Files are read on your device. Nothing is uploaded.',
      'app.noscript': 'This app needs JavaScript. Turn it on and reload this page.',
      'app.versionLabel': 'Version',
      'app.localOnly': 'All data stays on this device.',
      'app.distNote': 'Single-file review copy for offline reading. It cannot be installed and does not update itself.',

      'a11y.skip': 'Skip to main content',
      'a11y.mainNav': 'Main navigation',

      'settings.language': 'Language',
      'settings.theme': 'Theme',
      'lang.th': 'ไทย',
      'lang.en': 'English',
      'theme.system': 'System',
      'theme.light': 'Light',
      'theme.dark': 'Dark',

      'nav.overview': 'Overview',
      'nav.products': 'Products',
      'nav.salesteam': 'Sales team',
      'nav.forecast': 'Forecast',
      'nav.customers': 'Customers',
      'nav.data': 'Data & guide',
      'nav.short.overview': 'Overview',
      'nav.short.products': 'Products',
      'nav.short.salesteam': 'Team',
      'nav.short.forecast': 'Forecast',
      'nav.short.customers': 'Customers',
      'nav.short.data': 'Data',

      'empty.noData': 'No dataset on this device yet',
      'empty.action': 'Go to Data & guide',
      'empty.later': 'This section fills in once a report has been imported.',
      'empty.overview.body': 'Sales, invoice count, average per invoice, the product-group split and the monthly trend will appear here once there is data.',
      'empty.products.body': 'Product rankings, consumption rate per day and days of cover will appear here once there is data.',
      'empty.salesteam.body': 'Salesperson comparison and the salesperson by product-group table will appear here once there is data.',
      'empty.forecast.body': 'Next-month forecasts by product group, with their measured error, will appear here once there is data.',
      'empty.customers.body': 'Customer rankings with totals, invoice count and average per invoice will appear here once there is data.',

      'change.up': 'up',
      'change.down': 'down',
      'change.flat': 'unchanged',
      'change.vsPrevious': 'vs the preceding period',

      'table.scrollHint': 'Scroll the table sideways for the remaining columns',
      'table.view': 'Table view',
      'filter.barLabel': 'Filters',
      'toast.dismiss': 'Dismiss',

      'chart.other': 'Other',
      'chart.actual': 'Actual',
      'chart.forecast': 'Forecast',
      'chart.cutoff': 'Data to',

      'range.label': 'Time range',
      'range.thisMonth': 'This month',
      'range.3m': '3 months',
      'range.6m': '6 months',
      'range.all': 'All',
      'range.custom': 'Custom',
      'range.from': 'From',
      'range.to': 'To',
      'range.partial': 'This month is not complete yet',
      'range.perDayNote': 'Totals from different range lengths are not comparable, so the rate per day is always shown beside them.',

      'kpi.sales': 'Sales',
      'kpi.invoices': 'Invoices',
      'kpi.averagePerInvoice': 'Average per invoice',
      'kpi.perDay': 'per day',
      'kpi.customers': 'Customers',
      'unit.baht': 'THB',
      'unit.metre': 'm',
      'unit.perDay': '/day',

      'channel.label': 'Sales channel',
      'channel.combined': 'Cash and credit combined',
      'channel.cash': 'Cash only',
      'channel.credit': 'Credit only',

      'overview.groupSplit': 'Product-group split',
      'overview.monthly': 'Monthly sales',
      'overview.title': 'Overview',

      'product.title': 'Products',
      'product.code': 'Code',
      'product.description': 'Description',
      'product.quantity': 'Quantity',
      'product.ratePerDay': 'Rate per day',
      'product.share': 'Share',
      'product.stockOnHand': 'Stock on hand (typed in)',
      'product.daysOfCover': 'Days of cover',
      'product.stockNote': 'The stock figure is typed in by hand. It is not connected to a stock system.',
      'product.urgent': 'Order soon',
      'product.byColour': 'By colour',
      'product.byThickness': 'By thickness',
      'product.byProfile': 'By profile',
      'product.byCode': 'By product code',
      'product.attributeNote': 'Names are shown exactly as printed in the report. Different spellings are not combined.',
      'product.duplicateWarning': 'Some names may be duplicates. Waiting for the client’s normalisation table.',
      'product.unmapped': 'Not stated',

      'class.regular': 'Sells regularly',
      'class.irregular': 'Sells irregularly',
      'class.sparse': 'Sells occasionally',
      'class.insufficient': 'Not enough data',
      'class.label': 'Demand pattern',

      'team.title': 'Sales team',
      'team.salesperson': 'Salesperson',
      'team.share': 'Share of sales',
      'team.matrix': 'Salesperson by product group',
      'team.matrixNote': 'This table shows which product groups each salesperson sells.',
      'team.blank': 'No salesperson recorded',

      'forecast.title': 'Next month',
      'forecast.group': 'Product group',
      'forecast.value': 'Forecast',
      'forecast.range': 'Likely range',
      'forecast.error': 'Error (WAPE)',
      'forecast.window': 'Window',
      'forecast.months': 'months',
      'forecast.method': 'Method',
      'forecast.methodName': 'Consumption rate per day',
      'forecast.cutoff': 'Data to',
      'forecast.n': 'Months tested',
      'forecast.noFigure': 'No figure shown',
      'forecast.reason.error-too-high': 'The measured error is too high to decide on',
      'forecast.reason.too-few-months': 'Too few months with sales; the average gap between sales is shown instead',
      'forecast.reason.not-enough-data': 'Not enough data',
      'forecast.reason.mixed-units': 'Units are mixed',
      'forecast.reason.no-backtest': 'Could not be backtested',
      'forecast.warning.error-above-tolerance': 'The error is above the agreed tolerance. Treat this figure with care.',
      'forecast.warning.irregular-demand': 'This group sells irregularly.',
      'forecast.averageGap': 'Average gap between sales',
      'forecast.days': 'days',
      'forecast.seasonalOff': 'The seasonal method is switched off. It needs at least 12 months of history.',
      'forecast.noSkuNote': 'Individual product codes are not forecast: the measured error was far too high.',
      'forecast.backtest': 'Backtest results',

      'customer.title': 'Customers',
      'customer.name': 'Customer',
      'customer.total': 'Total',
      'customer.invoices': 'Invoices',
      'customer.average': 'Average per invoice',
      'customer.unmapped': 'No code yet',

      'data.import.title': 'Import reports',
      'data.import.reports': 'Supported reports: cash sales, credit sales (tax invoices), and deposit receipts.',
      'data.import.choose': 'Choose CSV files',
      'data.import.greyedOut': 'My file is greyed out',
      'data.import.reading': 'Reading the files…',
      'data.import.failed': 'The import failed. The previous data is untouched.',
      'data.import.done': 'Import finished',
      'data.import.onDevice': 'The files are read on this device. Nothing is sent anywhere.',
      'data.reconciliation': 'Reconciliation',
      'data.export': 'Export as CSV',
      'data.exportWarning': 'The exported file names customers and is not encrypted.',
      'data.clear': 'Clear the data on this device',
      'data.cleared': 'Data cleared',
      'data.install.title': 'Install this app',
      'data.device.title': 'This device',
      'data.device.language': 'Language',
      'data.device.theme': 'Theme in use',
      'data.device.online': 'Network',
      'data.device.installed': 'Running installed',
      'data.device.storage': 'Settings saved on device',
      'data.device.persisted': 'Storage marked persistent',
      'data.yes': 'Yes',
      'data.no': 'No',
      'data.online': 'Online',
      'data.offline': 'Offline',
      'data.rows.invoices': 'Invoices',
      'data.rows.lines': 'Item lines',
      'data.rows.products': 'Product codes',
      'data.rows.customers': 'Customers',
      'data.rows.salespeople': 'Salespeople',
      'data.rows.deposits': 'Deposit receipts',
      'data.rows.unresolved': 'Rows not understood',
      'data.rows.malformed': 'Malformed lines',
      'data.rows.blankSalesperson': 'Invoices with no salesperson',
      'data.rows.freeLines': 'Lines with no price',

      'storage.warningTitle': 'The system may delete this data',
      'storage.warningBody': 'On iPhone and iPad the system can delete this app’s data if the app is not added to the Home Screen and is not opened for about a week. Profiles and imported data would disappear together.',

      'profile.title': 'Choose who you are',
      'profile.select': 'Select your name',
      'profile.passcode': 'Passcode',
      'profile.unlock': 'Open',
      'profile.create': 'Create profile',
      'profile.createFirst': 'Create the first profile (always management)',
      'profile.displayName': 'Display name',
      'profile.role': 'Role',
      'profile.salespersonCode': 'Salesperson code',
      'profile.wrong': 'That passcode is not right',
      'profile.wait': 'Please wait a moment before trying again',
      'profile.reset': 'Reset all profiles',
      'profile.resetExplain': 'This clears the profiles only. Imported data is not deleted.',
      'profile.resetNotice': 'All profiles were reset on',
      'profile.resetAcknowledge': 'Acknowledge',
      'profile.noRecovery': 'A forgotten passcode cannot be recovered. Another management profile must delete the profile so it can be created again.',
      'profile.passcodeRule': 'At least 6 characters. Not all the same, and not a run of digits.',
      'profile.passcodeWhy': 'The passcode is hashed slowly to protect the passcode itself, because people reuse phone and bank PINs. It does not protect the data.',
      'profile.notEncryptedTitle': 'The data on this device is not encrypted',
      'profile.notEncryptedBody': 'Anyone who can reach this device’s files can read everything, passcode or no passcode. This separates what colleagues see and stops a passer-by using an unlocked tablet. It is not protection against someone who has the device.',
      'profile.reject.too-short': 'Too short',
      'profile.reject.repeated': 'All the same character',
      'profile.reject.sequential': 'A run of characters',
      'profile.signOut': 'Leave this profile',
      'profile.currentlyUsing': 'Signed in as',

      'role.sales': 'Salesperson',
      'role.supervisor': 'Sales supervisor',
      'role.management': 'Management',
      'role.pinnedFilter': 'Showing your own figures only',

      'pwa.updateAvailable': 'A new version is available.',
      'pwa.reload': 'Reload',
      'pwa.offline': 'Offline',
      'pwa.install.installed': 'This app is installed on this device.',
      'pwa.install.insecure': 'Installing needs the website address (https). A file opened from a folder cannot be installed.',
      'pwa.install.prompt': 'Install this app on this device.',
      'pwa.install.button': 'Install app',
      'pwa.install.iosSafari': 'Install from Safari:',
      'pwa.install.iosStep1': 'Tap the Share button in the Safari toolbar.',
      'pwa.install.iosStep2': 'Choose Add to Home Screen.',
      'pwa.install.iosStep3': 'Tap Add. The app icon appears on your Home Screen.',
      'pwa.install.iosOther': 'On iPhone and iPad, open this page in Safari to install it.',
      'pwa.install.macSafari': 'Install from Safari on Mac: choose File, then Add to Dock.',
      'pwa.install.chromium': 'Use the install icon in the address bar, or the browser menu, to install this app.',
      'pwa.install.other': 'Open this page in Chrome or Edge to install it.'
    }
  };

  var current = DEFAULT_LANG;

  function isSupported(lang) { return LANGS.indexOf(lang) !== -1; }
  function getLang() { return current; }

  /* A missing key returns the key itself and warns. The test suite asserts
     that no key used by the app is missing, so this should never fire in a
     released build; it exists so one typo cannot blank a whole screen. */
  function t(key) {
    var table = STRINGS[current] || STRINGS[DEFAULT_LANG];
    if (Object.prototype.hasOwnProperty.call(table, key)) return table[key];
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('i18n: missing key "' + key + '" for language "' + current + '"');
    }
    return key;
  }

  function setLang(lang) {
    current = isSupported(lang) ? lang : DEFAULT_LANG;
    document.documentElement.setAttribute('lang', current);
    MSFA.storage.setSetting('lang', current);
    apply(document);
    return current;
  }

  /* Fills every [data-i18n] node's text, and every [data-i18n-attr] node's
     attributes. Format: data-i18n-attr="aria-label:a11y.mainNav" */
  function apply(root) {
    var scope = root || document;

    scope.querySelectorAll('[data-i18n]').forEach(function (node) {
      node.textContent = t(node.getAttribute('data-i18n'));
    });

    scope.querySelectorAll('[data-i18n-attr]').forEach(function (node) {
      node.getAttribute('data-i18n-attr').split(',').forEach(function (pair) {
        var parts = pair.split(':');
        if (parts.length === 2) node.setAttribute(parts[0].trim(), t(parts[1].trim()));
      });
    });

    if (scope === document) document.title = t('app.title');
  }

  function init() {
    var stored = MSFA.storage.getSetting('lang', DEFAULT_LANG);
    current = isSupported(stored) ? stored : DEFAULT_LANG;
    document.documentElement.setAttribute('lang', current);
    apply(document);
    return current;
  }

  MSFA.i18n = {
    DEFAULT_LANG: DEFAULT_LANG,
    LANGS: LANGS,
    init: init,
    t: t,
    apply: apply,
    getLang: getLang,
    setLang: setLang,
    isSupported: isSupported,
    /* Exposed for tests/shell.test.cjs, which compares the two key sets. */
    __strings: STRINGS
  };
})(typeof window !== 'undefined' ? (window.MSFA = window.MSFA || {}) : (globalThis.MSFA = globalThis.MSFA || {}));
