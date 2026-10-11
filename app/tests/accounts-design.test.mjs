// SPDX-License-Identifier: MPL-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Repository} from '../db/repository.ts';
import {createAPI} from '../server/api.ts';
import {loadCanonical} from './canonical-fixture.mjs';
import {balanceSummary} from '../domain/finance.mjs';
import {accountOverview,accountGroups,trailingStart,historyObservation,historyKey,pointerHistoryIndex,historyGeometry} from '../web/accounts-model.mjs';

mkdirSync('artifacts/runtime',{recursive:true});const outfile=resolve('artifacts/runtime/accounts-render.mjs');
await build({stdin:{contents:"export * from './web/accounts.tsx'; export * from './web/presentation.jsx';",resolveDir:process.cwd()},outfile,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent'});
const ui=await import(pathToFileURL(outfile).href),noop=()=>{};
const render=(name,props,hidden=false)=>renderToStaticMarkup(React.createElement(ui.PresentationContext.Provider,{value:{hidden,format:'symbol',reduceMotion:false}},React.createElement(ui[name],props)));
const asOf='2026-10-09';
async function readState(db){const handle=createAPI(db);const call=(endpoint,token)=>handle(new Request('http://127.0.0.1:4174/api/'+endpoint,{headers:{host:'127.0.0.1:4174',...(token?{'x-talarurus-session':token}:{})}}));const session=await (await call('session')).json();const response=await call('state',session.token);assert.equal(response.status,200);return response.json();}

test('Accounts overview uses live persisted API data and agrees with literal balances, reports and restart',async()=>{
 const directory=mkdtempSync(resolve('artifacts/runtime/accounts-')),path=resolve(directory,'synthetic.sqlite');let db=new Repository(path);
 try{loadCanonical(db);let state=await readState(db),model=accountOverview(state,'All',asOf);assert.equal(model.current.netWorth,'441000');assert.equal(model.current.assets,'441000');assert.equal(model.current.liabilities,'0');assert.equal(model.change,'321000');assert.equal(model.baselineDate,'2026-08-31');assert.equal(model.groups.find(g=>g.id==='cash').total,'441000');assert.equal(model.groups.find(g=>g.id==='credit').total,'0');assert.deepEqual(model.current.balances,{card:'0',checking:'371000',savings:'70000'});
 for(const point of model.observations)assert.equal(point.minor,balanceSummary(state.accounts,state.transactions,{end:new Date(Date.parse(point.date+'T00:00:00Z')+86400000).toISOString().slice(0,10)}).netWorth);
 const grocery=state.transactions.find(t=>t.id==='grocery-1');db.updateTransaction(grocery.id,{amount:'-21000',revision:grocery.revision});state=await readState(db);const updated=accountOverview(state,'All',asOf);assert.equal(updated.current.netWorth,'440000');assert.equal(updated.change,'320000');assert.equal(updated.rows.find(a=>a.id==='card').pending,1);assert.equal(updated.rows.find(a=>a.id==='checking').lastPosted,'2026-09-12');
 db.close();db=new Repository(path);assert.deepEqual(accountOverview(await readState(db),'All',asOf),updated);
 }finally{db.close();}
});
test('Accounts calendar ranges clamp month ends, cross years and keep fixed-period unknown baselines explicit',()=>{
 assert.equal(trailingStart('2024-03-31',1),'2024-02-29');assert.equal(trailingStart('2023-03-31',1),'2023-02-28');assert.equal(trailingStart('2025-01-31',3),'2024-10-31');assert.equal(trailingStart('2024-02-29',12),'2023-02-28');assert.equal(trailingStart('0001-01-02',12),'0001-01-02');
 const db=new Repository();try{loadCanonical(db);const one=accountOverview(db.state(),'1M',asOf);assert.equal(one.start,'2026-09-09');assert.equal(one.change,'0');const three=accountOverview(db.state(),'3M',asOf);assert.equal(three.start,'2026-07-09');assert.equal(three.count,93);assert.equal(three.change,null);assert.equal(three.observations[0].minor,null);assert.equal(three.firstKnown,'2026-08-31');assert.equal(accountOverview(db.state(),'1Y',asOf).count,366);assert.equal(accountOverview(db.state(),'6M',asOf).start,'2026-04-09');assert.throws(()=>accountOverview(db.state(),'2M',asOf),/Unknown/);}finally{db.close();}
});
test('Accounts sparse All history preserves unchanged-date scrubbing, exact transfers, refunds and pending exclusions',()=>{
 const db=new Repository();try{loadCanonical(db);const model=accountOverview(db.state(),'All',asOf);assert(model.observations.length<model.count);const index=date=>Math.round((Date.parse(date)-Date.parse(model.start))/86400000);
 assert.equal(historyObservation(model,index('2026-09-06')).minor,'452000');assert.equal(historyObservation(model,index('2026-09-08')).minor,'441000');assert.equal(historyObservation(model,index('2026-09-10')).minor,'441000');assert.equal(historyObservation(model,index('2026-09-30')).minor,'441000');assert.equal(historyObservation(model,index('2026-10-01')).date,'2026-10-01');assert.equal(historyObservation(model,index('2026-10-01')).minor,'441000');
 for(let i=0;i<model.count;i++){const observation=historyObservation(model,i),next=new Date(Date.parse(observation.date)+86400000).toISOString().slice(0,10);assert.equal(observation.minor,db.report({end:next}).netWorth);}
 }finally{db.close();}
});
test('Accounts missing history remains null across staggered/future anchors and empty accounts',()=>{
 const db=new Repository();try{db.createAccount({name:'Known',type:'checking',anchor:'2026-08-31',opening:'100000'});db.createAccount({name:'Later',type:'savings',anchor:'2026-09-15',opening:'20000'});const model=accountOverview(db.state(),'All',asOf);assert.equal(model.firstKnown,'2026-09-15');assert.equal(model.change,'0');assert.equal(model.observations[0].minor,null);assert.equal(historyObservation(model,1).minor,null);assert.equal(model.current.netWorth,'120000');db.createAccount({name:'Future',type:'asset',anchor:'2027-01-01',opening:'300000'});const future=accountOverview(db.state(),'All',asOf);assert.equal(future.current.netWorth,null);assert.equal(future.change,null);assert.equal(historyGeometry(future),null);assert.equal(future.groups.find(g=>g.id==='assets').total,null);const html=render('Accounts',{state:db.state(),asOf,onSelect:noop,onCreate:noop,onTransfer:noop});assert(html.includes('Total net worth is unavailable.'));assert(html.includes('History isn’t available yet'));assert(!html.includes('role="slider"'));}finally{db.close();}
 const empty=accountOverview({accounts:[],transactions:[],budgets:[]},'All',asOf);assert.deepEqual(empty.observations,[]);assert.equal(empty.change,null);
});
test('Accounts group totals remain signed, with real manual holdings separated from reserved future groups',()=>{
 const db=new Repository();try{for(const [name,type,opening] of [['Cash','checking','10000'],['Savings','savings','5000'],['Credit','credit','-2000'],['Manual asset','asset','90000'],['Manual debt','liability','-10000']])db.createAccount({name,type,opening,anchor:'2026-08-31'});const model=accountOverview(db.state(),'All',asOf);assert.equal(model.current.netWorth,'93000');assert.deepEqual(model.groups.map(g=>[g.id,g.total]),[['cash','15000'],['credit','-2000'],['assets','90000'],['liabilities','-10000']]);assert.equal(model.groups.reduce((s,g)=>s+BigInt(g.total),0n),BigInt(model.current.netWorth));assert.deepEqual(accountGroups.filter(g=>!g.available).map(g=>g.id),['investments','real-estate']);const html=render('Accounts',{state:db.state(),asOf,onCreate:noop,onTransfer:noop,onSelect:noop});assert(html.includes('Other assets'));assert(html.includes('Other liabilities'));assert(!html.includes('Investments'));assert(!html.includes('Real estate'));assert(html.includes('−$20.00'));}finally{db.close();}
});
test('Accounts date navigation and pointer scrubbing clamp bounds for touch, keyboard and narrow plots',()=>{
 assert.equal(historyKey(5,'ArrowLeft',10),4);assert.equal(historyKey(5,'ArrowRight',10),6);assert.equal(historyKey(5,'Home',10),0);assert.equal(historyKey(5,'End',10),9);assert.equal(historyKey(5,'PageUp',10),9);assert.equal(historyKey(5,'PageDown',10),0);assert.equal(historyKey(0,'ArrowLeft',10),0);assert.equal(historyKey(9,'ArrowRight',10),9);assert.equal(historyKey(5,'Escape',10),null);
 assert.equal(pointerHistoryIndex(-100,0,390,11),0);assert.equal(pointerHistoryIndex(1000,0,390,11),10);assert.equal(pointerHistoryIndex(195,0,390,11),5);assert.equal(pointerHistoryIndex(50,0,1,1),0);
});
test('Accounts chart geometry retains real jumps/gaps and safe exact values beyond chart-number limits',()=>{
 const db=new Repository();try{loadCanonical(db);const model=accountOverview(db.state(),'3M',asOf),geometry=historyGeometry(model,390,260);assert(geometry.line.startsWith('M'));assert(geometry.line.includes(' H'));assert(!geometry.line.includes('NaN'));assert(geometry.x(model.firstKnown)>16);assert(geometry.y('441000')>=26);assert(geometry.y('441000')<=234);
 }finally{db.close();}
 const state={accounts:[{id:'huge',name:'Synthetic large asset',type:'asset',anchor:'2026-08-31',opening:'9223372036854775807'}],transactions:[],budgets:[]};const model=accountOverview(state,'All',asOf);assert.equal(model.current.netWorth,'9223372036854775807');const geometry=historyGeometry(model,320,260);assert(!geometry.line.includes('NaN'));assert.equal(geometry.y(model.current.netWorth),130);
 const single=accountOverview(state,'All','2026-08-31');assert.equal(single.count,1);assert.equal(historyGeometry(single,320,260).x('2026-08-31'),160);
});
test('Accounts page and details render native controls, truthful updates, escaped names and masked chart/data',()=>{
 const db=new Repository();try{loadCanonical(db);const account=db.accounts().find(a=>a.id==='checking');db.updateAccount(account.id,{name:'<img src=x onerror=alert(1)>',revision:1});const state=db.state(),props={state,asOf,onCreate:noop,onTransfer:noop,onSelect:noop};const html=render('Accounts',props);
 assert(html.includes('$4,410.00'));assert(html.includes('+$3,210.00'));assert(html.includes('role="slider"'));assert(html.includes('aria-valuetext="October 9, 2026: $4,410.00"'));assert.equal((html.match(/aria-pressed=/g)||[]).length,5);assert(html.includes('&lt;img src=x onerror=alert(1)&gt;'));assert(!html.includes('<img'));assert(html.includes('Last posted entry'));assert(!html.includes('Synced'));assert(!html.includes('Live balance'));
 const masked=render('Accounts',props,true);assert(!/\$[\d,]+/.test(masked));assert(!masked.includes('role="slider"'));assert(!masked.includes('linearGradient'));
 const detail=render('AccountDetails',{state,account:state.accounts.find(a=>a.id==='checking'),asOf,onEdit:noop,onTransactions:noop});assert(detail.includes('$3,710.00'));assert(detail.includes('$1,000.00'));assert(detail.includes('View transactions'));assert(detail.includes('No live banking or price updates.'));
 const hidden=render('AccountDetails',{state,account:state.accounts.find(a=>a.id==='checking'),asOf,onEdit:noop,onTransactions:noop},true);assert(!/\$[\d,]+/.test(hidden));assert(hidden.includes('disabled=""'));
 }finally{db.close();}
});
