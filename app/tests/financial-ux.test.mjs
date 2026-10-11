// SPDX-License-Identifier: MPL-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {observedNetWorthHistory} from '../web/net-worth-model.mjs';
import {accountOverview,historyGeometry,historyObservation} from '../web/accounts-model.mjs';
import {balanceSummary} from '../domain/finance.mjs';
import {monthRange} from '../web/periods.mjs';
import {canonical} from '../domain/fixture.mjs';

const asOf='2026-10-10',period=monthRange('2026-10');
const account=(id='cash',anchor='2026-09-30',opening='10000')=>({id,name:id,type:'checking',anchor,opening,currency:'USD'});
const entry=(date,amount,id=date)=>({id,date,amount,account:'cash',status:'posted',classification:'adjustment',payee:id});
const state=(transactions=[],accounts=[account()])=>({accounts,transactions,budgets:[]});

test('Current partial-month history, summary and event disclosure stop on the local as-of date',()=>{
 const fixture=state([entry('2026-10-02','125'),entry(asOf,'-25'),entry('2026-10-11','99999'),entry('2026-10-31','50000'),{...entry('2026-10-09','12345'),status:'pending'}]);
 const history=observedNetWorthHistory(fixture,period,asOf);
 assert.equal(history.days.length,10);assert.equal(history.asOf,asOf);assert.equal(history.end,'2026-10-11');assert(history.futureExcluded);
 assert.equal(history.days.at(-1).minor,'10100');assert.equal(history.summary.netWorth,'10100');assert.equal(history.change,'100');
 assert(history.days.every(d=>d.date<=asOf));assert(history.largest.every(d=>d.date<=asOf));
 assert(!JSON.stringify(history.days).includes('2026-10-11'));assert(!JSON.stringify(history.days).includes('12345'));
 for(const d of history.days)assert.equal(d.minor,balanceSummary(fixture.accounts,fixture.transactions,{end:new Date(Date.parse(d.date+'T00:00:00Z')+86400000).toISOString().slice(0,10)}).netWorth);
 assert.notEqual(balanceSummary(fixture.accounts,fixture.transactions,period).netWorth,history.summary.netWorth,'Fixture exercises the previous future-summary error');
});

test('Month-end boundaries include the last day exactly once and exclude the following month',()=>{
 const fixture=state([entry('2026-10-31','123'),entry('2026-11-01','456')]);
 for(const cutoff of ['2026-10-31','2026-11-01']){
  const h=observedNetWorthHistory(fixture,period,cutoff);assert.equal(h.days.length,31);assert.equal(h.asOf,'2026-10-31');assert.equal(h.summary.netWorth,'10123');assert.equal(h.change,'123');assert(!h.futureExcluded);
 }
 const first=observedNetWorthHistory(fixture,monthRange('2026-11'),'2026-11-01');assert.equal(first.days.length,1);assert.equal(first.days[0].minor,'10579');assert.equal(first.days[0].delta,'456');
});

test('Leap days and year rollover obey end-exclusive calendar dates',()=>{
 const leap=state([entry('2028-02-29','1')],[account('cash','2028-01-31')]);
 assert.equal(observedNetWorthHistory(leap,monthRange('2028-02'),'2028-02-28').days.length,28);
 const last=observedNetWorthHistory(leap,monthRange('2028-02'),'2028-02-29');assert.equal(last.days.length,29);assert.equal(last.summary.netWorth,'10001');
 const year=observedNetWorthHistory(state([entry('2026-12-31','123'),entry('2027-01-01','999')]),monthRange('2026-12'),'2026-12-31');assert.equal(year.asOf,'2026-12-31');assert.equal(year.end,'2027-01-01');assert.equal(year.summary.netWorth,'10123');
});

test('Future periods never expose a repeated current balance or future opening/posting as observed history',()=>{
 const fixture=state([entry('2026-11-03','900')],[account(),account('future','2026-11-01','20000')]);
 const h=observedNetWorthHistory(fixture,monthRange('2026-11'),asOf);
 assert.deepEqual(h.days,[]);assert.equal(h.summary.netWorth,null);assert.equal(h.change,null);assert.equal(h.asOf,null);assert.equal(h.reason,'This period has not started');assert.equal(h.firstKnown,null);
 const accounts=accountOverview(fixture,'All',asOf);assert.equal(accounts.current.netWorth,null);assert(accounts.observations.every(d=>d.date<=asOf));assert.equal(historyGeometry(accounts),null);
});

test('Staggered opening coverage stays null before the final anchor and never becomes a zero balance or gain',()=>{
 const fixture=state([],[account(),account('later','2026-10-05','5000')]);
 const h=observedNetWorthHistory(fixture,period,asOf);assert(h.days.slice(0,4).every(d=>d.minor===null&&d.delta===null));assert.equal(h.days[4].minor,'15000');assert.equal(h.days[4].delta,null);assert.equal(h.firstKnown,'2026-10-05');assert(h.partial);assert.equal(h.change,null);assert(h.flat);
 const geometry=historyGeometry(h,600,180);assert(geometry.line.startsWith(`M${geometry.x('2026-10-05').toFixed(2)}`));assert(!geometry.line.includes('NaN'));
 fixture.accounts.push(account('future','2026-10-15','100'));
 const unknown=observedNetWorthHistory(fixture,period,asOf);assert.equal(unknown.summary.netWorth,null);assert(unknown.days.every(d=>d.minor===null));assert.match(unknown.reason,/unavailable/);
});

test('Observed account filters, canonical transfer/refund steps and period change agree with the ledger',()=>{
 const h=observedNetWorthHistory(canonical,monthRange('2026-09'),asOf);
 assert.equal(h.summary.netWorth,'441000');assert.equal(h.change,'321000');assert.equal(h.days.find(d=>d.date==='2026-09-06').minor,'452000');assert.equal(h.days.find(d=>d.date==='2026-09-08').minor,'441000');
 const selected=observedNetWorthHistory(canonical,{...monthRange('2026-09'),account:'checking'},asOf);
 assert.deepEqual(selected.accounts.map(a=>a.id),['checking']);assert.equal(selected.summary.netWorth,'371000');assert.equal(selected.summary.assets,'371000');assert(!JSON.stringify(selected.days).includes('Credit Card'));
 const geometry=historyGeometry(h,600,220);assert(geometry.line.includes(' H'));assert(geometry.line.includes(' V'));assert(!geometry.line.includes(' C'));assert(!geometry.line.includes('NaN'));
});

test('Flat zero/positive/negative balances are centered on nonzero domains and cent changes are not magnified',()=>{
 for(const opening of ['0','10000','-10000']){
  const h=observedNetWorthHistory(state([],[account('cash','2026-09-30',opening)]),period,asOf),g=historyGeometry(h,600,180);
  assert(h.flat);assert(g.flat);assert(BigInt(g.low)<BigInt(opening));assert(BigInt(g.high)>BigInt(opening));assert.equal(g.y(opening),90);assert.equal(historyObservation(h,9).minor,opening);
 }
 const cent=observedNetWorthHistory(state([entry('2026-10-05','1')]),period,asOf),g=historyGeometry(cent,600,180);
 assert(!g.flat);assert.equal(cent.change,'1');assert.equal(BigInt(g.high)-BigInt(g.low),201n);
 const single=observedNetWorthHistory(state(),period,'2026-10-01');assert.equal(single.knownCount,1);assert.equal(historyGeometry(single,600,180).x('2026-10-01'),300);
});

mkdirSync('artifacts/runtime',{recursive:true});const output=resolve('artifacts/runtime/financial-ux-render.mjs');
await build({stdin:{contents:"export * from './web/reports.jsx'; export * from './web/accounts.tsx'; export * from './web/presentation.jsx';",resolveDir:process.cwd()},outfile:output,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent'});
const ui=await import(pathToFileURL(output).href);
const render=(fixture,filters=period,hidden=false)=>renderToStaticMarkup(React.createElement(ui.PresentationContext.Provider,{value:{hidden,format:'symbol',reduceMotion:true}},React.createElement(ui.NetWorth,{fixture,filters,asOf,r:balanceSummary(fixture.accounts,fixture.transactions,filters)})));

test('Net Worth renders the observed summary, pinned exact inspection, flat notice and bounded accessible selection',()=>{
 const html=render(state([entry('2026-10-11','99999')]));
 assert(html.includes('$100.00'));assert(!html.includes('$1,099.99'));assert(html.includes('As of today'));assert(html.includes('October 10, 2026: $100.00'));assert(html.includes('No change in recorded daily balances.'));
 assert(html.includes('aria-valuemax="9"'));assert(html.includes('Future dates are excluded; no projections are shown.'));assert(!html.includes('<th scope="row">2026-10-11'));
 assert(html.includes('data-surface="canvas"'));assert(!html.includes('foreground-surface'));
 const future=render(state(),monthRange('2026-11'));assert(future.includes('This period has not started'));assert(!future.includes('role="slider"'));assert(!future.includes('$100.00'));
 const missing=render(state([],[account(),account('later','2026-10-05','5000')]));assert(missing.includes('Earlier dates are unavailable, not zero.'));assert(missing.includes('Start-of-period balance unavailable'));
 const masked=render(state(),period,true);assert(!/\$[\d,]+/.test(masked));assert(!masked.includes('role="slider"'));assert(!masked.includes('No change in recorded daily balances.'));
});

test('Invalid observation dates and inverted periods fail explicitly',()=>{
 assert.throws(()=>observedNetWorthHistory(state(),period,'2026-02-30'),/Invalid date/);
 assert.throws(()=>observedNetWorthHistory(state(),{start:asOf,end:asOf},asOf),/nonempty/);
});


test('Accounts retains signed group subtotals and detail controls without an upward arrow for a flat period',()=>{
 const fixture=state([],[account(),{...account('card','2026-09-30','-2500'),type:'credit'}]);
 const html=renderToStaticMarkup(React.createElement(ui.Accounts,{state:fixture,asOf,onSelect(){},onCreate(){},onTransfer(){}}));
 assert(html.includes('accounts-change is-flat'));assert(!html.includes('accounts-change-direction'));assert(html.includes('$75.00'));assert(html.includes('−$25.00'));
 assert(html.includes('aria-labelledby="accounts-group-cash"'));assert(html.includes('aria-labelledby="accounts-group-credit"'));assert(html.includes('aria-label="Open card, Credit card, balance −$25.00"'));
 assert(!html.includes('YOUR PORTFOLIO'));assert(html.includes('Account history timeframe'));
});
