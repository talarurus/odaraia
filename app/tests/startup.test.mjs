// SPDX-License-Identifier: MPL-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {renderToStaticMarkup} from 'react-dom/server';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {startupStage} from '../web/startup.mjs';

test('Startup bridge accepts only fixed stages/codes and never sends arbitrary diagnostic content',()=>{
 const previous=globalThis.window,messages=[];
 globalThis.window={webkit:{messageHandlers:{odaraia:{postMessage:m=>messages.push(m)}}}};
 try{startupStage('SESSION_ESTABLISHED','synthetic-private-credential');startupStage('synthetic account data','SESSION_HTTP');startupStage('SESSION_FAILED','SESSION_HTTP');assert.deepEqual(messages,[{type:'startup',stage:'SESSION_ESTABLISHED'},{type:'startup',stage:'SESSION_FAILED',code:'SESSION_HTTP'}]);}
 finally{globalThis.window=previous;}
});

async function withAPI(name,callback){
 const directory=resolve('artifacts/runtime/startup-tests');await mkdir(directory,{recursive:true});const file=resolve(directory,name+'.mjs');
 await build({entryPoints:[resolve('web/api.ts')],outfile:file,bundle:true,platform:'node',format:'esm',logLevel:'silent'});
 const previous={window:globalThis.window,fetch:globalThis.fetch,location:globalThis.location,sessionStorage:globalThis.sessionStorage};const messages=[];
 globalThis.window={webkit:{messageHandlers:{odaraia:{postMessage:m=>messages.push(m)}}}};
 globalThis.location={hash:''};globalThis.sessionStorage={getItem:()=>'',setItem(){}};
 try{const {api}=await import(pathToFileURL(file).href);await callback(api,messages);}
 finally{Object.assign(globalThis,previous);}
}
test('Real frontend session bootstrap establishes authorization before state and excludes session/financial payloads from diagnostics',()=>withAPI('success',async(api,messages)=>{
 const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(url==='/api/session'?{token:'synthetic-session-secret'}:{accounts:[{name:'synthetic-private-account'}],transactions:[]}),{status:200});};
 const state=await api('/state');assert.equal(state.accounts.length,1);assert.deepEqual(calls.map(c=>c.url),['/api/session','/api/state']);assert.equal(calls[1].options.headers['X-Talarurus-Session'],'synthetic-session-secret');
 assert.deepEqual(messages.map(m=>m.stage),['SESSION_REQUESTED','SESSION_ESTABLISHED','STATE_FETCH_STARTED','STATE_FETCHED']);assert(!JSON.stringify(messages).includes('synthetic-session-secret'));assert(!JSON.stringify(messages).includes('synthetic-private-account'));
}));
test('Session authorization rejection reports a fixed failure and never fetches financial state',()=>withAPI('denied',async(api,messages)=>{
 const calls=[];globalThis.fetch=async url=>{calls.push(url);return new Response('Denied',{status:403});};await assert.rejects(api('/state'),/private startup link/);assert.deepEqual(calls,['/api/session']);assert.deepEqual(messages,[{type:'startup',stage:'SESSION_REQUESTED'},{type:'startup',stage:'SESSION_FAILED',code:'SESSION_HTTP'}]);
}));

test('Session network and malformed authorization failures never request state and can retry',()=>withAPI('session-recovery',async(api,messages)=>{
 let phase='network';const calls=[];
 globalThis.fetch=async url=>{calls.push(url);if(phase==='network')throw new Error('synthetic-private-network-detail');return new Response(JSON.stringify(url==='/api/session'?(phase==='invalid'?{token:null}:{token:'synthetic-retry-token'}):{accounts:[],transactions:[]}));};
 await assert.rejects(api('/state'),/synthetic-private/);phase='invalid';await assert.rejects(api('/state'),/session response was invalid/);
 assert.deepEqual(calls,['/api/session','/api/session']);phase='success';await api('/state');
 assert.deepEqual(messages.map(m=>[m.stage,m.code]),[['SESSION_REQUESTED',undefined],['SESSION_FAILED','SESSION_NETWORK'],['SESSION_REQUESTED',undefined],['SESSION_FAILED','SESSION_RESPONSE'],['SESSION_REQUESTED',undefined],['SESSION_ESTABLISHED',undefined],['STATE_FETCH_STARTED',undefined],['STATE_FETCHED',undefined]]);
 assert(!JSON.stringify(messages).includes('synthetic-'));
}));
test('State failures distinguish HTTP, network and invalid responses; retry reuses the session',()=>withAPI('state-recovery',async(api,messages)=>{
 let phase='http';let sessions=0;
 globalThis.fetch=async url=>{if(url==='/api/session'){sessions++;return new Response(JSON.stringify({token:'synthetic-state-token'}));}if(phase==='network')throw new Error('synthetic-private-network');if(phase==='invalid')return new Response('invalid-json');return new Response(JSON.stringify(phase==='http'?{error:'synthetic-private-record'}:{accounts:[],transactions:[]}),{status:phase==='http'?503:200});};
 await assert.rejects(api('/state'),/synthetic-private-record/);phase='network';await assert.rejects(api('/state'));phase='invalid';await assert.rejects(api('/state'));phase='ok';await api('/state');
 assert.equal(sessions,1);assert.deepEqual(messages.filter(m=>m.stage==='STATE_FETCH_FAILED').map(m=>m.code),['STATE_HTTP','STATE_NETWORK','STATE_RESPONSE']);assert.equal(messages.at(-1).stage,'STATE_FETCHED');assert(!JSON.stringify(messages).includes('synthetic-'));
}));
test('A missing or rejected diagnostic bridge cannot break application startup',()=>{
 const previous=globalThis.window;
 try{globalThis.window=undefined;assert.doesNotThrow(()=>startupStage('REACT_ROOT_MOUNTED'));globalThis.window={webkit:{messageHandlers:{odaraia:{postMessage(){throw new Error('unavailable');}}}}};assert.doesNotThrow(()=>startupStage('WORKSPACE_RENDERED'));}
 finally{globalThis.window=previous;}
});

test('Application and report render failures expose recovery and fixed diagnostics without exception payloads',async()=>{
 const directory=resolve('artifacts/runtime/startup-tests');await mkdir(directory,{recursive:true});
 const previous=globalThis.window,messages=[];globalThis.window={webkit:{messageHandlers:{odaraia:{postMessage:m=>messages.push(m)}}}};
 try{
  for(const [file,name] of [['application-boundary.jsx','ApplicationBoundary'],['report-boundary.jsx','ReportBoundary']]){
   const output=resolve(directory,file+'.mjs');await build({entryPoints:[resolve('web',file)],outfile:output,bundle:true,packages:'external',platform:'node',format:'esm',logLevel:'silent'});
   const Boundary=(await import(pathToFileURL(output).href))[name],boundary=new Boundary({children:'synthetic-private-workspace'}),error=new Error('synthetic-private-account-and-session');
   boundary.state=Boundary.getDerivedStateFromError(error);boundary.componentDidCatch(error,{componentStack:'synthetic-private-component'});
   const markup=renderToStaticMarkup(boundary.render());assert.match(markup,/role="alert"/);assert.match(markup,/<button/);assert(!markup.includes('synthetic-private'));if(name==='ReportBoundary')assert.match(markup,/data-report-failed="true"/);
  }
  assert.deepEqual(messages,[{type:'startup',stage:'REACT_RENDER_FAILED',code:'REACT_BOUNDARY'},{type:'startup',stage:'REACT_RENDER_FAILED',code:'REACT_BOUNDARY'}]);
 }finally{globalThis.window=previous;}
});
