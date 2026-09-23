(function(){
'use strict';
const E=ForecastEngine, $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function normalizeImportedSalespeople(source){
 if(source.importSummary?.format!=='express-csv')return source;
 const idMap=new Map(),people=new Map();
 for(const person of source.salespeople){
  const code=normalizeStaffId(person.staffId||person.id.replace(/^EXP-S-/,'')),id='EXP-S-'+code;
  idMap.set(person.id,id);
  if(!people.has(id))people.set(id,{...person,id,staffId:code,name:code==='UNASSIGNED'?'Unassigned salesperson':'Salesperson '+code,th:code==='UNASSIGNED'?'ไม่ระบุพนักงานขาย':'พนักงาน '+code});
 }
 const sales=source.sales.map(row=>({...row,salesperson:idMap.get(row.salesperson)||row.salesperson})),used=new Set(sales.map(row=>row.salesperson));
 return {...source,salespeople:[...people.values()].filter(person=>used.has(person.id)).sort((a,b)=>a.staffId.localeCompare(b.staffId)),sales,adjustments:(source.adjustments||[]).map(row=>({...row,salesperson:idMap.get(row.salesperson)||row.salesperson}))};
}
/* Caches for bySku/byCustomer and bounds(); declared before `state`, whose
   initialiser already calls bounds(). */
const lookupIndexes=new WeakMap();let boundsCache=null;
let data=E.seed();
try{localStorage.removeItem('monthly-forecast-entry-v1');indexedDB.deleteDatabase('monthly-sales-forecast-data-v1')}catch{/* Start without remembered company data. */}
data=normalizeImportedSalespeople(assignStaffIds(data));data={...data,operations:Array.isArray(data.operations)?data.operations:[],inventoryImport:data.inventoryImport||null,operationsImport:data.operationsImport||null};
let theme='light';try{theme=localStorage.getItem('monthly-forecast-theme')==='dark'?'dark':'light'}catch{}
let unlocked=false;
const state={role:'sales',identity:'',lang:'th',tab:'overview',importExpanded:true,compare:[],heatDay:'',heatCompare:[],sellerDetail:'',heatPage:0,reportSignature:'',customerSegment:'',customerSku:'',customerPerson:'',customerGroup:'',customerSearch:'',customerSelected:'',detailGroup:'',detailPrefix:'',detailSku:'',detailSearch:'',mineFrom:bounds().from,mineTo:bounds().to,mineSearch:'',mineCustomer:'',mineSku:'',topMetric:'sales',topPrefix:'',topUnit:'',attributeView:'color',stockByGroup:{},from:firstSaleDate(),to:bounds().to,person:'',segment:'',group:'',sku:data.products[0].sku,method:'auto',factor:1,review:7,buffer:7,team:defaultTeam()};
const t=(en,th)=>state.lang==='th'?th:en, name=p=>state.lang==='th'?(p.th||p.name):p.name, unit=p=>state.lang==='th'?p.unitTh:p.unit, money=n=>state.lang==='th'?num(n,2)+' บาท':'THB '+num(n,2), num=(n,d=0)=>n===null||!Number.isFinite(n)?'—':n.toLocaleString(state.lang==='th'?'th-TH':'en-US',{maximumFractionDigits:d,minimumFractionDigits:d}), pct=n=>n===null?'—':num(n*100,1)+'%', month=m=>new Date(m+'-01T00:00:00Z').toLocaleDateString(state.lang==='th'?'th-TH-u-ca-gregory':'en-US',{month:'short',year:'numeric',timeZone:'UTC'});
/* Sales Team: people are ticked by default except the unassigned bucket, which
   is not a person and would otherwise pull the per-person average down. */
function defaultTeam(){return new Set(data.salespeople.filter(p=>!p.archived&&p.staffId!=='UNASSIGNED').map(p=>p.id))}
/* One distinct colour per salesperson (CSS tokens --person-N, light and dark),
   the same in the checkbox list and the chart. */
function personColor(id){const person=data.salespeople.find(p=>p.id===id);if(!person||person.staffId==='UNASSIGNED')return 'var(--person-none)';return 'var(--person-'+(data.salespeople.filter(p=>p.staffId!=='UNASSIGNED').indexOf(person)%8+1)+')'}
/* Axis labels for baht. Thai readers get the full number ("2,500,000"); only
   English shortens it ("2.6 M", "648 k"), because พัน/ล้าน abbreviations are easy
   to misread in Thai. */
/* Heat-map cell label: Thai = whole baht ("1,234,567"), English = "1,235k". */
function heatShort(v){return v>0?(state.lang==='th'?num(v,0):num(Math.round(v/1000))+'k'):''}
function compactBaht(v){if(state.lang==='th')return num(v,0);return Math.abs(v)>=1e6?num(v/1e6,1)+' M':Math.abs(v)>=1e3?num(v/1e3,0)+' k':num(v,0)}
const colors=['#8ca94f','#687fb7','#c87973','#7e8992','#627aa9','#a8bd70'];
/* Nav icons: one thin-line set, 24-unit grid, drawn with currentColor (styles in css/styles.css). */
const NAV_ICON_PATHS={overview:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',forecast:'<path d="M3.5 18.5l5-5 3.5 3.5 7.5-8"/><path d="M14.5 9h5v5"/><path d="M3.5 21h17"/>',products:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5"/><path d="M12 12v9"/>',team:'<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.6-3.6 3.1-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M15.5 5.2a3.5 3.5 0 010 6.6"/><path d="M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',customers:'<path d="M4 20.5V7l8-3.5L20 7v13.5"/><path d="M9 20.5v-5h6v5"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>',data:'<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>',mine:'<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.8-4 3.7-6 7.5-6s6.7 2 7.5 6"/>',accessAdmin:'<circle cx="8" cy="15" r="4.5"/><path d="M11.2 11.8L20 3"/><path d="M16.5 6.5l2.5 2.5"/><path d="M14 9l2 2"/>'};
function navIcon(id){return '<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">'+(NAV_ICON_PATHS[id]||'<circle cx="12" cy="12" r="8"/>')+'</svg></span>'}
const tabs=[['overview','Overview','ภาพรวม'],['forecast','Demand forecast','คาดการณ์ยอดขาย'],['products','Products','สินค้า'],['team','Sales Team','ทีมขาย'],['customers','Customers','ลูกค้า'],['data','Data & backup','ข้อมูลและสำรอง']];
const managerTabs=[['overview','Overview','ภาพรวม'],['forecast','Demand forecast','คาดการณ์ยอดขาย'],['products','Products','สินค้า'],['team','Sales Team','ทีมขาย'],['customers','Customers','ลูกค้า']];
const salespersonTabs=[['mine','My sales','ยอดขายของฉัน']];
const techTabs=[['accessAdmin','Password support','ดูแลรหัสผ่าน']];
/* Temporary SKU-prefix group names, analysed from the real Express data
   pending client confirmation (see prd.md S13). Prefixes not listed here
   show the bare code, unchanged. */
const GROUP_PREFIX_NAMES={'01':['Bare zinc/galvanized sheet','สังกะสีเปลือย'],'02':['Standard coated paint','สีเคลือบมาตรฐาน'],'03':['Branded coated paint','สีเคลือบมีแบรนด์'],'04':['Special / imported paint','สีพิเศษ/นำเข้า'],'08':['Ceiling panel','แผ่นฝ้า'],'13':['Fencing','รั้ว'],'88':['PU foam insulation','ฉนวน PU'],'77':['Service fee','ค่าบริการ']};
function groupLabel(prefix){const known=GROUP_PREFIX_NAMES[prefix];return known?prefix+' · '+(state.lang==='th'?known[1]:known[0]):prefix}
/* Lookup by key through a Map built once per array. Views call these once per
   sale line (31,000+ lines on real data), so a linear find() over 600+
   products and 1,400+ customers made each tab switch take up to ~0.8 s.
   Changes always replace data.products / data.customers with a new array,
   so the cache is keyed on the array itself; the length check guards against
   an in-place push. The first item with a key wins, exactly like find().
   lookupIndexes is declared at the top, before any code can call it. */
function lookup(list,field,value){let entry=lookupIndexes.get(list);if(!entry||entry.length!==list.length){const map=new Map();for(const item of list)if(!map.has(item[field]))map.set(item[field],item);entry={length:list.length,map};lookupIndexes.set(list,entry)}return entry.map.get(value)}
const bySku=sku=>lookup(data.products,'sku',sku), byCustomer=id=>lookup(data.customers,'id',id);
/* bounds() sorts every sale date, and covered() calls it once per product
   row, so it is cached (boundsCache, declared at the top) until data.sales
   or completeThrough changes. */
function bounds(){if(!boundsCache||boundsCache.sales!==data.sales||boundsCache.length!==data.sales.length||boundsCache.completeThrough!==data.completeThrough)boundsCache={sales:data.sales,length:data.sales.length,completeThrough:data.completeThrough,value:{from:E.months(data)[0]+'-01',to:[E.monthEnd(data.completeThrough),...data.sales.map(r=>r.date)].sort().at(-1)}};return {...boundsCache.value}}
/* Default date range = the whole imported file: from the first sale date in
   the data to its last day, so a fresh import shows everything and the user
   narrows it down, instead of starting on the last month only. */
function firstSaleDate(){let first='';for(const r of data.sales)if(!first||r.date<first)first=r.date;return first||bounds().from}
function validDay(v){return /^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v}
function dateLabel(v){return new Date(v+'T00:00:00Z').toLocaleDateString(state.lang==='th'?'th-TH-u-ca-gregory':'en-US',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}
function bucketLabel(v){return v.length===10?dateLabel(v):month(v)}
function selectedRange(){return dateLabel(state.from)+' – '+dateLabel(state.to)}
function priorRange(){const days=Math.round((Date.parse(state.to)-Date.parse(state.from))/86400000)+1;return {from:E.addDays(state.from,-days),to:E.addDays(state.from,-1)}}
function lastYear(day){const m=E.shiftMonth(day.slice(0,7),-12);return m+'-'+String(Math.min(Number(day.slice(8)),E.daysIn(m))).padStart(2,'0')}
function covered(a,b){const limits=bounds();return a>=limits.from&&b<=limits.to}
function rangeBuckets(from,to){const out=[],days=(Date.parse(to)-Date.parse(from))/86400000+1;if(days<=92){for(let d=from;d<=to;d=E.addDays(d,1))out.push(d)}else{for(let m=from.slice(0,7);m<=to.slice(0,7);m=E.shiftMonth(m,1))out.push(m)}return out}function reportBuckets(){return rangeBuckets(state.from,state.to)}
function dateControls(){const limits=bounds();return '<label>'+t('From date','จากวันที่')+'<input id="from" type="date" min="'+limits.from+'" max="'+limits.to+'" value="'+state.from+'" required></label><label>'+t('To date','ถึงวันที่')+'<input id="to" type="date" min="'+limits.from+'" max="'+limits.to+'" value="'+state.to+'" required></label>'}
/* The Sales Team page picks people with its own checkboxes, so the salesperson
   filter is hidden and ignored there; otherwise unticked-by-filter people count
   as zero and drag the selected-team average down. */
function personFilter(){return state.tab==='team'?'':state.person}
function filteredBetween(from,to,ignoreGroup=false){const person=personFilter();return data.sales.filter(r=>r.date>=from&&r.date<=to&&(!person||r.salesperson===person)&&(!state.segment||byCustomer(r.customer).segment===state.segment)&&(ignoreGroup||!state.group||bySku(r.sku).group===state.group))}
function filtered(bucket){return filteredBetween(state.from,state.to).filter(r=>!bucket||r.date.startsWith(bucket))}
function stats(rows){const sales=E.sum(rows.map(r=>r.amount)),invoices=new Set(rows.map(r=>r.invoice)).size;return {sales,invoices,customers:new Set(rows.map(r=>r.customer)).size,average:invoices?sales/invoices:0}}
function group(rows,key){const map=new Map();for(const r of rows){const k=key(r);if(!map.has(k))map.set(k,[]);map.get(k).push(r)}return [...map].map(([key,rows])=>({key,rows,...stats(rows)})).sort((a,b)=>b.sales-a.sales)}
function option(value,label,current){return `<option value="${esc(value)}" ${String(value)===String(current)?'selected':''}>${esc(label)}</option>`}
function select(label,id,items,current){return `<label>${esc(label)}<select id="${id}">${items.map(x=>option(x[0],x[1],current)).join('')}</select></label>`}
function heading(eyebrow,title,sub){return `<div class="heading"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p class="muted">${esc(sub)}</p></div></div>`}
function panel(title,body,sub=''){return `<article class="panel"><div class="panel-head"><h2>${esc(title)}</h2>${sub?`<span class="muted">${esc(sub)}</span>`:''}</div>${body}</article>`}
function kpis(items){return `<div class="kpis">${items.map(([label,value,sub])=>`<article class="kpi"><label>${esc(label)}</label><strong>${esc(value)}</strong><small>${esc(sub)}</small></article>`).join('')}</div>`}
function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}" class="empty">${t('No matching records. Clear your filters to see more.','ไม่พบรายการที่ตรงกัน ล้างตัวกรองเพื่อดูข้อมูลเพิ่มเติม')}</td></tr>`}</tbody></table></div>`}
function bars(items){const max=Math.max(1,...items.map(x=>x.value));return items.length?items.map((x,i)=>`<div class="bar" title="${esc(x.label+': '+money(x.value))}"><div>${esc(x.label)}${x.sub?`<small class="muted">${esc(x.sub)}</small>`:''}</div><div class="track"><div class="fill" style="width:${Math.max(0,x.value/max*100)}%;background:${colors[i%colors.length]}"></div></div><strong>${esc(money(x.value))}</strong></div>`).join(''):`<p class="empty">${t('No matching sales.','ไม่พบยอดขายที่ตรงกัน')}</p>`}
function quantityBars(items,unitLabel){const max=Math.max(1,...items.map(x=>x.value));return items.length?items.map((x,i)=>`<div class="bar" title="${esc(x.label+': '+num(x.value,2)+' '+unitLabel)}"><div>${esc(x.label)}</div><div class="track"><div class="fill" style="width:${Math.max(0,x.value/max*100)}%;background:var(--cat-1)"></div></div><strong>${esc(num(x.value,2)+' '+unitLabel)}</strong></div>`).join(''):`<p class="empty">${t('No matching sales.','ไม่พบยอดขายที่ตรงกัน')}</p>`}
/* --- dataviz-skill components: sparkline, stat tile, meter, sequential heatmap.
   Palette: validated categorical/sequential/status roles (--cat-*, --seq-*,
   --status-*), see css/styles.css. Reuses the app's existing [data-tip]
   tooltip listener (registered near the end of this file) for hover values. */
function sparkline(values,w,h){
 w=w||120;h=h||32;
 const nums=values.map(v=>Number.isFinite(v)?v:0);
 if(!nums.length)return '';
 const max=Math.max(...nums,1e-9),min=Math.min(...nums,0),range=max-min||1;
 const step=nums.length>1?w/(nums.length-1):0;
 const points=nums.map((v,i)=>[i*step,h-((v-min)/range)*h]);
 const path=points.map((p,i)=>(i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
 const last=points[points.length-1];
 return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-hidden="true"><path d="${path}" fill="none" stroke="var(--cat-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3" fill="var(--cat-1)" stroke="#fff" stroke-width="1.5"/></svg>`;
}
function statTile(label,value,sub,sparkValues,extraHtml){
 return `<div class="stat-tile"><span class="stat-label">${esc(label)}</span><strong class="stat-value">${value}</strong>${sub?`<span class="stat-sub">${sub}</span>`:''}${sparkValues&&sparkValues.length>1?sparkline(sparkValues):''}${extraHtml||''}</div>`;
}
function gradeStatusColor(grade){return {good:'var(--status-good)',fair:'var(--status-warning)',weak:'var(--status-serious)',unusable:'var(--status-critical)',unknown:'var(--muted)'}[grade]||'var(--muted)'}
function meterRow(fraction,colorVar,iconLabel){
 const pct0=Math.max(0,Math.min(100,fraction*100));
 return `<div class="meter"><div class="meter-track"><div class="meter-fill" style="width:${pct0}%;background:${colorVar}"></div></div>${iconLabel?`<span class="meter-label" style="color:${colorVar}"><span class="meter-icon" style="background:${colorVar}">${esc(iconLabel.icon)}</span>${esc(iconLabel.text)}</span>`:''}</div>`;
}
function wapeMeter(wape,grade){
 const meta=wapeGradeMeta[grade]||wapeGradeMeta.unknown;
 const color=gradeStatusColor(grade);
 const fraction=wape===null?0:Math.min(1,wape/0.30);
 return `<div data-tip="${esc(t('WAPE','ค่าความคลาดเคลื่อน WAPE')+' '+(wape===null?t('not measured','ยังไม่ได้วัด'):pct(wape))+' · '+t(...meta.label))}">`+
  `<strong>${wape===null?'—':pct(wape)}</strong> `+meterRow(fraction,color,{icon:meta.icon,text:t(...meta.label)})+'</div>';
}
function coverMeterCell(days,urgent,reason){
 if(days===null)return '<span class="meter-label" style="color:var(--muted)">'+esc(reason==='no-stock-entered'?t('Type in stock to see cover','กรอกสต็อกเพื่อดูวันพอใช้'):t('No rate','ไม่มีอัตรา'))+'</span>';
 const color=urgent?'var(--status-critical)':'var(--status-good)';
 const fraction=Math.min(1,days/14);
 return meterRow(fraction,color,{icon:urgent?'!':'✓',text:num(days,1)+' '+t('days','วัน')});
}
/* Sequential heatmap as an HTML table: rows=[{label,cells:[{value,tip}...]}],
   columns=[label,...]. colorFor maps a normalized 0..1 magnitude to one of
   the 5 validated sequential steps. */
function heatmapSteps(){return ['var(--seq-100)','var(--seq-250)','var(--seq-400)','var(--seq-550)','var(--seq-700)']}
/* Heat-map shades are the same in light and dark themes, so the text colour is
   fixed too: dark on the three light steps, white on the two dark ones. */
function heatmapStepText(stepIndex){return stepIndex>=3?'#fff':'#0b1b2e'}
function heatmapTable(rowLabelHeader,columns,rows,max){
 const steps=heatmapSteps();
 const head='<tr><th>'+esc(rowLabelHeader)+'</th>'+columns.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr>';
 const body=rows.map(row=>{
  const rowMax=max==='row'?Math.max(1,...row.cells.map(c=>c.value||0)):max;
  const cells=row.cells.map(c=>{
   if(c.value===null||c.value===undefined||c.value<=0)return '<td style="background:var(--line)" data-tip="'+esc(c.tip)+'"></td>';
   const stepIndex=rowMax>0?Math.min(4,Math.floor((c.value/rowMax)*4.999)):0;
   return '<td style="background:'+steps[stepIndex]+';color:'+heatmapStepText(stepIndex)+'" data-tip="'+esc(c.tip)+'">'+(c.short||'')+'</td>';
  }).join('');
  return '<tr><td class="hm-row-label">'+esc(row.label)+'</td>'+cells+'</tr>';
 }).join('');
 return '<div class="table-wrap"><table class="heatmap-table"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>';
}
function heatmapScaleLegend(lowLabel,highLabel){
 return '<div class="scale-legend"><span>'+esc(lowLabel)+'</span>'+heatmapSteps().map(s=>'<span class="scale-swatch" style="background:'+s+'"></span>').join('')+'<span>'+esc(highLabel)+'</span></div>';
}
function chart(labels,series,valueLabel,{forecast=false,compare=false,seriesCompare=false,legend=true}={}){
 /* 'THB' is the key for money charts; the reader sees บาท in Thai. */
 const unitText=valueLabel==='THB'?t('THB','บาท'):valueLabel;
 if(!labels.length||!series.length)return `<div class="empty">${t('Select at least one salesperson.','เลือกพนักงานขายอย่างน้อยหนึ่งคน')}</div>`;
 const mobile=window.innerWidth<700,w=mobile?400:960,h=300,l=82,r=mobile?46:48,top=22,bottom=48,all=series.flatMap(s=>s.values).filter(Number.isFinite),max=Math.max(1,...all)*1.12,x=i=>l+i*(w-l-r)/Math.max(1,labels.length-1),y=v=>h-bottom-(v/max)*(h-top-bottom);
 let s=`<svg class="chart" viewBox="0 0 ${w} ${h}" role="${compare?'group':'img'}" aria-label="${esc(unitText)}"><title>${esc(unitText)}</title>`;
 for(let i=0;i<=4;i++){const v=max*i/4;s+=`<line x1="${l}" x2="${w-r}" y1="${y(v)}" y2="${y(v)}" stroke="#e2e9ee"/><text x="${l-10}" y="${y(v)+4}" text-anchor="end">${esc(valueLabel==='THB'?compactBaht(v):num(v,0))}</text>`}
 labels.forEach((v,i)=>{if(i===0||i===labels.length-1||(i%Math.ceil(labels.length/(mobile?2:6))===0&&i<labels.length-2))s+=`<text x="${x(i)}" y="${h-16}" text-anchor="middle">${esc(bucketLabel(v))}</text>`});
 series.forEach((line,j)=>{const col=line.color||colors[j%colors.length];let path='';line.values.forEach((v,i)=>{if(Number.isFinite(v))path+=(path?' L':'M')+x(i)+','+y(v)});s+=`<path d="${path}" fill="none" stroke="${col}" style="stroke:${col}" data-series="${esc(line.key||'')}" stroke-width="2.6" ${line.dashed?'stroke-dasharray="7 6"':''}/>`;if(line.reference){const label=line.name+': '+num(line.values.find(Number.isFinite),2)+' '+unitText;s+=`<rect class="average-hit" x="${x(0)}" y="${y(line.values.find(Number.isFinite))-9}" width="${Math.max(1,x(labels.length-1)-x(0))}" height="18" fill="transparent" tabindex="0" role="img" aria-label="${esc(label)}" data-tip="${esc(label)}"><title>${esc(label)}</title></rect>`}line.values.forEach((v,i)=>{if(!Number.isFinite(v)||line.reference||line.noPoints)return;const label=`${line.name} · ${bucketLabel(labels[i])}: ${num(v,2)} ${unitText}`,pointKey=seriesCompare?(line.key+'|'+labels[i]):labels[i];s+=`<circle cx="${x(i)}" cy="${y(v)}" r="${compare&&state.compare.includes(pointKey)?7:4}" fill="${compare&&state.compare.includes(pointKey)?colors[0]:'white'}" stroke="${col}" style="stroke:${col}" data-series="${esc(line.key||'')}" stroke-width="2" tabindex="0" ${compare?`role="button" data-compare="${pointKey}" aria-pressed="${state.compare.includes(pointKey)}"`:''} aria-label="${esc(label)}" data-tip="${esc(label)}"><title>${esc(label)}</title></circle>`})});
 s+='</svg>';return `<div class="legend"${legend?'':' hidden'}>${series.map((s,j)=>`<span><i style="background:${s.color||colors[j%colors.length]}"></i>${esc(s.name)}</span>`).join('')}</div>${s}<small class="muted">${t('Hover or focus a point for exact values.','วางเมาส์หรือใช้แป้นพิมพ์เลือกจุดเพื่อดูค่าที่แน่นอน')}</small>`;
}
function forecastMethodLabel(key) {
  const labels = {
    consumption: ['Seasonal monthly consumption rate', 'อัตราการใช้รายเดือนตามฤดูกาล'],
    naive: ["Last month's result", 'ผลเดือนล่าสุด'],
    recent: ['3-month average', 'ค่าเฉลี่ย 3 เดือน'],
    weighted: ['Weighted 3-month average', 'ค่าเฉลี่ยถ่วงน้ำหนัก 3 เดือน'],
    trend: ['Damped recent trend', 'แนวโน้มล่าสุดแบบจำกัดความผันผวน'],
    seasonal: ['Seasonal + recent trend', 'ฤดูกาล + แนวโน้มล่าสุด'],
  };
  return t(...(labels[key] || labels.consumption));
}
function forecastControls(){return '<div class="callout"><strong>'+t('Automatic method selection','เลือกระบบคำนวณอัตโนมัติ')+'</strong><p>'+t('The dashboard backtests several transparent methods and uses the lowest-error valid method for each SKU.','แดชบอร์ดทดสอบวิธีคำนวณที่ตรวจสอบได้หลายวิธีกับข้อมูลย้อนหลัง และเลือกวิธีที่มีความคลาดเคลื่อนต่ำสุดสำหรับแต่ละ SKU')+'</p></div><div class="form-grid"><label>'+t('Demand scenario adjustment (%)','ปรับสมมติฐานความต้องการ (%)')+'<input id="factor" type="number" min="-50" max="50" step="1" value="'+Math.round((state.factor-1)*100)+'"></label></div>'}
function comparisonPanel(){
 const selected=[...state.compare].sort(),reset='<button class="button secondary" data-clear-compare>'+t('Clear comparison','ล้างการเปรียบเทียบ')+'</button>';
 if(selected.length<2)return '<div id="point-comparison" class="comparison-box" aria-live="polite"><p>'+t('Click two graph points to compare. A third point starts a new comparison.','คลิกจุดกราฟสองจุดเพื่อเปรียบเทียบ คลิกจุดที่สามเพื่อเริ่มใหม่')+'</p>'+(selected.length?'<strong>'+bucketLabel(selected[0])+' · '+money(stats(filtered(selected[0])).sales)+'</strong> '+reset:'')+'</div>';
 const a=stats(filtered(selected[0])).sales,b=stats(filtered(selected[1])).sales,diff=b-a,change=a?diff/a:null;
 return '<div id="point-comparison" class="comparison-box" aria-live="polite"><div class="compare-values"><span><small>'+t('Earlier point','จุดก่อนหน้า')+' · '+bucketLabel(selected[0])+'</small><strong>'+money(a)+'</strong></span><span><small>'+t('Later point','จุดหลัง')+' · '+bucketLabel(selected[1])+'</small><strong>'+money(b)+'</strong></span></div><p><strong>'+t(diff>0?'Increase':diff<0?'Decrease':'No change',diff>0?'เพิ่มขึ้น':diff<0?'ลดลง':'ไม่เปลี่ยนแปลง')+': '+money(Math.abs(diff))+'</strong> · '+(change===null?t('Percentage unavailable: earlier value is zero.','คำนวณเปอร์เซ็นต์ไม่ได้: ค่าก่อนหน้าเป็นศูนย์'):(change>0?'+':'')+pct(change))+'</p><small>'+t('Later minus earlier; endpoint values only, not the sales total between them.','ค่าจุดหลังลบจุดก่อนหน้า เปรียบเทียบค่าปลายสองจุด ไม่ใช่ยอดรวมระหว่างจุด')+'</small>'+reset+'</div>';
}
/* Top N for every ranking: 5 / 10 / 15 / all, remembered per ranking for the
   session. "All" scrolls inside its box once the list is longer than 15. */
const TOP_N_CHOICES=[5,10,15,0];
function topLimit(key,fallback){const v=(state.topN||{})[key];return v===undefined?fallback:v}
function applyTop(list,key,fallback){const n=topLimit(key,fallback);return n?list.slice(0,n):list}
function topNControl(key,fallback,total){const current=topLimit(key,fallback);return '<div class="topn" role="group" aria-label="'+esc(t('How many to show','จำนวนที่แสดง'))+'">'+TOP_N_CHOICES.map(n=>'<button type="button" class="topn-option" data-top-n-key="'+key+'" data-top-n="'+n+'" aria-pressed="'+(current===n)+'">'+(n?'Top '+n:t('All','ทั้งหมด')+' ('+num(total)+')')+'</button>').join('')+'</div>'}
function topScroll(html,key,fallback,count){return topLimit(key,fallback)===0&&count>15?'<div class="topn-scroll" tabindex="0">'+html+'</div>':html}
/* Revenue heat map, rows x every imported month, in thousand baht. One shade
   scale for the whole table (all cells are baht). Uses the whole imported
   history so the seasonal shape shows, with the page's other filters. */
function monthRevenueHeatmap(rowHeader,keyOf,labelOf,keys,ignoreGroup){
 const months=E.months(data),rows=filteredBetween(months[0]+'-01',E.monthEnd(months[months.length-1]),ignoreGroup);
 const totals=new Map();for(const r of rows){const k=keyOf(r),m=r.date.slice(0,7),id=k+'|'+m;totals.set(id,(totals.get(id)||0)+r.amount)}
 const max=Math.max(1,...totals.values());
 const table=heatmapTable(rowHeader,months.map(m=>month(m)),keys.map(k=>({label:labelOf(k),cells:months.map(m=>{const v=totals.get(k+'|'+m)||0;return {value:v,short:heatShort(v),tip:labelOf(k)+' · '+month(m)+' · '+money(v)}})})),max);
 return '<p class="note">'+t('Values in thousand baht, every imported month. Darker = higher sales anywhere in this table. Tap a cell for the exact amount.','ตัวเลขเป็นบาท (ปัดเศษสตางค์) ครบทุกเดือนที่นำเข้า สีเข้ม = ยอดสูงกว่าในตารางนี้ แตะช่องเพื่อดูยอดพร้อมสตางค์')+'</p>'+table;
}
/* Long tables show 10 rows a page with Previous / Next, so the sections below
   them stay reachable. The page resets when the table's filters change
   (signature), and jumps to the page holding a focused row (e.g. the SKU just
   opened from "Forecast →") only when that focus changes. */
const PAGE_SIZE=10;
function pageSlice(key,list,signature,focusIndex=-1){
 state.pages=state.pages||{};const prev=state.pages[key]||{};
 let page=prev.sig===signature?prev.page||0:0;
 if(focusIndex>=0&&focusIndex!==prev.focus)page=Math.floor(focusIndex/PAGE_SIZE);
 const count=Math.max(1,Math.ceil(list.length/PAGE_SIZE));page=Math.min(Math.max(0,page),count-1);
 state.pages[key]={sig:signature,page,focus:focusIndex};
 return {rows:list.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE),page,count,total:list.length};
}
function pagerHtml(key,p){
 if(p.total<=PAGE_SIZE)return '';
 const from=p.page*PAGE_SIZE+1,to=Math.min(p.total,(p.page+1)*PAGE_SIZE);
 return '<div class="customer-pagination table-pager" data-pager="'+key+'"><button class="button secondary" data-page-key="'+key+'" data-page-step="-1" '+(p.page===0?'disabled':'')+'>← '+t('Previous','ก่อนหน้า')+'</button><span>'+t('Page','หน้า')+' '+num(p.page+1)+' / '+num(p.count)+' · '+t('showing','แสดง')+' '+num(from)+'–'+num(to)+' '+t('of','จาก')+' '+num(p.total)+'</span><button class="button secondary" data-page-key="'+key+'" data-page-step="1" '+(p.page>=p.count-1?'disabled':'')+'>'+t('Next','ถัดไป')+' →</button></div>';
}
function productChanges(rows){
 const prior=priorRange();
 if(!covered(prior.from,prior.to))return '<p class="empty">'+t('Not enough earlier history for this comparison. Choose a later or shorter date range.','ประวัติช่วงก่อนหน้าไม่เพียงพอสำหรับเปรียบเทียบ เลือกช่วงวันที่หลังจากนี้หรือช่วงที่สั้นลง')+'</p>';
 const before=new Map(group(filteredBetween(prior.from,prior.to),r=>r.sku).map(g=>[g.key,g.sales])),now=new Map(group(rows,r=>r.sku).map(g=>[g.key,g.sales]));
 const changes=[...new Set([...before.keys(),...now.keys()])].map(sku=>({sku,old:before.get(sku)||0,current:now.get(sku)||0})).map(r=>({...r,diff:r.current-r.old})).sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff));
 const allChanges=changes.length;changes.splice(0,changes.length,...applyTop(changes,'changes',5));
 const intro=topNControl('changes',5,allChanges)+'<p class="note">'+t('Largest sales changes versus ','ยอดขายที่เปลี่ยนแปลงมากที่สุด เทียบกับ ')+dateLabel(prior.from)+' – '+dateLabel(prior.to)+t('. Same filters and number of days.','. ใช้ตัวกรองเดียวกันและจำนวนวันเท่ากัน')+'</p>';
 if(!changes.length)return intro+'<p class="empty">'+t('No sales in either period.','ไม่มียอดขายทั้งสองช่วง')+'</p>';
 return intro+topScroll('<div id="product-changes">'+changes.map(r=>'<div class="insight-row"><div><strong>'+esc(r.sku)+' · '+esc(name(bySku(r.sku)))+'</strong><p>'+t('Previous','ช่วงก่อน')+': '+money(r.old)+' → '+t('Selected','ช่วงที่เลือก')+': '+money(r.current)+'</p><strong style="color:'+(r.diff<0?'#a54236':'#218368')+'">'+t(r.diff<0?'Decrease':r.diff>0?'Increase':'No change',r.diff<0?'ลดลง':r.diff>0?'เพิ่มขึ้น':'ไม่เปลี่ยนแปลง')+' '+money(Math.abs(r.diff))+'</strong> · '+(r.old?pct(r.diff/r.old):t('No previous sales','ช่วงก่อนหน้าไม่มียอดขาย'))+'</div></div>').join('')+'</div>','changes',5,changes.length)+'<p class="note">'+t('Start with the largest declines: check customer orders and availability before changing your plan.','เริ่มตรวจสอบสินค้าที่ลดลงมากที่สุด: ดูคำสั่งซื้อของลูกค้าและความพร้อมของสินค้าก่อนปรับแผน')+'</p><button class="button secondary" data-tab="products">'+t('View product details →','ดูรายละเอียดสินค้า →')+'</button>';
}

function heatComparison(){
 const ds=[...state.heatCompare].sort(),hint='<p>'+t('Click two dates to compare. A third date starts again.','คลิกวันที่สองวันเพื่อเปรียบเทียบ คลิกวันที่สามเพื่อเริ่มใหม่')+'</p>';
 if(ds.length<2)return hint;
 const a=stats(filteredBetween(ds[0],ds[0])),b=stats(filteredBetween(ds[1],ds[1])),diff=b.sales-a.sales;
 return hint+'<div id="heat-comparison" aria-live="polite"><strong>'+dateLabel(ds[0])+' · '+money(a.sales)+' → '+dateLabel(ds[1])+' · '+money(b.sales)+'</strong><p>'+t('Later minus earlier','วันหลังลบวันก่อน')+': '+(diff>0?'+':'')+money(diff)+' · '+(a.sales?pct(diff/a.sales):t('Percentage unavailable: earlier sales are zero.','คำนวณเปอร์เซ็นต์ไม่ได้: ยอดวันก่อนเป็นศูนย์'))+'</p><p>'+t('Invoices','ใบกำกับ')+': '+num(a.invoices)+' → '+num(b.invoices)+'</p></div><button class="button secondary" data-clear-heat>'+t('Clear comparison','ล้างการเปรียบเทียบ')+'</button>';
}
function interactiveSellers(rows){
 const gs=group(rows,r=>r.salesperson),max=Math.max(1,...gs.map(g=>g.sales));
 return '<p class="note">'+t('Click a salesperson to view details. Reporting filters stay unchanged.','คลิกพนักงานขายเพื่อดูรายละเอียด โดยไม่เปลี่ยนตัวกรองรายงาน')+'</p>'+gs.map((g,i)=>'<button class="seller-bar" data-seller="'+esc(g.key)+'" aria-expanded="'+(state.sellerDetail===g.key)+'"><span>'+esc(name(data.salespeople.find(p=>p.id===g.key)))+'<small>'+num(g.invoices)+' '+t('invoices','ใบกำกับ')+'</small></span><span class="track"><span class="fill" style="display:block;width:'+g.sales/max*100+'%;background:'+colors[i%colors.length]+'"></span></span><strong>'+money(g.sales)+'</strong></button>').join('')+(()=>{const g=gs.find(g=>g.key===state.sellerDetail);if(!g)return gs.length?'':'<p class="empty">'+t('No matching sales.','ไม่พบยอดขายที่ตรงกัน')+'</p>';const top=group(g.rows,r=>r.sku)[0];return '<div id="seller-details" class="callout" aria-live="polite"><strong>'+esc(name(data.salespeople.find(p=>p.id===g.key)))+'</strong><p>'+t('Customers','ลูกค้า')+': '+num(g.customers)+' · '+t('Average invoice','เฉลี่ยต่อใบกำกับ')+': '+money(g.average)+'</p><p>'+t('Average per calendar day','เฉลี่ยต่อวันปฏิทิน')+': '+money(g.sales/((Date.parse(state.to)-Date.parse(state.from))/86400000+1))+'</p><p>'+t('Top product','สินค้ายอดสูงสุด')+': '+esc(top.key)+' · '+esc(name(bySku(top.key)))+' · '+money(top.sales)+'</p><button class="button secondary" data-tab="team">'+t('Open sales team →','เปิดหน้าทีมขาย →')+'</button></div>'})()
}

function managementInsights(rows){
 if(!rows.length||stats(rows).sales===0)return '<p class="empty">'+t('No sales revenue in these filters. Change the dates or filters to see insights.','ไม่มียอดขายในตัวกรองนี้ เปลี่ยนช่วงวันที่หรือตัวกรองเพื่อดูข้อมูลเชิงลึก')+'</p>';
 const total=stats(rows).sales,peak=group(rows,r=>r.date)[0],seller=group(rows,r=>r.salesperson)[0],customer=group(rows,r=>r.customer)[0];
 const items=[
 [t('Highest sales day','วันที่มียอดขายสูงสุด'),dateLabel(peak.key)+' · '+money(peak.sales)+' · '+num(peak.invoices)+' '+t('invoices','ใบกำกับ'),t('Review the products and customers behind this peak before assuming it will repeat.','ตรวจสอบสินค้าและลูกค้าที่สร้างยอดสูงนี้ ก่อนคาดว่าจะเกิดซ้ำ')],
 [t('Leading salesperson','พนักงานขายยอดสูงสุด'),name(data.salespeople.find(p=>p.id===seller.key))+' · '+money(seller.sales)+' ('+pct(seller.sales/total)+')',t('Compare customer mix and average invoice value, not revenue alone.','เปรียบเทียบกลุ่มลูกค้าและยอดเฉลี่ยต่อใบกำกับร่วมด้วย ไม่ใช่เฉพาะยอดขาย')],
 [t('Leading customer','ลูกค้ายอดสูงสุด'),byCustomer(customer.key).name+' · '+money(customer.sales)+' · '+num(customer.invoices)+' '+t('invoices','ใบกำกับ'),t('Review recent purchases and confirm upcoming demand with the account owner.','ทบทวนการซื้อล่าสุดและยืนยันความต้องการถัดไปกับผู้ดูแลลูกค้า')]];
 return '<div id="management-insights">'+items.map((x,i)=>'<section class="insight-row"><span class="rank-number">'+(i+1)+'</span><div><h3>'+esc(x[0])+'</h3><p>'+esc(x[1])+'</p><small>'+esc(x[2])+'</small></div></section>').join('')+'</div><p class="note">'+t('Based on selected dates and reporting filters. Ties show one leader; these observations do not establish causes.','อ้างอิงช่วงวันที่และตัวกรองรายงาน หากยอดเท่ากันแสดงหนึ่งราย ข้อสังเกตเหล่านี้ไม่ได้ยืนยันสาเหตุ')+'</p>';
}
function salesHeatmap(rows){
 const dayMap=new Map(group(rows,r=>r.date).map(g=>[g.key,g])),max=Math.max(0,...[...dayMap.values()].map(g=>g.sales)),months=[];
 for(let m=state.from.slice(0,7);m<=state.to.slice(0,7);m=E.shiftMonth(m,1))months.push(m);
 const pages=Math.ceil(months.length/3);state.heatPage=Math.min(state.heatPage,pages-1);
 const palette=['#eef2f6','#d9eaf6','#9ec8e5','#5596c4','#246ea4'],week=t('Mon,Tue,Wed,Thu,Fri,Sat,Sun','จ.,อ.,พ.,พฤ.,ศ.,ส.,อา.').split(',');
 const cards=months.slice(state.heatPage*3,state.heatPage*3+3).map(m=>{
 let cells=Array((new Date(m+'-01T00:00:00Z').getUTCDay()+6)%7).fill('<span></span>').join('');
 for(let day=1;day<=E.daysIn(m);day++){const date=m+'-'+String(day).padStart(2,'0'),inside=date>=state.from&&date<=state.to,g=dayMap.get(date),value=g?.sales||0,level=value>0&&max>0?Math.max(1,Math.ceil(value/max*4)):0,label=dateLabel(date)+' · '+money(value)+' · '+num(g?.invoices||0)+' '+t('invoices','ใบกำกับ');
 cells+='<button class="heat-cell" '+(inside?'data-heat-day="'+date+'" data-tip="'+esc(label)+'"':'disabled')+' aria-label="'+esc(inside?label:dateLabel(date)+' · '+t('Outside selected dates','นอกช่วงวันที่เลือก'))+'" aria-pressed="'+(state.heatCompare.includes(date))+'" style="background:'+(inside?palette[level]:'#fff')+';color:'+(level>=3&&inside?'#fff':'#172e43')+'">'+day+'</button>'}
 return '<section class="heat-month"><h3>'+month(m)+'</h3><div class="heat-calendar">'+week.map(w=>'<span class="heat-weekday">'+w+'</span>').join('')+cells+'</div></section>'}).join('');
 const day=dayMap.get(state.heatDay);
 const detail=state.heatDay?'<strong>'+dateLabel(state.heatDay)+'</strong> · '+money(day?.sales||0)+' · '+num(day?.invoices||0)+' '+t('invoices','ใบกำกับ'):t('Hover or click a day to see its exact sales and invoice count.','วางเมาส์หรือคลิกวันที่เพื่อดูยอดขายและจำนวนใบกำกับที่แน่นอน');
 return '<article class="panel" id="sales-heatmap"><div class="panel-head"><h2>'+t('Daily sales heatmap','ปฏิทินความเข้มยอดขายรายวัน')+'</h2><span class="muted">'+selectedRange()+'</span></div><div class="heat-legend"><span>'+t('No sales','ไม่มียอดขาย')+'</span>'+palette.map((c,i)=>{const label=i===0?t('No sales','ไม่มียอดขาย')+': '+money(0):max===0?t('No positive sales in the selected range','ไม่มียอดขายมากกว่าศูนย์ในช่วงที่เลือก'):t('More than ','มากกว่า ')+money(Math.floor(max*(i-1)/4*100)/100)+t(' up to ',' ถึง ')+money(Math.floor(max*i/4*100)/100);return '<span class="heat-swatch" tabindex="0" role="img" aria-label="'+esc(label)+'" data-tip="'+esc(label)+'" title="'+esc(label)+'" style="background:'+c+'"></span>'}).join('')+'<span>'+t('Highest daily sales','ยอดรายวันสูงสุด')+': '+money(max)+'</span></div><div class="heat-months">'+cards+'</div><div class="callout" id="heat-detail" aria-live="polite">'+detail+heatComparison()+'</div>'+(pages>1?'<div class="heat-pagination"><button class="button secondary" data-heat-page="-1" '+(state.heatPage===0?'disabled':'')+'>'+t('Previous months','เดือนก่อนหน้า')+'</button><span>'+num(state.heatPage+1)+' / '+num(pages)+'</span><button class="button secondary" data-heat-page="1" '+(state.heatPage===pages-1?'disabled':'')+'>'+t('Next months','เดือนถัดไป')+'</button></div>':'')+'<p class="note">'+t('Darker means higher daily revenue. One shared scale covers the full selected range. Faded dates are outside the range; clicking a day does not change reporting filters.','สีเข้มหมายถึงยอดรายวันที่สูงกว่า ใช้มาตราส่วนเดียวกันตลอดช่วงวันที่ สีจางคือวันที่นอกช่วง การคลิกวันไม่เปลี่ยนตัวกรองรายงาน')+'</p></article>';
}
function productChangesDropdown(rows) {
  return `<details class="panel import-dropdown overview-changes-dropdown"><summary>${t('What changed in product sales?', 'ยอดขายสินค้าเปลี่ยนไปอย่างไร?')}</summary><div class="import-dropdown-body">${productChanges(rows)}</div></details>`;
}
function overviewBase(){if(data.demo)return heading(t('Company data','ข้อมูลบริษัท'),t('Import Express data to begin','นำเข้าข้อมูล Express เพื่อเริ่มต้น'),t('Open the dropdown below and select the cash-sales, credit-sales and deposit CSV files together.','เปิดเมนูด้านล่างแล้วเลือกไฟล์ขายเงินสด ขายเงินเชื่อ และรับมัดจำพร้อมกัน'))+expressImportPanel();const rows=filtered(),s=stats(rows),ms=reportBuckets(),trend=ms.map(m=>stats(filtered(m)).sales),prior=priorRange(),previous=stats(filteredBetween(prior.from,prior.to)).sales;const delta=covered(prior.from,prior.to)&&previous?(s.sales-previous)/previous:null;const plans=data.products.map(p=>({p,plan:E.plan(p,E.forecast(data,p.sku,state.method,state.factor),state.review,state.buffer)})),average=s.sales/ms.length,daily=ms[0]?.length===10,averageSeries=state.showOverviewAverage===false?[]:[{name:t(daily?'Average per calendar day':'Average per displayed month',daily?'เฉลี่ยต่อวันปฏิทิน':'เฉลี่ยต่อเดือนที่แสดง'),values:ms.map(()=>average),color:colors[0],dashed:true,reference:true}];
 const averageControl='<label class="chart-average-control"><input type="checkbox" data-overview-average '+(state.showOverviewAverage===false?'':'checked')+'><span>'+t(daily?'Show daily average':'Show monthly average',daily?'แสดงค่าเฉลี่ยรายวัน':'แสดงค่าเฉลี่ยรายเดือน')+' · <strong>'+money(average)+'</strong></span></label>';
 return heading(t('Management workspace','พื้นที่ทำงานสำหรับผู้บริหาร'),t('See sales. Plan the next move.','เห็นยอดขาย วางแผนก้าวถัดไป'),t('Sales performance for your selected dates, connected to next-month demand forecasting.','ผลงานยอดขายตามวันที่เลือก เชื่อมโยงกับการคาดการณ์ความต้องการเดือนถัดไป')).replace(/<\/div><\/div>$/,'</div>'+exportMenu()+'</div>')+expressImportPanel()+kpis([[t('Sales revenue','ยอดขาย'),money(s.sales),selectedRange()],[t('Invoices','ใบกำกับ'),num(s.invoices),t('Distinct invoice IDs','นับเลขที่ใบกำกับไม่ซ้ำ')],[t('Customers','ลูกค้า'),num(s.customers),t('Customers who purchased','ลูกค้าที่ซื้อสินค้า')],[t('Change from previous period','เปลี่ยนแปลงจากช่วงก่อนหน้า'),pct(delta),dateLabel(prior.from)+' – '+dateLabel(prior.to)]])+'<div class="grid wide overview-primary">'+panel(t('Sales over time','แนวโน้มยอดขาย'),averageControl+chart(ms,[{name:t('Sales revenue','ยอดขาย'),values:trend,color:colors[1]},...averageSeries],'THB',{compare:true})+'<p class="note">'+t('Green dashed line: average across displayed periods, including zero-sales periods. Partial months use only selected dates.','เส้นประสีเขียว: ค่าเฉลี่ยของช่วงที่แสดง รวมช่วงที่ไม่มียอดขาย เดือนที่ไม่เต็มใช้เฉพาะวันที่เลือก')+'</p>'+comparisonPanel(),t(daily?'Daily · selected dates':'Monthly · selected dates',daily?'รายวัน · ตามวันที่เลือก':'รายเดือน · ตามวันที่เลือก'))+productChangesDropdown(rows)+'</div>'+salesHeatmap(rows)+'<div class="grid">'+panel(t('Sales by salesperson','ยอดขายตามพนักงานขาย'),interactiveSellers(rows))+panel(t('Management insights','ข้อมูลเชิงลึกสำหรับผู้บริหาร'),managementInsights(rows))+'</div>';
}
function totalSalesForecast(method = 'auto', factor = 1) {
  const available = E.months(data);
  const history = [];
  if (available.length) {
    for (let current = available[0]; current <= data.completeThrough; current = E.shiftMonth(current, 1)) {
      history.push({ month: current, value: E.sum(data.sales.filter(row => row.date.startsWith(current)).map(row => row.amount)) });
    }
  }
  const values = history.map(row => row.value);
  const months = history.map(row => row.month);
  const effective = method === 'auto' ? E.chooseMethod(values, months) : method;
  const components = effective === 'consumption' ? E.consumptionComponents(values, months) : null;
  const baseValue = E.estimate(values, effective, months);
  const validation = E.backtest(values, effective, months);
  const base = baseValue === null ? null : baseValue * factor;
  const band = validation.residual === null ? null : validation.residual * factor;
  return {
    history,
    month: history.length ? E.shiftMonth(history.at(-1).month, 1) : null,
    method: effective,
    automatic: method === 'auto',
    components,
    base,
    projections: base === null ? [] : [base],
    low: base === null || band === null ? null : Math.max(0, base - band),
    high: base === null || band === null ? null : base + band,
    ...validation,
  };
}
function salesForecastControls(){return forecastControls()}
function forecastCalculationDetails(fc, product = null) {
  const values = fc.history.map(row => row.value);
  const months = fc.history.map(row => row.month);
  const components = fc.components || E.consumptionComponents(values, months);
  const unadjusted = fc.base;
  const formatValue = value => product ? num(value, 2) + ' ' + unit(product) : money(value);
  const rateLabel = product ? t('Weighted monthly consumption rate', 'อัตราการใช้รายเดือนแบบถ่วงน้ำหนัก') : t('Weighted monthly sales-value rate', 'อัตรามูลค่าขายรายเดือนแบบถ่วงน้ำหนัก');
  const formula = product
    ? t('Forecast consumption = weighted monthly consumption rate × seasonal index × recent-change factor', 'ปริมาณใช้ที่คาดการณ์ = อัตราการใช้รายเดือนแบบถ่วงน้ำหนัก × ดัชนีฤดูกาล × ตัวคูณการเปลี่ยนแปลงล่าสุด')
    : t('Forecast sales value = weighted monthly sales-value rate × seasonal index × recent-change factor', 'มูลค่าขายที่คาดการณ์ = อัตรามูลค่าขายรายเดือนแบบถ่วงน้ำหนัก × ดัชนีฤดูกาล × ตัวคูณการเปลี่ยนแปลงล่าสุด');
  const substitution = formatValue(components.rate) + ' × ' + num(components.seasonalIndex, 3) + ' × ' + num(components.trendFactor, 3) + ' = ' + formatValue(unadjusted);
  const inputs = fc.history.slice(-12).map(row => '<tr><td>' + month(row.month) + '</td><td>' + formatValue(row.value) + '</td></tr>');
  const seasonalityNote = components.annualSeasonality
    ? t('Calendar-month seasonality is active from ', 'ใช้ฤดูกาลตามเดือนปฏิทินจาก ') + num(components.seasonalSamples) + t(' matching historical month(s).', ' เดือนย้อนหลังที่ตรงกัน')
    : t('Annual seasonality is neutral at 1.000 until a previous matching calendar month is available. Recent monthly movement is already included through the recent-change factor.', 'ดัชนีฤดูกาลรายปีเป็นกลางที่ 1.000 จนกว่าจะมีเดือนปฏิทินเดียวกันของปีก่อน การเปลี่ยนแปลงรายเดือนล่าสุดถูกรวมผ่านตัวคูณการเปลี่ยนแปลงล่าสุดแล้ว');
  return '<details class="forecast-calculation-inline"><summary><h2>' + (product ? t('Consumption-rate calculation for ', 'การคำนวณอัตราการใช้สำหรับ ') + esc(product.sku) : t('How this forecast was calculated', 'วิธีคำนวณการคาดการณ์')) + '</h2><span class="forecast-calculation-toggle" aria-hidden="true">⌄</span></summary><div class="forecast-calculation-body"><h3>' + t('Formula', 'สูตรคำนวณ') + '</h3><p>' + esc(formula) + '</p><div class="callout"><strong>' + t('Substitution', 'แทนค่า') + '</strong><br>' + esc(substitution) + '</div><div class="metric-line"><span>' + rateLabel + '</span><strong>' + formatValue(components.rate) + '</strong></div><div class="metric-line"><span>' + t('Seasonal index', 'ดัชนีฤดูกาล') + '</span><strong>' + num(components.seasonalIndex, 3) + '</strong></div><div class="metric-line"><span>' + t('Recent-change factor', 'ตัวคูณการเปลี่ยนแปลงล่าสุด') + '</span><strong>' + num(components.trendFactor, 3) + '</strong></div><p class="note">' + esc(seasonalityNote) + '</p><div class="metric-line"><span>' + t('Automatic final forecast', 'ค่าคาดการณ์อัตโนมัติสุดท้าย') + '</span><strong>' + formatValue(unadjusted) + '</strong></div><div class="metric-line"><span>' + t('Weighted Absolute Percentage Error (WAPE)', 'ค่าความคลาดเคลื่อนสัมบูรณ์ถ่วงน้ำหนัก (WAPE)') + '</span><strong>Σ|' + t('actual − forecast', 'ยอดจริง − ค่าคาดการณ์') + '| ÷ Σ' + t('actual', 'ยอดจริง') + ' = ' + pct(fc.error) + '</strong></div><p class="note">' + num(fc.results.length) + ' ' + t('historical months were held out one at a time to validate this consumption-rate model. No forecast inputs or manual adjustments are required.', 'เดือนย้อนหลังถูกกันออกทีละเดือนเพื่อทดสอบแบบจำลองอัตราการใช้นี้ ไม่ต้องกรอกข้อมูลคาดการณ์หรือปรับค่าด้วยตนเอง') + '</p><h3>' + t('Monthly history used', 'ประวัติรายเดือนที่ใช้') + '</h3>' + table([t('Month', 'เดือน'), product ? t('Consumption quantity', 'ปริมาณใช้') : t('Total sales', 'ยอดขายรวม')], inputs) + '<p class="warning">' + t('Consumption means quantity sold from the imported Express sales lines. This does not calculate remaining stock because the source files contain no inventory balance.', 'อัตราการใช้หมายถึงจำนวนที่ขายจากรายการขาย Express ที่นำเข้า การคำนวณนี้ไม่หาสต็อกคงเหลือเพราะไฟล์ต้นทางไม่มียอดคงเหลือ') + '</p></div></details>';
}
function forecastViewBase() {
  const fc = totalSalesForecast();
  const hist = fc.history.slice(-12);
  const labels = [...hist.map(row => row.month), fc.month];
  const actual = [...hist.map(row => row.value), null];
  const prediction = [...hist.map((row, index) => index === hist.length - 1 ? row.value : null), fc.base];
  const selectedProduct = data.products.find(product => product.sku === state.sku) || data.products[0];
  const selectedForecast = E.forecast(data, selectedProduct.sku, 'auto', 1);
  const productForecasts = data.products.map(product => ({ product, forecast: E.forecast(data, product.sku, 'auto', 1) })).sort((a, b) => (b.forecast.base ?? -1) - (a.forecast.base ?? -1));
  const skuPage = pageSlice('skuForecast', productForecasts, '', productForecasts.findIndex(x => x.product.sku === state.sku));
  const productRows = skuPage.rows.map(({ product, forecast }) => {
    const components = forecast.components || {};
    return '<tr' + (product.sku === state.sku ? ' id="selected-forecast-product" class="selected-forecast-product" tabindex="-1"' : '') + '><td><strong>' + esc(product.sku) + '</strong><small>' + esc(name(product)) + '</small></td><td>' + esc(unit(product)) + '</td><td>' + num(components.rate, 2) + '</td><td>' + num(components.seasonalIndex, 3) + '</td><td>' + num(components.trendFactor, 3) + '</td><td><strong>' + num(forecast.base, 2) + '</strong></td><td>' + (forecast.error === null ? '—' : pct(forecast.error)) + '</td></tr>';
  });
  const seasonalStatus = fc.components?.annualSeasonality ? t('Calendar-month index active', 'ใช้ดัชนีเดือนปฏิทินแล้ว') : t('Building annual history', 'กำลังสะสมประวัติรายปี');
  return heading(t('Consumption forecasting', 'การคาดการณ์อัตราการใช้'), t('Forecast next month from monthly consumption', 'คาดการณ์เดือนถัดไปจากอัตราการใช้รายเดือน'), t('The model uses weighted monthly consumption, recent movement and calendar-month seasonality when enough history is available.', 'แบบจำลองใช้อัตราการใช้รายเดือนแบบถ่วงน้ำหนัก การเปลี่ยนแปลงล่าสุด และฤดูกาลตามเดือนปฏิทินเมื่อมีประวัติเพียงพอ')) +
    '<div class="forecast-kpis">' + kpis([
      [t('Next month', 'เดือนถัดไป'), month(fc.month), t('All imported sales', 'ยอดขายนำเข้าทั้งหมด')],
      [t('Predicted sales value', 'มูลค่าขายที่คาดการณ์'), money(fc.base), forecastMethodLabel(fc.method)],
      [t('Selected SKU consumption', 'ปริมาณใช้ SKU ที่เลือก'), num(selectedForecast.base, 2) + ' ' + unit(selectedProduct), selectedProduct.sku + ' · ' + name(selectedProduct)],
      [t('Seasonality status', 'สถานะฤดูกาล'), seasonalStatus, num(fc.history.length) + ' ' + t('complete months', 'เดือนที่ข้อมูลครบ')],
    ]) + '</div>' +
    panel(t('Total monthly sales value', 'มูลค่าขายรวมรายเดือน'), chart(labels, [{ name: t('Actual sales value', 'มูลค่าขายจริง'), values: actual, color: colors[1] }, { name: t('Next-month forecast', 'คาดการณ์เดือนถัดไป'), values: prediction, color: colors[2], dashed: true }], 'THB') + forecastCalculationDetails(fc)) +
    panel(t('Next-month consumption by product (reference only)', 'ปริมาณใช้เดือนถัดไปแยกตามสินค้า (ใช้อ้างอิงเท่านั้น)'), '<p class="warning">' + t('Per-SKU forecasts measured about 78% WAPE on this history and are not reliable enough for a decision. Use the group-level forecast above instead; this table is kept as a reference only.', 'การคาดการณ์รายชิ้นวัดค่าคลาดเคลื่อนได้ประมาณ 78% กับข้อมูลชุดนี้ ยังไม่น่าเชื่อถือพอสำหรับตัดสินใจ ให้ใช้ตัวเลขระดับกลุ่มด้านบนแทน ตารางนี้เก็บไว้เป็นข้อมูลอ้างอิงเท่านั้น') + '</p><p class="note">' + t('Consumption rate is quantity sold per complete month. Seasonal index is 1.000 until the same calendar month exists in the imported history.', 'อัตราการใช้คือจำนวนที่ขายต่อเดือนที่ข้อมูลครบ ดัชนีฤดูกาลเป็น 1.000 จนกว่าจะมีเดือนปฏิทินเดียวกันในประวัติที่นำเข้า') + '</p>' + table([t('Product / SKU', 'สินค้า / SKU'), t('Unit', 'หน่วย'), t('Monthly consumption rate', 'อัตราการใช้รายเดือน'), t('Seasonal index', 'ดัชนีฤดูกาล'), t('Recent change', 'การเปลี่ยนแปลงล่าสุด'), t('Forecast quantity', 'จำนวนที่คาดการณ์'), t('WAPE', 'WAPE')], productRows) + pagerHtml('skuForecast', skuPage)) +
    panel(t('Validation against known months', 'ตรวจสอบกับเดือนที่ทราบผลจริง'), table([t('Month', 'เดือน'), t('Actual sales value', 'มูลค่าขายจริง'), t('Forecast before that month', 'ค่าคาดการณ์ก่อนเดือนนั้น'), t('Absolute error', 'ส่วนต่างสัมบูรณ์')], fc.results.map(row => '<tr><td>' + month(fc.history[row.index].month) + '</td><td>' + money(row.actual) + '</td><td>' + money(row.predicted) + '</td><td>' + money(Math.abs(row.actual - row.predicted)) + '</td></tr>')));
}
/* --- group-level demand engine (js/predictions.js), added on top of the
   ported prototype's own per-SKU forecast (see forecastViewBase above,
   which is now the reference table, not the headline: per-SKU WAPE
   measured at ~78% is not usable for a decision). Every figure here states
   its method, window, cutoff, unit, error and n, per the brief. */
const demandClassLabels={regular:['Regular','สม่ำเสมอ'],irregular:['Irregular','ไม่สม่ำเสมอ'],sparse:['Sparse','ห่าง'],insufficient:['Insufficient history','ประวัติไม่พอ']};
const demandClassTone={regular:'good',irregular:'warn',sparse:'warn',insufficient:'bad'};
function forecastReasonLabel(fc,historyMonths){
 if(fc.reason==='not-enough-data')return t('Fewer than 3 months with a sale in the last '+historyMonths+' — only the sales gap is shown.','ขายน้อยกว่า 3 เดือนจาก '+historyMonths+' เดือนล่าสุด — แสดงเฉพาะช่วงห่างของการขาย');
 if(fc.reason==='too-few-months')return t('Sold in '+fc.monthsWithSales+' of the last '+historyMonths+' months — too few for a number; only the sales gap is shown.','ขาย '+fc.monthsWithSales+' จาก '+historyMonths+' เดือนล่าสุด — น้อยเกินจะให้ตัวเลข แสดงเฉพาะช่วงห่างของการขาย');
 return '—';
}
const wapeGradeMeta={good:{tone:'good',icon:'✓',label:['Good, within 10%','ดี ไม่เกิน 10%']},fair:{tone:'good',icon:'✓',label:['Fair, within 15%','พอใช้ ไม่เกิน 15%']},weak:{tone:'warn',icon:'!',label:['Weak, within 25%','อ่อน ไม่เกิน 25%']},unusable:{tone:'bad',icon:'✕',label:['Above 25%, judge with care','เกิน 25% ควรพิจารณาด้วยความระมัดระวัง']},unknown:{tone:'warn',icon:'?',label:['Not measured','ยังไม่ได้วัด']}};
function groupLevelLines(){return data.sales.map(sale=>{const p=bySku(sale.sku);return p?{date:sale.date,quantity:sale.quantity,unit:p.unit,code:sale.sku,group:p.sku.split('-')[0]}:null}).filter(Boolean)}
function groupDominantUnit(lines,group){const totals=new Map();for(const l of lines)if(l.group===group)totals.set(l.unit,(totals.get(l.unit)||0)+l.quantity);return[...totals.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]}
function groupMonthlyHistory(groupLines,unitForGroup,monthCount){
 const totals=new Map();
 for(const l of groupLines){if(l.unit!==unitForGroup)continue;const m=l.date.slice(0,7);totals.set(m,(totals.get(m)||0)+l.quantity)}
 const months=[];for(let m=E.shiftMonth(data.completeThrough,-(monthCount-1));m<=data.completeThrough;m=E.shiftMonth(m,1))months.push(m);
 return {months,values:months.map(m=>totals.get(m)||0)};
}
function datasetHistoryMonths(cutoff){
 const earliest=data.sales.map(r=>r.date.slice(0,7)).sort()[0];
 if(!earliest)return 0;
 let count=0;for(let m=earliest;m<=cutoff.slice(0,7);m=Predictions.shiftMonth(m,1))count++;
 return count;
}
/* Group-level forecasts, shared by the Forecast page and the CEO export.
   They use the whole history (no page filters), so the result is kept until
   the data or the language (group labels) changes. */
let groupForecastCache=null;
function groupForecasts(){
 if(groupForecastCache&&groupForecastCache.sales===data.sales&&groupForecastCache.length===data.sales.length&&groupForecastCache.lang===state.lang&&groupForecastCache.completeThrough===data.completeThrough)return groupForecastCache.value;
 const value=computeGroupForecasts();
 groupForecastCache={sales:data.sales,length:data.sales.length,lang:state.lang,completeThrough:data.completeThrough,value};
 return value;
}
function computeGroupForecasts(){
 const lines=groupLevelLines(),groups=[...new Set(lines.map(l=>l.group))].sort(),cutoff=E.monthEnd(data.completeThrough),nextMonth=Predictions.shiftMonth(data.completeThrough,1);
 const historyMonths=datasetHistoryMonths(cutoff);
 const rows=groups.map(group=>{
  const unitForGroup=groupDominantUnit(lines,group);
  const groupLines=lines.filter(l=>l.group===group);
  const series=Predictions.buildSeries(groupLines,{unit:unitForGroup,key:()=>group})[0];
  if(!series)return null;
  const fc=Predictions.forecastNextMonth(series,cutoff,historyMonths);
  const label=state.lang==='th'?bySku(data.products.find(p=>p.sku.split('-')[0]===group)?.sku||'').groupTh:bySku(data.products.find(p=>p.sku.split('-')[0]===group)?.sku||'').group;
  /* The forecast counts only lines in the group's main unit; unitShare says how
     many of the group's lines that is, so reports can state it. */
  const unitShare=groupLines.length?groupLines.filter(l=>l.unit===unitForGroup).length/groupLines.length:1;
  return {group,label:label||group,fc,unitForGroup,groupLines,unitShare};
 }).filter(Boolean);
 return {rows,nextMonth,historyMonths};
}
function groupForecastPanel(){
 if(data.demo)return '';
 const {rows,nextMonth,historyMonths}=groupForecasts();

 /* One card per group, grouped by unit (never compare different units),
    ranked high -> low: forecast, a likely range, 9-month history with the
    forecast month, and how accurate the method was when tested. */
 const byUnit=new Map();
 for(const r of rows){if(r.fc.value===null)continue;if(!byUnit.has(r.unitForGroup))byUnit.set(r.unitForGroup,[]);byUnit.get(r.unitForGroup).push(r)}
 const barGroups=[...byUnit.entries()].map(([unitForGroup,list])=>{
  list.sort((a,b)=>b.fc.value-a.fc.value);
  return '<div class="fc-unit-group"><h4>'+esc(t('Forecast for ','คาดการณ์เดือน ')+month(nextMonth)+t(', unit: ',', หน่วย: ')+unitForGroup)+'</h4><div class="fc-cards">'+list.map(r=>forecastCard(r,nextMonth,historyMonths)).join('')+'</div></div>';
 }).join('');

 /* Consumption-rate history as a line chart: the top groups (by forecast
    value) sharing the most common unit, so the series stay comparable. */
 const commonUnit=[...byUnit.entries()].sort((a,b)=>b[1].length-a[1].length)[0]?.[0];
 const topForLine=(byUnit.get(commonUnit)||[]).slice(0,4);
 const histSeries=topForLine.map((r,i)=>{const h=groupMonthlyHistory(r.groupLines,r.unitForGroup,historyMonths);return {name:r.label,values:h.values,color:['var(--cat-1)','var(--cat-2)','var(--cat-3)','var(--cat-4)'][i]}});
 const histMonths=topForLine.length?groupMonthlyHistory(topForLine[0].groupLines,topForLine[0].unitForGroup,historyMonths).months:[];
 const lineChart=topForLine.length?chart(histMonths,histSeries,commonUnit):'';

 const withoutNumber=rows.filter(r=>r.fc.value===null);
 const reasonList=withoutNumber.length?'<p class="note">'+t('Not enough history for a number yet: ','ยังไม่มีประวัติพอให้ตัวเลข: ')+withoutNumber.map(r=>esc(r.label)+' ('+esc(forecastReasonLabel(r.fc,historyMonths)) +')').join('; ')+'</p>':'';

 /* A6 monthly pattern: one row per group, one column per trailing calendar
    month in the dataset's own history (not a fixed 9 — see
    datasetHistoryMonths), cell = that month's quantity in the group's own
    unit (row-normalized, since groups do not share a unit). Paired with
    the demand-class label so the regular/irregular/sparse call is visible
    alongside the pattern that produced it, not just asserted. */
 const patternMonths=[];for(let m=E.shiftMonth(data.completeThrough,-(historyMonths-1));m<=data.completeThrough;m=E.shiftMonth(m,1))patternMonths.push(m);
 const patternRows=rows.map(r=>{
  const totals=new Map();for(const l of r.groupLines){if(l.unit!==r.unitForGroup)continue;const m=l.date.slice(0,7);totals.set(m,(totals.get(m)||0)+l.quantity)}
  const classInfo=demandClassLabels[r.fc.demandClass]||['',''];
  return {label:r.label+' ('+t(...classInfo)+')',cells:patternMonths.map(m=>{const v=totals.get(m)||0;return {value:v,tip:r.label+' · '+month(m)+' · '+(v>0?num(v,1)+' '+r.unitForGroup:t('No sales','ไม่มียอดขาย'))}})};
 });
 const patternHeatmap=heatmapTable(t('Group (demand class)','กลุ่ม (คลาสดีมานด์)'),patternMonths.map(m=>month(m)),patternRows,'row')+
  '<p class="note">'+t('One row per group, shaded by that group\'s own busiest month (darker = more sold, blank = no sale). Compare the shape of the row, not the colour across rows — units differ by group.','หนึ่งแถวต่อหนึ่งกลุ่ม ไล่สีตามเดือนที่ขายดีที่สุดของกลุ่มนั้นเอง (เข้ม = ขายเยอะ, ว่าง = ไม่มีขาย) เปรียบเทียบรูปแบบในแต่ละแถว ไม่ใช่เทียบสีข้ามแถว เพราะหน่วยต่างกันตามกลุ่ม')+'</p>';

 const detailTable=table([t('Group','กลุ่ม'),t('Demand class ('+historyMonths+'-month window)','คลาสดีมานด์ ('+historyMonths+' เดือน)'),t('Months with sales','เดือนที่มีขาย'),t('Window','ช่วง'),t('WAPE','WAPE'),t('Forecast for '+month(nextMonth),'คาดการณ์เดือน '+month(nextMonth))],
  rows.map(r=>{const classInfo=demandClassLabels[r.fc.demandClass]||['',''];const valueCell=r.fc.value===null?'<span class="pill '+(demandClassTone[r.fc.demandClass]||'warn')+'">'+esc(forecastReasonLabel(r.fc,historyMonths))+'</span>':num(r.fc.value,1)+' '+esc(r.unitForGroup);return '<tr><td><strong>'+esc(r.label)+'</strong></td><td><span class="pill '+demandClassTone[r.fc.demandClass]+'">'+esc(t(...classInfo))+'</span></td><td>'+r.fc.monthsWithSales+' / '+historyMonths+'</td><td>'+(r.fc.window||'—')+'</td><td>'+(r.fc.wape===null?'—':pct(r.fc.wape))+'</td><td>'+valueCell+'</td></tr>'}));

 return panel(t('Group-level demand forecast (headline method)','คาดการณ์ความต้องการระดับกลุ่มสินค้า (วิธีหลัก)'),
  '<p class="note">'+t('Method: weighted monthly consumption rate x damped trend, window of 3 or 6 months chosen per group by backtest. Demand class compares months-with-a-sale against the full '+historyMonths+' months of imported history, not a fixed 9. WAPE is always shown alongside the number — good/fair/weak/unusable describes it, it never hides it. Only a group selling in fewer than about a third of those '+historyMonths+' months has no number to show.','วิธี: อัตราการใช้รายเดือนแบบถ่วงน้ำหนัก คูณแนวโน้มแบบหน่วง เลือกช่วง 3 หรือ 6 เดือนต่อกลุ่มด้วยการทดสอบย้อนหลัง คลาสดีมานด์เทียบเดือนที่มีขายกับประวัติทั้งหมด '+historyMonths+' เดือนที่นำเข้า ไม่ตายตัวที่ 9 เดือน แสดง WAPE คู่กับตัวเลขเสมอ ระดับดี/พอใช้/อ่อน/ใช้ไม่ได้ใช้อธิบายเท่านั้น ไม่ซ่อนตัวเลข มีแค่กลุ่มที่ขายน้อยกว่าประมาณหนึ่งในสามของ '+historyMonths+' เดือนเท่านั้นที่ไม่มีตัวเลขให้')+'</p>'+
  '<div class="fc-legend"><p>'+t('How to read a card: the big number is next month\'s forecast, the arrow compares it with the last full month, and the range is where it lands if the error is as large as it was in testing.','วิธีอ่านการ์ด: ตัวเลขใหญ่คือคาดการณ์เดือนหน้า ลูกศรเทียบกับเดือนล่าสุดที่ครบเดือน ช่วงด้านล่างคือค่าที่น่าจะเป็นถ้าคลาดเคลื่อนเท่าที่ทดสอบย้อนหลัง')+'</p><p class="fc-legend-key"><span class="fc-key fc-key-actual"></span>'+t('Actual','ยอดจริง')+'<span class="fc-key fc-key-forecast"></span>'+t('Forecast','คาดการณ์')+' · '+t('Each card has its own scale: compare the numbers across cards, not the bar heights.','แต่ละการ์ดใช้สเกลของตัวเอง เทียบข้ามการ์ดให้ดูตัวเลข ไม่ใช่ความสูงของแท่ง')+'</p></div>'+barGroups+reasonList+accuracyTable(rows)+
  (lineChart?'<h4 style="margin:18px 0 4px;font-size:13px;color:var(--muted)">'+esc(t('Monthly consumption, top groups (','ปริมาณใช้รายเดือน กลุ่มขายดีสุด (')+commonUnit+')')+'</h4>'+lineChart:'')+
  '<h4 style="margin:18px 0 4px;font-size:13px;color:var(--muted)">'+t('Demand pattern by month (A6)','รูปแบบการขายรายเดือน (A6)')+'</h4>'+patternHeatmap+
  '<details class="chart-summary-toggle"><summary>'+t('View detailed table','ดูตารางแบบละเอียด')+'</summary>'+detailTable+'</details>');
}
/* One verdict per group for readers who do not read error measures:
   WAPE grade first; a method that does not beat "same as last month" (MASE >= 1),
   or was tested on fewer than 3 months, is at most a guide. */
function accuracyVerdict(fc){const a=fc.accuracy||{},g=fc.grade||'unknown';let v;
 if(g==='unusable')v=['bad','✕',t('Do not rely on it yet','อย่าเพิ่งใช้ตัดสินใจ')];
 else if(g==='weak'||(a.mase!==null&&a.mase!==undefined&&a.mase>=1)||(a.n||0)<3)v=['warn','!',t('Use as a guide only','ใช้ประกอบเท่านั้น')];
 else if(g==='good'||g==='fair')v=['good','✓',t('Reliable','เชื่อได้')];
 else v=['warn','?',t('Not measured','ยังไม่ได้วัด')];
 return {tone:v[0],icon:v[1],label:v[2],fewMonths:(a.n||0)<3}}
const gradeWords={good:['Good','ดี'],fair:['Fair','พอใช้'],weak:['Weak','อ่อน'],unusable:['Use with care','ใช้อย่างระวัง'],unknown:['Not measured','ยังไม่ได้วัด']};
/* Forecast card for one group. The range is forecast x (1 +/- WAPE), i.e. k = 1
   (CLAUDE.md section 8): where the number lands if this month's error is as
   large as the average error in the backtest. */
function forecastCard(r,nextMonth,historyMonths){
 const fc=r.fc,unitLabel=r.unitForGroup,h=groupMonthlyHistory(r.groupLines,r.unitForGroup,historyMonths),verdict=accuracyVerdict(fc);
 const low=fc.wape===null?null:Math.max(0,fc.value*(1-fc.wape)),high=fc.wape===null?null:fc.value*(1+fc.wape);
 /* A % change on a month that sold far less than usual is misleading (97 m ->
    819 m reads as +742%), so below a quarter of the usual month it is said in words. */
 const lastMonth=h.months[h.months.length-1],lastValue=h.values[h.values.length-1],usual=E.avg(h.values),lowBase=lastValue>0&&usual>0&&lastValue<usual*0.25,change=lastValue>0&&!lowBase?(fc.value-lastValue)/lastValue:null;
 const values=[...h.values,fc.value],max=Math.max(1,...values),W=240,H=64,gap=4,barW=(W-gap*(values.length-1))/values.length;
 const bars=values.map((v,i)=>{const bh=Math.max(v>0?2:0,v/max*(H-4)),x=i*(barW+gap),y=H-bh,isFc=i===values.length-1,label=(isFc?t('Forecast ','คาดการณ์ ')+month(nextMonth):month(h.months[i]))+': '+num(v,1)+' '+unitLabel;return '<rect class="'+(isFc?'fc-spark-forecast':'fc-spark-bar')+'" x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+barW.toFixed(1)+'" height="'+bh.toFixed(1)+'" rx="2" data-tip="'+esc(label)+'"><title>'+esc(label)+'</title></rect>'}).join('');
 const arrow=change===null?'':change>0.005?'▲':change<-0.005?'▼':'■',tone=change===null?'':change>0.005?'fc-up':change<-0.005?'fc-down':'fc-flat';
 return '<article class="fc-card"><div class="fc-card-head"><h3>'+esc(r.label)+'</h3><span class="fc-verdict fc-verdict-'+verdict.tone+'"><span aria-hidden="true">'+verdict.icon+'</span> '+esc(verdict.label)+'</span></div>'+
  '<p class="fc-caption">'+t('Forecast for ','คาดการณ์ ')+esc(month(nextMonth))+'</p><p class="fc-value"><strong>'+num(fc.value,1)+'</strong> '+esc(unitLabel)+'</p>'+
  (lowBase?'<p class="fc-change fc-flat">'+t('Last month (','เดือนล่าสุด (')+esc(month(lastMonth))+t(') sold unusually little: ',') ขายน้อยผิดปกติ: ')+num(lastValue,0)+' '+esc(unitLabel)+t(', so no % is shown',' จึงไม่แสดงเป็น %')+'</p>':'')+
  (change===null?'':'<p class="fc-change '+tone+'"><span aria-hidden="true">'+arrow+'</span> '+(change>0?'+':'')+pct(change)+' '+t('vs ','เทียบ ')+esc(month(lastMonth))+' <span class="fc-change-base">('+num(lastValue,0)+' '+esc(unitLabel)+')</span></p>')+
  (low===null?'':'<p class="fc-range">'+t('Likely range ','ช่วงที่น่าจะเป็น ')+num(low,0)+' – '+num(high,0)+' '+esc(unitLabel)+'</p>')+
  '<svg class="fc-spark" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(r.label+' · '+t('monthly history and forecast','ประวัติรายเดือนและคาดการณ์'))+'" preserveAspectRatio="none">'+bars+'</svg>'+
  '<div class="fc-spark-axis"><span>'+esc(month(h.months[0]))+'</span><span>'+esc(month(nextMonth))+'</span></div>'+
  (r.unitShare<0.995?'<p class="fc-unit-note">'+t('Counts ','นับเฉพาะหน่วย ')+esc(unitLabel)+t(' lines only: ',' : ')+pct(r.unitShare)+t(' of this group\'s sale lines',' ของรายการขายในกลุ่มนี้')+'</p>':'')+
  '<p class="fc-foot">WAPE <strong>'+(fc.wape===null?'—':pct(fc.wape))+'</strong> ('+esc(t(...gradeWords[fc.grade||'unknown']))+') · '+num(fc.accuracy?.n||0)+' '+t('months tested','เดือนที่ทดสอบ')+(verdict.fewMonths?' · '+t('few months tested','ทดสอบน้อยเดือน'):'')+'</p></article>';
}
/* Accuracy of the headline method per group, several measures side by side.
   None of them changes the forecast; WAPE stays the one used for grading. */
function accuracyTable(rows){
 const measured=rows.filter(r=>r.fc.accuracy);
 if(!measured.length)return '';
 const f=(v,kind,unit)=>v===null||v===undefined||!Number.isFinite(v)?'—':kind==='pct'?pct(v):kind==='signed'?(v>0?'+':'')+pct(v):kind==='ratio'?num(v,2):num(v,1)+' '+esc(unit);
 const beats=a=>a.mase===null||a.mase===undefined?'—':a.mase<1?'<span class="fc-better"><span aria-hidden="true">✓</span> '+t('Yes','ดีกว่า')+'</span>':'<span class="fc-worse"><span aria-hidden="true">!</span> '+t('No','ไม่ดีกว่า')+'</span>';
 /* Mini bars so the measures can be read at a glance:
    WAPE / MAPE: 0-50% scale, colour by the same 10/15/25% bands as the grade.
    Bias: centre line, bar to the right = forecasts too much, left = too little (±50%).
    MASE: 0-2 scale with a mark at 1 (= as good as repeating last month). */
 const band=v=>v===null||v===undefined?'':v<=0.15?'ok':v<=0.25?'mid':'high';
 const errBar=(v,skipped)=>v===null||v===undefined?'—':'<span class="acc-cell"><span class="acc-num">'+pct(v)+(skipped?'<small> ('+t('skips ','ข้าม ')+skipped+')</small>':'')+'</span><span class="acc-bar" aria-hidden="true"><i class="acc-'+band(v)+'" style="width:'+Math.min(100,v/0.5*100).toFixed(1)+'%"></i></span></span>';
 const biasBar=v=>v===null||v===undefined?'—':'<span class="acc-cell"><span class="acc-num">'+(v>0?'+':'')+pct(v)+' <small>'+(Math.abs(v)<0.02?t('balanced','สมดุล'):v>0?t('too high','คาดสูงไป'):t('too low','คาดต่ำไป'))+'</small></span><span class="acc-bar acc-diverge" aria-hidden="true"><i class="'+(Math.abs(v)<=0.1?'acc-ok':Math.abs(v)<=0.25?'acc-mid':'acc-high')+'" style="'+(v>=0?'left:50%':'right:50%')+';width:'+Math.min(50,Math.abs(v)/0.5*50).toFixed(1)+'%"></i></span></span>';
 const maseBar=v=>v===null||v===undefined?'—':'<span class="acc-cell"><span class="acc-num">'+num(v,2)+' <small>'+(v<1?'<span aria-hidden="true">✓</span> '+t('better','ดีกว่า'):'<span aria-hidden="true">!</span> '+t('not better','ไม่ดีกว่า'))+'</small></span><span class="acc-bar acc-mase" aria-hidden="true"><i class="'+(v<1?'acc-ok':'acc-high')+'" style="width:'+Math.min(100,v/2*100).toFixed(1)+'%"></i></span></span>';
 const simple=measured.map(r=>{const a=r.fc.accuracy,v=accuracyVerdict(r.fc);return '<tr><td><strong>'+esc(r.label)+'</strong></td><td><span class="fc-verdict fc-verdict-'+v.tone+'"><span aria-hidden="true">'+v.icon+'</span> '+esc(v.label)+'</span></td><td>'+errBar(a.wape)+'</td><td>'+errBar(a.mape,a.mapeSkipped)+'</td><td>'+biasBar(a.bias)+'</td><td>'+maseBar(a.mase)+'</td><td>'+num(a.n)+(v.fewMonths?' <small>'+t('(few)','(น้อย)')+'</small>':'')+'</td></tr>'});
 const detail=measured.map(r=>{const a=r.fc.accuracy,masTone=a.mase===null?'':a.mase<1?' fc-better':' fc-worse';return '<tr><td><strong>'+esc(r.label)+'</strong></td><td>'+f(a.wape,'pct')+'</td><td>'+f(a.mape,'pct')+(a.mapeSkipped?'<small> ('+t('skips ','ข้าม ')+a.mapeSkipped+')</small>':'')+'</td><td>'+f(a.mae,'unit',r.unitForGroup)+'</td><td>'+f(a.rmse,'unit',r.unitForGroup)+'</td><td>'+f(a.bias,'signed')+'</td><td class="'+masTone.trim()+'">'+(a.mase===null?'':'<span aria-hidden="true">'+(a.mase<1?'✓ ':'! ')+'</span>')+f(a.mase,'ratio')+'</td><td>'+num(a.n)+'</td></tr>'});
 const explain=[['WAPE',t('Total miss as a share of total sales. The headline measure; grades use it.','ผลรวมที่คลาดเคลื่อน เทียบกับยอดขายรวม เป็นตัวหลักที่ใช้ให้ระดับ')],['MAPE',t('Average miss per month in %. Skips months with no sales; jumps when a month sold very little.','ค่าเฉลี่ยความคลาดเคลื่อนรายเดือนเป็น % ข้ามเดือนที่ไม่มีขาย และพุ่งสูงในเดือนที่ขายได้น้อยมาก')],['MAE',t('Average miss per month, in the group\'s own unit.','คลาดเคลื่อนเฉลี่ยต่อเดือน ในหน่วยของกลุ่ม')],['RMSE',t('Like MAE, but large misses count more. Much bigger than MAE = a few bad months.','เหมือน MAE แต่ให้น้ำหนักเดือนที่พลาดมาก ถ้าสูงกว่า MAE มาก แปลว่ามีบางเดือนพลาดหนัก')],['Bias',t('+ means the method tends to forecast too much, − too little.','+ แปลว่ามักคาดสูงเกินจริง − แปลว่ามักคาดต่ำกว่าจริง')],['MASE',t('Compared with simply repeating last month. Below 1 = the method beats that guess.','เทียบกับการเดาว่าเดือนหน้าเท่ากับเดือนนี้ ต่ำกว่า 1 แปลว่าวิธีนี้ดีกว่าการเดาแบบนั้น')]];
 return '<section class="fc-accuracy"><h4>'+t('Can we trust each forecast?','เชื่อการคาดการณ์แต่ละกลุ่มได้แค่ไหน?')+'</h4>'+
  '<p class="note">'+t('Reliable = tested on at least 3 months, error within 15%, and better than repeating last month. Guide only = error up to 25%, not better than repeating last month, or fewer than 3 months tested. Do not rely = error above 25%.','เชื่อได้ = ทดสอบอย่างน้อย 3 เดือน คลาดเคลื่อนไม่เกิน 15% และดีกว่าการเดาว่าเท่าเดือนก่อน · ใช้ประกอบ = คลาดเคลื่อนไม่เกิน 25% หรือไม่ดีกว่าการเดาเท่าเดือนก่อน หรือทดสอบได้ไม่ถึง 3 เดือน · อย่าเพิ่งใช้ = คลาดเคลื่อนเกิน 25%')+'</p>'+
  '<dl class="acc-key"><div><dt>WAPE</dt><dd>'+t('total miss vs total sales (main measure)','คลาดเคลื่อนรวม เทียบยอดรวม (ตัวหลัก)')+'</dd></div><div><dt>MAPE</dt><dd>'+t('average miss per month','คลาดเคลื่อนเฉลี่ยรายเดือน')+'</dd></div><div><dt>Bias</dt><dd>'+t('tends to forecast too high (+) or too low (−)','มักคาดสูงไป (+) หรือต่ำไป (−)')+'</dd></div><div><dt>MASE</dt><dd>'+t('below 1 = better than repeating last month','ต่ำกว่า 1 = ดีกว่าเดาว่าเท่าเดือนก่อน')+'</dd></div></dl>'+
  '<div class="acc-table">'+table([t('Group','กลุ่ม'),t('Verdict','สรุป'),'WAPE','MAPE','Bias','MASE',t('Months tested','เดือนที่ทดสอบ')],simple)+'</div>'+
  '<details class="chart-summary-toggle fc-technical"><summary>'+t('Technical detail: all six measures, incl. MAE and RMSE in units','รายละเอียดทางเทคนิค: ครบ 6 ตัวชี้วัด รวม MAE และ RMSE ในหน่วยสินค้า')+'</summary>'+
  table([t('Group','กลุ่ม'),'WAPE','MAPE','MAE','RMSE','Bias','MASE',t('Months tested','เดือนที่ทดสอบ')],detail)+
  '<dl class="fc-metric-help">'+explain.map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl></details></section>';
}
function bestSellersPanel(){
 if(data.demo)return '';
 const lines=groupLevelLines(),days=Math.max(1,(Date.parse(state.to)-Date.parse(state.from))/86400000+1);
 const groups=[...new Set(lines.map(l=>l.group))];
 const bySalesRows=groups.map(group=>{
  const inRange=lines.filter(l=>l.group===group&&l.date>=state.from&&l.date<=state.to);
  const quantity=E.sum(inRange.map(l=>l.quantity));
  const unitForGroup=groupDominantUnit(lines,group);
  const label=state.lang==='th'?bySku(data.products.find(p=>p.sku.split('-')[0]===group)?.sku||'').groupTh:bySku(data.products.find(p=>p.sku.split('-')[0]===group)?.sku||'').group;
  return {key:group,name:label||group,quantity,unit:unitForGroup,groupLines:lines.filter(l=>l.group===group)};
 }).filter(r=>r.quantity>0);
 const stockMap=new Map(Object.entries(state.stockByGroup||{}).map(([k,v])=>[k,v===''?null:Number(v)]));
 const allRanked=Predictions.bestSellers(bySalesRows,days,stockMap,'quantity'),ranked=applyTop(allRanked,'best',10);
 const tiles=ranked.map(r=>{
  const hist=groupMonthlyHistory(r.groupLines,r.unit,6);
  const coverHtml=coverMeterCell(r.cover.days,r.cover.urgent,r.cover.reason);
  const stockInput='<input type="number" min="0" step="any" data-stock-group="'+esc(r.key)+'" value="'+esc(state.stockByGroup?.[r.key]??'')+'" placeholder="'+t('Type stock','กรอกสต็อก')+'" style="width:6em;margin-top:4px;display:block">';
  return statTile(r.name,num(r.quantity,0)+' '+esc(r.unit),esc(num(r.ratePerDay,2)+' '+r.unit+'/'+t('day','วัน')),hist.values,coverHtml+stockInput);
 });
 const rows=ranked.map(r=>{
  const coverCell=r.cover.days===null?t('—','—'):num(r.cover.days,1)+' '+t('days','วัน');
  return '<tr><td><strong>'+esc(r.name)+'</strong></td><td>'+num(r.quantity,1)+' '+esc(r.unit)+'</td><td>'+esc(state.stockByGroup?.[r.key]??'—')+'</td><td>'+coverCell+'</td></tr>';
 });
 return panel(t('Observed best sellers with days of cover (C1)','สินค้าขายดีที่สุด พร้อมวันสต็อกพอใช้ (C1)'),
  '<p class="note">'+t('Observed history for the selected dates, not a forecast. Rate = quantity / days in the selected range. Sparkline shows the last 6 months. Type a stock figure to see days of cover; nothing is assumed.','ประวัติที่สังเกตได้ในช่วงวันที่เลือก ไม่ใช่การคาดการณ์ อัตรา = จำนวน / วันในช่วงที่เลือก เส้นเล็กแสดง 6 เดือนล่าสุด กรอกยอดสต็อกเพื่อดูวันพอใช้ ระบบไม่สมมติค่าใด ๆ')+'</p>'+
  topNControl('best',10,allRanked.length)+topScroll('<div class="stat-tile-grid">'+tiles.join('')+'</div>','best',10,ranked.length)+
  '<details class="chart-summary-toggle"><summary>'+t('View detailed table','ดูตารางแบบละเอียด')+'</summary>'+table([t('Group','กลุ่ม'),t('Quantity sold, selected dates','จำนวนที่ขาย ช่วงวันที่เลือก'),t('Stock on hand','สต็อกคงเหลือ'),t('Days of cover','วันที่สต็อกพอใช้')],rows)+'</details>');
}
const statusLabels={healthy:['Stock available','มีสต็อกพร้อมใช้'],low:['Low stock','สต็อกต่ำ'],out:['No available stock','ไม่มีสต็อกพร้อมใช้'],excess:['Over 90 days of stock','สต็อกเกิน 90 วัน'],stale:['Refresh stock count','อัปเดตยอดนับสต็อก']};
function statusBadge(s){return `<span class="pill ${s==='healthy'?'good':s==='out'?'bad':'warn'}">${esc(t(...statusLabels[s]))}</span>`}
function numberField(label,key,value,opts=''){return `<label>${esc(label)}<input name="${key}" type="number" min="0" step="any" value="${value}" required ${opts}></label>`}
function inventory(){const p=bySku(state.sku),fc=E.forecast(data,p.sku,state.method,state.factor),pl=E.plan(p,fc,state.review,state.buffer);const rows=data.products.map(p=>{const f=E.forecast(data,p.sku,state.method,state.factor),s=E.plan(p,f,state.review,state.buffer);return `<tr><td><button class="row-action" data-sku="${esc(p.sku)}">${esc(p.sku)}</button><small>${esc(name(p))}</small></td><td>${esc(unit(p))}</td><td>${num(p.onHand,2)}</td><td>${num(s?.available??null,2)}</td><td>${num(p.leadDays)}</td><td>${num(s?.cover??null,1)}</td><td>${s?statusBadge(s.status):'—'}</td><td><strong>${s&&!s.stale?num(s.quantity,2):'—'}</strong></td></tr>`});
 return heading(t('Stock planning','วางแผนสต็อก'),t('Turn demand into a reviewable plan','เปลี่ยนความต้องการเป็นแผนที่ตรวจสอบได้'),t('Recommendations only. No supplier orders are sent. Verify the physical stock count before acting.','เป็นคำแนะนำเท่านั้น ไม่มีการส่งคำสั่งซื้อให้ผู้ขาย ตรวจสอบยอดนับสต็อกจริงก่อนดำเนินการ'))+panel(t('Planning assumptions','สมมติฐานการวางแผน'),forecastControls()+`<div class="form-grid"><label>${t('Review interval (days)','รอบทบทวนแผน (วัน)')}<input id="review" type="number" min="1" max="90" step="1" value="${state.review}"></label><label>${t('Safety buffer (days)','สต็อกสำรอง (วัน)')}<input id="buffer" type="number" min="0" max="90" step="1" value="${state.buffer}"></label><button class="button secondary" data-action="export-plan">${t('Export plan CSV','ส่งออกแผน CSV')}</button></div>`)+panel(t('Products to review','สินค้าที่ต้องทบทวน'),table([t('Product','สินค้า'),t('Unit','หน่วย'),t('On hand','คงเหลือ'),t('Available','พร้อมใช้'),t('Lead days','วันรอสินค้า'),t('Stock cover (days)','สต็อกพอใช้ (วัน)'),t('Stock status','สถานะสต็อก'),t('Suggested order','แนะนำสั่งเพิ่ม')],rows))+`<div class="grid">${panel(t('Edit stock snapshot','แก้ไขยอดสต็อก')+' · '+p.sku,`<form id="stock-form"><div class="form-grid">${numberField(t('On hand','คงเหลือ'),'onHand',p.onHand)}${numberField(t('Committed in the planning horizon','จองภายในช่วงวางแผน'),'committed',p.committed)}${numberField(t('Incoming quantity','จำนวนกำลังเข้า'),'inbound',p.inbound)}<label>${t('Incoming due date','วันที่คาดว่าจะเข้า')}<input type="date" name="inboundDue" value="${p.inboundDue||''}"></label><label>${t('Stock count date','วันที่นับสต็อก')}<input type="date" name="stockDate" value="${p.stockDate}" required></label>${numberField(t('Lead time (days)','ระยะเวลารอสินค้า (วัน)'),'leadDays',p.leadDays,'max="365"')}${numberField(t('Order pack size','จำนวนต่อชุดสั่งซื้อ'),'pack',p.pack)}</div><button class="button" type="submit">${t('Apply stock changes','ใช้ยอดสต็อกใหม่')}</button><p class="note">${t('Changes remain in this session unless you save on this device or download a backup.','การเปลี่ยนแปลงอยู่ในหน้านี้ จนกว่าจะบันทึกในเครื่องหรือดาวน์โหลดสำรอง')}</p></form>`)}${panel(t('Why this order quantity?','ทำไมจึงแนะนำจำนวนนี้?'),pl?`${pl.stale?`<p class="warning">${t('Stock must be counted at the end of the latest complete sales month. Recommendation withheld until refreshed.','ต้องใช้ยอดสต็อก ณ สิ้นเดือนขายล่าสุด ยังไม่แสดงคำแนะนำจนกว่าจะอัปเดตยอด')}</p>`:''}<div class="scenario"><small>${t('Suggested order','จำนวนที่แนะนำสั่ง')}</small><div class="big">${pl.stale?'—':num(pl.quantity,2)} ${esc(unit(p))}</div><small>${t('Rounded up to order pack','ปัดขึ้นตามชุดสั่งซื้อ')} ${num(p.pack)}</small></div><div class="metric-line"><span>${t('Daily demand estimate','คาดการณ์ความต้องการต่อวัน')}</span><strong>${num(pl.daily,2)}</strong></div><div class="metric-line"><span>${t('Demand over lead + review period','ความต้องการช่วงรอสินค้า + รอบทบทวน')}</span><strong>${num(pl.demand,2)}</strong></div><div class="metric-line"><span>${t('Safety stock','สต็อกสำรอง')}</span><strong>${num(pl.safety,2)}</strong></div><div class="metric-line"><span>${t('Incoming counted in horizon','ของเข้าที่นับในช่วงวางแผน')}</span><strong>${num(pl.incoming,2)}</strong></div><p class="note">${t('Order = max(0, demand + safety − on hand − incoming), rounded to pack. Demand is the larger of forecast demand and committed orders, to avoid counting commitments twice.','สั่งเพิ่ม = ค่าสูงสุดระหว่าง 0 กับ (ความต้องการ + สำรอง − คงเหลือ − ของเข้า) แล้วปัดตามชุด ใช้ค่ามากกว่าระหว่างคาดการณ์กับยอดจอง เพื่อไม่ให้นับยอดจองซ้ำ')}</p>${p.leadDays>=30?`<p class="warning">${t('Special specification: long lead time. This estimate extends next-month daily demand beyond one month; confirm the supplier schedule.','สินค้าสั่งพิเศษรอนาน คำนวณโดยขยายอัตรารายวันของเดือนถัดไปเกินหนึ่งเดือน ต้องยืนยันกำหนดการกับผู้ขาย')}</p>`:''}${pl.cover!==null&&pl.cover<p.leadDays?`<p class="warning">${t('Stock may run out before a new order arrives. Review incoming delivery dates and expedite where necessary.','สต็อกอาจหมดก่อนคำสั่งซื้อใหม่มาถึง ตรวจสอบวันส่งของเข้าและเร่งส่งหากจำเป็น')}</p>`:''}<p class="note">${t('Uniform daily demand assumed. This prototype does not schedule individual receipts or production capacity. A single incoming batch is supported per SKU.','สมมติว่าความต้องการเท่ากันทุกวัน ยังไม่จัดตารางรับสินค้าแต่ละครั้งหรือกำลังการผลิต รองรับของเข้าหนึ่งชุดต่อ SKU')}</p>`:`<p class="empty">${t('At least three complete months are required.','ต้องมีข้อมูลอย่างน้อย 3 เดือนเต็ม')}</p>`)}</div>`;
}
function productManagementView(){
 const groupOptions=[...new Map(data.products.map(p=>[p.group,state.lang==='th'?p.groupTh:p.group]))];
 const rows=activeProducts().slice().sort((a,b)=>a.sku.localeCompare(b.sku)).map(p=>'<tr><td><strong>'+esc(p.sku)+'</strong></td><td>'+esc(name(p))+'</td><td>'+esc(state.lang==='th'?p.groupTh:p.group)+'</td><td>'+esc(unit(p))+'</td><td>'+num(p.onHand,2)+'</td><td><button class="button danger" data-remove-product="'+esc(p.sku)+'">'+t('Remove','นำออก')+'</button></td></tr>');
 const form='<form id="product-form"><div class="form-grid"><label>'+t('SKU · required specification','SKU · ข้อมูลจำเพาะที่ต้องระบุ')+'<input name="sku" maxlength="30" placeholder="RF-401" required></label><label>'+t('Product name','ชื่อสินค้า')+'<input name="name" maxlength="120" required></label><label>'+t('Thai product name (optional)','ชื่อสินค้าไทย (ไม่บังคับ)')+'<input name="th" maxlength="120"></label>'+select(t('Product group','กลุ่มสินค้า'),'new-product-group',groupOptions,'')+'<label>'+t('Unit (English)','หน่วย (อังกฤษ)')+'<input name="unit" maxlength="40" placeholder="metre" required></label><label>'+t('Unit (Thai)','หน่วย (ไทย)')+'<input name="unitTh" maxlength="40" placeholder="เมตร" required></label><label>'+t('Starting stock','สต็อกเริ่มต้น')+'<input name="onHand" type="number" min="0" step="0.001" value="0" required></label><label>'+t('Stock count date','วันที่นับสต็อก')+'<input name="stockDate" type="date" value="'+esc(E.monthEnd(data.completeThrough))+'" required></label><label>'+t('Lead time (days)','ระยะเวลารอสินค้า (วัน)')+'<input name="leadDays" type="number" min="0" max="365" step="1" value="2" required></label><label>'+t('Order pack size','จำนวนต่อชุดสั่งซื้อ')+'<input name="pack" type="number" min="0.001" step="0.001" value="1" required></label></div><button class="button" type="submit">'+t('Add product / SKU','เพิ่มสินค้า / SKU')+'</button><p id="product-status" role="status"></p></form>';
 return heading(t('Product setup','ตั้งค่าสินค้า'),t('Add a new product and SKU','เพิ่มสินค้าและ SKU ใหม่'),t('Management and salespeople can add products needed for daily sales entry. Every SKU must be unique.','ผู้บริหารและพนักงานขายเพิ่มสินค้าที่ต้องใช้บันทึกยอดขายได้ SKU ทุกตัวต้องไม่ซ้ำกัน'))+panel(t('New product','สินค้าใหม่'),form)+panel(t('Available products','สินค้าที่มี'),'<p class="note">'+t('Remove unused SKUs permanently. SKUs with sales history are hidden from future entries while historical reports stay intact.','ลบ SKU ที่ยังไม่เคยใช้ได้ถาวร ส่วน SKU ที่มีประวัติการขายจะถูกซ่อนจากการบันทึกใหม่ โดยรายงานย้อนหลังยังคงเดิม')+'</p>'+table([t('SKU','SKU'),t('Product','สินค้า'),t('Group','กลุ่ม'),t('Unit','หน่วย'),t('Starting stock','สต็อกเริ่มต้น'),t('Action','ดำเนินการ')],rows)+'<p id="product-remove-status" role="status"></p>');
}
function customerManagementView(){
 const segments=[...new Map(data.customers.map(c=>[c.segment,state.lang==='th'?c.segmentTh:c.segment]))];
 const rows=activeCustomers().slice().sort((a,b)=>a.id.localeCompare(b.id)).map(c=>'<tr><td><strong>'+esc(c.id)+'</strong></td><td>'+esc(c.name)+'</td><td>'+esc(state.lang==='th'?c.segmentTh:c.segment)+'</td><td><button class="button danger" data-remove-customer="'+esc(c.id)+'">'+t('Remove','นำออก')+'</button></td></tr>');
 const form='<form id="customer-form"><div class="form-grid"><label>'+t('Customer ID','รหัสลูกค้า')+'<input name="id" maxlength="30" placeholder="C013" required></label><label>'+t('Customer name','ชื่อลูกค้า')+'<input name="name" maxlength="120" required></label>'+select(t('Customer group','กลุ่มลูกค้า'),'new-customer-segment',segments,'')+'</div><button class="button" type="submit">'+t('Add customer','เพิ่มลูกค้า')+'</button><p id="customer-status" role="status"></p></form>';
 return heading(t('Customer setup','ตั้งค่าลูกค้า'),t('Add a new customer','เพิ่มลูกค้าใหม่'),t('Management and salespeople can add customers before recording a sale. Every customer ID must be unique.','ผู้บริหารและพนักงานขายเพิ่มลูกค้าก่อนบันทึกยอดขายได้ รหัสลูกค้าทุกตัวต้องไม่ซ้ำกัน'))+panel(t('New customer','ลูกค้าใหม่'),form)+panel(t('Available customers','ลูกค้าที่มี'),'<p class="note">'+t('Remove unused customers permanently. Customers with sales history are hidden from future entries while historical reports stay intact.','ลบลูกค้าที่ยังไม่เคยใช้ได้ถาวร ส่วนลูกค้าที่มีประวัติการขายจะถูกซ่อนจากการบันทึกใหม่ โดยรายงานย้อนหลังยังคงเดิม')+'</p>'+table([t('Customer ID','รหัสลูกค้า'),t('Customer name','ชื่อลูกค้า'),t('Group','กลุ่ม'),t('Action','ดำเนินการ')],rows)+'<p id="customer-remove-status" role="status"></p>');
}
function productCategoryPie(groups,total){
 if(!groups.length||!total)return '<p class="empty">'+t('No category sales to chart.','ไม่มียอดขายตามกลุ่มสำหรับแสดงกราฟ')+'</p>';
 const palette=['#687fb7','#c87973','#8ca94f','#d29a54','#7e8992','#8b6fb1','#55a3a3','#b66d8a','#6d9b70','#d07b54','#5e88a8','#9a8759'],cx=150,cy=150,r=112;
 let angle=-Math.PI/2;
 const point=value=>[cx+r*Math.cos(value),cy+r*Math.sin(value)];
 const slices=groups.map((group,index)=>{
  const share=group.sales/total,start=angle,end=angle+share*Math.PI*2,color=palette[index%palette.length],label=state.lang==='th'?bySku(group.rows[0].sku).groupTh:group.key;
  angle=end;
  if(share>=.999999)return '<circle class="pie-slice'+(state.group===group.key?' selected':'')+'" cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+color+'" data-category="'+esc(group.key)+'" tabindex="0" role="button" aria-pressed="'+(state.group===group.key)+'" data-tip="'+esc(label+' · '+pct(share)+' · '+money(group.sales))+'"><title>'+esc(label+' · '+pct(share)+' · '+money(group.sales))+'</title></circle>';
  const a=point(start),b=point(end),large=share>.5?1:0,path='M '+cx+' '+cy+' L '+a[0]+' '+a[1]+' A '+r+' '+r+' 0 '+large+' 1 '+b[0]+' '+b[1]+' Z';
  return '<path class="pie-slice'+(state.group===group.key?' selected':'')+'" d="'+path+'" fill="'+color+'" data-category="'+esc(group.key)+'" tabindex="0" role="button" aria-pressed="'+(state.group===group.key)+'" data-tip="'+esc(label+' · '+pct(share)+' · '+money(group.sales))+'"><title>'+esc(label+' · '+pct(share)+' · '+money(group.sales))+'</title></path>';
 }).join('');
 const legend=groups.map((group,index)=>{const label=state.lang==='th'?bySku(group.rows[0].sku).groupTh:group.key,color=palette[index%palette.length],share=group.sales/total;return '<button class="pie-legend-item" data-category="'+esc(group.key)+'" aria-pressed="'+(state.group===group.key)+'"><i style="background:'+color+'"></i><span><strong>'+esc(label)+'</strong><small>'+pct(share)+' · '+money(group.sales)+'</small></span></button>'}).join('');
 const selectedGroup=groups.find(group=>group.key===state.group);
 const selected=state.group?(state.lang==='th'&&selectedGroup?bySku(selectedGroup.rows[0].sku).groupTh:state.group):t('All product groups','ทุกกลุ่มสินค้า');
 return '<div class="product-category-pie-layout"><svg class="product-pie" viewBox="0 0 300 300" role="group" aria-label="'+esc(t('Revenue share by product group','สัดส่วนยอดขายตามกลุ่มสินค้า'))+'">'+slices+'</svg><details class="pie-selection-dropdown"><summary><span>'+t('Select product group','เลือกกลุ่มสินค้า')+'</span><strong>'+esc(selected)+'</strong><i aria-hidden="true">⌄</i></summary><div class="pie-legend">'+legend+'</div></details></div>';
}
function customerSegmentPie(groups,total,segments){
 if(!groups.length||!total)return '<p class="empty">'+t('No customer sales to chart.','ไม่มียอดขายลูกค้าสำหรับแสดงกราฟ')+'</p>';
 const palette=['#687fb7','#c87973','#8ca94f','#d29a54','#7e8992','#8b6fb1','#55a3a3','#b66d8a'],cx=150,cy=150,r=112;
 let angle=-Math.PI/2;
 const point=value=>[cx+r*Math.cos(value),cy+r*Math.sin(value)];
 const labelFor=group=>segments.find(segment=>segment[0]===group.key)?.[1]||group.key;
 const slices=groups.map((group,index)=>{
  const share=group.sales/total,start=angle,end=angle+share*Math.PI*2,color=palette[index%palette.length],label=labelFor(group),tip=label+' · '+pct(share)+' · '+money(group.sales);
  angle=end;
  if(share>=.999999)return '<circle class="pie-slice'+(state.customerSegment===group.key?' selected':'')+'" cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+color+'" data-customer-segment="'+esc(group.key)+'" tabindex="0" role="button" aria-pressed="'+(state.customerSegment===group.key)+'" data-tip="'+esc(tip)+'"><title>'+esc(tip)+'</title></circle>';
  const a=point(start),b=point(end),large=share>.5?1:0,path='M '+cx+' '+cy+' L '+a[0]+' '+a[1]+' A '+r+' '+r+' 0 '+large+' 1 '+b[0]+' '+b[1]+' Z';
  return '<path class="pie-slice'+(state.customerSegment===group.key?' selected':'')+'" d="'+path+'" fill="'+color+'" data-customer-segment="'+esc(group.key)+'" tabindex="0" role="button" aria-pressed="'+(state.customerSegment===group.key)+'" data-tip="'+esc(tip)+'"><title>'+esc(tip)+'</title></path>';
 }).join('');
 const legend=groups.map((group,index)=>{const label=labelFor(group),color=palette[index%palette.length],share=group.sales/total;return '<button class="pie-legend-item" data-customer-segment="'+esc(group.key)+'" aria-pressed="'+(state.customerSegment===group.key)+'"><i style="background:'+color+'"></i><span><strong>'+esc(label)+'</strong><small>'+pct(share)+' · '+money(group.sales)+' · '+num(group.customers)+' '+t('customers','ลูกค้า')+'</small></span></button>'}).join('');
 return '<div class="product-pie-layout"><svg class="product-pie" viewBox="0 0 300 300" role="group" aria-label="'+esc(t('Sales share by customer group','สัดส่วนยอดขายตามกลุ่มลูกค้า'))+'">'+slices+'</svg><div class="pie-legend">'+legend+'</div></div><p class="note">'+t('Select a pie slice or legend item to filter the ranking below. Select it again to clear the filter.','เลือกชิ้นกราฟวงกลมหรือรายการคำอธิบายเพื่อกรองอันดับด้านล่าง เลือกอีกครั้งเพื่อล้างตัวกรอง')+'</p>';
}
function customerCompanyPie(groups,total){
 if(!groups.length||!total)return '<p class="empty">'+t('No customer sales to chart.','ไม่มียอดขายลูกค้าสำหรับแสดงกราฟ')+'</p>';
 const sorted=[...groups].sort((a,b)=>b.sales-a.sales),selected=sorted.find(group=>group.key===state.customerSelected);
 let shown=applyTop(sorted,'customers',10);
 if(selected&&!shown.some(group=>group.key===selected.key))shown=[...shown.slice(0,Math.max(0,shown.length-1)),selected];
 const maximum=Math.max(...shown.map(group=>group.sales),1);
 const bars=shown.map(group=>{const customer=byCustomer(group.key),rank=sorted.findIndex(row=>row.key===group.key)+1,width=group.sales/maximum*100;return '<button class="customer-company-bar" data-customer-company="'+esc(group.key)+'" aria-pressed="'+(state.customerSelected===group.key)+'"><span class="customer-company-rank">'+num(rank)+'</span><span class="customer-company-info"><strong>'+esc(customer.name)+'</strong><small>'+pct(group.sales/total)+' · '+num(group.invoices)+' '+t('invoices','ใบกำกับ')+'</small></span><span class="customer-company-track" aria-hidden="true"><i style="width:'+num(width,1)+'%"></i></span><strong class="customer-company-value">'+money(group.sales)+'</strong></button>'}).join('');
 const invoices=groups.reduce((sum,group)=>sum+group.invoices,0);
 const shownSales=shown.reduce((sum,group)=>sum+group.sales,0),remaining=Math.max(0,total-shownSales);
 return '<div class="customer-chart-summary"><span>'+t('Total sales','ยอดขายรวม')+'</span><strong>'+money(total)+'</strong><small>'+num(groups.length)+' '+t('companies','บริษัท')+' · '+num(invoices)+' '+t('invoices','ใบกำกับ')+'</small></div>'+topNControl('customers',10,sorted.length)+topScroll('<div class="customer-company-bars" role="group" aria-label="'+esc(t('Top customer companies by sales','บริษัทลูกค้ายอดขายสูงสุด'))+'">'+bars+'</div>','customers',10,shown.length)+(groups.length>shown.length?'<p class="customer-company-remainder">'+num(groups.length-shown.length)+' '+t('other companies','บริษัทอื่น')+' · '+money(remaining)+'</p>':'')+'<p class="note">'+t('Bars are scaled to the leading company. Select a company to filter the customer table; select it again to clear the filter.','แท่งกราฟเทียบกับบริษัทอันดับหนึ่ง เลือกบริษัทเพื่อกรองตารางลูกค้า และเลือกอีกครั้งเพื่อล้างตัวกรอง')+'</p>';
}
function attributeRankingPanel(rows){
 const view=state.attributeView||'color';
 const totals=new Map();let unmapped=0,unmappedQty=0,eligibleQty=0;
 for(const r of rows){
  const p=bySku(r.sku),g=p.sku.split('-')[0];
  /* Metres only, and never groups 77/88/99 — matching prd.md section 12.1's
     scope for this kind of ranking. Mixing units (metres with pieces, for
     example) into one quantity total is never allowed (section 8). */
  if(['77','88','99'].includes(g)||p.unit!=='เมตร')continue;
  eligibleQty+=r.quantity;
  const attrs=ExpressCsvImporter.parseRoofingAttributes(p.name,g);
  if(!attrs){unmapped++;unmappedQty+=r.quantity;continue}
  const value=view==='thickness'?(attrs.thicknessMm+' มม.'):attrs[view];
  if(!value){unmapped++;unmappedQty+=r.quantity;continue}
  totals.set(value,(totals.get(value)||0)+r.quantity);
 }
 const allAttributes=[...totals.entries()].sort((a,b)=>b[1]-a[1]),ranked=applyTop(allAttributes,'attributes',10);
 const maximum=Math.max(1,...ranked.map(([,v])=>v));
 const unit0=t('m','เมตร');
 const chart=ranked.length?topNControl('attributes',10,allAttributes.length)+topScroll(quantityBars(ranked.map(([label,value])=>({label,value})),unit0),'attributes',10,ranked.length):'<p class="empty">'+t('No matching material sales in this date range.','ไม่มีข้อมูลวัสดุที่ตรงกันในช่วงวันที่นี้')+'</p>';
 const options=[['profile',t('Profile','โปรไฟล์')],['color',t('Colour','สี')],['thickness',t('Thickness','ความหนา')]];
 return select(t('Rank by','จัดอันดับตาม'),'attribute-view',options,view)+chart+'<p class="note">'+t('Ranked by quantity sold (metres), for roofing, walling and fencing groups only (product groups 77, 88 and 99 excluded, matching prd.md section 12.1). ','จัดอันดับตามปริมาณที่ขาย (เมตร) เฉพาะกลุ่มหลังคา ผนัง และรั้ว (ไม่รวมกลุ่ม 77, 88, 99) ')+t('Unmapped: ','ยังไม่จับคู่: ')+num(unmapped)+' '+t('lines','รายการ')+' ('+(eligibleQty>0?pct(unmappedQty/eligibleQty):'—')+' '+t('of eligible quantity, mostly descriptions the Express export truncated — never guessed at.','ของปริมาณที่เข้าเกณฑ์ ส่วนใหญ่เป็นคำอธิบายที่ไฟล์ Express ตัดทอน — ไม่มีการเดา')+')</p>';
}
function productsView(){
 const rows=filtered(),categoryRows=filteredBetween(state.from,state.to,true),categoryGroups=group(categoryRows,r=>bySku(r.sku).group),categoryTotal=E.sum(categoryRows.map(r=>r.amount));
 const allProducts=group(rows,r=>r.sku).map(g=>({...g,quantity:E.sum(g.rows.map(r=>r.quantity)),product:bySku(g.key)}));
 const prefixes=[...new Set(data.products.map(p=>p.sku.split('-')[0]))].sort();
 const detailPrefixes=[...new Set(data.products.map(p=>p.sku.split('-')[0]))].sort(); const detailSearchControl='<label class="product-search">'+t('Search product name or SKU','ค้นหาชื่อสินค้าหรือ SKU')+'<input id="productSearch" type="search" autocomplete="off" placeholder="'+t('Type a product name or SKU','พิมพ์ชื่อสินค้าหรือ SKU')+'" value="'+esc(state.detailSearch)+'"></label>';
 const detailControls='<div class="detail-filters">'+select(t('SKU','SKU'),'detailPrefix',[['',t('All SKUs','ทุก SKU')],...detailPrefixes.map(v=>[v,groupLabel(v)])],state.detailPrefix)+'<button class="button secondary" data-clear-product-details>'+t('Clear product filters','ล้างตัวกรองสินค้า')+'</button></div><p class="note">'+t('* Group names are temporary, analysed from the codes in your files, pending your confirmation.','* ชื่อกลุ่มเป็นชื่อชั่วคราวที่วิเคราะห์จากรหัสในไฟล์ของคุณ รอการยืนยันจากคุณ')+'</p>'; const detailQuery=state.detailSearch.trim().toLocaleLowerCase(state.lang==='th'?'th-TH':'en-US');
 /* Same-dates-last-year sales per SKU, computed once rather than once per table row. */
 const pastBySku=new Map();for(const r of filteredBetween(lastYear(state.from),lastYear(state.to)))pastBySku.set(r.sku,(pastBySku.get(r.sku)||0)+r.amount);
 const detailRows=group(rows,r=>r.sku).filter(g=>{const p=bySku(g.key),searchText=(p.sku+' '+p.name+' '+p.th).toLocaleLowerCase(state.lang==='th'?'th-TH':'en-US');return (!detailQuery||searchText.includes(detailQuery))&&(!state.detailPrefix||p.sku.split('-')[0]===state.detailPrefix)});
 const detailPage=pageSlice('productDetails',detailRows,[state.from,state.to,state.person,state.segment,state.group,state.detailPrefix,state.detailSearch].join('|'));
 const prefixProducts=allProducts.filter(g=>!state.topPrefix||g.key.split('-')[0]===state.topPrefix);
 const units=[...new Map(prefixProducts.map(g=>[g.product.unit,unit(g.product)]))];
 if(!units.some(([key])=>key===state.topUnit))state.topUnit=units[0]?.[0]||'';
 const ranked=prefixProducts.filter(g=>state.topMetric!=='quantity'||g.product.unit===state.topUnit).sort((a,b)=>(state.topMetric==='quantity'?b.quantity-a.quantity:b.sales-a.sales)||a.key.localeCompare(b.key));
 const top=applyTop(ranked,'products',5),maximum=Math.max(1,...top.map(g=>state.topMetric==='quantity'?g.quantity:g.sales)),total=E.sum(ranked.map(g=>g.sales));
 const controls='<div class="ranking-toolbar"><div class="options" aria-label="'+t('Rank products by','จัดอันดับสินค้าตาม')+'"><button class="button '+(state.topMetric==='sales'?'':'secondary')+'" data-product-metric="sales" aria-pressed="'+(state.topMetric==='sales')+'">'+t('By revenue','ตามยอดขาย')+'</button><button class="button '+(state.topMetric==='quantity'?'':'secondary')+'" data-product-metric="quantity" aria-pressed="'+(state.topMetric==='quantity')+'">'+t('By quantity','ตามจำนวน')+'</button></div>'+select(t('SKU prefix · this ranking only','กลุ่มรหัส SKU · เฉพาะอันดับนี้'),'top-prefix',[['',t('All prefixes','ทุกกลุ่มรหัส')],...prefixes.map(prefix=>[prefix,groupLabel(prefix)])],state.topPrefix)+(state.topMetric==='quantity'?select(t('Compare within one unit','เปรียบเทียบในหน่วยเดียวกัน'),'top-unit',units,state.topUnit):'')+'</div>';
 const ranking=top.length?'<div class="top-products">'+top.map((g,i)=>{const p=g.product,value=state.topMetric==='quantity'?g.quantity:g.sales,label=state.topMetric==='quantity'?num(value,2)+' '+unit(p):money(value),color=colors[[...new Set(data.products.map(p=>p.group))].indexOf(p.group)%colors.length];return '<button class="top-product" data-forecast="'+esc(p.sku)+'" data-tip="'+esc(name(p)+' · '+label+' · '+t('Open forecast','เปิดการคาดการณ์'))+'"><span class="rank-number">'+(i+1)+'</span><span class="top-product-name"><strong>'+esc(p.sku+' · '+name(p))+'</strong><small>'+esc(state.lang==='th'?p.groupTh:p.group)+'</small></span><span class="track"><span class="fill" style="display:block;width:'+(value/maximum*100)+'%;background:'+color+'"></span></span><strong class="top-product-value">'+esc(label)+'</strong></button>'}).join('')+'</div>':'<p class="empty">'+t('No matching products.','ไม่พบสินค้าที่ตรงกัน')+'</p>';
 return heading(t('Product performance','ประสิทธิภาพสินค้า'),t('Know what is selling','รู้ว่าสินค้าใดขายได้'),t('Choose a category, then compare the leading products by revenue or quantity.','เลือกกลุ่มสินค้า แล้วเปรียบเทียบสินค้าอันดับต้นตามยอดขายหรือจำนวน'))+
 panel(t('Revenue share by product group','สัดส่วนยอดขายตามกลุ่มสินค้า'),productCategoryPie(categoryGroups,categoryTotal)+'<p class="note">'+t('Select a pie slice or legend item to filter the ranking and product details. Select it again to clear the filter.','เลือกชิ้นกราฟวงกลมหรือรายการคำอธิบายเพื่อกรองอันดับสินค้าและรายละเอียดสินค้า เลือกอีกครั้งเพื่อล้างตัวกรอง')+'</p>',t('Selected dates','ช่วงวันที่เลือก'))+
  panel(t('Sales by product group and month (thousand baht)','ยอดขายตามกลุ่มสินค้า × เดือน (บาท)'),monthRevenueHeatmap(t('Product group','กลุ่มสินค้า'),r=>bySku(r.sku)?.group||'',g=>{const p=data.products.find(x=>x.group===g);return p?(state.lang==='th'?p.groupTh:p.group):g},categoryGroups.map(g=>g.key),true))+
 panel(t('Top products','สินค้าอันดับต้น'),controls+topNControl('products',5,ranked.length)+topScroll(ranking,'products',5,top.length)+'<p class="ranking-summary">'+t('Showing','แสดง')+' <strong>'+num(top.length)+'</strong> '+t('of','จาก')+' <strong>'+num(ranked.length)+'</strong> '+t('matching SKUs','SKU ที่ตรงกัน')+' · '+t('Revenue for all matching SKUs','ยอดขายรวมทุก SKU ที่ตรงกัน')+': <strong>'+money(total)+'</strong></p><p class="note">'+t('Each row is one SKU. Click a product to open its forecast. The SKU prefix filters only this ranking. Quantity rankings compare one unit at a time.','แต่ละแถวคือหนึ่ง SKU คลิกสินค้าเพื่อเปิดการคาดการณ์ ตัวกรองกลุ่มรหัส SKU ใช้เฉพาะอันดับนี้ และอันดับจำนวนเปรียบเทียบในหน่วยเดียวกัน')+'</p>')+panel(t('Product details','รายละเอียดสินค้า'),detailSearchControl+detailControls+table([t('Product','สินค้า'),t('Quantity','จำนวน'),t('Length range sold','ช่วงความยาวที่ขาย'),t('Sales revenue','ยอดขาย'),t('Same dates last year','ช่วงวันที่เดียวกันปีก่อน'),t('Plan','วางแผน')],detailPage.rows.map(g=>{const p=bySku(g.key),past=pastBySku.get(p.sku)||0,quantities=g.rows.map(r=>r.quantity),lengthRange=quantities.length?(Math.min(...quantities)===Math.max(...quantities)?num(quantities[0],2):num(Math.min(...quantities),2)+'–'+num(Math.max(...quantities),2))+' '+esc(unit(p)):'—';return `<tr><td>${esc(name(p))}<small>${esc(p.sku)}</small></td><td>${num(E.sum(g.rows.map(r=>r.quantity)),2)} ${esc(unit(p))}</td><td>${lengthRange}</td><td>${money(g.sales)}</td><td>${covered(lastYear(state.from),lastYear(state.to))?money(past):'—'}</td><td><button class="row-action" data-forecast="${esc(p.sku)}">${t('Forecast →','คาดการณ์ →')}</button></td></tr>`}))+pagerHtml('productDetails',detailPage))+
 panel(t('Ranked by attribute','จัดอันดับตามคุณสมบัติสินค้า'),attributeRankingPanel(rows))}



function togglePerson(id){
 if(!unlocked||state.role!=='management')return;const p=data.salespeople.find(p=>p.id===id);if(!p||p.archived)return;
 if(!p.archived&&!confirm(t('Remove ','นำ ')+name(p)+t(' from the active team? All past sales will be kept.',' ออกจากทีมที่ใช้งานหรือไม่? ยอดขายเดิมจะยังอยู่')))return;
 const next={...data,salespeople:data.salespeople.map(x=>x.id===id?{...x,archived:true}:x)};
 try{E.validate(next);localStorage.setItem('monthly-forecast-entry-v1',JSON.stringify(next));data=next;state.team.delete(id);render();$('#people-status').textContent=t('Removed from the list. Past sales are unchanged.','นำออกจากรายชื่อแล้ว ยอดขายเดิมไม่เปลี่ยนแปลง')}catch{ $('#people-status').textContent=t('Not saved. Browser storage is unavailable.','ไม่ได้บันทึก ไม่สามารถใช้พื้นที่เก็บข้อมูลของเบราว์เซอร์ได้')}
}
const authKey='monthly-forecast-ceo-lock-v1';
const salespersonAuthKey='monthly-forecast-salesperson-locks-v1';
const techAuthKey='monthly-forecast-tech-lock-v1';
const managerAuthKey='monthly-forecast-manager-lock-v1';
function storedLock(){try{return localStorage.getItem(authKey)}catch{return null}}
function storedTechLock(){try{return localStorage.getItem(techAuthKey)}catch{return null}}
function storedManagerLock(){try{return localStorage.getItem(managerAuthKey)}catch{return null}}
function storedSalespersonLocks(){try{return JSON.parse(localStorage.getItem(salespersonAuthKey)||'{}')}catch{return {}}}
function renderWelcome(){
 document.querySelector('.app-layout').hidden=true;document.getElementById('role-switch')?.remove();document.getElementById('welcome-screen')?.remove();
 document.documentElement.lang=state.lang;document.querySelectorAll('[data-lang]').forEach(b=>{b.classList.toggle('active',b.dataset.lang===state.lang);b.setAttribute('aria-pressed',String(b.dataset.lang===state.lang))});
 $('#settings-toggle').setAttribute('aria-label',t('Settings','ตั้งค่า'));$('#settings-toggle').title=t('Settings','ตั้งค่า');$('#settings-title').textContent=t('Settings','ตั้งค่า');$('#language-label').textContent=t('Language','ภาษา');$('#theme-label').textContent=t('Theme','ธีม');$('.review-label').textContent=t('SELECT ACCESS · LOCAL PROTOTYPE','เลือกการเข้าใช้งาน · ต้นแบบในเครื่อง');$('.skip').textContent=t('Skip to access choice','ข้ามไปเลือกการเข้าใช้งาน');
 const screen=document.createElement('main');screen.id='welcome-screen';screen.className='access-screen welcome-screen';screen.tabIndex=-1;screen.innerHTML='<div class="welcome-copy"><div class="eyebrow">'+t('Welcome','ยินดีต้อนรับ')+'</div><h1>'+t('Choose how you want to enter','เลือกมุมมองที่ต้องการเข้าใช้งาน')+'</h1><p class="muted">'+t('Select your role before any sales information is shown. Passwords protect access on this browser only.','เลือกบทบาทก่อนแสดงข้อมูลยอดขาย รหัสผ่านป้องกันการเข้าใช้งานเฉพาะเบราว์เซอร์นี้')+'</p></div><div class="welcome-grid"><article class="access-card sales-team-card"><h2>'+t('Sales Team','ฝ่ายขาย')+'</h2><p>'+(data.demo?t('Salespeople can open the Express CSV files themselves, then choose their own imported ID.','พนักงานขายสามารถเปิดไฟล์ CSV จาก Express ได้เอง แล้วเลือกรหัสของตนจากข้อมูลที่นำเข้า'):t('Salespeople can view their own results. The Supervisor can review the team, customers, products and forecasts.','พนักงานขายดูผลงานของตนเอง ส่วนหัวหน้าฝ่ายขายดูทีม ลูกค้า สินค้า และการคาดการณ์'))+'</p><form id="welcome-sales-team" class="sales-team-entry"><button class="button" type="submit" name="entryRole" value="supervisor">'+t('Continue as salesperson','ดำเนินการในฐานะพนักงานขาย')+'</button><button class="button secondary manager-entry" type="submit" name="entryRole" value="supervisor">'+t('Continue as Supervisor','ดำเนินการในฐานะหัวหน้าฝ่ายขาย')+'</button></form></article><article class="access-card ceo-card"><h2>'+t('Management Team','ทีมผู้บริหาร')+'</h2><p>'+t('Open the complete management, forecasting, team and reporting workspace.','เปิดพื้นที่จัดการ การคาดการณ์ ทีม และรายงานทั้งหมด')+'</p><form id="welcome-ceo"><button class="button" type="submit">'+t('Continue as Management','ดำเนินการในฐานะผู้บริหาร')+'</button></form></article><article class="access-card tech-card"><h2>'+t('Tech Team','ทีมเทคนิค')+'</h2><p>'+t('Reset local passwords and check which accounts have completed password setup.','รีเซ็ตรหัสผ่านในเครื่องและตรวจสอบว่าบัญชีใดตั้งรหัสผ่านแล้ว')+'</p><form id="welcome-tech"><button class="button" type="submit">'+t('Continue as tech team','ดำเนินการในฐานะทีมเทคนิค')+'</button></form></article></div><p class="welcome-note">'+t('This prototype stores access settings and entered data locally on this device.','ต้นแบบนี้เก็บการตั้งค่าการเข้าใช้งานและข้อมูลที่กรอกไว้ในเครื่องนี้')+'</p>';
 screen.querySelector('button[name="entryRole"]:not(.manager-entry)')?.setAttribute('value','sales');
 document.querySelector('header').insertAdjacentElement('afterend',screen);renderTheme();screen.focus();
}
function renderSalespersonProfileDialog(){
 if(document.getElementById('salesperson-profile-dialog'))return;
 const dialog=document.createElement('dialog');dialog.id='salesperson-profile-dialog';dialog.innerHTML='<h2>'+t('Choose your salesperson profile','เลือกโปรไฟล์พนักงานขายของคุณ')+'</h2><p class="note">'+t('This list was created from the Express files you just selected.','รายชื่อนี้สร้างจากไฟล์ Express ที่คุณเพิ่งเลือก')+'</p><form id="welcome-salesperson-picker"><label>'+t('Name and ID','ชื่อและรหัส')+'<select name="identity" required>'+activePeople().map(p=>option(p.id,name(p)+' · ID '+p.staffId,'')).join('')+'</select></label><div class="options"><button class="button" type="submit">'+t('Continue','ดำเนินการต่อ')+'</button><button class="button secondary" type="button" id="cancel-salesperson-profile">'+t('Cancel','ยกเลิก')+'</button></div></form>';
 document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('#cancel-salesperson-profile').onclick=()=>dialog.close();dialog.showModal();dialog.querySelector('select').focus();
}
function renderSalespersonPicker(){
 const screen=document.getElementById('welcome-screen');if(!screen){renderWelcome();return}
 screen.innerHTML='<div class="welcome-copy"><div class="eyebrow">'+t('Salesperson access','เข้าใช้งานพนักงานขาย')+'</div><h1>'+t('Open a fresh set of Express CSV files','เปิดไฟล์ CSV จาก Express ชุดล่าสุด')+'</h1><p class="muted">'+t('Import the files each time so the salesperson list always reflects the current roster.','นำเข้าไฟล์ทุกครั้งเพื่อให้รายชื่อพนักงานขายเป็นข้อมูลล่าสุดเสมอ')+'</p></div><div class="salesperson-picker-wrap"><article class="access-card salesperson-picker-card"><h2>'+t('Import to choose your profile','นำเข้าเพื่อเลือกโปรไฟล์ของคุณ')+'</h2><p>'+t('No previously imported salesperson list is reused.','ระบบจะไม่ใช้รายชื่อพนักงานจากการนำเข้าครั้งก่อน')+'</p>'+importGuide(true)+'<label class="upload">'+t('Choose Express CSV files','เลือกไฟล์ CSV จาก Express')+'<input id="welcome-import-file" type="file" accept=".csv,text/csv,.json,application/json" multiple></label><div class="salesperson-picker-actions"><button class="button secondary" type="button" id="back-to-role-choice">'+t('Back','ย้อนกลับ')+'</button></div></article></div>';
 screen.querySelector('#back-to-role-choice').onclick=renderWelcome;screen.focus();
}
function addPasswordToggles(root){
 root.querySelectorAll('input[type="password"]').forEach(input=>{
  const wrap=document.createElement('span');wrap.className='password-input';input.parentNode.insertBefore(wrap,input);wrap.append(input);
  const button=document.createElement('button');button.type='button';button.className='password-toggle';
  const update=()=>{const visible=input.type==='text';button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',t(visible?'Hide password':'Show password',visible?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน'));button.title=t(visible?'Hide password':'Show password',visible?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน');button.innerHTML=visible?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.3A10.8 10.8 0 0 1 12 4c5.2 0 9 5 9 5s-1.1 1.5-2.9 2.8M6.2 6.2C4.2 7.5 3 9 3 9s3.8 5 9 5c1.3 0 2.5-.3 3.5-.7"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.8-5 9-5 9 5 9 5-3.8 5-9 5-9-5-9-5Z"/><circle cx="12" cy="12" r="2.5"/></svg>'};
  button.addEventListener('click',()=>{input.type=input.type==='password'?'text':'password';update();input.focus()});update();wrap.append(button);
 });
}
function renderAccess(){
 if(document.getElementById('ceo-dialog'))return;
 const setup=!storedLock(),dialog=document.createElement('dialog');dialog.id='ceo-dialog';
 dialog.innerHTML='<h2>'+t(setup?'Set management password':'Enter management password',setup?'ตั้งรหัสผ่านผู้บริหาร':'ใส่รหัสผ่านผู้บริหาร')+'</h2><form id="access-ceo"><label>'+t(setup?'Create password (at least 12 characters)':'Password',setup?'ตั้งรหัสผ่าน (อย่างน้อย 12 ตัวอักษร)':'รหัสผ่าน')+'<input name="password" type="password" autocomplete="'+(setup?'new-password':'current-password')+'" required '+(setup?'minlength="12"':'')+' maxlength="256"></label>'+(setup?'<label>'+t('Confirm password','ยืนยันรหัสผ่าน')+'<input name="confirm" type="password" autocomplete="new-password" required maxlength="256"></label>':'')+'<p class="note">'+t('Local privacy lock only—not secure server authentication.','ล็อกเพื่อความเป็นส่วนตัวในเครื่อง ไม่ใช่การยืนยันตัวตนผ่านเซิร์ฟเวอร์')+'</p><div class="options"><button class="button" type="submit">'+t(setup?'Set password & enter management':'Enter management mode',setup?'ตั้งรหัสผ่านและเข้าผู้บริหาร':'เข้าโหมดผู้บริหาร')+'</button><button class="button secondary" type="button" id="cancel-ceo">'+t('Cancel','ยกเลิก')+'</button></div><p id="access-status" role="status"></p></form>';
 document.body.append(dialog);addPasswordToggles(dialog);dialog.addEventListener('close',()=>{dialog.remove();$('#view-role')?.focus()});dialog.querySelector('#cancel-ceo').onclick=()=>dialog.close();dialog.showModal();
}

function renderManagerAccess(){
 if(document.getElementById('manager-dialog'))return;
 const setup=!storedManagerLock(),dialog=document.createElement('dialog');dialog.id='manager-dialog';
 dialog.innerHTML='<h2>'+t(setup?'Set supervisor password':'Enter supervisor password',setup?'ตั้งรหัสผ่านหัวหน้าฝ่ายขาย':'ใส่รหัสผ่านหัวหน้าฝ่ายขาย')+'</h2><form id="access-manager"><label>'+t(setup?'Create password (at least 12 characters)':'Password',setup?'ตั้งรหัสผ่าน (อย่างน้อย 12 ตัวอักษร)':'รหัสผ่าน')+'<input name="password" type="password" autocomplete="'+(setup?'new-password':'current-password')+'" required '+(setup?'minlength="12"':'')+' maxlength="256"></label>'+(setup?'<label>'+t('Confirm password','ยืนยันรหัสผ่าน')+'<input name="confirm" type="password" autocomplete="new-password" required minlength="12" maxlength="256"></label>':'')+'<p class="note">'+t('This local prototype separates the supervisor view on this browser only. A server is required for shared company accounts.','ต้นแบบนี้แยกมุมมองหัวหน้าฝ่ายขายเฉพาะในเบราว์เซอร์นี้ ระบบบัญชีที่ใช้ร่วมกันต้องติดตั้งบนเซิร์ฟเวอร์')+'</p><div class="options"><button class="button" type="submit">'+t(setup?'Set password & enter':'Enter supervisor view',setup?'ตั้งรหัสผ่านและเข้าใช้งาน':'เข้ามุมมองหัวหน้าฝ่ายขาย')+'</button><button class="button secondary" type="button" id="cancel-manager">'+t('Cancel','ยกเลิก')+'</button></div><p id="manager-access-status" role="status"></p></form>';
 document.body.append(dialog);addPasswordToggles(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('#cancel-manager').onclick=()=>dialog.close();dialog.showModal();dialog.querySelector('[name=password]').focus();
}
function renderTechAccess(){
 if(document.getElementById('tech-dialog'))return;
 const setup=!storedTechLock(),dialog=document.createElement('dialog');dialog.id='tech-dialog';
 dialog.innerHTML='<h2>'+t(setup?'Set tech-team password':'Enter tech-team password',setup?'ตั้งรหัสผ่านทีมเทคนิค':'ใส่รหัสผ่านทีมเทคนิค')+'</h2><form id="access-tech"><label>'+t(setup?'Create password (at least 12 characters)':'Password',setup?'ตั้งรหัสผ่าน (อย่างน้อย 12 ตัวอักษร)':'รหัสผ่าน')+'<input name="password" type="password" autocomplete="'+(setup?'new-password':'current-password')+'" required '+(setup?'minlength="12"':'')+' maxlength="256"></label>'+(setup?'<label>'+t('Confirm password','ยืนยันรหัสผ่าน')+'<input name="confirm" type="password" autocomplete="new-password" required minlength="12" maxlength="256"></label>':'')+'<p class="note">'+t('This local support role can reset passwords only. It cannot view sales or planning data.','บทบาทช่วยเหลือในเครื่องนี้รีเซ็ตรหัสผ่านได้เท่านั้น ไม่สามารถดูยอดขายหรือข้อมูลแผนได้')+'</p><div class="options"><button class="button" type="submit">'+t(setup?'Set password & enter support':'Enter tech support',setup?'ตั้งรหัสผ่านและเข้าหน้าช่วยเหลือ':'เข้าหน้าช่วยเหลือ')+'</button><button class="button secondary" type="button" id="cancel-tech">'+t('Cancel','ยกเลิก')+'</button></div><p id="tech-access-status" role="status"></p></form>';
 document.body.append(dialog);addPasswordToggles(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('#cancel-tech').onclick=()=>dialog.close();dialog.showModal();dialog.querySelector('[name=password]').focus();
}
async function passwordHash(password,salt){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new Uint8Array(salt),iterations:600000,hash:'SHA-256'},key,256))).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function renderSalespersonAccess(targetId,force=false){
 const person=activePeople().find(p=>p.id===targetId);if(!person||(!force&&targetId===state.identity))return;
 document.getElementById('salesperson-dialog')?.remove();const setup=!storedSalespersonLocks()[targetId],dialog=document.createElement('dialog');dialog.id='salesperson-dialog';dialog.dataset.target=targetId;
 dialog.innerHTML='<h2>'+t(setup?'Set salesperson password':'Enter salesperson password',setup?'ตั้งรหัสผ่านพนักงานขาย':'ใส่รหัสผ่านพนักงานขาย')+'</h2><p><strong>'+esc(name(person))+' · ID '+esc(person.staffId)+'</strong></p><form id="access-salesperson-switch"><label>'+t(setup?'Create a 6-character password':'6-character password',setup?'ตั้งรหัสผ่าน 6 ตัวอักษร':'รหัสผ่าน 6 ตัวอักษร')+'<input name="password" type="password" autocomplete="'+(setup?'new-password':'current-password')+'" minlength="6" maxlength="6" required></label>'+(setup?'<label>'+t('Confirm password','ยืนยันรหัสผ่าน')+'<input name="confirm" type="password" autocomplete="new-password" minlength="6" maxlength="6" required></label>':'')+'<p class="note">'+t('This password protects switching on this browser only. It is not a server account.','รหัสนี้ป้องกันการสลับผู้ใช้ในเบราว์เซอร์นี้เท่านั้น ไม่ใช่บัญชีบนเซิร์ฟเวอร์')+'</p><div class="options"><button class="button" type="submit">'+t(setup?'Set password & switch':'Switch salesperson',setup?'ตั้งรหัสและสลับผู้ใช้':'สลับพนักงานขาย')+'</button><button class="button secondary" type="button" id="cancel-salesperson">'+t('Cancel','ยกเลิก')+'</button></div><p id="salesperson-access-status" role="status"></p></form>';
 document.body.append(dialog);addPasswordToggles(dialog);dialog.addEventListener('close',()=>{dialog.remove();render();$('#view-identity')?.focus()});dialog.querySelector('#cancel-salesperson').onclick=()=>dialog.close();dialog.showModal();dialog.querySelector('[name=password]').focus();
}
document.addEventListener('submit',async e=>{
 if(e.target.id==='welcome-sales-team'){e.preventDefault();e.submitter?.classList.contains('manager-entry')?renderManagerAccess():renderSalespersonPicker();return}
 if(e.target.id==='welcome-salesperson-picker'){e.preventDefault();const identity=new FormData(e.target).get('identity');e.target.closest('dialog')?.close();renderSalespersonAccess(identity,true);return}
 if(e.target.id==='welcome-ceo'){e.preventDefault();renderAccess();return}
 if(e.target.id==='welcome-tech'){e.preventDefault();renderTechAccess();return}
 if(e.target.id==='access-sales'){e.preventDefault();if(!storedLock())return;const id=$('#access-identity').value;if(!activePeople().some(p=>p.id===id))return;state.identity=id;state.role='sales';state.tab='mine';unlocked=true;render();return}
 if(e.target.id==='access-salesperson-switch'){e.preventDefault();const form=e.target,button=form.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;try{const target=form.closest('dialog').dataset.target,person=activePeople().find(p=>p.id===target);if(!person)throw Error(t('This salesperson is no longer active.','พนักงานขายนี้ไม่ได้ใช้งานแล้ว'));const f=new FormData(form),password=String(f.get('password')||''),locks=storedSalespersonLocks(),lock=locks[target];if(password.length!==6)throw Error(t('Use exactly 6 characters.','ใช้รหัสผ่านให้ครบ 6 ตัวอักษร'));if(!lock){if(password!==f.get('confirm'))throw Error(t('The passwords do not match.','รหัสผ่านทั้งสองช่องไม่ตรงกัน'));const salt=Array.from(crypto.getRandomValues(new Uint8Array(16))),hash=await passwordHash(password,salt);locks[target]={version:1,salt,hash};localStorage.setItem(salespersonAuthKey,JSON.stringify(locks))}else if(lock.version!==1||await passwordHash(password,lock.salt)!==lock.hash)throw Error(t('Incorrect salesperson password.','รหัสผ่านพนักงานขายไม่ถูกต้อง'));state.identity=target;state.role='sales';state.tab='mine';state.mineFrom=bounds().from;state.mineTo=bounds().to;state.mineSearch=state.mineCustomer=state.mineSku='';unlocked=true;form.closest('dialog').close();toast(t('Switched to ','เปลี่ยนเป็น ')+name(person));}catch(err){const status=$('#salesperson-access-status');if(status)status.textContent=err.message;form.querySelector('[name=password]').value='';form.querySelector('[name=password]').focus();button.disabled=false}return}
 if(e.target.id==='access-manager'){e.preventDefault();const form=e.target,button=form.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;try{const f=new FormData(form),password=String(f.get('password')||''),raw=storedManagerLock();if(!raw){if(password.length<12||password!==f.get('confirm'))throw Error(t('Use at least 12 characters and matching passwords.','ใช้รหัสผ่านอย่างน้อย 12 ตัวอักษรและให้ทั้งสองช่องตรงกัน'));const salt=Array.from(crypto.getRandomValues(new Uint8Array(16))),hash=await passwordHash(password,salt);localStorage.setItem(managerAuthKey,JSON.stringify({version:1,salt,hash}))}else{const lock=JSON.parse(raw);if(lock.version!==1||await passwordHash(password,lock.salt)!==lock.hash)throw Error(t('Incorrect supervisor password.','รหัสผ่านหัวหน้าฝ่ายขายไม่ถูกต้อง'))}state.role='supervisor';state.tab='overview';unlocked=true;form.reset();form.closest('dialog').close();render()}catch(err){$('#manager-access-status').textContent=err.message;form.querySelector('[name=password]').value='';form.querySelector('[name=password]').focus();button.disabled=false}return}
 if(e.target.id==='access-tech'){e.preventDefault();const form=e.target,button=form.querySelector('button');if(button.disabled)return;button.disabled=true;try{const f=new FormData(form),password=String(f.get('password')||''),raw=storedTechLock();if(!raw){if(password.length<12||password!==f.get('confirm'))throw Error(t('Use at least 12 characters and matching passwords.','ใช้รหัสผ่านอย่างน้อย 12 ตัวอักษรและให้ทั้งสองช่องตรงกัน'));const salt=Array.from(crypto.getRandomValues(new Uint8Array(16))),hash=await passwordHash(password,salt);localStorage.setItem(techAuthKey,JSON.stringify({version:1,salt,hash}))}else{const lock=JSON.parse(raw);if(lock.version!==1||await passwordHash(password,lock.salt)!==lock.hash)throw Error(t('Incorrect tech-team password.','รหัสผ่านทีมเทคนิคไม่ถูกต้อง'))}state.role='tech';state.tab='accessAdmin';unlocked=true;form.reset();form.closest('dialog').close();render()}catch(err){$('#tech-access-status').textContent=err.message;form.querySelector('[name=password]').value='';form.querySelector('[name=password]').focus();button.disabled=false}return}
 if(e.target.id!=='access-ceo')return;e.preventDefault();const form=e.target,button=form.querySelector('button');if(button.disabled)return;button.disabled=true;
 try{const f=new FormData(form),password=String(f.get('password')||''),raw=storedLock();if(!raw){if(password.length<12||password!==f.get('confirm'))throw Error(t('Use at least 12 characters and matching passwords.','ใช้รหัสผ่านอย่างน้อย 12 ตัวอักษรและให้ทั้งสองช่องตรงกัน'));const salt=Array.from(crypto.getRandomValues(new Uint8Array(16))),hash=await passwordHash(password,salt);localStorage.setItem(authKey,JSON.stringify({version:1,salt,hash}));}else{const lock=JSON.parse(raw);if(lock.version!==1||await passwordHash(password,lock.salt)!==lock.hash)throw Error(t('Incorrect management password.','รหัสผ่านผู้บริหารไม่ถูกต้อง'))}
 if(!form.isConnected)return;state.role='management';state.tab='overview';unlocked=true;form.reset();document.getElementById('ceo-dialog')?.close();render();
 }catch(err){const status=$('#access-status');if(status)status.textContent=err.message;form.querySelector('[name=password]').value='';form.querySelector('[name=password]').focus();button.disabled=false}
});


function normalizeStaffId(value){const id=String(value||'').trim().toUpperCase().replace(/^ID\s+/,'');return /^\d+$/.test(id)?id.replace(/^0+(?=\d)/,'').padStart(2,'0'):id}
function assignStaffIds(source){
 const used=new Set(source.salespeople.filter(p=>p.staffId).map(p=>normalizeStaffId(p.staffId)));let seq=1;
 return {...source,salespeople:source.salespeople.map(p=>{if(p.staffId)return {...p,staffId:normalizeStaffId(p.staffId)};let id=/^S\d+$/.test(p.id)?normalizeStaffId(p.id.slice(1)):'';if(!id||used.has(id)){while(used.has(String(seq).padStart(2,'0')))seq++;id=String(seq++).padStart(2,'0')}used.add(id);return {...p,staffId:id}})};
}

function activePeople(){return data.salespeople.filter(p=>!p.archived)} function activeProducts(){return data.products.filter(p=>!p.archived)} function activeCustomers(){return data.customers.filter(c=>!c.archived)}

function renderTheme(){
 document.documentElement.dataset.theme=theme;
 const host=document.getElementById('theme-switch');if(!host)return;
 host.setAttribute('aria-label',t('Colour theme','ธีมสี'));
 host.innerHTML=['light','dark'].map(v=>'<button type="button" data-theme-choice="'+v+'" aria-pressed="'+(theme===v)+'" class="'+(theme===v?'active':'')+'">'+t(v==='light'?'Light':'Dark',v==='light'?'สว่าง':'มืด')+'</button>').join('');
}

function renderRole(){
 if(!activePeople().some(p=>p.id===state.identity))state.identity=activePeople()[0]?.id||'';
 let host=document.getElementById('role-switch');if(!host){host=document.createElement('div');host.id='role-switch';host.className='role-switch';document.querySelector('.header-right').prepend(host)}
 const extra=state.role==='sales'?select(t('Salesperson (local selection)','พนักงานขาย (เลือกในเครื่อง)'),'view-identity',activePeople().map(p=>[p.id,name(p)]),state.identity):'<button class="account-exit" type="button" data-lock>'+t(state.role==='supervisor'?'Exit Supervisor view':'Exit Management mode',state.role==='supervisor'?'ออกจากมุมมองหัวหน้าฝ่ายขาย':'ออกจากโหมดผู้บริหาร')+'</button>';
 host.innerHTML=accountMenu(extra);
}
/* The header's single account control: current view, switch view, and exit.
   Language, theme and install stay in the settings (gear) menu. */
const roleChoices=()=>[['sales',t('Salesperson','พนักงานขาย')],['supervisor',t('Supervisor','หัวหน้าฝ่ายขาย')],['management',t('Management','ผู้บริหาร')],['tech',t('Tech Team','ทีมเทคนิค')]];
function accountMenu(extra){const current=roleChoices().find(([id])=>id===state.role)?.[1]||'';return '<details class="account-menu" id="account-menu"><summary aria-label="'+esc(t('View: ','มุมมอง: ')+current)+'"><span class="account-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.8-4 3.7-6 7.5-6s6.7 2 7.5 6"/></svg></span><span class="account-text"><small>'+t('View','มุมมอง')+'</small><strong>'+esc(current)+'</strong></span><span class="account-chevron" aria-hidden="true">▾</span></summary><div class="account-popover"><span class="account-heading">'+t('Switch view','เปลี่ยนมุมมอง')+'</span>'+roleChoices().map(([id,label])=>'<button type="button" class="account-role" data-view-role="'+id+'" aria-pressed="'+(state.role===id)+'">'+esc(label)+(state.role===id?'<span aria-hidden="true">✓</span>':'')+'</button>').join('')+'<hr>'+extra+'</div></details>'}
function requestRole(requested){
 if(requested==='management'&&state.role!=='management')renderAccess();
 else if(requested==='supervisor'&&state.role!=='supervisor')renderManagerAccess();
 else if(requested==='tech'&&state.role!=='tech')renderTechAccess();
 else if(requested==='sales'&&state.role!=='sales'){unlocked=false;state.role='sales';state.identity='';state.tab='mine';render()}
}
function entryNotice(){return '<p class="callout">'+t('Local privacy lock—not server-protected accounts. Data is stored in this browser, not shared across devices.','ล็อกเพื่อความเป็นส่วนตัวในเครื่อง ไม่ใช่บัญชีที่ป้องกันด้วยเซิร์ฟเวอร์ ข้อมูลบันทึกในเบราว์เซอร์นี้ ไม่แชร์ข้ามเครื่อง')+'</p>'}
function salesEntryForms(){
 if(!activePeople().length)return panel(t('Record sales','บันทึกยอดขาย'),'<p>'+t('Add or restore a salesperson first.','เพิ่มหรือคืนสถานะพนักงานก่อน')+'</p>');
 const template=document.createElement('template');template.innerHTML=legacyEntryForms();const form=template.content.querySelector('#sale-form');
 if(state.role==='sales'){const picker=form.querySelector('[name=salesperson]');picker.innerHTML=option(state.identity,name(data.salespeople.find(p=>p.id===state.identity)),state.identity);picker.disabled=true}
 return heading(t('Daily entry','บันทึกรายวัน'),t('Record sales','บันทึกยอดขาย'),t('One product line per entry. Saved automatically in this browser.','บันทึกทีละรายการสินค้า บันทึกอัตโนมัติในเบราว์เซอร์นี้'))+entryNotice()+panel(t('New sales entry','รายการขายใหม่'),form.outerHTML+'<p id="entry-status" role="status"></p>');
}
function peopleView(){
 if(state.role!=='management')return mySalesView();const template=document.createElement('template');template.innerHTML=legacyEntryForms();
 return '<section id="team-management"><h2>'+t('Manage salespeople','จัดการพนักงานขาย')+'</h2><p class="note">'+t('Removed people disappear from this list. Past sales remain in historical reports.','พนักงานที่นำออกจะไม่แสดงในรายชื่อนี้ ยอดขายเดิมยังคงอยู่ในรายงานย้อนหลัง')+'</p>'+panel(t('Add salesperson','เพิ่มพนักงานขาย'),template.content.querySelector('#person-form').outerHTML+'<p id="entry-status" role="status"></p>')+panel(t('Salespeople','พนักงานขาย'),table([t('ID','รหัส'),t('Name','ชื่อ'),t('Action','ดำเนินการ')],activePeople().map(p=>'<tr><td>ID '+esc(p.staffId)+'</td><td>'+esc(name(p))+'</td><td><button class="button secondary" data-person-toggle="'+esc(p.id)+'">'+t('Remove','นำออก')+'</button></td></tr>'))+'<p id="people-status" role="status"></p>')+'</section>';
}
function mySalesView(){if(data.demo)return heading(t('Salesperson workspace','พื้นที่พนักงานขาย'),t('Upload Express CSV first','นำเข้า CSV จาก Express ก่อน'),t('Company sales data is not available in this browser yet. Use salesperson access to open the Express files.','ยังไม่มีข้อมูลยอดขายบริษัทในเบราว์เซอร์นี้ ใช้ทางเข้าพนักงานขายเพื่อเปิดไฟล์ Express'))+panel(t('No company data loaded','ยังไม่มีข้อมูลบริษัท'),'<p class="empty">'+t('Sales results will appear here after the Express CSV import is complete.','ยอดขายจะแสดงที่นี่หลังนำเข้า CSV จาก Express สำเร็จ')+'</p>');
 if(!activePeople().length)return panel(t('My sales','ยอดขายของฉัน'),'<p>'+t('No active salespeople are available in the imported files.','ไม่พบพนักงานขายที่ใช้งานในไฟล์ที่นำเข้า')+'</p>');
 const limits=bounds();if(!validDay(state.mineFrom)||state.mineFrom<limits.from)state.mineFrom=limits.from;if(!validDay(state.mineTo)||state.mineTo>limits.to)state.mineTo=limits.to;if(state.mineFrom>state.mineTo){state.mineFrom=limits.from;state.mineTo=limits.to}
 const allRows=data.sales.filter(r=>r.salesperson===state.identity),dateRows=allRows.filter(r=>r.date>=state.mineFrom&&r.date<=state.mineTo),person=data.salespeople.find(p=>p.id===state.identity),labels=rangeBuckets(state.mineFrom,state.mineTo),values=labels.map(bucket=>E.sum(dateRows.filter(r=>bucket.length===10?r.date===bucket:r.date.startsWith(bucket)).map(r=>r.amount))),s=stats(dateRows);
 const customerIds=[...new Set(allRows.map(r=>r.customer))].sort(),skus=[...new Set(allRows.map(r=>r.sku))].sort(),query=state.mineSearch.trim().toLocaleLowerCase('th-TH');
 const listRows=dateRows.filter(r=>{const customer=byCustomer(r.customer),product=bySku(r.sku),matchesSearch=!query||[r.invoice,r.customer,customer.name,customer.th,r.sku,product.name,product.th].join(' ').toLocaleLowerCase('th-TH').includes(query);return matchesSearch&&(!state.mineCustomer||r.customer===state.mineCustomer)&&(!state.mineSku||r.sku===state.mineSku)});
 const dateControls=panel(t('Choose date range','เลือกช่วงวันที่'),'<div class="form-grid"><label>'+t('From date','จากวันที่')+'<input id="mineFrom" type="date" min="'+limits.from+'" max="'+limits.to+'" value="'+state.mineFrom+'"></label><label>'+t('To date','ถึงวันที่')+'<input id="mineTo" type="date" min="'+limits.from+'" max="'+limits.to+'" value="'+state.mineTo+'"></label></div><button class="button secondary" data-clear-mine-dates>'+t('Reset dates','ล้างช่วงวันที่')+'</button><p class="note">'+t('The selected dates update your totals, graph and sales list.','ช่วงวันที่ที่เลือกจะอัปเดตยอดรวม กราฟ และรายการขายของคุณ')+'</p>');
 const listControls='<div class="form-grid"><label class="mine-search">'+t('Search invoice, customer or product','ค้นหาใบกำกับ ลูกค้า หรือสินค้า')+'<input id="mineSearch" type="search" value="'+esc(state.mineSearch)+'" placeholder="'+t('Type to search','พิมพ์เพื่อค้นหา')+'" autocomplete="off"></label>'+select(t('Customer','ลูกค้า'),'mineCustomer',[['',t('All customers','ลูกค้าทั้งหมด')],...customerIds.map(id=>[id,byCustomer(id).name])],state.mineCustomer)+select(t('Product / SKU','สินค้า / SKU'),'mineSku',[['',t('All products','สินค้าทั้งหมด')],...skus.map(sku=>[sku,sku+' · '+name(bySku(sku))])],state.mineSku)+'</div><button class="button secondary" data-clear-mine-list>'+t('Clear search and list filters','ล้างการค้นหาและตัวกรองรายการ')+'</button>';
 const ownChart=chart(labels,[{name:t('My sales revenue','ยอดขายของฉัน'),values,color:colors[1]}],t('THB','บาท'));
 const rangeText=dateLabel(state.mineFrom)+' – '+dateLabel(state.mineTo),shown=listRows.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,100);
 return heading(t('Salesperson workspace','พื้นที่พนักงานขาย'),t('My sales','ยอดขายของฉัน')+' · '+name(person),t('Your imported sales only','เฉพาะยอดขายที่นำเข้าของคุณ'))+entryNotice()+kpis([[t('My sales','ยอดขายของฉัน'),money(s.sales),rangeText],[t('My invoices','ใบกำกับของฉัน'),num(s.invoices),rangeText],[t('My customers','ลูกค้าของฉัน'),num(s.customers),rangeText]]).replace('class="kpis"','class="kpis mine-kpis"')+dateControls+panel(t('My sales over time','กราฟยอดขายของฉัน'),ownChart,rangeText+' · '+t('only your records','เฉพาะข้อมูลของคุณ'))+panel(t('My sales list','รายการขายของฉัน')+' · '+num(listRows.length)+' '+t('matching lines','รายการที่ตรงกัน'),listControls+table([t('Date','วันที่'),t('Invoice','ใบกำกับ'),t('Customer','ลูกค้า'),t('Product','สินค้า'),t('Quantity','จำนวน'),t('Sales','ยอดขาย')],shown.map(r=>'<tr><td>'+dateLabel(r.date)+'</td><td>'+esc(r.invoice)+'</td><td>'+esc(byCustomer(r.customer).name)+'</td><td>'+esc(r.sku)+'</td><td>'+num(r.quantity)+' '+esc(unit(bySku(r.sku)))+'</td><td>'+money(r.amount)+'</td></tr>'))+'<p class="note">'+t('Showing up to 100 matching lines.','แสดงสูงสุด 100 รายการที่ตรงกัน')+'</p>');
}

function legacyEntryForms(){
 const field=(label,key,type='text',extra='')=>'<label>'+label+'<input name="'+key+'" type="'+type+'" required '+extra+'></label>';
 const pick=(label,key,items)=>'<label>'+label+'<select name="'+key+'" required>'+items.map(x=>option(x[0],x[1],'')).join('')+'</select></label>';
 return panel(t('Manage people & record sales','เพิ่มพนักงานและบันทึกยอดขาย'),'<p class="callout">'+t('Local entry only: choose a salesperson, not a secure login. Saved in this browser; use Download backup for safekeeping. Sample records remain fictional. New open-month entries appear in reports, but forecasts use closed months only.','บันทึกในเครื่องเท่านั้น: เลือกชื่อพนักงาน ไม่ใช่ระบบเข้าสู่ระบบ บันทึกในเบราว์เซอร์นี้ ควรดาวน์โหลดสำรอง ข้อมูลตัวอย่างยังเป็นข้อมูลสมมติ รายการเดือนที่ยังไม่ปิดจะแสดงในรายงาน แต่คาดการณ์ใช้เฉพาะเดือนที่ปิดแล้ว')+'</p><div class="grid"><form id="person-form"><h3>'+t('Add salesperson','เพิ่มพนักงานขาย')+'</h3>'+field(t('Name','ชื่อ'),'name','text','maxlength="100"')+field(t('Salesperson ID','รหัสพนักงานขาย'),'staffId','text','maxlength="23" placeholder="ID 05"')+'<button type="submit" class="button">'+t('Add salesperson','เพิ่มพนักงานขาย')+'</button></form><form id="sale-form"><h3>'+t('Record daily sales · one product line','บันทึกยอดขายรายวัน · หนึ่งรายการสินค้า')+'</h3><div class="form-grid">'+field(t('Date','วันที่'),'date','date','min="'+bounds().from+'" max="'+new Date().toLocaleDateString('en-CA')+'" value="'+state.to+'"')+pick(t('Salesperson','พนักงานขาย'),'salesperson',activePeople().map(p=>[p.id,name(p)]))+field(t('Invoice number','เลขที่ใบกำกับ'),'invoice','text','maxlength="80"')+pick(t('Customer','ลูกค้า'),'customer',activeCustomers().map(c=>[c.id,c.name]))+pick(t('Product / unit','สินค้า / หน่วย'),'sku',activeProducts().map(p=>[p.sku,p.sku+' · '+name(p)+' ('+unit(p)+')']))+field(t('Quantity','จำนวน'),'quantity','number','min="0.001" step="0.001"')+field(t('Line sales amount (THB)','ยอดขายรายการนี้ (บาท)'),'amount','number','min="0" step="0.01"')+'</div><p class="note">'+t('Enter the total for this product line, not the whole invoice. Repeat the invoice number for different products. Existing invoice headers must match.','กรอกยอดรวมของรายการสินค้านี้ ไม่ใช่ทั้งใบกำกับ ใช้เลขเดิมสำหรับสินค้าอื่นในใบเดียวกัน ข้อมูลหัวใบกำกับต้องตรงกัน')+'</p><button class="button" type="submit">'+t('Save sales entry','บันทึกรายการขาย')+'</button></form></div><p id="entry-status" role="status"></p><button class="button secondary" data-action="backup">'+t('Download backup','ดาวน์โหลดสำรอง')+'</button>');
}
document.addEventListener('submit',e=>{
 const formId=e.target.getAttribute('id');if(!['product-form','customer-form'].includes(formId))return;e.preventDefault();
 const f=new FormData(e.target),get=k=>String(f.get(k)||'').trim();
 try{
  if(!unlocked)throw Error(t('Unlock a view first.','โปรดปลดล็อกมุมมองก่อน'));
  let next;
  if(formId==='product-form'){
   const sku=get('sku').toUpperCase(),productName=get('name'),groupKey=$('#new-product-group')?.value,source=data.products.find(p=>p.group===groupKey),stockDate=get('stockDate'),leadDays=Number(get('leadDays')),pack=Number(get('pack')),onHand=Number(get('onHand'));
   if(!/^[A-Z0-9][A-Z0-9._-]{1,29}$/.test(sku))throw Error(t('Use a 2–30 character SKU with letters, numbers, dots, underscores or hyphens.','ใช้ SKU 2–30 ตัวอักษร โดยใช้ตัวอักษรอังกฤษ ตัวเลข จุด ขีดล่าง หรือขีดกลาง'));
   if(data.products.some(p=>p.sku.toUpperCase()===sku))throw Error(t('This SKU already exists.','มี SKU นี้แล้ว'));
   if(!productName||!source||!validDay(stockDate)||!Number.isInteger(leadDays)||leadDays<0||leadDays>365||!Number.isFinite(pack)||pack<=0||!Number.isFinite(onHand)||onHand<0)throw Error(t('Complete every required product specification with valid values.','กรอกข้อมูลจำเพาะสินค้าที่จำเป็นให้ครบและถูกต้อง'));
   const product={sku,name:productName,th:get('th')||productName,group:source.group,groupTh:source.groupTh,unit:get('unit'),unitTh:get('unitTh'),base:0,price:0,leadDays,pack,onHand,committed:0,inbound:0,stockDate,inboundDue:null};
   next={...data,products:[...data.products,product]};
  }else{
   const id=get('id').toUpperCase(),customerName=get('name'),segment=$('#new-customer-segment')?.value,source=data.customers.find(c=>c.segment===segment);
   if(!/^[A-Z0-9][A-Z0-9._-]{1,29}$/.test(id))throw Error(t('Use a 2–30 character customer ID with letters, numbers, dots, underscores or hyphens.','ใช้รหัสลูกค้า 2–30 ตัวอักษร โดยใช้ตัวอักษรอังกฤษ ตัวเลข จุด ขีดล่าง หรือขีดกลาง'));
   if(data.customers.some(c=>c.id.toUpperCase()===id))throw Error(t('This customer ID already exists.','มีรหัสลูกค้านี้แล้ว'));
   if(!customerName||!source)throw Error(t('Enter a customer name and group.','กรอกชื่อลูกค้าและกลุ่มลูกค้า'));
   next={...data,customers:[...data.customers,{id,name:customerName,segment:source.segment,segmentTh:source.segmentTh}]};
  }
  E.validate(next);localStorage.setItem('monthly-forecast-entry-v1',JSON.stringify(next));data=next;render();
  const status=formId==='product-form'?$('#product-status'):$('#customer-status');if(status)status.textContent=t('Added and saved in this browser. It is now available in Record sales.','เพิ่มและบันทึกในเบราว์เซอร์แล้ว พร้อมเลือกในหน้าบันทึกยอดขาย');
 }catch(err){const status=formId==='product-form'?$('#product-status'):$('#customer-status');if(status)status.textContent=t('Not saved: ','ไม่ได้บันทึก: ')+err.message}
});
document.addEventListener('submit',e=>{
 if(!['person-form','sale-form'].includes(e.target.id))return;e.preventDefault();const f=new FormData(e.target),get=k=>String(f.get(k)||'').trim();let next,personId;
 try{
 if(!unlocked)throw Error('Locked');
 if(e.target.id==='person-form'){
 if(state.role!=='management')throw Error(t('Management view required.','ต้องใช้มุมมองผู้บริหาร'));
 const en=get('name'),th=en,staffId=normalizeStaffId(get('staffId'));if(!en||! /^[A-Z0-9-]{1,20}$/.test(staffId))throw Error(t('Enter a name and an ID using letters, numbers or hyphens.','กรอกชื่อและรหัสโดยใช้ตัวอักษรอังกฤษ ตัวเลข หรือขีดกลาง'));if(data.salespeople.some(p=>normalizeStaffId(p.staffId)===staffId))throw Error(t('This ID is already assigned, including removed people. Choose another ID.','รหัสนี้ถูกใช้แล้ว รวมถึงพนักงานที่นำออก เลือกรหัสอื่น'));
 if(activePeople().some(p=>p.name.toLowerCase()===en.toLowerCase()||p.th===th))throw Error(t('This salesperson already exists.','มีพนักงานชื่อนี้แล้ว'));
 personId='S-'+crypto.randomUUID();next={...data,salespeople:[...data.salespeople,{id:personId,name:en,th,staffId}]};
 }else{
 const date=get('date'),invoice=get('invoice'),sku=get('sku');
 if(!validDay(date)||date<bounds().from||date>new Date().toLocaleDateString('en-CA'))throw Error(t('Choose a valid date, no later than today.','เลือกวันที่ที่ถูกต้องและไม่เกินวันนี้'));
 if(!invoice||Number(get('quantity'))<=0)throw Error(t('Enter an invoice and positive quantity.','กรอกเลขใบกำกับและจำนวนมากกว่าศูนย์'));
 if(data.sales.some(r=>r.invoice===invoice&&r.sku===sku))throw Error(t('This invoice/product already exists; no duplicate was saved.','มีใบกำกับและสินค้านี้แล้ว ไม่ได้บันทึกซ้ำ'));
 if(!activeProducts().some(p=>p.sku===sku)||!activeCustomers().some(c=>c.id===get('customer')))throw Error(t('Select an active product and customer.','เลือกสินค้าและลูกค้าที่ยังใช้งาน'));  if(!activePeople().some(p=>p.id===(state.role==='sales'?state.identity:get('salesperson'))))throw Error(t('Select an active salesperson.','เลือกพนักงานที่ยังใช้งาน'));
 const r={id:'ENTRY-'+crypto.randomUUID(),invoice,date,sku,customer:get('customer'),salesperson:state.role==='sales'?state.identity:get('salesperson'),quantity:Number(get('quantity')),amount:Number(get('amount'))};
 next={...data,sales:[...data.sales,r]};
 }
 E.validate(next);
 // Persist first: if storage fails, keep both the old dataset and the form.
 localStorage.setItem('monthly-forecast-entry-v1',JSON.stringify(next));data=next;
 if(personId)state.team.add(personId);else{state.from=get('date');state.to=get('date');state.person=state.role==='sales'?state.identity:get('salesperson');state.group='';state.segment='';state.team.add(state.person)}
 render();$('#entry-status').textContent=t('Saved on this browser. Download a backup to keep another copy.','บันทึกในเบราว์เซอร์แล้ว ดาวน์โหลดสำรองเพื่อเก็บอีกชุด');
 }catch(err){$('#entry-status').textContent=t('Not saved: ','ไม่ได้บันทึก: ')+err.message}
});

function teamPointComparison(series) {
  const available = new Set(series.map(line => line.key));
  const selected = state.compare.map(key => {
    const split = key.indexOf('|'), personId = split > 0 ? key.slice(0, split) : '', bucket = split > 0 ? key.slice(split + 1) : '';
    if (!available.has(personId)) return null;
    const person = data.salespeople.find(item => item.id === personId), line = series.find(item => item.key === personId), index = reportBuckets().indexOf(bucket);
    if (!person || !line || index < 0) return null;
    return { key, person, bucket, value: line.values[index] };
  }).filter(Boolean);
  const reset = '<button class="button secondary" data-clear-compare>' + t('Clear comparison', 'ล้างการเปรียบเทียบ') + '</button>';
  if (selected.length < 2) return '<div class="comparison-box" aria-live="polite"><p>' + t('Click any two salesperson dots to compare them. They may be from different people or different dates.', 'คลิกจุดของพนักงานขายสองจุดเพื่อเปรียบเทียบ เลือกต่างคนหรือต่างวันที่ได้') + '</p>' + (selected.length ? '<strong>' + esc(name(selected[0].person)) + ' · ' + bucketLabel(selected[0].bucket) + ' · ' + money(selected[0].value) + '</strong> ' + reset : '') + '</div>';
  const first = selected[0], second = selected[1], difference = second.value - first.value, change = first.value ? difference / first.value : null;
  return '<div class="comparison-box" aria-live="polite"><div class="compare-values"><span><small>' + esc(name(first.person)) + ' · ' + bucketLabel(first.bucket) + '</small><strong>' + money(first.value) + '</strong></span><span><small>' + esc(name(second.person)) + ' · ' + bucketLabel(second.bucket) + '</small><strong>' + money(second.value) + '</strong></span></div><p><strong>' + t(difference > 0 ? 'Higher' : difference < 0 ? 'Lower' : 'No difference', difference > 0 ? 'สูงกว่า' : difference < 0 ? 'ต่ำกว่า' : 'ไม่ต่างกัน') + ': ' + money(Math.abs(difference)) + '</strong> · ' + (change === null ? t('Percentage unavailable: first value is zero.', 'คำนวณเปอร์เซ็นต์ไม่ได้: ค่าแรกเป็นศูนย์') : (change > 0 ? '+' : '') + pct(change)) + '</p><small>' + t('Second selected dot minus the first selected dot.', 'จุดที่เลือกจุดที่สองลบด้วยจุดแรก') + '</small>' + reset + '</div>';
}
function teamViewBase() {
  const ms = reportBuckets(), rows = filtered();
  /* One pass over the rows instead of one filtered() scan per person per bucket
     (the full 9-month default made that ~390 ms). Rows are added in the same
     order as before, so every sum is identical. */
  const daily = ms[0]?.length === 10, bucketSums = new Map();
  for (const row of rows) { const key = row.salesperson + '|' + (daily ? row.date : row.date.slice(0, 7)); bucketSums.set(key, (bucketSums.get(key) || 0) + row.amount); }
  const series = activePeople().filter(person => state.team.has(person.id)).map(person => ({ key: person.id, name: name(person), color: personColor(person.id), values: ms.map(bucket => bucketSums.get(person.id + '|' + bucket) || 0) }));
  const averageValues = ms.map((_, index) => series.length ? E.avg(series.map(line => line.values[index])) : null);
  const averageOverall = averageValues.length ? E.avg(averageValues.filter(Number.isFinite)) : 0;
  const chartSeries = series.length ? [...series, { key: 'selected-team-average', name: t('Average per selected person', 'ค่าเฉลี่ยต่อคน (คนที่เลือก)'), color: 'var(--series-average)', values: averageValues, dashed: true, noPoints: true }] : series;
  return heading(t('Sales Team', 'ทีมขาย'), t('Compare your salespeople', 'เปรียบเทียบพนักงานขาย'), t('Select names, then click any two graph dots to compare exact results.', 'เลือกชื่อ แล้วคลิกจุดกราฟสองจุดเพื่อเปรียบเทียบผลลัพธ์ที่แน่นอน')) + (state.person ? '<p class="note team-filter-note">' + t('The salesperson filter from other pages is not used here. Tick names below to choose who to compare.', 'หน้านี้ไม่ใช้ตัวกรองพนักงานขายจากหน้าอื่น ติ๊กชื่อด้านล่างเพื่อเลือกคนที่ต้องการเปรียบเทียบ') + '</p>' : '') + panel(t('Sales comparison over selected dates', 'เปรียบเทียบยอดขายตามวันที่เลือก'), `<div class="options team-chips">${activePeople().map(person => `<label data-team-chip="${esc(person.id)}"><input type="checkbox" data-team="${esc(person.id)}" ${state.team.has(person.id) ? 'checked' : ''}><i class="dot" style="background:${personColor(person.id)}"></i>${esc(name(person))}</label>`).join('')}</div>${series.length ? `<div class="team-average-summary"><span>${ms[0]?.length === 10 ? t('Average per person per day', 'ค่าเฉลี่ยต่อคนต่อวัน') : t('Average per person per month', 'ค่าเฉลี่ยต่อคนต่อเดือน')} <small>(${num(series.length)} ${t('people ticked', 'คนที่เลือก')})</small></span><strong>${money(averageOverall)}</strong></div>` : ''}<p class="team-chart-key"><span class="key-dash" aria-hidden="true"></span>${t('Dashed line = average per selected person', 'เส้นประ = ค่าเฉลี่ยต่อคนของคนที่เลือก')} · ${t('Axis in baht', 'แกนหน่วยบาท')} · ${t('Point at a name to highlight that line', 'ชี้หรือแตะชื่อเพื่อเน้นเส้นของคนนั้น')}</p>${chart(ms, chartSeries, 'THB', { compare: true, seriesCompare: true, legend: false })}${teamPointComparison(series)}`) + panel(t('Sales by salesperson and month (thousand baht)', 'ยอดขายพนักงาน × เดือน (บาท)'), monthRevenueHeatmap(t('Salesperson', 'พนักงานขาย'), row => row.salesperson, id => name(data.salespeople.find(person => person.id === id) || { name: id }), activePeople().filter(person => state.team.has(person.id)).map(person => person.id), false)) + panel(t('Selected-period performance', 'ผลงานในช่วงวันที่เลือก'), table([t('Salesperson', 'พนักงานขาย'), t('Sales revenue', 'ยอดขาย'), t('Invoices', 'ใบกำกับ'), t('Customers', 'ลูกค้า'), t('Average invoice', 'ยอดเฉลี่ยต่อใบกำกับ')], group(rows, row => row.salesperson).filter(grouped => state.team.has(grouped.key)).map(grouped => `<tr><td>${esc(name(data.salespeople.find(person => person.id === grouped.key)))}</td><td>${money(grouped.sales)}</td><td>${num(grouped.invoices)}</td><td>${num(grouped.customers)}</td><td>${money(grouped.average)}</td></tr>`)));
}
function customersView(){
 const base=filtered().filter(r=>(!state.customerSku||r.sku===state.customerSku)&&(!state.customerPerson||r.salesperson===state.customerPerson));
 const companies=group(base,r=>r.customer),total=stats(base).sales,chosen=companies.find(g=>g.key===state.customerSelected);
 const query=state.customerSearch.trim().toLocaleLowerCase('th-TH'),rows=base.filter(r=>{const c=byCustomer(r.customer),matchesCompany=!state.customerSelected||r.customer===state.customerSelected,matchesSearch=!query||[c.id,c.name,c.th].join(' ').toLocaleLowerCase('th-TH').includes(query);return matchesCompany&&matchesSearch});
 const customerGroups=group(rows,r=>r.customer);
 const pageSize=10,pageCount=Math.max(1,Math.ceil(customerGroups.length/pageSize)),customerPage=Math.min(Math.max(0,Number(state.customerPage)||0),pageCount-1),pageGroups=customerGroups.slice(customerPage*pageSize,(customerPage+1)*pageSize);
 state.customerPage=customerPage;
 const controls='<label>'+t('Search customer name or ID','ค้นหาชื่อลูกค้าหรือรหัส')+'<input id="customerSearch" type="search" value="'+esc(state.customerSearch)+'" placeholder="'+t('Type a customer name or ID','พิมพ์ชื่อลูกค้าหรือรหัส')+'" autocomplete="off"></label><div class="form-grid" id="customer-list-filters">'+select(t('Product / SKU','สินค้า / SKU'),'customerSku',[['',t('All SKUs','ทุก SKU')],...data.products.map(p=>[p.sku,p.sku+' · '+name(p)])],state.customerSku)+select(t('Salesperson','พนักงานขาย'),'customerPerson',[['',t('All salespeople','พนักงานขายทั้งหมด')],...data.salespeople.map(p=>[p.id,'ID '+p.staffId+' · '+name(p)])],state.customerPerson)+'</div><button class="button secondary" data-clear-customer>'+t('Clear list filters','ล้างตัวกรองรายชื่อ')+'</button><p class="note">'+t('These filters refine the date range and filters above. SKU sales include matching product lines only.','ตัวกรองนี้ใช้ร่วมกับช่วงวันที่และตัวกรองด้านบน ยอดขายตาม SKU นับเฉพาะรายการสินค้าที่ตรงกัน')+'</p>';
 const chart=customerCompanyPie(companies,total)+(chosen?'<div class="callout" id="customer-company-details" aria-live="polite"><strong>'+esc(byCustomer(chosen.key).name)+'</strong><p>'+money(chosen.sales)+' · '+(total?pct(chosen.sales/total):'—')+' '+t('of displayed customer sales','ของยอดขายลูกค้าที่แสดง')+'</p><p>'+t('Average invoice','ยอดเฉลี่ยต่อใบกำกับ')+': '+money(chosen.average)+'</p></div>':'');
 const pagination=customerGroups.length?'<div class="customer-pagination"><button class="button secondary" data-customer-page="-1" '+(customerPage===0?'disabled':'')+'>'+t('Previous','ก่อนหน้า')+'</button><span>'+t('Page','หน้า')+' '+num(customerPage+1)+' / '+num(pageCount)+' · '+num(customerGroups.length)+' '+t('companies','บริษัท')+'</span><button class="button secondary" data-customer-page="1" '+(customerPage>=pageCount-1?'disabled':'')+'>'+t('Next','ถัดไป')+'</button></div>':'';
 return heading(t('Customer view','มุมมองลูกค้า'),t('Customers and their sales relationships','ลูกค้าและความสัมพันธ์กับทีมขาย'),t('Compare buying companies and filter the customer ranking.','เปรียบเทียบบริษัทลูกค้าและกรองอันดับลูกค้า'))+panel(t('Sales by customer company','ยอดขายตามบริษัทลูกค้า'),chart)+panel(t('All customer companies','บริษัทลูกค้าทั้งหมด'),controls+'<p class="note"><strong>'+num(customerGroups.length)+'</strong> '+t('matching companies','บริษัทที่ตรงกับตัวกรอง')+'</p><div id="customer-ranking" class="all-customer-table">'+(rows.length?table([t('Customer','ลูกค้า'),t('Sales revenue','ยอดขาย'),t('Invoices','ใบกำกับ'),t('Salespeople','พนักงานขาย')],pageGroups.map(g=>{const c=byCustomer(g.key);return '<tr><td>'+esc(c.name)+'<small>'+esc(c.id)+'</small></td><td>'+money(g.sales)+'</td><td>'+num(g.invoices)+'</td><td>'+esc([...new Set(g.rows.map(r=>r.salesperson))].map(id=>name(data.salespeople.find(p=>p.id===id))).join(', '))+'</td></tr>'})):'<p class="empty">'+t('No customers match these filters. Clear list filters or adjust the filters above.','ไม่มีลูกค้าที่ตรงกับตัวกรอง ล้างตัวกรองรายชื่อหรือปรับตัวกรองด้านบน')+'</p>')+pagination+'</div>');
}


function inventoryReady(){return !!data.inventoryImport&&data.products.some(p=>p.inventoryImported)}
function modelGrade(error){return error===null?['warn',t('Not enough validation data','ข้อมูลตรวจสอบยังไม่พอ')]:error<=.10?['good',t('Within 10% target','อยู่ในเป้าหมาย 10%')]:error<=.15?['warn',t('Review · within 15% tolerance','ควรทบทวน · ยังอยู่ในเกณฑ์ 15%')]:['bad',t('Above 15% tolerance','เกินเกณฑ์ 15%')]}
function actionCentre(){
 const items=[],fc=totalSalesForecast(),grade=modelGrade(fc.error),unresolved=data.importSummary?.unresolvedRows?.length||0;
 items.push({tone:grade[0],title:t('Forecast reliability','ความน่าเชื่อถือของการคาดการณ์'),body:(fc.error===null?'—':pct(fc.error))+' · '+grade[1]});
 const ops=data.operations||[],today=new Date().toLocaleDateString('en-CA'),overdue=ops.filter(r=>r.dueDate&&r.dueDate<today&&!['delivered','cancelled'].includes(r.statusKey)).length;
 items.push({tone:!ops.length?'warn':overdue?'bad':'good',title:t('Production & delivery','การผลิตและจัดส่ง'),body:!ops.length?t('Waiting for the operations CSV.','รอไฟล์ CSV งานผลิตและจัดส่ง'):num(overdue)+' '+t('overdue open orders','งานเปิดที่เกินกำหนด')});
 if(unresolved)items.push({tone:'bad',title:t('Import rows requiring review','แถวนำเข้าที่ต้องตรวจสอบ'),body:num(unresolved)+' '+t('rows were not resolved during Express import.','แถวไม่สามารถจับคู่ได้ตอนนำเข้า Express')});
 return panel(state.role==='supervisor'?t('Supervisor action centre','ศูนย์ติดตามสำหรับหัวหน้าฝ่ายขาย'):t('Management action centre','ศูนย์ติดตามสำหรับผู้บริหาร'),'<div class="action-grid">'+items.map(x=>'<div class="action-item '+x.tone+'"><strong>'+esc(x.title)+'</strong><span>'+esc(x.body)+'</span></div>').join('')+'</div><p class="note">'+t('Alerts are calculated from the files loaded in this browser; verify source completeness before acting.','การแจ้งเตือนคำนวณจากไฟล์ที่โหลดในเบราว์เซอร์นี้ โปรดตรวจสอบความครบถ้วนก่อนตัดสินใจ')+'</p>');
}
function overview(){return overviewBase()}
function forecastReliabilityPanel() {
  const fc = totalSalesForecast('auto', 1);
  const components = fc.components;
  const grade = modelGrade(fc.error);
  return panel(t('Consumption forecast validation', 'การตรวจสอบการคาดการณ์อัตราการใช้'), '<p class="note">' + t('This is one auditable forecast model, not a contest between unrelated methods. It is retested month by month as more Express history is imported.', 'นี่คือแบบจำลองคาดการณ์ที่ตรวจสอบย้อนกลับได้หนึ่งแบบ ไม่ใช่การแข่งขันระหว่างวิธีที่ไม่เกี่ยวข้อง ระบบจะทดสอบใหม่ทีละเดือนเมื่อมีประวัติ Express เพิ่มขึ้น') + '</p>' + table([t('Method', 'วิธี'), t('Monthly rate', 'อัตรารายเดือน'), t('Seasonal index', 'ดัชนีฤดูกาล'), t('Recent-change factor', 'ตัวคูณการเปลี่ยนแปลงล่าสุด'), t('WAPE', 'WAPE'), t('Status', 'สถานะ')], ['<tr><td><strong>' + esc(forecastMethodLabel(fc.method)) + '</strong></td><td>' + money(components.rate) + '</td><td>' + num(components.seasonalIndex, 3) + '</td><td>' + num(components.trendFactor, 3) + '</td><td>' + (fc.error === null ? '—' : pct(fc.error)) + '</td><td><span class="score-badge ' + grade[0] + '">' + esc(grade[1]) + '</span></td></tr>']) + (!components.annualSeasonality ? '<p class="warning">' + t('The current files contain fewer than one prior matching calendar month for the next forecast month. The model therefore uses a neutral annual seasonal index and relies on the measured recent monthly change. Importing at least 12–24 months will activate stronger calendar-month seasonality.', 'ไฟล์ปัจจุบันยังไม่มีเดือนปฏิทินเดียวกันย้อนหลังสำหรับเดือนที่จะคาดการณ์ แบบจำลองจึงใช้ดัชนีฤดูกาลรายปีแบบกลางและอาศัยการเปลี่ยนแปลงรายเดือนล่าสุด การนำเข้าประวัติอย่างน้อย 12–24 เดือนจะทำให้ฤดูกาลตามเดือนปฏิทินทำงานได้ชัดขึ้น') + '</p>' : ''));
}
function forecastView(){return groupForecastPanel()+bestSellersPanel()+forecastViewBase()+forecastReliabilityPanel()}
function salespersonCustomerMatrix(){
 const rows=filtered(),segments=[...new Map(data.customers.map(c=>[c.segment,state.lang==='th'?c.segmentTh:c.segment]))],people=activePeople(),showSegments=segments.length>1;
 const body=people.map(p=>{const own=rows.filter(r=>r.salesperson===p.id),s=stats(own);return '<tr><td><strong>'+esc(name(p))+'</strong><small>'+num(s.invoices)+' '+t('invoices','ใบกำกับ')+' · '+t('avg','เฉลี่ย')+' '+money(s.average)+'</small></td>'+(showSegments?segments.map(([key])=>'<td>'+money(E.sum(own.filter(r=>byCustomer(r.customer).segment===key).map(r=>r.amount)))+'</td>').join(''):'')+'<td><strong>'+money(s.sales)+'</strong></td></tr>'}).join('');
 const note=showSegments?t('Use this relationship view to see which customer groups each salesperson serves and where average invoice value can improve.','ใช้มุมมองความสัมพันธ์นี้เพื่อดูว่าพนักงานแต่ละคนดูแลลูกค้ากลุ่มใด และจุดใดควรเพิ่มยอดเฉลี่ยต่อบิล'):t('Express currently supplies one generic customer group, so this table shows each salesperson total only.','ข้อมูล Express ปัจจุบันมีกลุ่มลูกค้าทั่วไปเพียงกลุ่มเดียว ตารางนี้จึงแสดงเฉพาะยอดรวมของพนักงานแต่ละคน');
 return panel(t('Salesperson × customer-group matrix','เมทริกซ์พนักงานขาย × กลุ่มลูกค้า'),'<p class="note">'+note+'</p><div class="table-wrap matrix-table"><table><thead><tr><th>'+t('Salesperson','พนักงานขาย')+'</th>'+(showSegments?segments.map(x=>'<th>'+esc(x[1])+'</th>').join(''):'')+'<th>'+t('Total','รวม')+'</th></tr></thead><tbody>'+body+'</tbody></table></div>');
}
function salespersonGroupMatrix(){
 const rows=filtered(),groups=[...new Map(data.products.map(p=>[p.group,state.lang==='th'?p.groupTh:p.group]))].sort((a,b)=>E.sum(rows.filter(r=>bySku(r.sku).group===b[0]).map(r=>r.amount))-E.sum(rows.filter(r=>bySku(r.sku).group===a[0]).map(r=>r.amount))),people=activePeople(),showGroups=groups.length>1;
 const note=t('Product groups the salesperson sells, alongside the customer-group matrix above. Columns are ordered by total revenue in the selected dates. Darker means more revenue.','กลุ่มสินค้าที่พนักงานแต่ละคนขาย คู่กับเมทริกซ์กลุ่มลูกค้าด้านบน คอลัมน์เรียงตามยอดขายรวมในช่วงวันที่เลือก สีเข้มหมายถึงยอดขายสูงกว่า');
 if(!showGroups)return panel(t('Salesperson × product-group matrix','เมทริกซ์พนักงานขาย × กลุ่มสินค้า'),'<p class="note">'+note+'</p><p class="empty">'+t('Not enough product groups to compare.','กลุ่มสินค้ามีไม่พอให้เปรียบเทียบ')+'</p>');
 const cellsByPerson=people.map(p=>{const own=rows.filter(r=>r.salesperson===p.id);return groups.map(([key,label])=>{const value=E.sum(own.filter(r=>bySku(r.sku).group===key).map(r=>r.amount));return {value,tip:name(p)+' · '+label+' · '+money(value)}})});
 const max=Math.max(1,...cellsByPerson.flat().map(c=>c.value));
 const heatRows=people.map((p,i)=>({label:name(p),cells:cellsByPerson[i].map(c=>({...c,short:heatShort(c.value)}))}));
 const heatmap=heatmapTable(t('Salesperson','พนักงานขาย'),groups.map(g=>g[1]),heatRows,max)+heatmapScaleLegend(t('No sales','ไม่มียอดขาย'),money(max));
 const body=people.map(p=>{const own=rows.filter(r=>r.salesperson===p.id),s=stats(own);return '<tr><td><strong>'+esc(name(p))+'</strong><small>'+num(s.invoices)+' '+t('invoices','ใบกำกับ')+' · '+t('avg','เฉลี่ย')+' '+money(s.average)+'</small></td>'+groups.map(([key])=>'<td>'+money(E.sum(own.filter(r=>bySku(r.sku).group===key).map(r=>r.amount)))+'</td>').join('')+'<td><strong>'+money(s.sales)+'</strong></td></tr>'}).join('');
 const detailTable='<div class="table-wrap matrix-table"><table><thead><tr><th>'+t('Salesperson','พนักงานขาย')+'</th>'+groups.map(x=>'<th>'+esc(x[1])+'</th>').join('')+'<th>'+t('Total','รวม')+'</th></tr></thead><tbody>'+body+'</tbody></table></div>';
 return panel(t('Salesperson × product-group matrix','เมทริกซ์พนักงานขาย × กลุ่มสินค้า'),'<p class="note">'+note+'</p>'+heatmap+'<details class="chart-summary-toggle"><summary>'+t('View detailed table','ดูตารางแบบละเอียด')+'</summary>'+detailTable+'</details>');
}
function teamView(){return teamViewBase()+salespersonCustomerMatrix()+salespersonGroupMatrix()}
function seasonalityIndex(product){const hist=E.history(data,product.sku),target=Number(E.shiftMonth(data.completeThrough,1).slice(5)),same=hist.filter(r=>Number(r.month.slice(5))===target).map(r=>r.value),all=hist.map(r=>r.value),mean=E.avg(all);return same.length&&mean?E.avg(same)/mean:null}
function inventoryView(){
 const ready=inventoryReady(),importedProducts=data.products.filter(p=>p.inventoryImported),plans=importedProducts.map(p=>{const fc=E.forecast(data,p.sku,'auto',state.factor),pl=E.plan(p,fc,state.review,state.buffer);return {p,fc,pl,index:seasonalityIndex(p)}}),valid=plans.filter(x=>x.pl),short=valid.filter(x=>['out','low'].includes(x.pl.status)).length,excess=valid.filter(x=>x.pl.status==='excess').length,orderTotal=E.sum(valid.filter(x=>!x.pl.stale).map(x=>x.pl.quantity)),missing=data.products.length-importedProducts.length;
 const importControls=state.role==='management'?'<div class="file-actions"><label>'+t('Choose stock CSV','เลือกไฟล์ CSV สต็อก')+'<input id="stock-file" type="file" accept=".csv,text/csv"></label><button class="button secondary" data-action="stock-template">'+t('Download stock template','ดาวน์โหลดแบบฟอร์มสต็อก')+'</button></div><p id="stock-import-status" role="status" class="note"></p>':'<p class="callout">'+t('Ask a management user to import or replace the verified stock snapshot.','ให้ผู้บริหารเป็นผู้นำเข้าหรือแทนที่ยอดสต็อกที่ตรวจสอบแล้ว')+'</p>';
 const upload=panel(t('Inventory data source','แหล่งข้อมูลสินค้าคงคลัง'),'<div class="source-status '+(ready?'ready':'')+'"><i></i><strong>'+t(ready?'Stock snapshot loaded':'Waiting for stock snapshot CSV',ready?'นำเข้ายอดสต็อกแล้ว':'รอไฟล์ CSV ยอดสต็อก')+(ready?' · '+num(importedProducts.length)+' / '+num(data.products.length)+' '+t('SKUs matched','SKU ที่ตรงกัน'):'')+'</strong></div><p class="note">'+t('Required columns: sku, express_stock, physical_count, committed, incoming, incoming_due, stock_date, lead_days and pack_size. Physical count becomes the planning stock when supplied.','คอลัมน์ที่ต้องใช้: sku, express_stock, physical_count, committed, incoming, incoming_due, stock_date, lead_days และ pack_size หากมี physical_count ระบบจะใช้เป็นยอดสำหรับวางแผน')+'</p>'+importControls+(missing?'<p class="warning">'+num(missing)+' '+t('products have no stock row and are excluded from every stock calculation.','สินค้ายังไม่มีแถวสต็อกและจะไม่ถูกนำไปคำนวณสต็อก')+'</p>':''));
 if(!ready)return heading(t('Inventory intelligence','ข้อมูลเชิงลึกสินค้าคงคลัง'),t('Forecast demand without guessing stock','คาดการณ์ความต้องการโดยไม่เดายอดสต็อก'),t('Load a verified stock snapshot to activate shortage, excess and replenishment calculations.','นำเข้ายอดสต็อกที่ตรวจสอบแล้วเพื่อเปิดการคำนวณขาดสต็อก สต็อกเกิน และการเติมสินค้า'))+upload;
 const rows=plans.map(({p,fc,pl,index})=>'<tr><td><strong>'+esc(p.sku)+'</strong><small>'+esc(name(p))+'</small></td><td>'+num(p.onHand,2)+'</td><td>'+num(p.expressStock??p.onHand,2)+'</td><td>'+num(p.physicalCount??null,2)+'</td><td>'+num((p.physicalCount??p.onHand)-(p.expressStock??p.onHand),2)+'</td><td>'+num(fc.base,2)+' '+esc(unit(p))+'</td><td>'+(index===null?'—':num(index,2)+'×')+'</td><td>'+num(pl?.cover??null,1)+'</td><td>'+(pl?statusBadge(pl.status):'—')+'</td><td><strong>'+(!pl||pl.stale?'—':num(pl.quantity,2))+'</strong></td></tr>');
 return heading(t('Inventory intelligence','ข้อมูลเชิงลึกสินค้าคงคลัง'),t('Replenish the right products','เติมสินค้าให้ตรงกับความต้องการ'),t('Monthly SKU demand, lead time, safety stock and physical-count differences are combined into one review.','รวมความต้องการรายเดือน ระยะเวลารอ สต็อกสำรอง และส่วนต่างยอดนับจริงไว้ในจุดเดียว'))+upload+kpis([[t('Shortage risks','เสี่ยงขาด'),num(short),t('Out or below lead-time cover','หมดหรือมีไม่พอช่วงรอสินค้า')],[t('Excess stock','สต็อกเกิน'),num(excess),t('More than 90 days cover','มากกว่า 90 วัน')],[t('Suggested replenishment','แนะนำเติม'),num(orderTotal,2),t('Mixed units · review by SKU','หลายหน่วย · ตรวจทีละ SKU')],[t('Next forecast month','เดือนคาดการณ์ถัดไป'),month(E.shiftMonth(data.completeThrough,1)),t('Seasonal SKU baseline','ค่าฐานตามฤดูกาลราย SKU')]])+panel(t('SKU replenishment and reconciliation','การเติมสินค้าและตรวจสอบยอดราย SKU'),'<div class="table-wrap compact-table"><table><thead><tr><th>'+t('Product','สินค้า')+'</th><th>'+t('Planning stock','สต็อกวางแผน')+'</th><th>'+t('Express','Express')+'</th><th>'+t('Physical','นับจริง')+'</th><th>'+t('Difference','ส่วนต่าง')+'</th><th>'+t('Next-month demand','ความต้องการเดือนถัดไป')+'</th><th>'+t('Seasonality','ดัชนีฤดูกาล')+'</th><th>'+t('Cover days','พอใช้ (วัน)')+'</th><th>'+t('Status','สถานะ')+'</th><th>'+t('Suggested order','แนะนำสั่ง')+'</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div><div class="file-actions"><button class="button" data-action="export-plan">'+t('Export purchasing review','ส่งออกรายการทบทวนจัดซื้อ')+'</button></div><p class="note">'+t('Normal products may use 1–2 lead days; special specifications can use 30–40 days in the imported file. Recommendations are withheld when the stock count is not aligned to the latest closed month.','สินค้าปกติอาจใช้เวลารอ 1–2 วัน ส่วนสเปกพิเศษใส่ 30–40 วันในไฟล์ ระบบจะไม่แนะนำจำนวนหากวันที่นับสต็อกไม่ตรงกับสิ้นเดือนล่าสุด')+'</p>');
}
function operationsView(){
 const rows=data.operations||[],today=new Date().toLocaleDateString('en-CA'),open=rows.filter(r=>!['delivered','cancelled'].includes(r.statusKey)),overdue=open.filter(r=>r.dueDate&&r.dueDate<today),delivered=rows.filter(r=>r.statusKey==='delivered'),departments=[...new Set(rows.map(r=>r.department).filter(Boolean))];
 const upload=panel(t('Operations data source','แหล่งข้อมูลงานปฏิบัติการ'),'<p class="note">'+t('Import order, quotation, job, production and delivery status without embedding company data. Required columns: order_id, stage, due_date, sku, quantity, department, customer and delivery_date.','นำเข้าสถานะใบเสนอราคา คำสั่งซื้อ ใบงาน การผลิต และจัดส่งโดยไม่ฝังข้อมูลบริษัท คอลัมน์ที่ใช้: order_id, stage, due_date, sku, quantity, department, customer และ delivery_date')+'</p><div class="file-actions"><label>'+t('Choose operations CSV','เลือกไฟล์ CSV งานปฏิบัติการ')+'<input id="operations-file" type="file" accept=".csv,text/csv"></label><button class="button secondary" data-action="operations-template">'+t('Download operations template','ดาวน์โหลดแบบฟอร์มงาน')+'</button></div><p id="operations-import-status" role="status" class="note"></p>');
 if(!rows.length)return heading(t('Operations planning','วางแผนการปฏิบัติการ'),t('Connect orders to production and delivery','เชื่อมคำสั่งซื้อกับการผลิตและจัดส่ง'),t('This workspace activates when a job-status CSV is loaded.','พื้นที่นี้จะเปิดใช้งานเมื่อนำเข้า CSV สถานะงาน'))+upload;
 const stages=['quote','order','job','production','ready','delivered'],stageLabels={quote:t('Quotation','ใบเสนอราคา'),order:t('Order','คำสั่งซื้อ'),job:t('Job issued','ออกใบงาน'),production:t('In production','กำลังผลิต'),ready:t('Ready','พร้อมส่ง'),delivered:t('Delivered','ส่งแล้ว')},counts=stages.map(stage=>({stage,count:rows.filter(r=>r.statusKey===stage).length}));
 const workload=departments.map(d=>({label:d,value:E.sum(open.filter(r=>r.department===d).map(r=>r.quantity))})).sort((a,b)=>b.value-a.value);
 return heading(t('Operations planning','วางแผนการปฏิบัติการ'),t('Connect sales, production and delivery','เชื่อมงานขาย การผลิต และจัดส่ง'),t('Review the operational pipeline and overdue work from the latest imported file.','ทบทวนลำดับงานและงานเกินกำหนดจากไฟล์ล่าสุด'))+upload+'<div class="operations-grid"><div class="mini-stat"><small>'+t('Open work','งานเปิด')+'</small><strong>'+num(open.length)+'</strong></div><div class="mini-stat"><small>'+t('Overdue','เกินกำหนด')+'</small><strong>'+num(overdue.length)+'</strong></div><div class="mini-stat"><small>'+t('Delivered','ส่งแล้ว')+'</small><strong>'+num(delivered.length)+'</strong></div></div>'+panel(t('Quotation-to-delivery funnel','ขั้นตอนจากใบเสนอราคาถึงจัดส่ง'),bars(counts.map(x=>({label:stageLabels[x.stage],value:x.count}))))+panel(t('Department workload','ภาระงานตามแผนก'),workload.length?bars(workload):'<p class="empty">'+t('No department values in the imported file.','ไม่มีข้อมูลแผนกในไฟล์ที่นำเข้า')+'</p>')+panel(t('Due-date review','ทบทวนกำหนดส่ง'),table([t('Order','คำสั่งซื้อ'),t('Stage','ขั้นตอน'),t('Due date','กำหนด'),t('SKU','SKU'),t('Quantity','จำนวน'),t('Department','แผนก'),t('Customer','ลูกค้า')],open.slice().sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')).map(r=>'<tr><td>'+esc(r.orderId)+'</td><td>'+esc(stageLabels[r.statusKey]||r.stage)+'</td><td>'+(r.dueDate?dateLabel(r.dueDate):'—')+(r.dueDate&&r.dueDate<today?' <span class="pill bad">'+t('Overdue','เกินกำหนด')+'</span>':'')+'</td><td>'+esc(r.sku||'—')+'</td><td>'+num(r.quantity,2)+'</td><td>'+esc(r.department||'—')+'</td><td>'+esc(r.customer||'—')+'</td></tr>')));
}
function parseSupplementalCsv(text){const rows=ExpressCsvImporter.parseRows(text).filter(row=>row.some(cell=>String(cell).trim()));if(rows.length<2)throw Error(t('The CSV has no data rows.','ไฟล์ CSV ไม่มีแถวข้อมูล'));const header=rows[0].map(v=>String(v).trim().toLowerCase().replace(/[\s-]+/g,'_'));return rows.slice(1).map((row,index)=>({index:index+2,get:key=>String(row[header.indexOf(key)]??'').trim(),number:key=>{const v=String(row[header.indexOf(key)]??'').replace(/,/g,'').trim(),n=Number(v);return v&&Number.isFinite(n)?n:0},has:key=>header.includes(key)}))}
function parseIsoOrThai(value){const v=String(value||'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(v)&&validDay(v))return v;return ExpressCsvImporter.parseThaiDate(v)}
function normalizeStage(value){const v=String(value||'').trim().toLowerCase();if(/quote|quotation|เสนอ/.test(v))return'quote';if(/deliver|ส่งแล้ว/.test(v))return'delivered';if(/ready|พร้อม/.test(v))return'ready';if(/production|ผลิต/.test(v))return'production';if(/job|ใบงาน/.test(v))return'job';if(/cancel|ยกเลิก/.test(v))return'cancelled';return'order'}
async function importStockFile(file){
 const parsed=parseSupplementalCsv(await decodeExpressCsv(file)),products=new Map(data.products.map(p=>[p.sku.toUpperCase(),p])),seen=new Set(),unknown=[];
 const updated=data.products.map(p=>({...p}));const map=new Map(updated.map(p=>[p.sku.toUpperCase(),p]));
 for(const row of parsed){const sku=row.get('sku').toUpperCase();if(!sku||seen.has(sku))throw Error(t('Missing or duplicate SKU on row ','SKU ว่างหรือซ้ำที่แถว ')+row.index);seen.add(sku);if(!products.has(sku)){unknown.push(sku);continue}const p=map.get(sku),express=row.number('express_stock'),physical=row.has('physical_count')&&row.get('physical_count')!==''?row.number('physical_count'):null,stockDate=parseIsoOrThai(row.get('stock_date')),incoming=row.number('incoming'),incomingDue=parseIsoOrThai(row.get('incoming_due')),lead=row.number('lead_days'),pack=row.number('pack_size');if(!stockDate)throw Error(t('Invalid stock_date on row ','stock_date ไม่ถูกต้องที่แถว ')+row.index);if(incoming>0&&!incomingDue)throw Error(t('incoming_due is required when incoming is greater than zero on row ','ต้องมี incoming_due เมื่อ incoming มากกว่าศูนย์ที่แถว ')+row.index);Object.assign(p,{expressStock:express,physicalCount:physical,onHand:physical===null?express:physical,committed:row.number('committed'),inbound:incoming,inboundDue:incoming?incomingDue:null,stockDate,leadDays:Number.isInteger(lead)&&lead>=0&&lead<=365?lead:2,pack:pack>0?pack:1,inventoryImported:true})}
 if(!seen.size)throw Error(t('No matching stock rows were found.','ไม่พบแถวสต็อกที่ตรงกัน'));const next={...data,products:updated,inventoryImport:{file:file.name,importedAt:new Date().toISOString(),rows:seen.size,unknown}};E.validate(next);data=next;return {matched:seen.size-unknown.length,unknown}}
async function importOperationsFile(file){
 const parsed=parseSupplementalCsv(await decodeExpressCsv(file)),operations=[];
 for(const row of parsed){const orderId=row.get('order_id'),stage=row.get('stage'),dueDate=parseIsoOrThai(row.get('due_date')),deliveryDate=parseIsoOrThai(row.get('delivery_date'));if(!orderId||!stage)throw Error(t('order_id and stage are required on row ','ต้องมี order_id และ stage ที่แถว ')+row.index);if(row.get('due_date')&&!dueDate)throw Error(t('Invalid due_date on row ','due_date ไม่ถูกต้องที่แถว ')+row.index);operations.push({orderId,stage,statusKey:normalizeStage(stage),dueDate:dueDate||'',sku:row.get('sku').toUpperCase(),quantity:row.number('quantity'),department:row.get('department'),customer:row.get('customer'),deliveryDate:deliveryDate||''})}
 data={...data,operations,operationsImport:{file:file.name,importedAt:new Date().toISOString(),rows:operations.length}};return operations.length}

/* How to import, shown wherever files are chosen. Covers the normal case
   (three reports together) and the others: several periods, one report only,
   deposits added later, JSON backups, and what happens when something fails. */
function importGuide(compact){
 const items=[
  [t('Select all three reports together in one go:','เลือก 3 ไฟล์พร้อมกันในครั้งเดียว:')+' '+t('cash sales, credit sales (tax invoices) and deposit receipts.','ขายเงินสด ขายเงินเชื่อ (ใบกำกับสินค้า) และใบรับมัดจำ')+' '+t('Hold Cmd (Mac) or Ctrl (Windows) to pick several files; on a phone or tablet tap each file, then Open.','กด Cmd (Mac) หรือ Ctrl (Windows) ค้างไว้เพื่อเลือกหลายไฟล์ บนมือถือ/แท็บเล็ตแตะเลือกทีละไฟล์แล้วกด เปิด')],
  [t('Importing sales files replaces everything currently loaded.','การนำเข้าไฟล์ขายจะแทนที่ข้อมูลเดิมทั้งหมด')+' '+t('If you have more than one period (e.g. Oct–Nov 2025 and Dec 2025–Aug 2026), select every file of every period at the same time. Documents repeated in overlapping files are counted once.','ถ้ามีข้อมูลหลายช่วง (เช่น ต.ค.–พ.ย. 2025 และ ธ.ค. 2025–ส.ค. 2026) ให้เลือกไฟล์ทุกช่วงพร้อมกันในครั้งเดียว เอกสารที่ซ้ำกันในไฟล์ที่ช่วงเวลาทับกันจะนับครั้งเดียว')],
  [t('Only one sales report (cash or credit) also works, but sales will not include the other channel.','มีแค่ไฟล์ขายเงินสดหรือขายเงินเชื่อไฟล์เดียวก็นำเข้าได้ แต่ยอดขายจะไม่รวมอีกช่องทาง')],
  [t('Deposit receipts on their own are added to the data already loaded (sales are not replaced). Sales must be imported first.','ไฟล์ใบรับมัดจำอย่างเดียวจะถูกเพิ่มเข้าไปในข้อมูลที่มีอยู่ (ไม่ลบข้อมูลขาย) แต่ต้องนำเข้าไฟล์ขายก่อน')],
  [t('A backup (.json) is chosen on its own, one file, and replaces everything.','ไฟล์สำรอง (.json) ให้เลือกทีละ 1 ไฟล์ และไม่ปนกับ CSV ไฟล์สำรองจะแทนที่ข้อมูลทั้งหมด')],
  [t('Use the CSV files exported from Express as they are; opening and re-saving them in Excel can change dates and Thai text.','ใช้ไฟล์ CSV ที่ export จาก Express ได้เลย ไม่ต้องเปิดแก้ใน Excel ก่อน เพราะอาจทำให้วันที่หรือภาษาไทยเปลี่ยน')],
  [t('Before anything is replaced you see what was found and confirm. If an import fails, the current data stays as it is. Files are read on this device only.','ก่อนแทนที่ ระบบจะสรุปสิ่งที่อ่านได้ให้ตรวจและยืนยัน ถ้านำเข้าไม่สำเร็จ ข้อมูลเดิมจะยังอยู่ ไฟล์ถูกอ่านในเครื่องนี้เท่านั้น ไม่มีการส่งออกไปที่ไหน')],
 ];
 const list=(compact?items.slice(0,2):items).map((x,i)=>'<li><span class="import-step">'+(i+1)+'</span><span>'+esc(x[0])+'</span></li>').join('');
 return '<details class="import-guide" open><summary>'+t('How to import (read first)','วิธีนำเข้าไฟล์ (อ่านก่อน)')+'</summary><ol>'+list+'</ol></details>';
}
/* The confirmation before an import: which reports were found, which are
   missing, the dates covered, repeats skipped, and whether it replaces or adds. */
function importConfirmText(next,files){
 const typeName={cash:t('cash sales','ขายเงินสด'),credit:t('credit sales','ขายเงินเชื่อ'),deposit:t('deposit receipts','ใบรับมัดจำ')};
 const chosen=(next.importSummary.files||[]).slice(-files.length),types=new Set(chosen.map(f=>f.type));
 const depositOnly=chosen.length&&chosen.every(f=>f.type==='deposit');
 let first='',last='';for(const r of next.sales){if(!first||r.date<first)first=r.date;if(!last||r.date>last)last=r.date}
 const lines=[t('Files found:','ไฟล์ที่อ่านได้:')];
 for(const f of chosen)lines.push('  ✓ '+f.name+' → '+(typeName[f.type]||f.type));
 const missing=depositOnly?[]:['cash','credit','deposit'].filter(k=>!types.has(k));
 if(missing.length)lines.push('','⚠ '+t('Not selected: ','ไม่ได้เลือก: ')+missing.map(k=>typeName[k]).join(', ')+t(' (these will be missing from the dashboard)',' (ข้อมูลส่วนนี้จะไม่มีในแดชบอร์ด)'));
 lines.push('',t('Sales dates: ','ช่วงวันที่ของยอดขาย: ')+(first?dateLabel(first)+' – '+dateLabel(last):'—'));
 lines.push(num(next.sales.length)+t(' sale lines · ',' รายการขาย · ')+num(next.products.length)+t(' products · ',' สินค้า · ')+num(next.customers.length)+t(' customers · ',' ลูกค้า · ')+num(next.adjustments?.length||0)+t(' deposits',' รายการมัดจำ'));
 const repeats=next.importSummary.duplicateDocuments||0;
 if(repeats)lines.push(t('Repeated documents skipped (same number in more than one file): ','เอกสารที่ซ้ำกันระหว่างไฟล์ ข้ามไป: ')+num(repeats));
 lines.push('',depositOnly?t('The deposits will be ADDED to the current data; sales stay as they are. Continue?','จะเพิ่มใบรับมัดจำเข้าไปในข้อมูลเดิม ข้อมูลขายไม่เปลี่ยน ดำเนินการต่อหรือไม่?'):t('This REPLACES all data currently loaded. Continue?','ข้อมูลนี้จะแทนที่ข้อมูลเดิมทั้งหมด ดำเนินการต่อหรือไม่?'));
 return lines.join('\n');
}
/* Importer errors are written in English in js/import-express.js; say them in the reader's language. */
function importErrorText(message){
 if(/^Unsupported Express CSV: /.test(message))return t('These files are not a supported Express report: ','ไฟล์เหล่านี้ไม่ใช่รายงาน Express ที่รองรับ: ')+message.replace(/^Unsupported Express CSV: /,'')+t('. Use the cash-sales, credit-sales or deposit report.','. ใช้รายงานขายเงินสด ขายเงินเชื่อ หรือใบรับมัดจำ');
 if(/^Deposit receipts alone cannot start/.test(message))return t('Deposit receipts alone cannot start a dataset. Import the sales files first (or together with the deposits).','ไฟล์ใบรับมัดจำอย่างเดียวเริ่มข้อมูลใหม่ไม่ได้ ให้นำเข้าไฟล์ขายก่อน หรือเลือกพร้อมกับไฟล์ขาย');
 if(/^No sale lines were found/.test(message))return t('No sale lines were found in the selected files.','ไม่พบรายการขายในไฟล์ที่เลือก');
 if(/^Select at least one cash-sales or credit-sales/.test(message))return t('Select at least one cash-sales or credit-sales file.','เลือกไฟล์ขายเงินสดหรือขายเงินเชื่ออย่างน้อย 1 ไฟล์');
 return message;
}
function expressImportPanel(){
 const imported=data.importSummary?.format==='express-csv',depositCount=data.adjustments?.length||0,unresolvedCount=data.importSummary?.unresolvedRows?.length||0;
 return '<details id="express-import-dropdown" class="panel import-dropdown" '+(state.importExpanded?'open':'')+'><summary>'+t('Import CSV from Express','นำเข้า CSV จาก Express')+'</summary><div class="import-dropdown-body">'+importGuide(false)+'<label class="upload">'+t('Choose Express CSV files','เลือกไฟล์ CSV จาก Express')+'<input id="import-file" type="file" accept=".csv,text/csv,.json,application/json" multiple></label><p id="import-status" class="note" role="status">'+t('Nothing is uploaded to a server. A failed import leaves the current dashboard unchanged. Compatible JSON backups are still supported.','ไม่มีไฟล์ถูกส่งไปยังเซิร์ฟเวอร์ หากนำเข้าไม่สำเร็จ แดชบอร์ดปัจจุบันจะไม่เปลี่ยนแปลง และยังรองรับไฟล์สำรอง JSON')+'</p><div class="metric-line"><span>'+t('Current source','แหล่งข้อมูลปัจจุบัน')+'</span><strong>'+(imported?t('Express CSV','CSV จาก Express'):t('Waiting for Express CSV','รอไฟล์ CSV จาก Express'))+'</strong></div><div class="metric-line"><span>'+t('Sales lines / products','รายการขาย / สินค้า')+'</span><strong>'+num(data.sales.length)+' / '+num(data.products.length)+'</strong></div><div class="metric-line"><span>'+t('Customers / deposits','ลูกค้า / เงินมัดจำ')+'</span><strong>'+num(data.customers.length)+' / '+num(depositCount)+'</strong></div>'+(unresolvedCount?'<p class="warning">'+t('Rows needing review: ','แถวที่ต้องตรวจสอบ: ')+num(unresolvedCount)+'</p>':'')+'</div></details>';
}
function dataView(){
 return heading(t('Data & backup','ข้อมูลและสำรอง'),t('Keep and verify imported data','เก็บและตรวจสอบข้อมูลที่นำเข้า'),t('Download a backup after each approved Express import and review the known limitations.','ดาวน์โหลดไฟล์สำรองหลังการนำเข้า Express ที่อนุมัติแต่ละครั้ง และทบทวนข้อจำกัดที่ทราบ'))+
 panel(t('Keep your review work','เก็บงานที่ทบทวน'),`<p>${t('Save a local copy after a successful import. Browser storage may be cleared or unavailable, so keep a downloaded backup.','บันทึกสำเนาหลังนำเข้าสำเร็จ พื้นที่เก็บข้อมูลของเบราว์เซอร์อาจถูกล้างหรือใช้งานไม่ได้ จึงควรดาวน์โหลดไฟล์สำรอง')}</p><div class="form-grid"><button class="button" data-action="backup">${t('Download data backup','ดาวน์โหลดข้อมูลสำรอง')}</button><button class="button secondary" data-action="save">${t('Save on this device','บันทึกในเครื่องนี้')}</button><button class="button secondary" data-action="restore">${t('Load saved data','โหลดข้อมูลที่บันทึก')}</button><button class="button secondary" data-action="forget">${t('Delete saved data','ลบข้อมูลที่บันทึก')}</button></div>${(()=>{const m=savedMeta();return '<p class="note" id="saved-status">'+(m?t('Saved on this device: ','บันทึกในเครื่องนี้เมื่อ ')+esc(new Date(m.savedAt).toLocaleString(state.lang==='th'?'th-TH':'en-GB'))+' · '+num(m.lines)+' '+t('sale lines','รายการขาย'):t('Nothing is saved on this device yet. The app always opens empty; saved data loads only when you press Load saved data.','ยังไม่มีข้อมูลบันทึกในเครื่องนี้ แอปเปิดขึ้นมาว่างเสมอ ข้อมูลที่บันทึกจะโหลดเมื่อกดโหลดข้อมูลที่บันทึกเท่านั้น'))+'</p>'})()}<label class="upload backup-upload">${t('Load a backup file (.json) — one file, replaces all data','โหลดไฟล์สำรอง (.json) — เลือกทีละ 1 ไฟล์ และจะแทนที่ข้อมูลทั้งหมด')}<input id="backup-file" type="file" accept=".json,application/json"></label><p class="note">${t('Backup includes the parsed records, deposit adjustments and edited stock snapshots. View filters and scenarios reset when reopened.','ไฟล์สำรองรวมข้อมูลที่แปลงแล้ว รายการเงินมัดจำ และยอดสต็อกที่แก้ไข ตัวกรองและสถานการณ์จำลองจะเริ่มใหม่เมื่อเปิดอีกครั้ง')}</p>`)+
 (data.demo?'':panel(t('Summary for the CEO','สรุปสำหรับผู้บริหาร'),exportChoices()))+
 panel(t('Import checks and limitations','การตรวจสอบและข้อจำกัด'),`<ol class="help-list"><li>${t('Confirm the sales-line, product, customer and deposit counts after every import.','ยืนยันจำนวนรายการขาย สินค้า ลูกค้า และเงินมัดจำหลังนำเข้าทุกครั้ง')}</li><li>${t('Products, customers and salespeople are derived from the selected reports; nothing from the company files is hardcoded.','สินค้า ลูกค้า และพนักงานขายสร้างจากรายงานที่เลือก ไม่มีข้อมูลจากไฟล์บริษัทถูกเขียนตายตัว')}</li><li>${t('Deposit receipts are retained as separate adjustment records in the backup and import summary. They are not treated as product revenue.','ใบรับมัดจำถูกเก็บเป็นรายการปรับปรุงแยกต่างหากในไฟล์สำรองและสรุปการนำเข้า และไม่ถูกนับเป็นรายได้สินค้า')}</li><li>${t('Stock, pack size and lead time are not present in these three reports and must be reviewed separately before replenishment decisions.','สต็อก ขนาดชุดสั่งซื้อ และระยะเวลารอไม่มีในรายงานทั้งสามไฟล์ ต้องตรวจสอบแยกก่อนตัดสินใจเติมสินค้า')}</li></ol>`);
}
function navDescription(id) {
  const descriptions = {
    overview: ['Sales snapshot and trends', 'ภาพรวมยอดขายและแนวโน้ม'],
    inventory: ['Stock, replenishment and counts', 'สต็อก เติมสินค้า และยอดนับ'],
    operations: ['Production and delivery pipeline', 'งานผลิตและการจัดส่ง'],
    forecast: ['Automatic next-month forecast', 'คาดการณ์เดือนถัดไปอัตโนมัติ'],
    products: ['Performance by product', 'ผลงานแยกตามสินค้า'],
    team: ['Compare salespeople', 'เปรียบเทียบพนักงานขาย'],
    customers: ['Customer rankings and mix', 'อันดับและกลุ่มลูกค้า'],
    data: ['Import, save and backup', 'นำเข้า บันทึก และสำรอง'],
    mine: ['Your imported sales', 'ยอดขายที่นำเข้าของคุณ']
  };
  return t(...(descriptions[id] || ['', '']));
}
function reportMonthControl() {
  const limits = bounds(), value = state.from.slice(0, 7) === state.to.slice(0, 7) ? state.from.slice(0, 7) : '';
  return `<label>${t('Choose month', 'เลือกเดือน')}<input id="reportMonth" type="month" min="${limits.from.slice(0, 7)}" max="${limits.to.slice(0, 7)}" value="${value}"></label>`;
}
function render(){renderTheme();if(!unlocked){renderWelcome();return}document.querySelector('.app-layout').hidden=false;document.querySelector('.shell').hidden=false;$('#nav').hidden=false;document.getElementById('welcome-screen')?.remove();if(state.role==='management'&&(data.demo||!tabs.some(([id])=>id===state.tab)))state.tab='overview';if(state.role==='supervisor'&&(data.demo||!managerTabs.some(([id])=>id===state.tab)))state.tab='overview';if(state.role==='sales'&&!salespersonTabs.some(([id])=>id===state.tab))state.tab='mine';renderRole();const signature=[state.from,state.to,state.person,state.segment,state.group].join('|');if(state.reportSignature!==signature){state.compare=[];state.heatDay='';state.heatCompare=[];state.sellerDetail='';state.heatPage=0;state.reportSignature=signature}document.documentElement.lang=state.lang;document.querySelectorAll('[data-lang]').forEach(b=>{b.classList.toggle('active',b.dataset.lang===state.lang);b.setAttribute('aria-pressed',String(b.dataset.lang===state.lang))});$('#settings-toggle').setAttribute('aria-label',t('Settings','ตั้งค่า'));$('#settings-toggle').title=t('Settings','ตั้งค่า');$('#settings-title').textContent=t('Settings','ตั้งค่า');$('#language-label').textContent=t('Language','ภาษา');$('#theme-label').textContent=t('Theme','ธีม');$('.review-label').textContent=t('CLIENT REVIEW · PROTOTYPE','ทบทวนกับลูกค้า · ต้นแบบ');$('.skip').textContent=t('Skip to content','ข้ามไปเนื้อหา');const visibleTabs=state.role==='management'?(data.demo?tabs.filter(([id])=>id==='overview'):tabs):state.role==='supervisor'?(data.demo?managerTabs.filter(([id])=>id==='overview'):managerTabs):salespersonTabs;$('#nav').innerHTML='<div class="nav-heading"><span>'+t('Workspace','พื้นที่ทำงาน')+'</span><strong>'+t('Sales intelligence','ข้อมูลเชิงลึกการขาย')+'</strong></div>'+visibleTabs.map(([id,en,th],i)=>`<button data-tab="${id}" ${state.tab===id?'aria-current="page"':''}>${navIcon(id)}<small class="nav-number">${String(i+1).padStart(2,'0')}</small><span class="nav-topic">${t(en,th)}</span><small class="nav-description">${esc(navDescription(id))}</small></button>`).join('');
 const controlsElement=$('#controls'),mainElement=$('#main');if(controlsElement?.parentElement===mainElement)mainElement.before(controlsElement);
 const reporting=!data.demo&&['management','supervisor'].includes(state.role)&&['overview','products','team','customers'].includes(state.tab);$('#controls').hidden=!reporting;$('#controls').innerHTML=reporting?dateControls()+(state.tab==='team'?'':select(t('Salesperson','พนักงานขาย'),'person',[['',t('All salespeople','พนักงานขายทั้งหมด')],...data.salespeople.map(p=>[p.id,name(p)])],state.person))+select(t('Customer segment','กลุ่มลูกค้า'),'segment',[['',t('All segments','ทุกกลุ่ม')],...[...new Map(data.customers.map(c=>[c.segment,state.lang==='th'?c.segmentTh:c.segment]))]],state.segment)+select(t('Product group','กลุ่มสินค้า'),'group',[['',t('All groups','ทุกกลุ่ม')],...[...new Map(data.products.map(p=>[p.group,state.lang==='th'?p.groupTh:p.group]))]],state.group)+`<button class="button secondary" data-action="reset-filters">${t('Clear filters','ล้างตัวกรอง')}</button><small>${selectedRange()+' · '+t('Both dates included. Charts show daily values for up to 92 days, monthly for longer ranges. Forecasts use the complete imported sales history.','รวมวันเริ่มต้นและสิ้นสุด กราฟรายวันสำหรับช่วงไม่เกิน 92 วัน ช่วงยาวกว่านั้นแสดงรายเดือน การคาดการณ์ใช้ประวัติยอดขายที่นำเข้าทั้งหมด')}</small>`:'';
 $('#main').innerHTML=({overview,forecast:forecastView,inventory:inventoryView,products:productsView,productManage:productManagementView,team:teamView,entry:salesEntryForms,mine:mySalesView,customers:customersView,customerManage:customerManagementView,operations:operationsView,data:dataView}[state.tab])();if(reporting&&state.tab==='overview'){const summary=$('#main .kpis');if(summary)summary.insertAdjacentElement('afterend',$('#controls'))}else if(reporting&&['products','team','customers'].includes(state.tab)){const pageHeading=$('#main .heading');if(pageHeading)pageHeading.insertAdjacentElement('afterend',$('#controls'))}$('#footer').textContent=t('Monthly Sales Forecast Assistant · Local prototype · Figures and recommendations must be verified before real use.','Monthly Sales Forecast Assistant · ต้นแบบในเครื่อง · ต้องตรวจสอบตัวเลขและคำแนะนำก่อนใช้จริง');}
/* The toast slides in (CSS on #toast:not([hidden])) and fades out via .m-leaving before it is hidden. */
let toastTimer,toastHideTimer;function toast(message){const el=$('#toast');clearTimeout(toastTimer);clearTimeout(toastHideTimer);el.classList.remove('m-leaving');el.hidden=false;el.textContent=message;toastTimer=setTimeout(()=>{el.classList.add('m-leaving');toastHideTimer=setTimeout(()=>{el.hidden=true;el.classList.remove('m-leaving')},220)},5500)}
/* Save on this device: IndexedDB, only when the user presses the button. The
   app still starts empty (the startup code deletes the older auto-save
   database); a saved copy is loaded only through "Load saved data". A small
   note in localStorage remembers when it was saved so the Data page can say so. */
const savedDbName='monthly-forecast-saved-v1',savedMetaKey='monthly-forecast-saved-meta';
function savedDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open(savedDbName,1);request.onupgradeneeded=()=>request.result.createObjectStore('datasets');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function savedDbRun(mode,work){const db=await savedDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('datasets',mode),request=work(tx.objectStore('datasets'));tx.oncomplete=()=>resolve(request?.result);tx.onerror=tx.onabort=()=>reject(tx.error)})}finally{db.close()}}
function savedMeta(){try{return JSON.parse(localStorage.getItem(savedMetaKey)||'null')}catch{return null}}
async function saveOnDevice(){try{await savedDbRun('readwrite',store=>store.put(data,'current'));try{localStorage.setItem(savedMetaKey,JSON.stringify({savedAt:new Date().toISOString(),lines:data.sales.length}));localStorage.removeItem('monthly-forecast-review-v1')}catch{}toast(t('Saved on this device.','บันทึกในเครื่องนี้แล้ว'));if(state.tab==='data')render()}catch{toast(t('Device storage unavailable. Please download a backup.','ไม่สามารถบันทึกในเครื่อง โปรดดาวน์โหลดข้อมูลสำรอง'))}}
async function restoreFromDevice(){let saved;try{saved=await savedDbRun('readonly',store=>store.get('current'))}catch{saved=null}if(!saved){toast(t('No valid saved data was found.','ไม่พบข้อมูลที่บันทึกที่ใช้ได้'));return}if(!confirm(t('Replace the current session with saved data? Download a backup first if needed.','แทนที่ข้อมูลปัจจุบันด้วยข้อมูลที่บันทึกหรือไม่? ดาวน์โหลดสำรองก่อนหากจำเป็น')))return;try{load(saved);toast(t('Saved data loaded.','โหลดข้อมูลที่บันทึกแล้ว'))}catch{toast(t('No valid saved data was found.','ไม่พบข้อมูลที่บันทึกที่ใช้ได้'))}}
async function forgetOnDevice(){if(!confirm(t('Delete the copy saved on this device? The dashboard you are viewing is not affected.','ลบข้อมูลที่บันทึกไว้ในเครื่องนี้หรือไม่? แดชบอร์ดที่เปิดอยู่จะไม่ได้รับผลกระทบ')))return;try{await savedDbRun('readwrite',store=>store.delete('current'))}catch{}try{localStorage.removeItem(savedMetaKey);localStorage.removeItem('monthly-forecast-review-v1')}catch{}toast(t('Saved copy deleted from this device.','ลบข้อมูลที่บันทึกในเครื่องนี้แล้ว'));if(state.tab==='data')render()}
/* CEO summary: everything below comes from the same helpers the dashboard
   uses (filtered(), stats(), group(), groupForecasts()), for the dates and
   filters currently selected. js/export.js only formats it. */
function ceoSummary(){
 const rows=filtered(),s=stats(rows),prior=priorRange(),prev=covered(prior.from,prior.to)?stats(filteredBetween(prior.from,prior.to)).sales:null;
 const total=s.sales||0,share=v=>total?v/total:0,locale=state.lang==='th'?'th-TH':'en-GB';
 const months=[];for(let m=state.from.slice(0,7);m<=state.to.slice(0,7);m=E.shiftMonth(m,1))months.push(m);
 const monthly=months.map(m=>{const r=stats(rows.filter(x=>x.date.startsWith(m)));return {month:m,label:month(m),shortLabel:month(m),sales:r.sales,invoices:r.invoices,average:r.average}});
 const sellers=group(rows,r=>r.salesperson).sort((a,b)=>b.sales-a.sales).map(g=>({name:name(data.salespeople.find(p=>p.id===g.key)||{name:g.key}),sales:g.sales,invoices:g.invoices,share:share(g.sales)}));
 const allCustomers=group(rows,r=>r.customer).sort((a,b)=>b.sales-a.sales).map(g=>({name:byCustomer(g.key)?.name||g.key,sales:g.sales,invoices:g.invoices,share:share(g.sales)}));
 const allProducts=group(rows,r=>r.sku).sort((a,b)=>b.sales-a.sales).map(g=>{const p=bySku(g.key)||{};return {sku:g.key,name:name(p)||g.key,sales:g.sales,quantity:E.sum(g.rows.map(r=>r.quantity)),unit:p.unit?unit(p):'',share:share(g.sales)}});
 const groups=group(rows,r=>{const p=bySku(r.sku);return p?(state.lang==='th'?p.groupTh:p.group):'—'}).sort((a,b)=>b.sales-a.sales).map(g=>({name:g.key,sales:g.sales,share:share(g.sales)}));
 /* Channels and customer concentration (used by the insights below). */
 const channelNames={cash:t('Cash sales','ขายเงินสด'),credit:t('Credit sales','ขายเงินเชื่อ')};
 const channels=group(rows,r=>r.sourceType||'cash').sort((a,b)=>b.sales-a.sales).map(g=>({name:channelNames[g.key]||g.key,sales:g.sales,invoices:g.invoices,customers:g.customers,share:share(g.sales)}));
 let running=0,customersFor80=0;for(const c of allCustomers){if(running>=total*0.8)break;running+=c.sales;customersFor80++}
 const concentration={top1:allCustomers[0]?.share||0,top10:E.sum(allCustomers.slice(0,10).map(c=>c.share)),customersFor80,customerCount:allCustomers.length};
 const {rows:fcRows,nextMonth,historyMonths}=groupForecasts();
 const forecastRows=fcRows.filter(r=>r.fc.value!==null).sort((a,b)=>a.unitForGroup.localeCompare(b.unitForGroup)||b.fc.value-a.fc.value).map(r=>{const a=r.fc.accuracy||{},g=r.fc.grade||'unknown';const h=groupMonthlyHistory(r.groupLines,r.unitForGroup,historyMonths),lastValue=h.values[h.values.length-1],usual=E.avg(h.values),lowBase=lastValue>0&&usual>0&&lastValue<usual*0.25,v=accuracyVerdict(r.fc);return {lastMonthLabel:month(h.months[h.months.length-1]),lastValue,change:lastValue>0&&!lowBase?(r.fc.value-lastValue)/lastValue:null,lowBase,unitShare:r.unitShare,verdict:v.label,verdictTone:v.tone,name:r.label,value:r.fc.value,unit:r.unitForGroup,low:r.fc.wape===null?null:Math.max(0,r.fc.value*(1-r.fc.wape)),high:r.fc.wape===null?null:r.fc.value*(1+r.fc.wape),grade:g,gradeLabel:t(...gradeWords[g]),wape:r.fc.wape,mape:a.mape??null,mae:a.mae??null,rmse:a.rmse??null,bias:a.bias??null,mase:a.mase??null,n:a.n||0}});
 const insights=[];
 const bestMonth=monthly.filter(m=>m.sales>0).sort((a,b)=>b.sales-a.sales)[0];
 if(bestMonth&&monthly.length>1)insights.push(t('Best month: ','เดือนที่ขายได้สูงสุด: ')+bestMonth.label+' · '+money(bestMonth.sales));
 if(prev!==null&&prev>0)insights.push(t('Sales ','ยอดขาย')+(total>=prev?t('rose ','เพิ่มขึ้น '):t('fell ','ลดลง '))+pct(Math.abs((total-prev)/prev))+t(' against ',' เทียบกับ ')+dateLabel(prior.from)+' – '+dateLabel(prior.to));
 if(sellers[0])insights.push(t('Top salesperson: ','พนักงานขายยอดสูงสุด: ')+sellers[0].name+' · '+pct(sellers[0].share)+t(' of sales',' ของยอดขาย'));
 if(allCustomers[0])insights.push(t('Largest customer: ','ลูกค้ารายใหญ่สุด: ')+allCustomers[0].name+' · '+pct(allCustomers[0].share)+t('; the top 10 customers make up ','; ลูกค้า 10 อันดับแรกรวมกันคิดเป็น ')+pct(E.sum(allCustomers.slice(0,10).map(c=>c.share)))+t(' of sales',' ของยอดขาย'));
 if(allCustomers.length)insights.push(t('Concentration: ','การกระจุกตัว: ')+num(concentration.customersFor80)+t(' of ',' จาก ')+num(allCustomers.length)+t(' customers make up 80% of sales',' รายลูกค้า ทำยอดขายรวม 80%'));
 if(channels.length>1)insights.push(channels.map(c=>c.name+' '+pct(c.share)).join(' · '));
 if(groups[0])insights.push(t('Largest product group: ','กลุ่มสินค้าที่ขายมากสุด: ')+groups[0].name+' · '+pct(groups[0].share));
 const reliable=forecastRows.filter(r=>r.grade==='good'||r.grade==='fair'),careful=forecastRows.filter(r=>r.grade==='weak'||r.grade==='unusable');
 if(forecastRows.length)insights.push(t('Forecast for ','คาดการณ์เดือน ')+month(nextMonth)+': '+num(reliable.length)+'/'+num(forecastRows.length)+t(' groups tested within 15% error',' กลุ่มคลาดเคลื่อนไม่เกิน 15% จากการทดสอบ')+(careful.length?t('; use with care: ','; ควรใช้อย่างระวัง: ')+careful.slice(0,4).map(r=>r.name).join(', '):''));
 /* Extra analysis for the export (all in baht, same rows as the KPIs). */
 const heat=(keyOf,labelOf,rowKeys,cols,colOf)=>rowKeys.map(k=>({name:labelOf(k),values:cols.map(c=>E.sum(rows.filter(r=>keyOf(r)===k&&colOf(r)===c).map(r=>r.amount)))}));
 const groupKey=r=>{const p=bySku(r.sku);return p?(state.lang==='th'?p.groupTh:p.group):'—'};
 const groupMonth=heat(groupKey,k=>k,groups.map(g=>g.name),months,r=>r.date.slice(0,7));
 const sellerMonth=heat(r=>r.salesperson,k=>name(data.salespeople.find(p=>p.id===k)||{name:k}),group(rows,r=>r.salesperson).sort((a,b)=>b.sales-a.sales).map(g=>g.key),months,r=>r.date.slice(0,7));
 const weekdayNames=state.lang==='th'?['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์']:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
 const weekdayOf=r=>(new Date(r.date+'T00:00:00Z').getUTCDay()+6)%7;
 const weekdayMonth=heat(weekdayOf,k=>weekdayNames[k],[0,1,2,3,4,5,6],months,r=>r.date.slice(0,7));
 const priorGroups=prev!==null?new Map(group(filteredBetween(prior.from,prior.to),groupKey).map(g=>[g.key,g.sales])):null;
 const growth=priorGroups?groups.map(g=>({name:g.name,now:g.sales,before:priorGroups.get(g.name)||0})).map(g=>({...g,diff:g.now-g.before})).sort((a,b)=>b.diff-a.diff):[];
 const heatmaps={months:monthly.map(m=>m.label),groupMonth,sellerMonth,weekdayMonth};
 const filters=[state.person?name(data.salespeople.find(p=>p.id===state.person)||{name:state.person}):'',state.segment,state.group].filter(Boolean);
 const notes=[
  t('Source: Express cash sales, credit sales and deposit reports imported on this device.','แหล่งข้อมูล: รายงานขายเงินสด ขายเงินเชื่อ และใบรับมัดจำจาก Express ที่นำเข้าในเครื่องนี้'),
  t('Revenue is line amounts for the selected dates; deposit receipts are not counted as revenue.','ยอดขายคือยอดรายการขายในช่วงวันที่เลือก ใบรับมัดจำไม่นับเป็นยอดขาย'),
  t('Forecasts are group-level (units never mixed), from 9 months of history; the range assumes the error seen in backtesting.','คาดการณ์ทำระดับกลุ่มสินค้า (ไม่รวมหน่วยต่างกัน) จากประวัติ 9 เดือน ช่วงที่น่าจะเป็นอิงความคลาดเคลื่อนจากการทดสอบย้อนหลัง'),
  t('Stock data is not in these reports; check stock before ordering.','รายงานนี้ไม่มีข้อมูลสต็อก ควรตรวจสต็อกก่อนสั่งซื้อ'),
 ];
 notes.push(t('Units: money is in Thai baht (THB), summed from the line amounts printed in the Express reports; invoice-level discounts, VAT and deposit deductions are not applied. Forecast quantities are in each group\'s own unit and are never added across units.','หน่วย: ยอดเงินเป็นบาท รวมจากยอดรายการสินค้าตามที่พิมพ์ในรายงาน Express ยังไม่หักส่วนลดท้ายบิล VAT และเงินมัดจำ ปริมาณคาดการณ์ใช้หน่วยของแต่ละกลุ่ม และไม่รวมข้ามหน่วย'));
 const partial=forecastRows.filter(r=>r.unitShare<0.995);
 if(partial.length)notes.push(t('Groups forecast on their main unit only: ','กลุ่มที่คาดการณ์เฉพาะหน่วยหลัก: ')+partial.map(r=>r.name+' ('+r.unit+' '+pct(r.unitShare)+t(' of lines',' ของรายการ')+')').join(', '));
 if(forecastRows.some(r=>r.name.startsWith('77')))notes.push(t('Group 77 is a service fee (e.g. roll forming) counted in the unit it is billed in; confirm with the company.','กลุ่ม 77 เป็นค่าบริการ (เช่น ค่ารีดลอน) นับตามหน่วยที่ออกบิล ควรยืนยันกับบริษัท'));
 if(filters.length)notes.unshift(t('Filters applied: ','ตัวกรองที่ใช้: ')+filters.join(', '));
 return {lang:state.lang,company:document.querySelector('.brand-app-name strong')?.textContent||'',period:{from:state.from,to:state.to,label:selectedRange()},generatedLabel:new Date().toLocaleString(locale),sourceLabel:num(data.sales.length)+' '+t('sale lines','รายการขาย')+' · '+num(data.products.length)+' '+t('products','สินค้า')+' · '+num(data.customers.length)+' '+t('customers','ลูกค้า'),
  kpis:{sales:total,invoices:s.invoices,customers:s.customers,average:s.average,change:prev?(total-prev)/prev:null,priorLabel:dateLabel(prior.from)+' – '+dateLabel(prior.to)},
  monthly,sellers,customers:allCustomers.slice(0,10),allCustomers,customerCount:allCustomers.length,products:allProducts.slice(0,10),allProducts,groups,channels,concentration,heatmaps,growth,forecast:{monthLabel:month(nextMonth),rows:forecastRows},insights,notes};
}
/* Report and slides open as a printable page (Print / Save as PDF). If the
   browser blocks the new window, the same page is downloaded as .html. */
function openPrintable(html,filename){
 const win=window.open('','_blank');
 if(win){win.document.open();win.document.write(html);win.document.close();
  /* The page's own onclick is blocked by the app's Content-Security-Policy
     (inherited by this window), so the Print button is wired from here. */
  win.document.querySelectorAll('[data-print]').forEach(button=>button.addEventListener('click',()=>win.print()));return}
 download(filename,html,'text/html');toast(t('Pop-up blocked: the file was downloaded instead. Open it and choose Print.','เบราว์เซอร์บล็อกหน้าต่างใหม่ จึงดาวน์โหลดไฟล์แทน เปิดไฟล์แล้วเลือกพิมพ์'));
}
function exportCeo(kind){
 if(data.demo||!window.CeoExport){toast(t('Import company data first.','นำเข้าข้อมูลบริษัทก่อน'));return}
 const summary=ceoSummary(),stamp=state.from+'_'+state.to;
 if(kind==='xlsx'){download('ceo-summary-'+stamp+'.xlsx',CeoExport.xlsx(summary),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');toast(t('Excel summary downloaded.','ดาวน์โหลดสรุป Excel แล้ว'));return}
 if(kind==='report')openPrintable(CeoExport.reportHtml(summary),'ceo-report-'+stamp+'.html');
 if(kind==='slides')openPrintable(CeoExport.slidesHtml(summary),'ceo-slides-'+stamp+'.html');
}
function exportMenu(){return '<details class="export-menu"><summary><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M4.5 19.5h15"/></svg>'+t('Export summary','ส่งออกสรุป')+'</summary><div class="export-popover">'+exportChoices()+'</div></details>'}
function exportChoices(){return '<div class="export-choices"><button type="button" class="export-choice" data-export="xlsx"><strong>Excel (.xlsx)</strong><small>'+t('All figures on 11 sheets, to work with','ตัวเลขทั้งหมด 11 ชีต สำหรับทำต่อ')+'</small></button><button type="button" class="export-choice" data-export="report"><strong>'+t('PDF report (A4)','รายงาน PDF (A4)')+'</strong><small>'+t('6 pages with charts and heat maps, to read','6 หน้า พร้อมกราฟและ heat map สำหรับอ่าน')+'</small></button><button type="button" class="export-choice" data-export="slides"><strong>'+t('Slides (PDF 16:9)','สไลด์ (PDF 16:9)')+'</strong><small>'+t('About 14 slides for a meeting','ราว 14 หน้า สำหรับประชุม')+'</small></button></div><p class="note">'+t('Uses the dates and filters selected now: ','ใช้ช่วงวันที่และตัวกรองที่เลือกอยู่: ')+esc(selectedRange())+'. '+t('The files contain customer names and amounts; share them only inside the company.','ไฟล์มีชื่อลูกค้าและยอดเงิน ควรแชร์เฉพาะภายในบริษัท')+'</p>'}
function download(filename,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function load(next){E.validate(next);next=normalizeImportedSalespeople(assignStaffIds(next));E.validate(next);data={...next,operations:Array.isArray(next.operations)?next.operations:[],inventoryImport:next.inventoryImport||null,operationsImport:next.operationsImport||null};Object.assign(state,{compare:[],heatDay:'',heatCompare:[],sellerDetail:'',heatPage:0,reportSignature:'',customerSelected:'',mineFrom:bounds().from,mineTo:bounds().to,mineSearch:'',mineCustomer:'',mineSku:'',topMetric:'sales',topPrefix:'',topUnit:'',attributeView:'color',stockByGroup:{},from:firstSaleDate(),to:bounds().to,person:'',segment:'',group:'',sku:data.products[0].sku,method:'auto',factor:1,review:7,buffer:7,team:defaultTeam()});render()}
function csvCell(v){const s=String(v??'');return '"'+(/^[=+@\-\t\r]/.test(s)?"'":'')+s.replace(/"/g,'""')+'"'}
function exportPlan(){const rows=[['dataset','forecast_month','sku','product','unit','method','scenario_factor','review_days','buffer_days','forecast_quantity','stock_date','on_hand','committed','incoming_counted','lead_days','pack','status','suggested_order']];for(const p of data.products){const f=E.forecast(data,p.sku,state.method,state.factor),s=E.plan(p,f,state.review,state.buffer);rows.push([data.demo?'FICTIONAL SAMPLE':'IMPORTED UNVERIFIED',f.month,p.sku,p.name,p.unit,f.method,state.factor,state.review,state.buffer,f.base===null?'':E.round(f.base),p.stockDate,p.onHand,p.committed,s?.incoming??'',p.leadDays,p.pack,s?.status??'insufficient_history',s&&!s.stale?s.quantity:''])}download('stock-plan-'+E.shiftMonth(data.completeThrough,1)+'.csv','\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8')}
document.addEventListener('click',e=>{const b=e.target.closest('[data-remove-product],[data-remove-customer]');if(!b||!unlocked)return;
 if(b.hasAttribute('data-remove-product')){const sku=b.dataset.removeProduct,p=data.products.find(x=>x.sku===sku);if(!p||p.archived)return;const used=data.sales.some(r=>r.sku===sku),message=used?t('Remove this SKU from future sales entry? Historical sales will be kept.','นำ SKU นี้ออกจากการบันทึกยอดขายใหม่หรือไม่? ประวัติการขายจะยังคงอยู่'):t('Permanently remove this unused SKU?','ลบ SKU ที่ยังไม่เคยใช้นี้ถาวรหรือไม่?');if(!confirm(message))return;const next={...data,products:used?data.products.map(x=>x.sku===sku?{...x,archived:true}:x):data.products.filter(x=>x.sku!==sku)};try{E.validate(next);localStorage.setItem('monthly-forecast-entry-v1',JSON.stringify(next));data=next;render();const status=$('#product-remove-status');if(status)status.textContent=t(used?'Removed from future entry. Historical sales are unchanged.':'Unused SKU permanently removed.',used?'นำออกจากการบันทึกใหม่แล้ว ประวัติการขายไม่เปลี่ยนแปลง':'ลบ SKU ที่ยังไม่เคยใช้ถาวรแล้ว')}catch(err){const status=$('#product-remove-status');if(status)status.textContent=t('Not removed: ','ไม่ได้นำออก: ')+err.message}return}
 const id=b.dataset.removeCustomer,c=data.customers.find(x=>x.id===id);if(!c||c.archived)return;const used=data.sales.some(r=>r.customer===id),message=used?t('Remove this customer from future sales entry? Historical sales will be kept.','นำลูกค้ารายนี้ออกจากการบันทึกยอดขายใหม่หรือไม่? ประวัติการขายจะยังคงอยู่'):t('Permanently remove this unused customer?','ลบลูกค้าที่ยังไม่เคยใช้นี้ถาวรหรือไม่?');if(!confirm(message))return;const next={...data,customers:used?data.customers.map(x=>x.id===id?{...x,archived:true}:x):data.customers.filter(x=>x.id!==id)};try{E.validate(next);localStorage.setItem('monthly-forecast-entry-v1',JSON.stringify(next));data=next;render();const status=$('#customer-remove-status');if(status)status.textContent=t(used?'Removed from future entry. Historical sales are unchanged.':'Unused customer permanently removed.',used?'นำออกจากการบันทึกใหม่แล้ว ประวัติการขายไม่เปลี่ยนแปลง':'ลบลูกค้าที่ยังไม่เคยใช้ถาวรแล้ว')}catch(err){const status=$('#customer-remove-status');if(status)status.textContent=t('Not removed: ','ไม่ได้นำออก: ')+err.message}
}); document.addEventListener('click',e=>{const point=e.target.closest('[data-compare]');if(point){selectCompare(point.dataset.compare);return}const category=e.target.closest('[data-category]');if(category){state.group=state.group===category.dataset.category?'':category.dataset.category;render();return}const company=e.target.closest('[data-customer-company]');if(company){state.customerSelected=state.customerSelected===company.dataset.customerCompany?'':company.dataset.customerCompany;state.customerPage=0;render();document.querySelector('[data-customer-company="'+company.dataset.customerCompany+'"]')?.focus({preventScroll:true});return}const segment=e.target.closest('[data-customer-segment]');if(segment){state.customerSegment=state.customerSegment===segment.dataset.customerSegment?'':segment.dataset.customerSegment;render();document.querySelector('[data-customer-segment="'+segment.dataset.customerSegment+'"]')?.focus({preventScroll:true});return}const b=e.target.closest('button');if(!b)return;if(b.dataset.themeChoice){theme=b.dataset.themeChoice;try{localStorage.setItem('monthly-forecast-theme',theme)}catch{}$('#settings-menu').open=false;renderTheme();return}if(b.hasAttribute('data-lock')){state.role='sales';state.tab='mine';render();return}if(b.dataset.customerSegment){state.customerSegment=state.customerSegment===b.dataset.customerSegment?'':b.dataset.customerSegment;render();document.querySelector('[data-customer-segment="'+b.dataset.customerSegment+'"]')?.focus({preventScroll:true});return}if(b.hasAttribute('data-clear-customer')){state.customerSelected=state.customerSegment=state.customerSku=state.customerPerson=state.customerGroup=state.customerSearch='';state.customerPage=0;render();return}if(b.dataset.customerPage){state.customerPage+=Number(b.dataset.customerPage);render();requestAnimationFrame(()=>document.querySelector('#customer-ranking')?.scrollIntoView({behavior:'smooth',block:'start'}));return}if(b.dataset.personToggle){togglePerson(b.dataset.personToggle);return}if(!unlocked&&!b.dataset.lang)return;if(state.role==='sales'&&((b.dataset.tab&&b.dataset.tab!=='mine')||b.dataset.action||b.dataset.forecast||b.dataset.sku))return;if(b.hasAttribute('data-clear-heat')){state.heatCompare=[];state.heatDay='';render()}else if(b.dataset.seller){state.sellerDetail=state.sellerDetail===b.dataset.seller?'':b.dataset.seller;render();document.querySelector('[data-seller="'+b.dataset.seller+'"]').focus({preventScroll:true})}else if(b.hasAttribute('data-clear-compare')){state.compare=[];render()}else if(b.dataset.heatDay){state.heatDay=b.dataset.heatDay;state.heatCompare=state.heatCompare.includes(state.heatDay)?state.heatCompare.filter(d=>d!==state.heatDay):state.heatCompare.length===2?[state.heatDay]:[...state.heatCompare,state.heatDay];render();document.querySelector('[data-heat-day="'+state.heatDay+'"]').focus({preventScroll:true})}else if(b.dataset.heatPage){state.heatPage+=Number(b.dataset.heatPage);render()}else if(b.dataset.category){state.group=state.group===b.dataset.category?'':b.dataset.category;render()}else if(b.dataset.productMetric){state.topMetric=b.dataset.productMetric;render()}else if(b.dataset.lang){state.lang=b.dataset.lang;$('#settings-menu').open=false;render()}else if(b.dataset.tab){state.compare=[];state.tab=b.dataset.tab;render();$('#main').focus()}else if(b.dataset.sku){state.sku=b.dataset.sku;render();$('#stock-form')?.scrollIntoView({behavior:'smooth',block:'center'})}else if(b.dataset.forecast){state.sku=b.dataset.forecast;state.tab='forecast';render();requestAnimationFrame(()=>{const selected=$('#selected-forecast-product');selected?.scrollIntoView({behavior:'smooth',block:'center'});selected?.focus({preventScroll:true})})}else if(b.dataset.action){switch(b.dataset.action){case'reset-filters':state.topPrefix='';state.person=state.segment=state.group='';state.from=firstSaleDate();state.to=bounds().to;render();break;case'template':download('forecast-sample-template.json',JSON.stringify(E.seed(),null,2),'application/json');break;case'backup':download('forecast-data-backup-'+new Date().toLocaleDateString('en-CA')+'.json',JSON.stringify(data),'application/json');break;case'export-plan':exportPlan();break;case'stock-template':download('inventory-template.csv','\uFEFFsku,express_stock,physical_count,committed,incoming,incoming_due,stock_date,lead_days,pack_size\r\n','text/csv;charset=utf-8');break;case'operations-template':download('operations-template.csv','\uFEFForder_id,stage,due_date,sku,quantity,department,customer,delivery_date\r\n','text/csv;charset=utf-8');break;case'save':saveOnDevice();break;case'restore':restoreFromDevice();break;case'forget':forgetOnDevice();break;case'demo':if(confirm(t('Replace current session data with the fictional sample? Download a backup first if needed.','แทนที่ข้อมูลปัจจุบันด้วยตัวอย่างสมมติหรือไม่? ดาวน์โหลดสำรองก่อนหากจำเป็น')))load(E.seed());break}}});
async function decodeExpressCsv(file){
 const bytes=await file.arrayBuffer();
 try{return ExpressCsvImporter.decodeExpressBytes(bytes)}catch{throw Error(t('This browser cannot decode the Thai Express CSV encoding.','เบราว์เซอร์นี้ไม่รองรับการถอดรหัสภาษาไทยของไฟล์ Express CSV'))}
}
async function buildExpressImport(files){
 const total=files.reduce((sum,file)=>sum+file.size,0);if(total>25000000)throw Error(t('The selected files exceed the 25 MB import limit.','ไฟล์ที่เลือกมีขนาดรวมเกิน 25 MB'));
 const documents=[];for(const file of files){documents.push({name:file.name,text:await decodeExpressCsv(file)})}
 return ExpressCsvImporter.buildDataset(documents,data.demo?undefined:data);
}
document.addEventListener('toggle',e=>{if(e.target.matches('#express-import-dropdown'))state.importExpanded=e.target.open},true);
document.addEventListener('input',e=>{const el=e.target;if(!unlocked||el.id!=='customerSearch')return;const cursor=el.selectionStart??el.value.length;state.customerSearch=el.value;state.customerPage=0;render();const next=$('#customerSearch');next?.focus({preventScroll:true});next?.setSelectionRange(cursor,cursor)}); document.addEventListener('change',async e=>{const el=e.target;if(!unlocked&&el.id!=='welcome-import-file')return;if(el.matches('[data-overview-average]')){state.showOverviewAverage=el.checked;render();document.querySelector('[data-overview-average]')?.focus({preventScroll:true});return}if(['customerSegment','customerSku','customerPerson','customerGroup'].includes(el.id)){state[el.id]=el.value;state.customerPage=0;render();document.getElementById(el.id)?.focus({preventScroll:true});return}if(el.id==='view-role'){const requested=el.value;el.value=state.role;if(requested==='management'&&state.role!=='management')renderAccess();else if(requested==='supervisor'&&state.role!=='supervisor')renderManagerAccess();else if(requested==='sales'){state.role='sales';state.tab='mine';render()}return}if(el.id==='view-identity'){const target=el.value;el.value=state.identity;renderSalespersonAccess(target);return}if(el.id==='top-prefix'){state.topPrefix=el.value;render()}else if(el.id==='top-unit'){state.topUnit=el.value;render()}else if(el.id==='attribute-view'){state.attributeView=el.value;render();document.getElementById(el.id)?.focus({preventScroll:true})}else if(el.id==='reportMonth'){const limits=bounds(),from=el.value+'-01',to=E.monthEnd(el.value);if(!/^\d{4}-\d{2}$/.test(el.value)||to<limits.from||from>limits.to){toast(t('Choose a month within the available history.','เลือกเดือนที่อยู่ในช่วงข้อมูล'));render();return}state.from=from<limits.from?limits.from:from;state.to=to>limits.to?limits.to:to;render();document.getElementById('reportMonth')?.focus({preventScroll:true})}else if(['from','to'].includes(el.id)){const from=el.id==='from'?el.value:state.from,to=el.id==='to'?el.value:state.to;if(!validDay(from)||!validDay(to)||from>to||!covered(from,to)){toast(t('Choose valid dates within the available history. From date must not be after To date.','เลือกวันที่ภายในประวัติข้อมูลที่มี โดยจากวันที่ต้องไม่เกินถึงวันที่'));el.value=state[el.id];return}state.from=from;state.to=to;render()}else if(['person','segment','group'].includes(el.id)){state[el.id]=el.value;render()}else if(el.id==='plan-sku'){state.sku=el.value;render()}else if(el.id==='method'){state.method=el.value;render()}else if(['factor','review','buffer'].includes(el.id)){const v=Number(el.value),min=el.id==='factor'?-50:el.id==='review'?1:0,max=el.id==='factor'?50:90;if(el.value===''||!Number.isInteger(v)||v<min||v>max){toast(t('Enter a whole number within the displayed range.','กรอกจำนวนเต็มภายในช่วงที่กำหนด'));render();return}state[el.id]=el.id==='factor'?1+v/100:v;render()}else if(el.dataset.team){state.compare=[];el.checked?state.team.add(el.dataset.team):state.team.delete(el.dataset.team);render()}else if(el.dataset.stockGroup){state.stockByGroup={...state.stockByGroup,[el.dataset.stockGroup]:el.value};render();document.querySelector('[data-stock-group="'+el.dataset.stockGroup+'"]')?.focus({preventScroll:true})}else if(((state.role==='management'&&(el.id==='import-file'||el.id==='backup-file'))||el.id==='welcome-import-file')&&el.files.length){
 const files=[...el.files];
 try{
  let next;
  if(files.length===1&&files[0].name.toLowerCase().endsWith('.json')){if(files[0].size>25000000)throw Error(t('Maximum file size is 25 MB.','ขนาดไฟล์สูงสุด 25 MB'));next=JSON.parse(await files[0].text())}
  else{if(files.some(file=>!file.name.toLowerCase().endsWith('.csv')))throw Error(t('Select CSV files together, or one compatible JSON backup.','เลือกไฟล์ CSV พร้อมกัน หรือเลือกไฟล์สำรอง JSON ที่รองรับหนึ่งไฟล์'));next=await buildExpressImport(files)}
  E.validate(next);
  const summary=next.importSummary?.format==='express-csv'?importConfirmText(next,files):t('Replace the current session with this compatible backup?','แทนที่ข้อมูลปัจจุบันด้วยไฟล์สำรองนี้หรือไม่?');
  if(confirm(summary)){const salespersonImport=el.id==='welcome-import-file';if(!salespersonImport)state.importExpanded=false;load(next);if(salespersonImport){renderSalespersonProfileDialog();toast(t('Import complete for this session. Choose your salesperson profile.','นำเข้าสำเร็จสำหรับครั้งนี้ เลือกโปรไฟล์พนักงานขายของคุณ'))}else{state.importExpanded=false;toast(t('Import complete for this session.','นำเข้าสำเร็จสำหรับครั้งนี้'))}}
 }catch(err){toast(t('Import failed: ','นำเข้าไม่สำเร็จ: ')+importErrorText(err.message))}finally{el.value=''}
}
});
/* Sales Team chart: pointing at (or focusing) a name fades the other lines. */
function focusTeamSeries(id){const svg=document.querySelector('#main svg.chart');if(!svg)return;svg.classList.toggle('has-focus',!!id);svg.querySelectorAll('[data-series]').forEach(el=>el.classList.toggle('is-focus',!!id&&el.dataset.series===id))}
document.addEventListener('pointerover',e=>{const chip=e.target.closest('[data-team-chip]');if(chip)focusTeamSeries(chip.dataset.teamChip)});
document.addEventListener('pointerout',e=>{const chip=e.target.closest('[data-team-chip]');if(chip&&!chip.contains(e.relatedTarget))focusTeamSeries('')});
document.addEventListener('focusin',e=>{const chip=e.target.closest('[data-team-chip]');focusTeamSeries(chip?chip.dataset.teamChip:'')});
document.addEventListener('click',e=>{const b=e.target.closest('[data-export]');if(!b||!unlocked)return;const menu=b.closest('details');if(menu)menu.open=false;exportCeo(b.dataset.export)});
document.addEventListener('click',e=>{const b=e.target.closest('[data-page-key]');if(!b||!unlocked||b.disabled)return;const key=b.dataset.pageKey,p=(state.pages||{})[key];if(!p)return;p.page+=Number(b.dataset.pageStep);render();requestAnimationFrame(()=>{const pager=document.querySelector('[data-pager="'+key+'"]');const box=pager&&pager.closest('.panel');if(box)box.scrollIntoView({block:'start',behavior:'auto'});window.scrollBy(0,-72)})});
document.addEventListener('click',e=>{const b=e.target.closest('[data-top-n-key]');if(!b||!unlocked)return;state.topN={...(state.topN||{}),[b.dataset.topNKey]:Number(b.dataset.topN)};render()});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!unlocked)return;if(b.hasAttribute('data-clear-product-details')){state.detailPrefix=state.detailSearch='';render()}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-reset-ceo],[data-reset-manager],[data-reset-salesperson]');if(!b||!unlocked||state.role!=='tech'||b.disabled)return;if(b.hasAttribute('data-reset-manager')){if(!confirm(t('Reset the supervisor password on this browser?','รีเซ็ตรหัสผ่านหัวหน้าฝ่ายขายในเบราว์เซอร์นี้หรือไม่?')))return;localStorage.removeItem(managerAuthKey);render();toast(t('Supervisor password reset.','รีเซ็ตรหัสผ่านหัวหน้าฝ่ายขายแล้ว'));return}if(b.hasAttribute('data-reset-ceo')){if(!confirm(t('Reset the management password on this browser? The management user will need to create a new one.','รีเซ็ตรหัสผ่านผู้บริหารในเบราว์เซอร์นี้หรือไม่? ผู้บริหารต้องตั้งรหัสใหม่')))return;localStorage.removeItem(authKey);render();toast(t('Management password reset.','รีเซ็ตรหัสผ่านผู้บริหารแล้ว'));return}const id=b.dataset.resetSalesperson,person=activePeople().find(p=>p.id===id);if(!person||!confirm(t('Reset password for ','รีเซ็ตรหัสผ่านของ ')+name(person)+'?'))return;const locks=storedSalespersonLocks();delete locks[id];localStorage.setItem(salespersonAuthKey,JSON.stringify(locks));render();toast(t('Password reset for ','รีเซ็ตรหัสผ่านของ ')+name(person))});
document.addEventListener('click',e=>{const b=e.target.closest('[data-lock]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();unlocked=false;state.role='sales';state.identity='';state.tab='mine';render()},{capture:true});
document.addEventListener('input',e=>{const el=e.target;if(!unlocked||state.role!=='sales'||el.id!=='mineSearch')return;const cursor=el.selectionStart??el.value.length;state.mineSearch=el.value;render();const next=$('#mineSearch');next?.focus({preventScroll:true});next?.setSelectionRange(cursor,cursor)});
document.addEventListener('change',e=>{const el=e.target;if(!unlocked||state.role!=='sales'||!['mineFrom','mineTo','mineCustomer','mineSku'].includes(el.id))return;if(['mineFrom','mineTo'].includes(el.id)){const from=el.id==='mineFrom'?el.value:state.mineFrom,to=el.id==='mineTo'?el.value:state.mineTo;if(!validDay(from)||!validDay(to)||from>to||!covered(from,to)){toast(t('Choose valid dates within the available history.','เลือกวันที่ภายในช่วงข้อมูล โดยจากวันที่ต้องไม่เกินถึงวันที่'));render();return}state.mineFrom=from;state.mineTo=to}else state[el.id]=el.value;render();document.getElementById(el.id)?.focus({preventScroll:true})});
document.addEventListener('click',e=>{const button=e.target.closest('[data-clear-mine-dates],[data-clear-mine-list]');if(!button||!unlocked||state.role!=='sales')return;if(button.hasAttribute('data-clear-mine-dates')){state.mineFrom=bounds().from;state.mineTo=bounds().to}else state.mineSearch=state.mineCustomer=state.mineSku='';render()});
document.addEventListener('input',e=>{const el=e.target;if(!unlocked||el.id!=='productSearch')return;const cursor=el.selectionStart??el.value.length;state.detailSearch=el.value;render();const next=$('#productSearch');next?.focus({preventScroll:true});next?.setSelectionRange(cursor,cursor)});
document.addEventListener('change',e=>{const el=e.target;if(!unlocked||el.id!=='detailPrefix')return;state.detailPrefix=el.value;render();document.getElementById(el.id)?.focus({preventScroll:true})});
document.addEventListener('submit',e=>{if(e.target.id!=='stock-form')return;if(!unlocked||state.role!=='management'){e.preventDefault();return}e.preventDefault();const form=new FormData(e.target),p={...bySku(state.sku)};for(const k of ['onHand','committed','inbound','leadDays','pack'])p[k]=Number(form.get(k));p.stockDate=form.get('stockDate');p.inboundDue=form.get('inboundDue')||null;const next={...data,products:data.products.map(x=>x.sku===p.sku?p:x)};try{E.validate(next);data=next;render();toast(t('Stock snapshot updated. Review the recalculated plan.','อัปเดตยอดสต็อกแล้ว โปรดทบทวนแผนที่คำนวณใหม่'))}catch(err){toast(t('Please correct the stock inputs: ','โปรดแก้ไขข้อมูลสต็อก: ')+err.message)}});
function selectCompare(key){if(state.compare.includes(key))state.compare=state.compare.filter(x=>x!==key);else state.compare=state.compare.length>=2?[key]:[...state.compare,key];render();document.querySelector('[data-compare="'+key+'"]')?.focus({preventScroll:true})}
function accessAdminView(){
 const locks=storedSalespersonLocks(),rows=activePeople().map(p=>'<tr><td>ID '+esc(p.staffId)+'</td><td>'+esc(name(p))+'</td><td><span class="pill '+(locks[p.id]?'good':'warn')+'">'+t(locks[p.id]?'Password set':'Not set',locks[p.id]?'ตั้งรหัสแล้ว':'ยังไม่ตั้งรหัส')+'</span></td><td><button class="button secondary" data-reset-salesperson="'+esc(p.id)+'" '+(locks[p.id]?'':'disabled')+'>'+t('Reset password','รีเซ็ตรหัสผ่าน')+'</button></td></tr>');
 const ceoSet=!!storedLock(),managerSet=!!storedManagerLock();
 return heading(t('Access support','ช่วยเหลือการเข้าใช้งาน'),t('Password reset centre','ศูนย์รีเซ็ตรหัสผ่าน'),t('This view shows password setup status only. It cannot open sales, customer, product, forecast or stock information.','หน้านี้แสดงเฉพาะสถานะการตั้งรหัสผ่าน ไม่สามารถเปิดยอดขาย ลูกค้า สินค้า การคาดการณ์ หรือข้อมูลสต็อก'))+panel(t('Management access','การเข้าใช้งานผู้บริหาร'),'<div class="password-row"><div><strong>'+t('Management','ผู้บริหาร')+'</strong><span class="pill '+(ceoSet?'good':'warn')+'">'+t(ceoSet?'Password set':'Not set',ceoSet?'ตั้งรหัสแล้ว':'ยังไม่ตั้งรหัส')+'</span></div><button class="button secondary" data-reset-ceo '+(ceoSet?'':'disabled')+'>'+t('Reset management password','รีเซ็ตรหัสผ่านผู้บริหาร')+'</button></div><p class="note">'+t('After reset, the management user must create a new password on the next login.','หลังรีเซ็ต ผู้บริหารต้องตั้งรหัสผ่านใหม่เมื่อเข้าสู่ระบบครั้งถัดไป')+'</p>')+panel(t('Supervisor access','การเข้าใช้งานหัวหน้าฝ่ายขาย'),'<div class="password-row"><div><strong>'+t('Supervisor','หัวหน้าฝ่ายขาย')+'</strong><span class="pill '+(managerSet?'good':'warn')+'">'+t(managerSet?'Password set':'Not set',managerSet?'ตั้งรหัสแล้ว':'ยังไม่ตั้งรหัส')+'</span></div><button class="button secondary" data-reset-manager '+(managerSet?'':'disabled')+'>'+t('Reset supervisor password','รีเซ็ตรหัสหัวหน้าฝ่ายขาย')+'</button></div>')+panel(t('Salesperson access','การเข้าใช้งานพนักงานขาย'),table([t('ID','รหัส'),t('Salesperson','พนักงานขาย'),t('Password status','สถานะรหัสผ่าน'),t('Action','ดำเนินการ')],rows)+'<p class="note">'+t('Reset removes only the selected local password. Sales records and account names are not changed.','การรีเซ็ตลบเฉพาะรหัสผ่านในเครื่องของคนที่เลือก ยอดขายและชื่อบัญชีไม่เปลี่ยนแปลง')+'</p>');
}
function renderTechShell(){
 document.querySelector('.app-layout').hidden=false;document.querySelector('.shell').hidden=false;$('#nav').hidden=false;document.getElementById('welcome-screen')?.remove();document.documentElement.lang=state.lang;
 document.querySelectorAll('[data-lang]').forEach(b=>{b.classList.toggle('active',b.dataset.lang===state.lang);b.setAttribute('aria-pressed',String(b.dataset.lang===state.lang))});$('#settings-toggle').setAttribute('aria-label',t('Settings','ตั้งค่า'));$('#settings-toggle').title=t('Settings','ตั้งค่า');$('#settings-title').textContent=t('Settings','ตั้งค่า');$('#language-label').textContent=t('Language','ภาษา');$('#theme-label').textContent=t('Theme','ธีม');$('.review-label').textContent=t('TECH SUPPORT · LOCAL PROTOTYPE','ทีมช่วยเหลือ · ต้นแบบในเครื่อง');
 let host=document.getElementById('role-switch');if(!host){host=document.createElement('div');host.id='role-switch';host.className='role-switch';document.querySelector('.header-right').prepend(host)}host.innerHTML=accountMenu('<button class="account-exit" type="button" data-lock>'+t('Exit tech team','ออกจากทีมเทคนิค')+'</button>');
 $('#nav').innerHTML=techTabs.map(([id,en,th],i)=>'<button data-tab="'+id+'" aria-current="page">'+navIcon(id)+'<small>'+String(i+1).padStart(2,'0')+'</small>'+t(en,th)+'</button>').join('');$('#controls').hidden=true;$('#controls').innerHTML='';$('#main').innerHTML=accessAdminView();$('#footer').textContent=t('Local password support · Resets affect this browser only.','ช่วยเหลือรหัสผ่านในเครื่อง · การรีเซ็ตมีผลเฉพาะเบราว์เซอร์นี้');renderTheme();
}

document.addEventListener('change',async e=>{const el=e.target;if(!unlocked||!el.files?.length||!['stock-file','operations-file'].includes(el.id))return;const file=el.files[0];try{if(!file.name.toLowerCase().endsWith('.csv'))throw Error(t('Choose a CSV file.','เลือกไฟล์ CSV'));if(file.size>10000000)throw Error(t('Maximum file size is 10 MB.','ขนาดไฟล์สูงสุด 10 MB'));if(el.id==='stock-file'){if(state.role!=='management')throw Error(t('Management access is required to replace stock data.','ต้องใช้สิทธิ์ผู้บริหารเพื่อแทนที่ข้อมูลสต็อก'));const result=await importStockFile(file);render();toast(t('Stock imported: ','นำเข้าสต็อกแล้ว: ')+num(result.matched)+t(' matched SKUs.',' SKU ที่ตรงกัน'))}else{if(state.role!=='management')throw Error(t('Management access is required to replace operations data.','ต้องใช้สิทธิ์ผู้บริหารเพื่อแทนที่ข้อมูลงาน'));const count=await importOperationsFile(file);render();toast(t('Operations imported: ','นำเข้างานแล้ว: ')+num(count)+t(' rows.',' แถว'))}}catch(err){toast(t('Import failed: ','นำเข้าไม่สำเร็จ: ')+importErrorText(err.message))}finally{el.value=''}});

document.addEventListener('keydown',e=>{const point=e.target.closest('[data-compare]');if(point&&['Enter',' '].includes(e.key)){e.preventDefault();selectCompare(point.dataset.compare);return}const category=e.target.closest('.pie-slice[data-category]');if(category&&['Enter',' '].includes(e.key)){e.preventDefault();state.group=state.group===category.dataset.category?'':category.dataset.category;render();return}const segment=e.target.closest('.pie-slice[data-customer-segment]');if(segment&&['Enter',' '].includes(e.key)){e.preventDefault();state.customerSegment=state.customerSegment===segment.dataset.customerSegment?'':segment.dataset.customerSegment;render();return}const company=e.target.closest('.pie-slice[data-customer-company]');if(company&&['Enter',' '].includes(e.key)){e.preventDefault();state.customerSelected=state.customerSelected===company.dataset.customerCompany?'':company.dataset.customerCompany;render()}});
const tip=document.createElement('div');tip.id='chart-tip';tip.setAttribute('role','status');tip.hidden=true;document.body.append(tip);function showTip(e){const p=e.target.closest('[data-tip]');if(!p)return;tip.textContent=p.dataset.tip;tip.hidden=false;const rect=p.getBoundingClientRect();tip.style.left=Math.min(Math.max(8,rect.left),window.innerWidth-310)+'px';tip.style.top=Math.max(8,rect.top-75)+'px'}document.addEventListener('pointerover',showTip);document.addEventListener('focusin',showTip);document.addEventListener('pointerout',e=>{if(e.target.closest('[data-tip]'))tip.hidden=true});document.addEventListener('focusout',()=>tip.hidden=true);
if(document.modelContext?.registerTool){const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});try{Promise.resolve(document.modelContext.registerTool({name:'get_forecast_summary',description:'Read the selected SKU forecast and its assumptions in this local client-review prototype.',annotations:{readOnlyHint:true,untrustedContentHint:true},inputSchema:{type:'object',properties:{},additionalProperties:false},execute:async input=>{if(!unlocked||state.role!=='management')throw Error('Management access required');if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw Error('Expected an empty object.');const f=E.forecast(data,state.sku,state.method,state.factor);return {sampleData:!!data.demo,sku:state.sku,month:f.month,unit:bySku(state.sku).unit,base:f.base,low:f.low,high:f.high,method:f.method,scenarioFactor:state.factor,historicalWAPE:f.error}}},{signal:lifecycle.signal})).catch(()=>{})}catch{/* Optional browser capability; UI remains fully usable. */}}
const renderDashboard=render;render=function(){
 if(unlocked&&state.role==='tech'){state.tab='accessAdmin';renderTechShell()}
 else{if(unlocked&&state.tab==='accessAdmin')state.tab=state.role==='sales'?'mine':'overview';renderDashboard()}
 /* Page-entry motion only; motion.js ignores re-renders of the same page. */
 window.Motion?.afterRender(unlocked?state.role+'|'+state.tab:'');
};
document.addEventListener('change',e=>{
 const select=e.target;if(select.id!=='view-role'||!unlocked)return;
 const requested=select.value;select.value=state.role;e.preventDefault();e.stopImmediatePropagation();requestRole(requested);
},{capture:true});
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-view-role]');if(!b||!unlocked)return;
 e.preventDefault();const menu=b.closest('details');if(menu)menu.open=false;requestRole(b.dataset.viewRole);
});
/* Header menus close on an outside click or Escape. */
document.addEventListener('click',e=>{document.querySelectorAll('details.account-menu[open],details.settings-menu[open]').forEach(menu=>{if(!menu.contains(e.target))menu.open=false})});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;document.querySelectorAll('details.account-menu[open],details.settings-menu[open]').forEach(menu=>{menu.open=false;menu.querySelector('summary')?.focus()})});
document.addEventListener('click',e=>{
 const button=e.target.closest('#nav [data-tab]');if(!button||!unlocked||state.role==='tech')return;
 const allowed=(state.role==='management'?tabs:state.role==='supervisor'?managerTabs:salespersonTabs).map(([id])=>id),target=button.dataset.tab;
 if(!allowed.includes(target))return;
 e.preventDefault();e.stopImmediatePropagation();state.compare=[];
 const open=()=>{state.tab=target;render();requestAnimationFrame(()=>$('#main')?.focus())};
 window.Motion?Motion.navigate(button,state.role+'|'+target,open):open();
},{capture:true});
render();
})();
