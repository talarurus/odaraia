// SPDX-License-Identifier: MPL-2.0
// Repeated fresh-process SQLite measurements. No OS-cache flush, network or capacity claim.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {mkdirSync,writeFileSync,readFileSync,rmSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {IndependentProof} from './independent.mjs';
import {report} from './fixtures/report-policy-previous.mjs';
const tag=process.env.PERF_TAG||'',rowCount=Number(process.env.PERF_ROWS||50000),runCount=Number(process.env.PERF_RUNS||3);
if(![50000,100000].includes(rowCount)||!Number.isInteger(runCount)||runCount<1||runCount>3||!/^[a-z0-9-]*$/.test(tag))throw new Error('Invalid bounded benchmark configuration');
const dir=resolve('artifacts/evidence-completion',tag),path=resolve(`.runtime/controlled-performance${tag?'-'+tag:''}.db`);
const period={start:'2026-09-01',end:'2026-10-01'};
const summarize=xs=>{const s=[...xs].sort((a,b)=>a-b);return {samples:s.length,minMs:s[0],p50Ms:s[Math.ceil(s.length*.5)-1],p95Ms:s[Math.ceil(s.length*.95)-1],maxMs:s.at(-1)};};
const query=(e,mode,hh)=>mode==='legacy'?report(e.accounts(hh),e.rows(hh),period):e.report(hh,period);
function measure(e,mode,hh,n,expected){
 const list=[],reports=[],raw={list:[],report:[]};let peakRSS=process.memoryUsage().rss;
 for(let i=0;i<n;i++){
  let t=performance.now();const rows=e.rows(hh,{...period,limit:100});raw.list.push(performance.now()-t);assert.equal(rows.length,100);assert(rows.every(r=>r.payee.startsWith(hh)));
  t=performance.now();const r=query(e,mode,hh);raw.report.push(performance.now()-t);assert.equal(r.income,expected.income);assert.equal(r.spending,expected.spending);assert.equal(r.netWorth,expected.netWorth);
  peakRSS=Math.max(peakRSS,process.memoryUsage().rss);
 }
 return {list:summarize(raw.list),report:summarize(raw.report),raw,peakRSS,assertions:n*5,memory:process.memoryUsage()};
}
if(!isMainThread){
 const e=new IndependentProof(workerData.path);parentPort.postMessage({ready:true});
 parentPort.once('message',()=>{try{parentPort.postMessage(measure(e,workerData.mode,workerData.hh,20,workerData.expected));}catch(error){parentPort.postMessage({error:error.stack});}finally{e.close();parentPort.close();}});
}else if(process.argv.includes('--trial')){
 const mode=process.argv[process.argv.indexOf('--trial')+1],run=process.argv.at(-1),seed=JSON.parse(readFileSync(resolve(dir,'performance-seed.json')));
 const e=new IndependentProof(path),startMemory=process.memoryUsage();let t=performance.now();const first=query(e,mode,'bench-a');const firstReportMs=performance.now()-t;assert.equal(first.netWorth,seed.expected['bench-a'].netWorth);
 const sequential=measure(e,mode,'bench-a',100,seed.expected['bench-a']);e.close();global.gc?.();const afterSequentialGC=process.memoryUsage();
 const workers=Array.from({length:5},(_,i)=>new Worker(new URL(import.meta.url),{workerData:{path,mode,hh:i%2?'bench-b':'bench-a',expected:seed.expected[i%2?'bench-b':'bench-a']}}));
 await Promise.all(workers.map(w=>new Promise((ok,fail)=>{w.once('message',m=>m.ready?ok():fail(new Error('No ready signal')));w.once('error',fail);})));t=performance.now();
 const pending=workers.map(w=>new Promise((ok,fail)=>{w.once('message',m=>m.error?fail(new Error(m.error)):ok(m));w.once('error',fail);}));workers.forEach(w=>w.postMessage('start'));
 const concurrent=await Promise.all(pending);const elapsedMs=performance.now()-t;
 await Promise.all(workers.map(w=>w.threadId===-1?Promise.resolve():new Promise(ok=>w.once('exit',ok))));global.gc?.();
 const five={elapsedMs,list:summarize(concurrent.flatMap(x=>x.raw.list)),report:summarize(concurrent.flatMap(x=>x.raw.report)),peakRSS:Math.max(...concurrent.map(x=>x.peakRSS)),workerHeapBytes:concurrent.map(x=>x.memory.heapUsed),assertions:concurrent.reduce((s,x)=>s+x.assertions,0),raw:concurrent.map(x=>x.raw)};
 const targets={sequentialList:sequential.list.p95Ms<300,sequentialReport:sequential.report.p95Ms<1000,fiveClientList:five.list.p95Ms<300,fiveClientReport:five.report.p95Ms<1000};
 const result={mode,run,date:new Date().toISOString(),status:Object.values(targets).every(Boolean)?'PASS':'FAIL',targets,firstReportMs,sequential,five,startMemory,afterSequentialGC,afterWorkersGC:process.memoryUsage(),resourceUsage:process.resourceUsage(),coldDefinition:'Fresh Node process and reopened database; OS file/page cache NOT flushed. Seed and preceding trials warm the OS cache.'};
 writeFileSync(resolve(dir,`performance-${mode}-${run}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify({mode,run,status:result.status,firstReportMs,sequentialP95:sequential.report.p95Ms,fiveP95:five.report.p95Ms,peakMiB:five.peakRSS/2**20}));
 if(result.status==='FAIL')process.exitCode=1;
}else{
 mkdirSync(dir,{recursive:true});mkdirSync('.runtime',{recursive:true});
 if(!process.argv.includes('--reuse')){
  for(const suffix of ['','-wal','-shm'])rmSync(path+suffix,{force:true});const e=new IndependentProof(path);e.db.exec('PRAGMA journal_mode=WAL');const expected={},loads={};
  for(const hh of ['bench-a','bench-b']){
   const accounts=Array.from({length:10},(_,i)=>({id:`a${i}`,name:`${hh} account ${i}`,type:'checking',currency:'USD',opening:'100000',anchor:'2024-09-30'}));
   const rows=Array.from({length:rowCount},(_,i)=>{const m=i%24,y=2024+Math.floor((m+9)/12),month=(m+9)%12+1;return {id:'r'+i,sourceId:'r'+i,connection:'fixture',account:`a${i%10}`,date:`${y}-${String(month).padStart(2,'0')}-${String(1+Math.floor(i/24)%28).padStart(2,'0')}`,amount:i%13===0?'120000':'-1234',payee:`${hh} Merchant ${i%100}`,category:i%13===0?'Paychecks':'Groceries',classification:i%13===0?'income':'expense',status:'posted',revision:1};});
   const t=performance.now();e.createHousehold(hh,accounts);e.commit(hh,e.preview(hh,rows,{fileKey:hh}).id);loads[hh]=performance.now()-t;
   const sept=rows.filter(x=>x.date>=period.start&&x.date<period.end);expected[hh]={income:sept.filter(x=>x.classification==='income').reduce((s,x)=>s+BigInt(x.amount),0n).toString(),spending:(-sept.filter(x=>x.classification==='expense').reduce((s,x)=>s+BigInt(x.amount),0n)).toString(),netWorth:(1000000n+rows.reduce((s,x)=>s+BigInt(x.amount),0n)).toString()};
  }
  const seed={date:new Date().toISOString(),machine:{cpu:os.cpus()[0]?.model,logicalCPUs:os.cpus().length,ramBytes:os.totalmem(),platform:os.platform(),release:os.release(),arch:os.arch()},versions:{node:process.version,sqlite:e.db.prepare('SELECT sqlite_version() AS v').get().v},workload:{households:2,rowsPerHousehold:rowCount,accounts:10,months:24,perTrial:'100 sequential list+report calls, then 5 concurrent workers ×20 list+report calls',writes:'Seed via real preview/commit; timed workload is read-only'},loads,expected,payloadBytes:e.db.prepare('SELECT SUM(length(payload)) AS n FROM transactions').get().n,plan:e.db.prepare('EXPLAIN QUERY PLAN SELECT payload FROM transactions WHERE household=? AND date>=? AND date<? ORDER BY date DESC,id LIMIT 100').all('bench-a',period.start,period.end)};
  e.close();seed.databaseBytes=statSync(path).size;writeFileSync(resolve(dir,'performance-seed.json'),JSON.stringify(seed,null,2));global.gc?.();
 }
 const modes=process.argv.includes('--legacy-only')?['legacy']:process.argv.includes('--projected-only')?['projected']:['legacy','projected'];const outcomes=[];
 // Alternate candidate queries so the same fixtures and scheduling order are repeatable.
 for(let run=1;run<=runCount;run++)for(const mode of modes){const code=await new Promise((ok,fail)=>{const c=spawn(process.execPath,['--expose-gc',new URL(import.meta.url).pathname,'--trial',mode,String(run)],{stdio:'inherit'});c.once('error',fail);c.once('exit',ok);});outcomes.push({mode,run,exitCode:code});}
 writeFileSync(resolve(dir,`performance-${modes.join('-')}-runs.json`),JSON.stringify(outcomes,null,2));if(outcomes.some(x=>x.exitCode!==0))process.exitCode=1;
}
