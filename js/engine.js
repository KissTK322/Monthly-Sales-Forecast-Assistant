(function(root){
'use strict';
const sum=a=>a.reduce((s,n)=>s+n,0), avg=a=>a.length?sum(a)/a.length:0, round=n=>Math.round(n*100)/100;
function shiftMonth(month,delta){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7)}
function daysIn(month){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m,0)).getUTCDate()}
function monthEnd(month){return month+'-'+daysIn(month)}
function addDays(date,days){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s}
function months(data){return [...new Set(data.sales.map(r=>r.date.slice(0,7)))].sort()}
const historyCache=new WeakMap();
function history(data, sku) {
  let cached = historyCache.get(data);
  if (!cached || cached.sales !== data.sales || cached.completeThrough !== data.completeThrough || cached.productCount !== data.products.length) {
    const available = months(data);
    const monthList = [];
    if (available.length) {
      for (let current = available[0]; current <= data.completeThrough; current = shiftMonth(current, 1)) monthList.push(current);
    }
    const monthIndex = new Map(monthList.map((month, index) => [month, index]));
    const bySku = new Map(data.products.map(product => [product.sku, Array(monthList.length).fill(0)]));
    for (const sale of data.sales) {
      const index = monthIndex.get(sale.date.slice(0, 7));
      const values = bySku.get(sale.sku);
      if (index !== undefined && values) values[index] += sale.quantity;
    }
    cached = { sales: data.sales, completeThrough: data.completeThrough, productCount: data.products.length, monthList, bySku };
    historyCache.set(data, cached);
  }
  const values = cached.bySku.get(sku) || Array(cached.monthList.length).fill(0);
  return cached.monthList.map((month, index) => ({ month, value: values[index] }));
}
function consumptionComponents(values, months = []) {
  if (!values.length) return null;
  const window = values.slice(-Math.min(6, values.length));
  const weightTotal = window.length * (window.length + 1) / 2;
  const rate = window.reduce((total, value, index) => total + value * (index + 1), 0) / weightTotal;
  const recentRate = avg(values.slice(-Math.min(3, values.length)));
  const previousRate = values.length >= 6 ? avg(values.slice(-6, -3)) : recentRate;
  const rawChange = previousRate > 0 ? recentRate / previousRate : 1;
  const trendFactor = values.length >= 6 ? Math.min(1.2, Math.max(.8, Math.sqrt(Math.max(0, rawChange)))) : 1;
  const targetMonth = months.length ? shiftMonth(months.at(-1), 1).slice(5) : '';
  let seasonalIndex = 1;
  let seasonalSamples = 0;
  if (months.length === values.length && values.length >= 12 && targetMonth) {
    const baseline = avg(values.slice(-12));
    const matching = values.filter((value, index) => months[index].slice(5) === targetMonth && value >= 0);
    if (baseline > 0 && matching.length) {
      seasonalIndex = Math.min(1.3, Math.max(.7, avg(matching) / baseline));
      seasonalSamples = matching.length;
    }
  }
  return {
    rate,
    recentRate,
    previousRate,
    rawChange,
    trendFactor,
    seasonalIndex,
    seasonalSamples,
    targetMonth,
    annualSeasonality: seasonalSamples > 0,
    forecast: Math.max(0, rate * trendFactor * seasonalIndex),
    monthsUsed: window.length,
  };
}
function estimate(values, method, months = []) {
  if (!values.length) return null;
  if (method === 'consumption') return consumptionComponents(values, months).forecast;
  if (method === 'naive') return values.at(-1);
  if (method === 'recent') {
    if (values.length < 3) return null;
    return avg(values.slice(-3));
  }
  if (method === 'weighted') {
    if (values.length < 3) return null;
    const recent = values.slice(-3);
    return (recent[0] + recent[1] * 2 + recent[2] * 3) / 6;
  }
  if (method === 'trend') {
    if (values.length < 4) return null;
    const recent = values.slice(-Math.min(6, values.length));
    const n = recent.length;
    const xMean = (n - 1) / 2;
    const yMean = avg(recent);
    let numerator = 0;
    let denominator = 0;
    for (let index = 0; index < n; index++) {
      numerator += (index - xMean) * (recent[index] - yMean);
      denominator += (index - xMean) ** 2;
    }
    const raw = yMean + (denominator ? numerator / denominator : 0) * (n - xMean);
    const anchor = avg(recent.slice(-3));
    return Math.max(0, Math.min(anchor * 1.5, Math.max(anchor * .5, raw)));
  }
  if (method === 'seasonal') {
    if (values.length < 15) return null;
    const prior = values[values.length - 12];
    const recent = avg(values.slice(-3));
    const priorRecent = avg(values.slice(-15, -12));
    const ratio = priorRecent > 0 ? recent / priorRecent : 1;
    return Math.max(0, prior * Math.min(1.5, Math.max(.5, ratio)));
  }
  return null;
}
function backtest(values, method, months = []) {
  const minimum = { consumption: 3, naive: 1, recent: 3, weighted: 3, trend: 4, seasonal: 15 }[method] ?? 3;
  const start = Math.max(minimum, values.length - 6);
  const results = [];
  for (let index = start; index < values.length; index++) {
    const predicted = estimate(values.slice(0, index), method, months.slice(0, index));
    if (predicted !== null) results.push({ index, actual: values[index], predicted });
  }
  const denominator = sum(results.map(result => result.actual));
  return {
    results,
    error: results.length && denominator > 0 ? sum(results.map(result => Math.abs(result.actual - result.predicted))) / denominator : null,
    residual: results.length ? avg(results.map(result => Math.abs(result.actual - result.predicted))) : null,
  };
}
function chooseMethod(values) {
  return values.length ? 'consumption' : 'naive';
}
function forecast(data, sku, method = 'auto', factor = 1) {
  const hist = history(data, sku);
  const values = hist.map(row => row.value);
  const months = hist.map(row => row.month);
  const effective = method === 'auto' ? chooseMethod(values, months) : method;
  const components = effective === 'consumption' ? consumptionComponents(values, months) : null;
  const base = estimate(values, effective, months);
  const validation = backtest(values, effective, months);
  const scaled = base === null ? null : base * factor;
  const band = validation.residual === null ? null : validation.residual * factor;
  return {
    history: hist,
    month: hist.length ? shiftMonth(hist.at(-1).month, 1) : null,
    method: effective,
    automatic: method === 'auto',
    components,
    base: scaled,
    low: scaled === null || band === null ? null : Math.max(0, scaled - band),
    high: scaled === null || band === null ? null : scaled + band,
    ...validation,
  };
}
function plan(product,fc,review=7,buffer=7){if(fc.base===null||!fc.month)return null;const stale=product.stockDate!==monthEnd(shiftMonth(fc.month,-1));const daily=fc.base/daysIn(fc.month);const end=addDays(product.stockDate,product.leadDays+review);const incoming=product.inbound>0&&product.inboundDue&&product.inboundDue<=end&&product.inboundDue>product.stockDate?product.inbound:0;const demand=Math.max(daily*(product.leadDays+review),product.committed);const safety=daily*buffer;const target=demand+safety;const raw=Math.max(0,target-product.onHand-incoming);const quantity=Math.ceil(raw/product.pack)*product.pack;const available=Math.max(0,product.onHand-product.committed);const cover=daily>0?available/daily:null;let status=available<=0?'out':cover!==null&&cover<product.leadDays?'low':cover!==null&&cover>90?'excess':'healthy';if(stale)status='stale';return {daily,end,incoming,demand,safety,target,quantity,available,cover,status,stale}}
function seed(){const defs=[['RF-101','Color-coated roofing','หลังคาเคลือบสี','Roofing','หลังคา','m','เมตร',1200,145,2,50,1150,120,400],['RF-202','PU insulated panels','แผ่นหลังคาฉนวน PU','Roofing','หลังคา','m','เมตร',700,380,5,25,3600,80,0],['RF-303','Galvanized roofing','หลังคาสังกะสี','Roofing','หลังคา','m','เมตร',820,110,2,50,120,60,250],['SP-401','Special-profile panels','แผ่นหลังคาสั่งพิเศษ','Special','สั่งพิเศษ','m','เมตร',280,510,35,20,170,120,100],['AC-501','Roofing screws','สกรูยึดหลังคา','Accessories','อุปกรณ์','piece','ชิ้น',4800,2.5,2,100,9000,500,1500],['AC-502','Roof sealant','วัสดุยาแนวหลังคา','Accessories','อุปกรณ์','piece','ชิ้น',450,85,3,12,180,45,0],['FL-601','Flashing profiles','ครอบและแฟลชชิ่ง','Profiles','ชิ้นส่วนขึ้นรูป','m','เมตร',550,180,4,10,720,100,0],['ST-701','Steel purlins','แปเหล็ก','Profiles','ชิ้นส่วนขึ้นรูป','piece','ชิ้น',360,320,7,10,480,80,100]];
const products=defs.map(([sku,name,th,group,groupTh,unit,unitTh,base,price,leadDays,pack,onHand,committed,inbound])=>({sku,name,th,group,groupTh,unit,unitTh,base,price,leadDays,pack,onHand,committed,inbound,stockDate:'2026-08-31',inboundDue:inbound?'2026-09-02':null}));const salespeople=[{id:'S01',name:'Narin',th:'นรินทร์'},{id:'S02',name:'Mali',th:'มะลิ'},{id:'S03',name:'Arun',th:'อรุณ'},{id:'S04',name:'Pim',th:'พิม'}];const customers=Array.from({length:12},(_,i)=>({id:'C'+String(i+1).padStart(3,'0'),name:['North Build','Urban Roof','Home Project','Siam Dealer'][i%4]+' '+(i+1),segment:['Contractor','Dealer','Homeowner'][i%3],segmentTh:['ผู้รับเหมา','ตัวแทนจำหน่าย','เจ้าของบ้าน'][i%3]}));const sales=[];let seq=0;for(let mi=0;mi<30;mi++){const month=shiftMonth('2024-03',mi);products.forEach((p,pi)=>{for(let j=0;j<12;j++){const seasonal=1+.22*Math.sin(((Number(month.slice(5))+pi/3)/12)*2*Math.PI);const trend=1+mi*.009;const wiggle=.9+((mi*13+j*7+pi*11)%23)/100;const quantity=Math.round(p.base/12*seasonal*trend*wiggle*(j%4===0?1.3:.95));sales.push({id:'L'+(++seq),invoice:'INV-'+month.replace('-','')+'-'+String(seq).padStart(5,'0'),date:month+'-'+String(2+j*2).padStart(2,'0'),sku:p.sku,customer:customers[(j+pi)%12].id,salesperson:salespeople[(j+pi)%4].id,quantity,amount:round(quantity*p.price)})}})}return {version:1,demo:true,completeThrough:'2026-08',products,salespeople,customers,sales}}
function validate(data){if(!data||data.version!==1)throw Error('Expected dataset version 1.');for(const k of ['products','salespeople','customers','sales'])if(!Array.isArray(data[k])||!data[k].length)throw Error('Missing or empty '+k);if(data.sales.length>100000||data.products.length>10000)throw Error('Dataset exceeds prototype limits.');const ids={};for(const [key,field] of [['products','sku'],['salespeople','id'],['customers','id'],['sales','id']]){ids[key]=new Set();data[key].forEach(r=>{if(typeof r[field]!=='string'||!r[field].trim()||ids[key].has(r[field]))throw Error('Missing or duplicate '+key+' ID.');ids[key].add(r[field])})}for(const p of data.products){for(const k of ['name','th','group','groupTh','unit','unitTh'])if(typeof p[k]!=='string'||!p[k].trim())throw Error('Product '+p.sku+' needs '+k);for(const k of ['onHand','committed','inbound','leadDays','pack'])if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<0)throw Error('Invalid '+k+' for '+p.sku);if(p.pack<=0||p.leadDays>365||!Number.isInteger(p.leadDays))throw Error('Invalid pack or lead time.');if(!validDate(p.stockDate)||p.inbound>0&&(!validDate(p.inboundDue)||p.inboundDue<=p.stockDate))throw Error('Invalid stock or incoming date.');}
for(const r of data.salespeople)for(const k of ['name','th'])if(typeof r[k]!=='string')throw Error('Salesperson name required.');for(const r of data.customers)for(const k of ['name','segment','segmentTh'])if(typeof r[k]!=='string'||!r[k].trim())throw Error('Customer segments are required.');const invoices=new Map();for(const r of data.sales){if(!validDate(r.date)||!ids.products.has(r.sku)||!ids.customers.has(r.customer)||!ids.salespeople.has(r.salesperson)||typeof r.invoice!=='string'||!r.invoice)throw Error('Invalid sale date, invoice, or linked ID.');if(!Number.isFinite(r.quantity)||r.quantity<0||!Number.isFinite(r.amount)||r.amount<0)throw Error('Sales quantity and amount must be nonnegative numbers.');const signature=[r.date,r.customer,r.salesperson].join('|');if(invoices.has(r.invoice)&&invoices.get(r.invoice)!==signature)throw Error('Inconsistent invoice header: '+r.invoice);invoices.set(r.invoice,signature)}const ms=months(data);if(ms.length>60||shiftMonth(ms[0],59)<ms.at(-1))throw Error('Use up to 60 months of data.');if(!/^\d{4}-\d{2}$/.test(data.completeThrough)||!ms.includes(data.completeThrough))throw Error('completeThrough must identify a closed month in the history.');for(let m=ms[0];m<=data.completeThrough;m=shiftMonth(m,1))if(!ms.includes(m))throw Error('Missing complete month: '+m);return data}
root.ForecastEngine={sum,avg,round,shiftMonth,daysIn,monthEnd,addDays,history,months,consumptionComponents,estimate,backtest,chooseMethod,forecast,plan,seed,validate};if(typeof module!=='undefined')module.exports=root.ForecastEngine;
})(typeof window==='undefined'?globalThis:window);
