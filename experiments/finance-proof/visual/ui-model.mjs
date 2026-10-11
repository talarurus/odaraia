// SPDX-License-Identifier: MPL-2.0
// Presentation-only helpers. Exact ledger rules remain in shared/finance.mjs.
import {money,balanceSummary,flowData,selectRows,checkedChartNumber} from '../shared/finance.mjs';
export const preferenceKey='talarurus.presentation';
export const defaultPreferences=Object.freeze({format:'symbol',hidden:false,reduceMotion:false});
export function normalizePreferences(value){return {format:value?.format==='code'?'code':'symbol',hidden:value?.hidden===true,reduceMotion:value?.reduceMotion===true};}
export function readPresentation(storage){try{return normalizePreferences(JSON.parse(storage?.getItem(preferenceKey)||'null'));}catch{return {...defaultPreferences};}}
export function savePresentation(storage,value){try{storage.setItem(preferenceKey,JSON.stringify(normalizePreferences(value)));return true;}catch{return false;}}
export const reducedMotion=(preferences,systemReduce)=>preferences.reduceMotion||systemReduce;
// Early motion preference, before CSS/React; no records or amounts are persisted.
export function bootstrapPresentation(){
 let reduce=false;try{reduce=JSON.parse(localStorage.getItem('talarurus.presentation')||'null')?.reduceMotion===true;}catch{}
 document.documentElement.dataset.motion=reduce||(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches)?'reduce':'normal';
}
export const presentationBootstrap=`(${bootstrapPresentation.toString()})();`;
export function formatAmount(value,preferences=defaultPreferences,options={}){
 if(preferences.hidden)return '••••';
 if(value===null||value===undefined)return 'Unavailable';
 const text=money(value,options);return preferences.format==='code'?text.replace('$','USD '):text;
}
// Integer rounding to one decimal avoids lossy conversions and division by zero.
export function percentage(value,total){const n=BigInt(value),d=BigInt(total);if(d<=0n)return null;const a=n<0n?-n:n;const tenths=(a*1000n+d/2n)/d;return `${n<0n?'−':''}${tenths/10n}.${tenths%10n}%`;}
export function percentageLabel(value,total,denominator){const p=percentage(value,total);return p===null?`% of ${denominator} unavailable`:`${p} of ${denominator}`;}
export const initialTxFilters=Object.freeze({search:'',account:'',category:'',status:'all',kind:'',merchant:'',classification:''});
export function withStatus(filters,status){return {...filters,status,...status==='review'?{classification:'',kind:''}:{}};}
export function filteredTransactions(fixture,period,filters,preferences=defaultPreferences){
 return selectRows(fixture.transactions,period).filter(r=>r.status!=='removed'&&(!filters.account||r.account===filters.account)&&(!filters.category||r.category===filters.category)&&(!filters.merchant||r.payee===filters.merchant)&&(!filters.classification||r.classification===filters.classification)&&(filters.status==='all'||(filters.status==='review'?r.classification==='unclassified':r.status===filters.status))&&(!filters.kind||(filters.kind==='external'?r.classification!=='transfer':filters.kind==='reported'&&['income','expense'].includes(r.classification)))&&(!filters.search||`${r.payee} ${r.category} ${preferences.hidden?'':money(r.amount)} ${r.date}`.toLowerCase().includes(filters.search.toLowerCase()))).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
}
export function flowPresentation(r){const data=flowData(r);const onlyIncome=data.nodes.filter(x=>['income','credit','deficit'].includes(x.kind)).every(x=>x.kind==='income')&&data.total===r.income&&BigInt(r.income)>0n;return {...data,centerLabel:onlyIncome?'Income':'Available',note:onlyIncome?'Income is posted income after adjustments. Transfers are excluded.':'Available includes positive income, net category credits and a balancing deficit where needed. A deficit is not income. Income reversals appear as destinations.'};}
export function flowDrill(node){
 if(node.kind==='income')return {category:node.name,classification:'income'};
 if(node.kind==='expense')return {category:node.name,classification:'expense'};
 if(node.kind==='credit')return {category:node.name.replace(/^Net credit · /,''),classification:'expense'};
 if(node.kind==='reversal')return {category:node.name.replace(/^Income reversal · /,''),classification:'income'};
 return {kind:'reported'};
}
// Opposite-side links show pooled funding, not a fabricated source/category allocation.
export function flowHighlighted(active,link,data){
 if(!active)return false;
 if(active==='Available'||active===link.name)return true;
 const selected=data.nodes.find(n=>n.name===active);
 const sourceKinds=['income','credit','deficit'];
 return selected&&selected.kind!=='center'&&sourceKinds.includes(selected.kind)!==sourceKinds.includes(link.kind);
}
export function periodState(fixture,filters,r){
 if(!fixture.accounts.length)return {title:'No accounts yet',note:'This synthetic scenario has no accounts. Choose another demo to explore reports.'};
 const rows=selectRows(fixture.transactions,filters).filter(x=>x.status!=='removed');
 if(!rows.length)return {title:'No transactions this period',note:'Opening balances still contribute to net worth. Choose another period or demo.'};
 if(rows.every(x=>x.status==='pending'))return {title:'All transactions are pending',note:'Pending records appear in Transactions; reports include them only after posting.'};
 if(r.unresolvedCount&&r.externalCount===0)return {title:'Transactions need classification',note:'Posted records need an income or expense category before they can contribute to these reports.'};
 if(r.externalCount===0)return {title:'No income or spending this period',note:'Internal transfers change account balances, not income or spending.'};
 return null;
}
export const nextDate=date=>new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
export function netWorthHistory(fixture,filters){
 if(!fixture.accounts.length)return {days:[],beginning:null,change:null,largest:[],reason:'No accounts yet'};
 const beginning=balanceSummary(fixture.accounts,fixture.transactions,{end:filters.start}).netWorth;
 const ending=balanceSummary(fixture.accounts,fixture.transactions,{end:filters.end}).netWorth;
 // Same anchored, posted-only policy; avoid rebuilding income/merchant reports per day.
 const postingsByDate=Object.groupBy(fixture.transactions.filter(t=>t.status==='posted'),t=>t.date);
 const days=[];let previous=beginning;
 for(let date=filters.start;date<filters.end;date=nextDate(date)){
  const value=balanceSummary(fixture.accounts,fixture.transactions,{end:nextDate(date)}).netWorth;
  const delta=value!==null&&previous!==null?String(BigInt(value)-BigInt(previous)):null;
  const postings=postingsByDate[date]||[];
  const events=[...new Set(postings.map(t=>t.classification==='transfer'?'Internal transfer (paired balances cancel)':t.payee))];
  if(fixture.accounts.some(a=>a.anchor===date))events.push('Opening balance anchor');
  days.push({date,minor:value,value:value===null?null:checkedChartNumber(value)/100,delta,events});previous=value;
 }
 const largest=days.filter(d=>d.delta!==null&&BigInt(d.delta)!==0n).sort((a,b)=>{const abs=n=>n<0n?-n:n;const x=abs(BigInt(a.delta)),y=abs(BigInt(b.delta));return x===y?a.date.localeCompare(b.date):x>y?-1:1;}).slice(0,3);
 return {days,beginning,change:beginning===null||ending===null?null:String(BigInt(ending)-BigInt(beginning)),largest,reason:days.some(d=>d.minor!==null)?null:'Balance history unavailable for this period'};
}
function csvText(value){const text=String(value??'');const safe=/^[\s\uFEFF]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text)?`'${text}`:text;return `"${safe.replaceAll('"','""')}"`;}
export function transactionsCSV(fixture,period){
 const header=['ID','Date','Account','Merchant','Category','Status','Classification','Currency','Amount (USD)'];
 const rows=selectRows(fixture.transactions,period).filter(x=>x.status!=='removed').map(t=>{const n=BigInt(t.amount),abs=n<0n?-n:n;const amount=`${n<0n?'-':''}${abs/100n}.${String(abs%100n).padStart(2,'0')}`;return [t.id,t.date,fixture.accounts.find(a=>a.id===t.account)?.name||t.account,t.payee,t.category,t.status,t.classification,'USD'].map(csvText).concat(amount).join(',');});
 return header.map(csvText).join(',')+'\r\n'+rows.join('\r\n')+'\r\n';
}
