// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {canonical,sample} from '../shared/fixture.mjs';
import {report,validateRows,parseDollars} from '../shared/finance.mjs';
import {cells} from './csv.mjs';
import {demos} from '../visual/scenarios.mjs';
import {percentage,percentageLabel,formatAmount,defaultPreferences,normalizePreferences,readPresentation,savePresentation,preferenceKey,reducedMotion,presentationBootstrap,initialTxFilters,withStatus,filteredTransactions,flowPresentation,flowDrill,flowHighlighted,periodState,netWorthHistory,transactionsCSV} from '../visual/ui-model.mjs';
const period={start:'2026-09-01',end:'2026-10-01'};
const result=fixture=>report(fixture.accounts,fixture.transactions,period);
test('UI percentages distinguish exact income/spending denominators and round once',()=>{
 const r=result(canonical);assert.equal(percentage('18000',r.income),'3.6%');assert.equal(percentage('18000',r.spending),'10.1%');
 assert.equal(percentageLabel('18000',r.income,'income'),'3.6% of income');assert.equal(percentageLabel('18000',r.spending,'spending'),'10.1% of spending');
 assert.equal(percentage('1','16'),'6.3%');assert.equal(percentage('-1','16'),'−6.3%');assert.equal(percentage('900719925474099301','900719925474099301'),'100.0%');
});
test('UI percentages never divide by zero or disguise credits and adjustments',()=>{
 for(const total of ['0','-10'])assert.equal(percentage('100',total),null);
 assert.equal(percentageLabel('150000','0','income'),'% of income unavailable');assert.equal(percentage('-20000','500000'),'−4.0%');assert.equal(percentage('150000','100000'),'150.0%');
});
test('USD presentation preserves exact values, signs and cents without currency conversion',()=>{
 assert.equal(formatAmount('123456'),'$1,234.56');assert.equal(formatAmount('-1',{format:'code',hidden:false}),'−USD 0.01');
 assert.equal(formatAmount('900719925474099301',{format:'code',hidden:false}),'USD 9,007,199,254,740,993.01');
 assert.equal(formatAmount('123456',defaultPreferences,{signed:true}),'+$1,234.56');assert.equal(formatAmount(null),'Unavailable');
});
test('Amount masking covers zero, unknown, signed and large financial amounts',()=>{
 for(const amount of ['0','-10','900719925474099301',null])for(const options of [{},{signed:true},{whole:true}])assert.equal(formatAmount(amount,{hidden:true,format:'code'},options),'••••');
});
test('Display preferences persist only an allowlist and tolerate denied/corrupt storage',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 assert.deepEqual(readPresentation(storage),defaultPreferences);
 assert(savePresentation(storage,{format:'code',hidden:true,reduceMotion:true,transactions:canonical.transactions,token:'forbidden'}));
 assert.deepEqual([...values.keys()],[preferenceKey]);assert.deepEqual(JSON.parse(values.get(preferenceKey)),{format:'code',hidden:true,reduceMotion:true});assert.deepEqual(readPresentation(storage),{format:'code',hidden:true,reduceMotion:true});
 assert.deepEqual(readPresentation({getItem:()=>'{broken'}),defaultPreferences);assert.equal(savePresentation({setItem:()=>{throw Error('denied');}},defaultPreferences),false);
 assert.deepEqual(normalizePreferences({format:'EUR',hidden:'true',reduceMotion:1}),defaultPreferences);
});
test('Motion preference never overrides OS reduction and bootstraps before styles',()=>{
 for(const appReduce of [false,true])for(const osReduce of [false,true]){
  assert.equal(reducedMotion({reduceMotion:appReduce},osReduce),appReduce||osReduce);
  const root={dataset:{}};runInNewContext(presentationBootstrap,{localStorage:{getItem:()=>JSON.stringify({reduceMotion:appReduce}),setItem:()=>assert.fail('No bootstrap writes')},matchMedia:()=>({matches:osReduce}),document:{documentElement:root}});assert.equal(root.dataset.motion,appReduce||osReduce?'reduce':'normal');
 }
 const root={dataset:{}};runInNewContext(presentationBootstrap,{localStorage:{getItem:()=>{throw Error('denied');}},matchMedia:()=>({matches:true}),document:{documentElement:root}});assert.equal(root.dataset.motion,'reduce');
});
test('Sankey central terminology and values follow exact finance semantics',()=>{
 assert.equal(flowPresentation(result(canonical)).centerLabel,'Income');
 for(const id of ['negative-flow','net-credit','income-reversal']){const r=result(demos[id]),flow=flowPresentation(r);assert.equal(flow.centerLabel,'Available');assert(flow.note.includes('deficit is not income'));const center=flow.nodes.findIndex(n=>n.kind==='center');assert.equal(flow.links.filter(l=>l.target===center).reduce((s,l)=>s+BigInt(l.value),0n),BigInt(flow.total));assert.equal(flow.links.filter(l=>l.source===center).reduce((s,l)=>s+BigInt(l.value),0n),BigInt(flow.total));}
});
test('Flow/category/merchant drill-down returns the net posted records and is reversible',()=>{
 const grocery=filteredTransactions(canonical,period,{...initialTxFilters,...flowDrill({kind:'expense',name:'Groceries'}),status:'posted'});assert.deepEqual(new Set(grocery.map(x=>x.id)),new Set(['grocery-1','refund-1']));assert.equal(grocery.reduce((s,x)=>s-BigInt(x.amount),0n),18000n);
 const merchant=filteredTransactions(canonical,period,{...initialTxFilters,merchant:'Blue Kettle Cafe',classification:'expense',status:'posted'});assert.equal(merchant.length,2);
 assert.deepEqual(flowDrill({name:'Net credit · Housing',kind:'credit'}),{category:'Housing',classification:'expense'});assert.deepEqual(flowDrill({name:'Income reversal · Adjustment',kind:'reversal'}),{category:'Adjustment',classification:'income'});
 assert.equal(filteredTransactions(canonical,period,initialTxFilters).length,canonical.transactions.length);assert.equal(filteredTransactions(canonical,period,{...initialTxFilters,search:'does-not-exist'}).length,0);
 assert.equal(filteredTransactions(canonical,period,{...initialTxFilters,status:'pending'}).length,1);
});
test('Hidden amount search cannot reveal which records match monetary values',()=>{
 const filters={...initialTxFilters,search:'$5,000.00'};assert.equal(filteredTransactions(canonical,period,filters).length,1);assert.equal(filteredTransactions(canonical,period,filters,{hidden:true}).length,0);
 assert.equal(filteredTransactions(canonical,period,{...initialTxFilters,search:'Blue Kettle'}, {hidden:true}).length,2);
});
test('Flow focus highlights related pooled incoming/outgoing paths accurately',()=>{
 const data=flowPresentation(result(canonical));
 for(const link of data.links){assert.equal(flowHighlighted(null,link,data),false);assert.equal(flowHighlighted('Available',link,data),true);}
 assert(flowHighlighted('Housing',data.links.find(x=>x.kind==='income'),data));assert(flowHighlighted('Housing',data.links.find(x=>x.name==='Housing'),data));assert(!flowHighlighted('Housing',data.links.find(x=>x.name==='Dining'),data));
});
test('Report drill-down excludes unresolved records while review surfaces them explicitly',()=>{
 const fixture={...canonical,transactions:[...canonical.transactions,{...canonical.transactions[1],id:'unclassified-test',category:'Unclassified',classification:'unclassified'}]},r=result(fixture);
 assert.equal(r.unresolvedCount,1);assert.equal(r.income,'500000');assert.equal(r.spending,'179000');
 const rows=filteredTransactions(fixture,period,{...initialTxFilters,...flowDrill({kind:'center'}),status:'posted'});assert.equal(rows.length,7);assert(rows.every(t=>['income','expense'].includes(t.classification)));
 assert.equal(filteredTransactions(fixture,period,{...initialTxFilters,status:'review'}).length,1);assert.equal(periodState(demos['needs-review'],period,result(demos['needs-review'])).title,'Transactions need classification');
});
test('Needs review does not conflict with a carried expense classification',()=>{
 const unresolved={...canonical.transactions[1],id:'review-housing',classification:'unclassified'},fixture={...canonical,transactions:[...canonical.transactions,unresolved]};
 const drill={...initialTxFilters,category:'Housing',classification:'expense',kind:'reported',status:'posted'};
 assert.equal(filteredTransactions(fixture,period,drill).length,1);
 const review=withStatus(drill,'review');assert.equal(review.category,'Housing');assert.deepEqual(filteredTransactions(fixture,period,review).map(t=>t.id),['review-housing']);assert.equal(drill.status,'posted');
});
test('Every limited-data demo validates without changing original synthetic fixtures',()=>{
 for(const demo of Object.values(demos))validateRows(demo.accounts,demo.transactions);
 assert.equal(canonical.transactions.length,12);assert.equal(sample.transactions.length,115);assert.equal(demos['one-account'].accounts.length,1);assert.equal(demos['one-transaction'].transactions.length,1);
 assert.equal(result(demos['no-spending']).spending,'0');assert.equal(result(demos['no-income']).income,'0');assert.equal(result(demos['negative-flow']).surplus,'-50000');assert.deepEqual(demos['no-transactions'].budgets,[]);
});
test('No-activity reasons distinguish absent accounts, transactions and pending-only data',()=>{
 assert.equal(periodState(demos['no-accounts'],period,result(demos['no-accounts'])).title,'No accounts yet');assert.equal(periodState(demos['no-transactions'],period,result(demos['no-transactions'])).title,'No transactions this period');assert.equal(periodState(demos['all-pending'],period,result(demos['all-pending'])).title,'All transactions are pending');
 assert.equal(periodState(demos['one-transaction'],period,result(demos['one-transaction'])),null);
});
test('Every canonical history point equals anchors plus posted ledger amounts',()=>{
 const h=netWorthHistory(canonical,period);assert.equal(h.days.length,30);assert.equal(h.beginning,'120000');assert.equal(h.change,'321000');assert.equal(h.days.at(-1).minor,'441000');
 for(const day of h.days){const direct=canonical.accounts.reduce((sum,a)=>sum+BigInt(a.opening)+canonical.transactions.filter(t=>t.account===a.id&&t.status==='posted'&&t.date>a.anchor&&t.date<=day.date).reduce((s,t)=>s+BigInt(t.amount),0n),0n);assert.equal(day.minor,String(direct));}
 for(const date of ['2026-09-10','2026-09-12','2026-09-30'])assert.equal(h.days.find(d=>d.date===date).delta,'0');assert(h.days.find(d=>d.date==='2026-09-12').events.includes('Internal transfer (paired balances cancel)'));
});
test('Sample net-worth jumps follow salary dates, not transfer/payments or pending',()=>{
 for(const month of ['07','08','09']){
  const p={start:`2026-${month}-01`,end:`2026-${String(Number(month)+1).padStart(2,'0')}-01`},h=netWorthHistory(sample,p),r=report(sample.accounts,sample.transactions,p);
  assert.equal(h.days.find(d=>d.date===`2026-${month}-02`).delta,'620000');assert(h.days.find(d=>d.date===`2026-${month}-16`).events.includes('Juniper Design'));
  for(const date of ['25','27'])assert.equal(h.days.find(d=>d.date===`2026-${month}-${date}`).delta,'0');
  assert.equal(h.days.at(-1).minor,r.netWorth);assert.equal(BigInt(r.assets)-BigInt(r.liabilities),BigInt(r.netWorth));assert.equal(h.change,r.surplus);
 }
 assert.equal(netWorthHistory(sample,period).days.at(-1).delta,'0');
});
test('Unknown and staggered balance anchors remain history gaps, never fabricated zeros',()=>{
 assert.equal(netWorthHistory(demos['no-accounts'],period).days.length,0);
 const missing=netWorthHistory(demos['missing-history'],period);assert(missing.reason.includes('unavailable'));assert(missing.days.every(d=>d.minor===null&&d.value===null));assert.equal(missing.change,null);
 const fixture={accounts:[{...canonical.accounts[0],anchor:'2026-09-04'}],transactions:[]},h=netWorthHistory(fixture,period);assert(h.days.slice(0,3).every(d=>d.minor===null));assert.equal(h.days[3].minor,'100000');assert(h.days[3].events.includes('Opening balance anchor'));assert.equal(h.change,null);
});
test('Synthetic CSV round-trips exact signed amounts, duplicate coffees and pending/transfers',()=>{
 const csv=transactionsCSV(canonical,period),[headers,...rows]=cells(csv),objects=rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));
 assert.equal(rows.length,12);assert.equal(objects.filter(x=>x.Merchant==='Blue Kettle Cafe').length,2);assert.equal(objects.filter(x=>x.Status==='pending').length,1);assert.equal(objects.filter(x=>x.Classification==='transfer').length,4);
 for(const t of canonical.transactions){const row=objects.find(x=>x.ID===t.id);assert.equal(row.Currency,'USD');assert.equal(parseDollars(row['Amount (USD)']),t.amount);}
 assert.equal(cells(transactionsCSV(demos['no-accounts'],period)).length,1);assert.equal(cells(transactionsCSV(canonical,{start:'2026-10-01',end:'2026-11-01'})).length,1);
});
test('CSV neutralizes spreadsheet formulas while quoting commas, quotes and newlines',()=>{
 for(const name of ['=1+1',' +SUM(A1)','-cmd','@IMPORT','\t=CMD','\r=CMD','\uFEFF=CMD']){const fixture={accounts:canonical.accounts,transactions:[{...canonical.transactions[0],payee:name}]};const [,row]=cells(transactionsCSV(fixture,period));assert.equal(row[3],`'${name}`);assert.equal(row[8],'5000.00');}
 const name='Example, "merchant"\nSecond line',fixture={accounts:canonical.accounts,transactions:[{...canonical.transactions[0],payee:name}]};assert.equal(cells(transactionsCSV(fixture,period))[1][3],name);
});
