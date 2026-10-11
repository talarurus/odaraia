// SPDX-License-Identifier: MPL-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';
import {mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Repository} from '../db/repository.ts';
import {loadCanonical} from './canonical-fixture.mjs';
import {initialTxFilters} from '../web/ui-model.mjs';

mkdirSync('artifacts/runtime',{recursive:true});
const outfile=resolve('artifacts/runtime/polish-render.mjs');
await build({stdin:{contents:"export * from './web/overview.tsx'; export * from './web/import.tsx'; export * from './web/settings.tsx'; export * from './web/forms.tsx'; export * from './web/reports.jsx'; export * from './web/presentation.jsx';",resolveDir:process.cwd()},outfile,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent'});
const ui=await import(pathToFileURL(outfile).href);
const render=(name,props,hidden=false)=>renderToStaticMarkup(React.createElement(ui.PresentationContext.Provider,{value:{hidden,format:'symbol',reduceMotion:false}},React.createElement(ui[name],props)));
const noop=()=>{};

test('UI budget cards retain exact actual, remaining, refund and overspending amounts; masking hides bars',()=>{
 const db=new Repository();try{loadCanonical(db);db.setBudget({month:'2026-09',category:'Housing',planned:'100000'});const props={state:db.state(),month:'2026-09',onSaved:noop,onDrill:noop};const html=render('Budgets',props);
 assert(html.includes('$250.00'));assert(html.includes('$180.00'));assert(html.includes('$70.00'));
 assert(html.includes('$1,500.00'));assert(html.includes('−$500.00'));assert(html.includes('Overspent'));
 assert(html.includes('Housing: $1,500.00 spent of $1,000.00 target'));
 const masked=render('Budgets',props,true);assert(!/\$[\d,]+/.test(masked));assert(!masked.includes('budget-track'));
 }finally{db.close();}
});
test('UI budget progress is bounded for overspending, zero targets, net refunds and large exact amounts',()=>{
 for(const [a,p,w] of [['18000','25000',72],['150000','100000',100],['1','0',100],['0','0',0],['-100','25000',0],['4000000000000000','8000000000000000',50]])assert.equal(ui.budgetProgress(a,p),w);
});
test('UI CSV preview preserves duplicate safeguards and reconciliation in desktop and mobile renderers',()=>{
 const tx={date:'2026-09-03',payee:'<script>alert(1)</script>',category:'Groceries',classification:'expense',status:'posted',amount:'-750'};
 const rows=[{row:2,transaction:tx,duplicate:false,requiresReview:true,candidates:[{id:'pending',payee:'Shop',date:tx.date,status:'pending',classification:'expense'},{id:'transfer',payee:'Pair',date:tx.date,status:'posted',classification:'transfer'}]},{row:3,transaction:tx,duplicate:true,sourceChanged:true,candidates:[]}];
 const html=render('ImportPreview',{rows,decisions:{2:'skip',3:'skip'},onDecision:noop,busy:false});
 assert.equal((html.match(/value="skip" selected=""/g)||[]).length,2);
 assert(html.includes('aria-label="Decision row 2"'));assert(html.includes('aria-label="Mobile decision row 2"'));
 assert(!html.includes('Decision row 3'));assert(!html.includes('Mobile decision row 3'));
 assert.equal((html.match(/Known ID with changed source details/g)||[]).length,2);
 assert(html.includes('value="match:pending"'));assert(!html.includes('value="match:transfer"'));
 assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(html.includes('−$7.50'));
 const masked=render('ImportPreview',{rows,decisions:{2:'skip',3:'skip'},onDecision:noop,busy:false},true);assert(!/\$[\d,]+/.test(masked));assert(masked.includes('disabled=""'));
});
test('UI transaction filters expose active context and voided status without deferred selection controls',()=>{
 const db=new Repository();try{loadCanonical(db);const html=render('Transactions',{fixture:db.state(),period:{start:'2026-09-01',end:'2026-10-01'},filters:{...initialTxFilters,account:'checking',category:'Groceries',classification:'expense'},setFilters:noop,onDetail:noop,onFilterSheet:noop,tools:React.createElement('button',{},'Import CSV')});
 assert(html.includes('Remove category filter: Groceries'));assert(html.includes('Remove account filter: Harbor Checking'));assert(html.includes('>Voided</button>'));assert(html.includes('colSpan="4"'));assert(!html.includes('Bulk editing'));assert(html.includes('transaction-actions'));
 assert(html.includes('Groceries · Harbor Checking'));assert(html.includes('$200.00 out'));assert(html.includes('$20.00 in')); // Gross account outflow and refund inflow; net category spending is $180 above.
 }finally{db.close();}
});
test('UI imported transaction provenance stays escaped and amount-masked; form retains revision/void controls',()=>{
 const existing={id:'x',revision:3,account:'a',date:'2026-09-03',amount:'-750',payee:'Synthetic',category:'Groceries',classification:'expense',status:'posted',provenance:{fileName:'<img src=x>',row:2,normalized:{date:'2026-09-03',amount:'-750',payee:'Synthetic'}}};
 const props={existing,accounts:[{id:'a',name:'Checking'}],transactions:[existing],onSaved:noop};const html=render('TransactionForm',props);
 assert(html.includes('History, transfers &amp; corrections'));assert(html.includes('Void transaction'));assert(html.includes('disabled=""'));assert(html.includes('&lt;img src=x&gt;'));assert(html.includes('Original amount'));
 const masked=render('TransactionForm',props,true);assert(!masked.includes('Original amount'));assert(!masked.includes('−$7.50'));assert(masked.includes('Show amounts to inspect source evidence.'));
});
test('UI settings categories retain formatting and recovery workflows; base palette is consolidated',()=>{
 const html=render('Settings',{appearance:{preference:'dark',theme:'dark',persistent:true},preferences:{hidden:false,format:'symbol',reduceMotion:true},onAppearance:noop,onPresentation:noop,persistent:true,onSaved:noop});
 assert.equal((html.match(/type="radio"/g)||[]).length,3);assert(!html.includes('Restore a backup'));
 const props={appearance:{preference:'dark',theme:'dark',persistent:true},preferences:{hidden:false,format:'symbol',reduceMotion:true},onAppearance:noop,onPresentation:noop,persistent:true,onSaved:noop};
 const display=render('Settings',{...props,initialSection:'display'});assert(display.includes('value="code"'));assert(display.includes('Hide financial amounts'));assert(!display.includes('Appearance preference'));
 const recovery=render('Settings',{...props,initialSection:'recovery'});assert(recovery.includes('Restore a backup'));assert(recovery.includes('Existing records will cause restoration to be rejected.'));assert(recovery.includes('recovery-card'));
 const empty=render('CSVImport',{accounts:[],onSaved:noop});assert(empty.includes('Create an account first'));assert(empty.includes('aria-current="step"'));assert(empty.includes('disabled=""'));
 assert(!readFileSync('web/style.css','utf8').includes('--canvas:#'));assert(readFileSync('web/design-system.css','utf8').includes('--canvas:var(--tf-page)'));
});
test('UI compact Sankey labels preserve ordinary names and fit long Unicode labels without changing values',()=>{
 assert.equal(ui.compactFlowLabel('Groceries'),'Groceries');assert.equal(ui.compactFlowLabel('Long account and category name',20),'Long account and ca…');assert.equal(Array.from(ui.compactFlowLabel('😀'.repeat(40),20)).length,20);
});
