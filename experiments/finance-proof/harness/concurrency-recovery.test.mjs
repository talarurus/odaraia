// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';import assert from 'node:assert/strict';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {spawnSync} from 'node:child_process';import {mkdirSync,rmSync} from 'node:fs';import {resolve} from 'node:path';
import {IndependentProof} from './independent.mjs';import {canonical} from '../shared/fixture.mjs';
const period={start:'2026-09-01',end:'2026-10-01'};
const clean=path=>{for(const suffix of ['','-wal','-shm'])rmSync(path+suffix,{force:true});};
if(!isMainThread){
 const e=new IndependentProof(workerData.path);parentPort.postMessage({ready:true});
 parentPort.once('message',()=>{try{
  for(let i=0;i<50;i++){e.update(workerData.hh,'coffee-1',{note:`${workerData.hh}-${i}`},i+1);assert.equal(e.rows(workerData.hh).find(r=>r.id==='coffee-1').note,`${workerData.hh}-${i}`);assert.equal(e.report(workerData.hh,period).spending,workerData.expected);assert.equal(e.export(workerData.hh).payload.household.id,workerData.hh);}
  parentPort.postMessage({status:'PASS',writes:50,assertions:150});
 }catch(e){parentPort.postMessage({error:e.stack});}finally{e.close();parentPort.close();}});
}else{
 test('Two genuine concurrent workers isolate colliding IDs across reads, writes, reports and exports',async()=>{
  mkdirSync('.runtime/tests',{recursive:true});const path=resolve('.runtime/tests/concurrent.db');clean(path);const e=new IndependentProof(path);e.db.exec('PRAGMA journal_mode=WAL');e.load('one',canonical);e.load('two',canonical);e.update('two','rent-1',{amount:'-100000'},1);e.close();
  const workers=['one','two'].map(hh=>new Worker(new URL(import.meta.url),{workerData:{path,hh,expected:hh==='one'?'179000':'129000'}}));
  try{
   await Promise.all(workers.map(w=>new Promise((ok,fail)=>{w.once('message',m=>m.ready?ok():fail(Error('No ready signal')));w.once('error',fail);})));const pending=workers.map(w=>new Promise((ok,fail)=>{w.once('message',m=>m.error?fail(Error(m.error)):ok(m));w.once('error',fail);}));workers.forEach(w=>w.postMessage('start'));const outputs=await Promise.all(pending);assert.equal(outputs.reduce((s,x)=>s+x.writes,0),100);assert.equal(outputs.reduce((s,x)=>s+x.assertions,0),300);
   const check=new IndependentProof(path);try{assert.equal(check.rows('one').find(r=>r.id==='coffee-1').note,'one-49');assert.equal(check.rows('two').find(r=>r.id==='coffee-1').note,'two-49');}finally{check.close();}
  }finally{await Promise.all(workers.map(w=>w.terminate()));clean(path);}
 });
 test('Abrupt process exit during real sync rolls back the batch and preserves a retryable checkpoint',()=>{
  mkdirSync('.runtime/tests',{recursive:true});const path=resolve('.runtime/tests/crash-sync.db');clean(path);let e=new IndependentProof(path);e.db.exec('PRAGMA journal_mode=WAL');e.load('one',canonical);e.sync('one','fake-bank',{id:'seed',nextCursor:'c0'});e.close();
  const packet={id:'crash-job',expectedCursor:'c0',nextCursor:'c1',rows:[1700,1800].map((amount,i)=>({...canonical.transactions[1],id:'crash-'+i,sourceId:'crash-'+i,amount:String(-amount)}))};
  const source=`import {IndependentProof} from './harness/independent.mjs';const e=new IndependentProof(process.argv[1]);const packet=JSON.parse(process.argv[2]);const store=e.store.bind(e);let writes=0;e.store=(...args)=>{store(...args);if(++writes===1)process.exit(17);};e.sync('one','fake-bank',packet);process.exit(99);`;
  try{const child=spawnSync(process.execPath,['--input-type=module','-e',source,path,JSON.stringify(packet)],{encoding:'utf8',timeout:15000});assert.equal(child.error,undefined);assert.equal(child.status,17,child.stderr);e=new IndependentProof(path);assert.equal(e.rows('one').length,12);assert.equal(e.connection('one','fake-bank').cursor,'c0');e.sync('one','fake-bank',packet);assert(e.sync('one','fake-bank',packet).replayed);assert.equal(e.rows('one').length,14);assert.equal(e.report('one',period).spending,'182500');assert.equal(e.connection('one','fake-bank').cursor,'c1');}finally{e.close();clean(path);}
 });
}
