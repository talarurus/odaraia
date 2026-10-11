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
mkdirSync('artifacts/runtime',{recursive:true});
const outfile=resolve('artifacts/runtime/apple-render.mjs');
await build({stdin:{contents:"export * from './web/accounts.tsx'; export * from './web/presentation.jsx';",resolveDir:process.cwd()},outfile,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent'});
const ui=await import(pathToFileURL(outfile).href),noop=()=>{};
const render=(state,hidden=false)=>renderToStaticMarkup(React.createElement(ui.PresentationContext.Provider,{value:{hidden,format:'symbol',reduceMotion:true}},React.createElement(ui.Accounts,{state,asOf:'2026-10-09',onCreate:noop,onTransfer:noop,onSelect:noop})));

test('Asset shares only describe complete positive assets; debt, overdrafts and masked values expose no proportions',()=>{
 const db=new Repository();try{
  loadCanonical(db);let html=render(db.state());assert(html.includes('100% of assets'));
  db.createAccount({name:'Manual holding',type:'asset',opening:'441000',anchor:'2026-08-31'});
  html=render(db.state());assert.equal((html.match(/50% of assets/g)||[]).length,2);
  db.createAccount({name:'Manual debt',type:'liability',opening:'-50000',anchor:'2026-08-31'});
  html=render(db.state());assert.equal((html.match(/% of assets/g)||[]).length,2);assert(html.includes('−$500.00'));
  html=render(db.state(),true);assert(!html.includes('% of assets'));assert(!/\$[\d,]+/.test(html));assert(!html.includes('role="slider"'));assert(!html.includes('linearGradient'));
  db.createAccount({name:'Overdrawn cash',type:'checking',opening:'-10000',anchor:'2026-08-31'});
  html=render(db.state());assert.equal((html.match(/% of assets/g)||[]).length,1);
  db.createAccount({name:'Future asset',type:'asset',opening:'10000',anchor:'2027-01-01'});
  assert(!render(db.state()).includes('% of assets'));
 }finally{db.close();}
});

test('Zero assets do not produce percentages and escaped long account labels keep accessible detail controls',()=>{
 const state={accounts:[{id:'zero',name:'<img src=x> '+ 'Very long account name '.repeat(12),type:'checking',anchor:'2026-08-31',opening:'0'}],transactions:[],budgets:[]};
 const html=render(state);assert(!html.includes('% of assets'));assert(!html.includes('NaN'));assert(!html.includes('<img'));assert(html.includes('&lt;img src=x&gt;'));assert(html.includes('aria-label="Open &lt;img src=x&gt;'));
 assert(html.includes('aria-orientation="horizontal"'));assert(html.includes('Missing balances are unavailable'));assert(html.includes('aria-describedby='));
});

function luminance(hex){if(hex.length===4)hex='#'+[...hex.slice(1)].map(v=>v+v).join('');const components=hex.match(/[\da-f]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*components[0]+.7152*components[1]+.0722*components[2];}
const contrast=(a,b)=>{const [lo,hi]=[luminance(a),luminance(b)].sort((a,b)=>a-b);return (hi+.05)/(lo+.05);};
test('Both appearances meet contrast for financial content, secondary labels, controls and chart lines',()=>{
 const css=readFileSync('web/design-system.css','utf8');
 const blocks=[css.match(/:root \{([\s\S]*?)\}/)[1],css.match(/:root\[data-theme=dark\] \{([\s\S]*?)\}/)[1]];
 for(const block of blocks){const t=Object.fromEntries([...block.matchAll(/--tf-([\w-]+):\s*(#[\da-f]{3,6})(?=;)/gi)].map(m=>[m[1],m[2]]));
  for(const [foreground,background,min] of [['text','page',4.5],['text','surface',4.5],['muted','page',4.5],['muted','surface',4.5],['muted','inset',4.5],['on-primary','primary',4.5],['positive','page',4.5],['negative','page',4.5],['chart','page',3],['chart','surface',3]])assert(contrast(t[foreground],t[background])>=min,`${foreground} on ${background}: ${contrast(t[foreground],t[background])}`);
 }
});

test('On-glass primary copy keeps contrast at the native readable tint endpoints',()=>{
 const css=readFileSync('web/design-system.css','utf8');
 const native=readFileSync('desktop/Compositing.swift','utf8').match(/readableTintAlpha\(dark:Bool\)->Double \{ 1-\(dark \? ([\d.]+):([\d.]+)\)\*glass \}/);
 assert(native,'Use the actual product tint endpoints');
 const blocks=[css.match(/:root \{([\s\S]*?)\}/)[1],css.match(/:root\[data-theme=dark\] \{([\s\S]*?)\}/)[1]];
 const blend=(ink,wallpaper,alpha)=>'#'+ink.match(/[\da-f]{2}/gi).map((v,i)=>Math.round(parseInt(v,16)*alpha+wallpaper[i]*(1-alpha)).toString(16).padStart(2,'0')).join('');
 blocks.forEach((block,index)=>{
  const t=Object.fromEntries([...block.matchAll(/--tf-([\w-]+):\s*(#[\da-f]{3,6})(?=;)/gi)].map(m=>[m[1],m[2]]));
  for(const wallpaper of [[0,0,0],[255,255,255]])assert(contrast(t.text,blend(t.page,wallpaper,1-Number(native[index?1:2])))>=4.5,'Primary canvas copy at the native tint bound');
 });
});
