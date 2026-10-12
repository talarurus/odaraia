// SPDX-License-Identifier: MPL-2.0
// Offline renders of current React source. No live user data is opened.
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {Repository} from '../db/repository.ts';
import {loadCanonical} from '../tests/canonical-fixture.mjs';
import {pageTitle,publicAssets} from '../product-identity.mjs';
export const root=fileURLToPath(new URL('../',import.meta.url));
export const reviewPages=['dashboard','accounts','cashflow','spending','transactions','networth','budgets','import','settings'];
export async function prepareReview(){
 const runtime=resolve(root,'artifacts/runtime');await mkdir(runtime,{recursive:true});
 const repo=new Repository();let populated,emptyState;try{emptyState=repo.state();loadCanonical(repo);populated=repo.state();globalThis.__CRETODUS_REVIEW_STATE__=populated;}finally{repo.close();}
 // Parallel test processes must never import a partially overwritten bundle.
 const outfile=resolve(runtime,'cretodus-review-'+process.pid+'-'+randomUUID()+'.mjs');
 await build({absWorkingDir:root,entryPoints:['web/app.tsx'],outfile,bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},logLevel:'silent',plugins:[{name:'isolated-review-fixture',setup(b){
  b.onLoad({filter:/web\/app\.tsx$/},async args=>({contents:(await readFile(args.path,'utf8'))
   .replace('useState<FinancialState|null>(null)','useState<FinancialState|null>(globalThis.__CRETODUS_REVIEW_STATE__)')
   .replace('[loading,setLoading]=useState(true)','[loading,setLoading]=useState(false)')
   .replace('useState(today().slice(0,7))',"useState('2026-09')")
   .replace(/startupStage\('REACT_RENDER_REQUESTED'\);[\s\S]*$/,''),loader:'tsx',resolveDir:resolve(root,'web')}));
  b.onLoad({filter:/web\/accounts\.tsx$/},async args=>({contents:(await readFile(args.path,'utf8')).replace('useState({width:960,height:380})','useState(globalThis.__CRETODUS_REVIEW_PLOT__)'),loader:'tsx',resolveDir:resolve(root,'web')}));
  b.onLoad({filter:/web\/forms\.tsx$/},async args=>({contents:(await readFile(args.path,'utf8')).replace("export const today=()=>new Date().toLocaleDateString('en-CA');","export const today=()=>'2026-10-09';"),loader:'tsx',resolveDir:resolve(root,'web')}));
 }}]});
 const {App}=await import(pathToFileURL(outfile).href+'?v='+Date.now());
 return ({page='accounts',theme='light',width=1440,hidden=false,empty=false,native=false,windowStyle='solid',effectiveWindowStyle=windowStyle,glassError='',material={},candidate=false,section='appearance',dismissed=false,collapsed=false,experimental=false}={})=>{
  globalThis.__CRETODUS_REVIEW_STATE__=empty?emptyState:populated;
  globalThis.window={localStorage:{getItem:key=>key==='talarurus.presentation'?JSON.stringify({hidden,format:'symbol',reduceMotion:true}):key==='talarurus.appearance'?theme:key==='odaraia.onboarding'&&dismissed?'dismissed-v1':key==='odaraia.sidebar.collapsed'?String(collapsed):null}};
  if(native)globalThis.window.__ODARAIA_NATIVE__={windowAppearance:windowStyle,effectiveWindowAppearance:effectiveWindowStyle,glassDiagnostics:{lastError:glassError},theme,material,translucencyAvailable:candidate,reduceTransparency:false,reduceMotion:true};
  globalThis.window.__ODARAIA_EXPERIMENTAL__=experimental;
  globalThis.location={search:'?page='+page+'&section='+section};globalThis.matchMedia=()=>({matches:theme==='dark'});
  globalThis.__CRETODUS_REVIEW_PLOT__={width:width<768?width:width-336,height:width<768?321:380};
  return renderToStaticMarkup(React.createElement(App));
 };
}
export async function writeReview(){
 const out=resolve(root,'artifacts/odaraia/review');await mkdir(out,{recursive:true});
 const render=await prepareReview(),css=(await Promise.all(['style.css','application.css','accounts.css','design-system.css','branding.css','mac-workspace.css','window-workspace.css'].map(f=>readFile(resolve(root,'web',f),'utf8')))).join('\n'),files=[];
 for(const a of publicAssets){const target=resolve(out,'assets',a.file);await mkdir(resolve(target,'..'),{recursive:true});await copyFile(resolve(root,'public',a.file),target);}
 for(const page of reviewPages)for(const theme of ['light','dark'])for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const name=`${page}-${device}-${theme}.html`,markup=render({page,theme,width}).replaceAll('/assets/','./assets/');
  await writeFile(resolve(out,name),`<!doctype html><html lang="en" data-theme="${theme}" data-motion="reduce"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${pageTitle(page)}</title><style>${css}</style></head><body><div id="root">${markup}</div></body></html>`);
  files.push({page,theme,device,width,height,name});
 }
 await writeFile(resolve(out,'render-manifest.json'),JSON.stringify({kind:'Offline React markup; not browser screenshots',fixture:'Canonical synthetic SQLite ledger; no user database',asOf:'2026-10-09',reportMonth:'2026-09',files},null,2));
 await writeFile(resolve(out,'review.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>plainbalance · application brand review</title><style>body{font:15px/1.6 system-ui;background:#f7f7f5;color:#292c29;margin:32px}a{color:#395c4e}table{border-collapse:collapse}td,th{padding:10px;text-align:left}.gallery{display:flex;gap:24px;overflow:auto}.desktop{width:720px;height:500px;flex:none;overflow:hidden}.desktop iframe{width:1440px;height:1000px;transform:scale(.5);transform-origin:top left;border:0}.mobile iframe{width:390px;height:844px;border:0}</style><h1>plainbalance · by Talarurus</h1><p>Current React source with synthetic persisted records. These are offline review renders; controls are inert and responsive reporting charts need the live browser to measure. They are not browser screenshots.</p><table><tr><th>Screen</th><th>Desktop light / dark</th><th>Mobile light / dark</th></tr>${reviewPages.map(p=>`<tr><td>${p}</td>${['desktop','mobile'].map(d=>`<td>${['light','dark'].map(t=>`<a href="${p}-${d}-${t}.html">${t}</a>`).join(' / ')}</td>`).join('')}</tr>`).join('')}</table><h2>Accounts</h2><div class="gallery"><div class="desktop"><iframe title="Accounts desktop light" src="accounts-desktop-light.html"></iframe></div><div class="mobile"><iframe title="Accounts mobile dark" src="accounts-mobile-dark.html"></iframe></div></div><h2>Publisher attribution</h2><div class="gallery"><div class="desktop"><iframe title="Settings desktop light" src="settings-desktop-light.html"></iframe></div><div class="mobile"><iframe title="Settings mobile dark" src="settings-mobile-dark.html"></iframe></div></div></html>`);
 console.log(`Wrote ${files.length} offline React renders: ${out}/review.html`);
}
if(process.argv[1]===fileURLToPath(import.meta.url))await writeReview();
