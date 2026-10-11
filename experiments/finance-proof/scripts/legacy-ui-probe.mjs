// SPDX-License-Identifier: MPL-2.0
// Execute preserved pre-refinement components against real limited-data fixtures.
// This is historical regression evidence, not a browser or current-suite verdict.
import {build} from 'esbuild';import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {demos} from '../visual/scenarios.mjs';import {report} from '../shared/finance.mjs';
const outfile=resolve('.runtime/legacy-ui.mjs');
await build({stdin:{contents:readFileSync('artifacts/ui-refinement/app-before.jsx','utf8')+'\nexport {CashFlow,NetWorth};',resolveDir:resolve('visual'),sourcefile:'preserved-baseline.jsx',loader:'jsx'},outfile,bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},logLevel:'silent'});
const components=await import(pathToFileURL(outfile).href),filters={start:'2026-09-01',end:'2026-10-01'},cases=[];
for(const [component,dataset] of [['NetWorth','no-accounts'],['NetWorth','missing-history'],['CashFlow','no-income']]){
 const fixture=demos[dataset],r=report(fixture.accounts,fixture.transactions,filters);
 try{const html=renderToStaticMarkup(React.createElement(components[component],{fixture,filters,r,onDrill(){}}));cases.push({component,dataset,status:/NaN|Infinity/.test(html)?'FAIL':'PASS',criterion:'No crash or non-finite percentages',error:/NaN|Infinity/.test(html)?'Non-finite cash-flow percentage is rendered':null});}
 catch(error){cases.push({component,dataset,status:'FAIL',criterion:'No crash or non-finite percentages',error:error.message});}
}
writeFileSync('artifacts/ui-refinement/legacy-ui-probe.json',JSON.stringify({notice:'Preserved original components, executed before/after helper edits; current financial policy and fixtures are real and unchanged',cases},null,2));console.log(JSON.stringify(cases,null,2));
