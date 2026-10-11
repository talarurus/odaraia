// SPDX-License-Identifier: MPL-2.0
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {performance} from 'node:perf_hooks';
import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {IndependentProof} from './independent.mjs';
const summary=xs=>{const s=[...xs].sort((a,b)=>a-b);return {samples:s.length,minMs:s[0],p50Ms:s[Math.ceil(s.length*.5)-1],p95Ms:s[Math.ceil(s.length*.95)-1],maxMs:s.at(-1)};};
if(!isMainThread){
 const e=new IndependentProof(workerData.path);parentPort.postMessage({ready:true});
 parentPort.once('message',()=>{try{const lists=[],reports=[];for(let i=0;i<20;i++){let t=performance.now();const rows=e.rows(workerData.household,{start:'2026-09-01',end:'2026-10-01',limit:100});lists.push(performance.now()-t);assert(rows.every(x=>x.payee.startsWith(workerData.household)));t=performance.now();const r=e.report(workerData.household,{start:'2026-09-01',end:'2026-10-01'});reports.push(performance.now()-t);assert.equal(r.income,workerData.income);assert.equal(r.spending,workerData.spending);}parentPort.postMessage({lists,reports,assertions:60,scope:workerData.household,heapBytes:process.memoryUsage().heapUsed});}catch(error){parentPort.postMessage({error:error.message});}finally{e.close();parentPort.close();}});
}else{
 mkdirSync('.runtime',{recursive:true});mkdirSync('artifacts',{recursive:true});const path=resolve('.runtime/benchmark.db');for(const suffix of ['','-wal','-shm'])rmSync(path+suffix,{force:true});
 const e=new IndependentProof(path);e.db.exec('PRAGMA journal_mode=WAL');const result={candidate:'Independent SQLite proof',notPostgreSQL:true,date:new Date().toISOString(),machine:{platform:os.platform(),release:os.release(),arch:os.arch(),cpus:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalRamBytes:os.totalmem()},versions:{node:process.version,sqlite:e.db.prepare('SELECT sqlite_version() AS v').get().v},workload:{households:2,rowsPerHousehold:50000,accountsPerHousehold:10,months:24,ordering:'date DESC,id',index:'transactions_period(household,date,id)',report:'Load all household rows, parse JSON, exact BigInt JavaScript aggregation; no report cache',network:'None — engine calls only'},measurements:{},limitations:['Not PostgreSQL, HTTP, authentication, RLS, encryption, bank transport or hosted capacity evidence.','Worker threads share the Node process; RSS cannot be attributed per isolated tenant process.','No 100-household projection or 1/10-worker memory test performed.','Public service SLOs cannot be inferred from engine-only latencies.']};
 const expectations={};
 for(const household of ['bench-a','bench-b']){
  const accounts=Array.from({length:10},(_,i)=>({id:`a${i}`,name:`${household} account ${i}`,type:'checking',currency:'USD',opening:'100000',anchor:'2024-09-30'}));
  const rows=Array.from({length:50000},(_,i)=>{const m=i%24,y=2024+Math.floor((m+9)/12),month=(m+9)%12+1;const date=`${y}-${String(month).padStart(2,'0')}-${String(1+Math.floor(i/24)%28).padStart(2,'0')}`;return {id:'r'+i,sourceId:'r'+i,connection:'fixture',account:`a${i%10}`,date,amount:i%13===0?'120000':'-1234',payee:`${household} Merchant ${i%100}`,category:i%13===0?'Paychecks':'Groceries',classification:i%13===0?'income':'expense',status:'posted',revision:1};});
  const t=performance.now();e.createHousehold(household,accounts);e.commit(household,e.preview(household,rows,{fileKey:household}).id);result.measurements[`${household}LoadMs`]=performance.now()-t;
  const sept=rows.filter(x=>x.date>='2026-09-01'&&x.date<'2026-10-01');expectations[household]={income:sept.filter(x=>x.classification==='income').reduce((s,r)=>s+BigInt(r.amount),0n).toString(),spending:(-sept.filter(x=>x.classification==='expense').reduce((s,r)=>s+BigInt(r.amount),0n)).toString()};
 }
 let t=performance.now();e.rows('bench-a',{start:'2026-09-01',end:'2026-10-01',limit:100});result.measurements.firstListMs=performance.now()-t;t=performance.now();e.report('bench-a',{start:'2026-09-01',end:'2026-10-01'});result.measurements.firstReportMs=performance.now()-t;
 // First call after import is not an OS cold-cache measurement.
 const lists=[],reports=[];for(let i=0;i<100;i++){t=performance.now();e.rows('bench-a',{start:'2026-09-01',end:'2026-10-01',limit:100});lists.push(performance.now()-t);t=performance.now();const r=e.report('bench-a',{start:'2026-09-01',end:'2026-10-01'});reports.push(performance.now()-t);assert.equal(r.spending,expectations['bench-a'].spending);}
 result.measurements.warmSequentialList=summary(lists);result.measurements.warmSequentialReport=summary(reports);result.measurements.mainMemory=process.memoryUsage();e.close();
 const workers=Array.from({length:5},(_,i)=>new Worker(new URL(import.meta.url),{workerData:{path,household:i%2?'bench-b':'bench-a',...expectations[i%2?'bench-b':'bench-a']}}));
 await Promise.all(workers.map(w=>new Promise((ok,fail)=>{w.once('message',m=>m.ready?ok():fail(new Error('No ready signal')));w.once('error',fail);})));const started=performance.now();
 const pending=workers.map(w=>new Promise((ok,fail)=>{w.once('message',m=>m.error?fail(new Error(m.error)):ok(m));w.once('error',fail);}));for(const w of workers)w.postMessage('start');
 const values=await Promise.all(pending);result.measurements.concurrent5={elapsedMs:performance.now()-started,list:summary(values.flatMap(x=>x.lists)),report:summary(values.flatMap(x=>x.reports)),scopeAssertions:values.reduce((n,x)=>n+x.assertions,0),workerHeapBytes:values.map(x=>x.heapBytes),processRSSBytes:process.memoryUsage().rss};
 result.expectations=expectations;result.status='PASS';result.proposedTargets={listP95Under300ms:result.measurements.concurrent5.list.p95Ms<300,reportP95Under1000ms:result.measurements.concurrent5.report.p95Ms<1000};
 writeFileSync('artifacts/benchmark.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await Promise.all(workers.map(w=>new Promise(ok=>{w.once('exit',ok);if(w.threadId===-1)ok();})));
}
