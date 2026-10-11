// SPDX-License-Identifier: MPL-2.0
// Controlled SSR comparison only; not browser/frame-rate, SQLite or hosted performance.
import {build} from 'esbuild';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
if(process.argv[2]==='worker'){
 const {App}=await import(pathToFileURL(resolve(process.argv[3])).href),stats=[];let warnings=0;console.warn=()=>warnings++;
 for(const page of ['cashflow','spending','transactions','networth','settings']){
  globalThis.location={search:`?page=${page}&dataset=sample`};const render=()=>renderToStaticMarkup(React.createElement(App));
  const start=performance.now();render();const first=performance.now()-start;
  for(let i=0;i<4;i++)render();const times=[];
  for(let i=0;i<25;i++){const start=performance.now();render();times.push(performance.now()-start);}times.sort((a,b)=>a-b);
  stats.push({page,firstMs:first,warmP50Ms:times[12],warmP95Ms:times[23],warmMaxMs:times.at(-1)});
 }
 console.log(JSON.stringify({stats,warnings,rssBytes:process.memoryUsage().rss}));
}else{
 mkdirSync('artifacts/ui-refinement',{recursive:true});const options={bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},logLevel:'silent'};
 await build({...options,entryPoints:['visual/app.jsx'],outfile:'.runtime/ui-current.mjs'});
 await build({...options,stdin:{contents:readFileSync('artifacts/ui-refinement/app-before.jsx','utf8'),resolveDir:resolve('visual'),sourcefile:'preserved-baseline.jsx',loader:'jsx'},outfile:'.runtime/ui-previous.mjs'});
 const runs=[];for(let trial=1;trial<=3;trial++)for(const variant of ['previous','current']){
  const child=spawnSync(process.execPath,[process.argv[1],'worker',`.runtime/ui-${variant}.mjs`],{encoding:'utf8'});
  if(child.status!==0)throw Error(child.stderr||child.error?.message||`Worker exit ${child.status}`);
  runs.push({trial,variant,...JSON.parse(child.stdout)});
 }
 const evidence={scope:'Three fresh Node processes per variant, each with first render + four warmups + 25 samples per page. First Settings/other renders share prior-page work; only Cash flow is a cold first page. SSR only: ResponsiveContainer has no browser dimensions and emits recorded warnings.',rows:115,accounts:3,versions:{node:process.version,react:JSON.parse(readFileSync('node_modules/react/package.json')).version},runs};
 writeFileSync('artifacts/ui-refinement/ui-performance.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(runs.map(({trial,variant,rssBytes,stats})=>({trial,variant,rssMiB:rssBytes/1048576,stats})),null,2));
}
