// SPDX-License-Identifier: MPL-2.0
// Real React server rendering and component handlers; never a browser-layout substitute.
import test from 'node:test';import assert from 'node:assert/strict';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';import {mkdirSync,readFileSync} from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {demos} from '../visual/scenarios.mjs';import {report,money} from '../shared/finance.mjs';import {flowLabelLayout} from '../visual/flow-labels.mjs';import {flowPresentation,percentageLabel} from '../visual/ui-model.mjs';
mkdirSync('.runtime',{recursive:true});const outfile=resolve('.runtime/ui-refinement-ssr.mjs');
await build({entryPoints:['visual/app.jsx'],outfile,bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},logLevel:'silent'});
const {App,FlowNode,FlowLink}=await import(pathToFileURL(outfile).href);
const render=(page,dataset='canonical',presentation)=>{globalThis.location={search:`?page=${page}&dataset=${dataset}`};return renderToStaticMarkup(React.createElement(App,{presentation}));};
test('Rendered percentages explicitly use income on Cash flow and spending on Spending',()=>{
 const cash=render('cashflow'),spending=render('spending');assert(cash.includes('% of income'));assert(cash.includes('3.6% of income'));assert(spending.includes('% of spending'));assert(spending.includes('10.1% of spending'));assert(cash.includes('transfers reduce expenses')===false);assert(spending.includes('after refunds'));
});
test('All synthetic scenarios render all five pages without crashes, NaN or infinity',()=>{
 for(const id of Object.keys(demos))for(const page of ['cashflow','spending','transactions','networth','settings']){const html=render(page,id);assert(!html.includes('NaN'),`${page}/${id}`);assert(!html.includes('Infinity'),`${page}/${id}`);assert(html.includes('Synthetic'));}
});
test('Empty/pending-only cash flow never renders a misleading Sankey container',()=>{
 for(const [id,message] of [['no-accounts','No accounts yet'],['no-transactions','No transactions this period'],['all-pending','All transactions are pending']]){const html=render('cashflow',id);assert(html.includes(message));assert(!html.includes('Cash flow Sankey diagram'));assert(html.includes('Choose demo data'));}
 assert(render('spending','no-spending').includes('No spending this period'));assert(render('cashflow','no-income').includes('% of income is unavailable'));assert(render('cashflow','negative-flow').includes('Net deficit'));
});
test('Missing history renders Unavailable rather than zero net-worth charts',()=>{
 const html=render('networth','missing-history');assert(html.includes('Balance history unavailable'));assert(html.includes('Unavailable'));assert(!html.includes('Daily net worth'));assert(!html.includes('$0.00'));
 assert(render('networth','no-accounts').includes('No accounts yet'));
});
test('Cross-screen rendered totals and refund percentages retain canonical financial contract',()=>{
 assert(render('cashflow').includes('$5,000.00'));assert(render('cashflow').includes('$1,790.00'));assert(render('cashflow').includes('$3,210.00'));assert(render('spending').includes('$1,790.00'));assert(render('networth').includes('$4,410.00'));assert(render('networth').includes('+$3,210.00'));
 const posted=demos.canonical.transactions.filter(t=>t.status==='posted');const out=posted.filter(t=>BigInt(t.amount)<0n).reduce((s,t)=>s-BigInt(t.amount),0n);assert.equal(out,241000n);assert.equal(out-60000n-2000n,179000n);assert(render('transactions').includes('$2,410.00 out'));
});
test('Masked pages contain no ordinary financial text, amount chart or financial tooltip',()=>{
 for(const page of ['cashflow','spending','transactions','networth']){const html=render(page,'canonical',{hidden:true,format:'code',reduceMotion:true});assert(html.includes('••••'));assert(!/\$[\d,]+/.test(html),page);assert(!/USD [\d,]+/.test(html),page);assert(!/\d+\.\d%/.test(html),page);assert(!html.includes('finance-tooltip'));assert(!html.includes('recharts-responsive-container'));assert(!html.includes('Search merchant, category or amount'));}
 const settings=render('settings','canonical',{hidden:true,format:'symbol',reduceMotion:false});assert(/disabled=""[^>]*>.*?Export selected-period/s.test(settings));assert(settings.includes('Show financial amounts to enable downloads'));
});
test('Currency-code display changes only USD presentation across financial pages',()=>{
 const preferences={hidden:false,format:'code',reduceMotion:false};for(const page of ['cashflow','spending','transactions','networth']){const html=render(page,'canonical',preferences);assert(/USD [\d,]+\.\d{2}/.test(html));assert(!/\$[\d,]+/.test(html));assert(!html.includes('EUR'));}
});
test('Settings includes bounded privacy/export/motion controls and synthetic-data disclosures',()=>{
 const html=render('settings');for(const text of ['USD display','Hide financial amounts','Reduce Motion','Export selected-period transactions','not a complete backup','no currency conversion','CSV period: September 2026'])assert(html.includes(text));assert.equal((html.match(/type="radio"/g)||[]).length,3);assert.equal((html.match(/type="checkbox"/g)||[]).length,2);
});
test('Net-credit and reversal history labels stay truthful and unresolved reports are explicit',()=>{
 const credit=render('cashflow','net-credit'),reversal=render('cashflow','income-reversal');assert(credit.includes('Housing · Expense'));assert(credit.includes('−$200.00'));assert(reversal.includes('Adjustment · Income'));assert(reversal.includes('−$100.00'));
 const needsReview=render('cashflow','needs-review');assert(needsReview.includes('Report incomplete: 1 posted records'));assert(needsReview.includes('Review transactions'));assert(!needsReview.includes('Cash flow Sankey diagram'));
});
test('Sankey node focus and Enter/Space activate the actual drill-down handler',()=>{
 const r=report(demos.canonical.accounts,demos.canonical.transactions,{start:'2026-09-01',end:'2026-10-01'}),data=flowPresentation(r),payload=data.nodes.find(x=>x.name==='Groceries'),calls=[],inspection=[];
 const element=FlowNode({x:400,y:80,width:5,height:12,index:data.nodes.indexOf(payload),payload,select:x=>calls.push(x),inspect:x=>inspection.push(x),layout:flowLabelLayout(data),centerLabel:'Income',money,percent:v=>percentageLabel(v,r.income,'income')}),label=element.props.children[2];
 assert.equal(label.props.role,'button');assert.equal(label.props.tabIndex,'0');assert(label.props['aria-label'].includes('3.6% of income'));label.props.onFocus();assert.deepEqual(inspection,['Groceries']);
 let prevented=0;for(const key of ['Enter',' ','Escape'])label.props.onKeyDown({key,preventDefault:()=>prevented++});assert.equal(prevented,2);assert.deepEqual(calls,[payload,payload]);label.props.onBlur();assert.equal(inspection.at(-1),null);
});
test('Sankey links expose amount/percentage and execute pointer and keyboard selection',()=>{
 const r=report(demos.canonical.accounts,demos.canonical.transactions,{start:'2026-09-01',end:'2026-10-01'}),data=flowPresentation(r),payload=data.links.find(x=>x.name==='Housing'),calls=[];
 const element=FlowLink({sourceX:1,targetX:10,sourceY:2,targetY:5,sourceControlX:3,targetControlX:8,linkWidth:5,payload,active:'Housing',setActive:x=>calls.push(x),select:x=>calls.push(x),money,percent:v=>percentageLabel(v,r.income,'income'),data});
 assert.equal(element.props.role,'button');assert.equal(element.props.strokeWidth,5);assert.equal(element.props.strokeOpacity,.68);assert(element.props['aria-label'].includes('30.0% of income'));element.props.onFocus();element.props.onKeyDown({key:'Enter',preventDefault(){}});element.props.onClick();assert.deepEqual(calls,['Housing',payload,payload]);
});
test('Reduced-motion CSS applies to OS and app preference without changing palette tokens',()=>{
 const css=readFileSync('visual/style.css','utf8'),previous=readFileSync('harness/fixtures/style-before.css','utf8');assert(css.includes('@media(prefers-reduced-motion:reduce)'));assert(css.includes(':root[data-motion=reduce]'));assert(css.includes('animation:none!important'));
 const roots=text=>text.match(/:root(?:\[data-theme=dark\])?\{[^}]+\}/g);assert.deepEqual(roots(css),roots(previous));assert(css.includes('env(safe-area-inset-bottom)'));assert(css.includes('.sankey-plot{min-width:800px}'));
});
