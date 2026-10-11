// SPDX-License-Identifier: MPL-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync,writeFileSync,readFileSync,symlinkSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {Repository} from '../../db/repository.ts';
import {MemoryRepository} from '../../storage/memory.ts';
import {createAsyncNativeService} from '../../storage/async-native.ts';
import {processTransport,nativeBinary} from '../../storage/native-sqlite/transport.mjs';
import {createApplicationService} from '../../services/application.ts';
import {Importer,hash} from '../../server/importer.ts';
import {Portability} from '../../server/portability.ts';
import {loadCanonical} from '../canonical-fixture.mjs';
import {expected} from '../../domain/fixture.mjs';
import {budgetActual} from '../../domain/finance.mjs';
const folder=()=>mkdtempSync(resolve(tmpdir(),'odaraia-persistent-'));
const nodeService=r=>createApplicationService(r,{importer:new Importer(r),portability:new Portability(r)});
const options={account:'checking',delimiter:',',dateFormat:'ISO',amountMode:'signed',columns:{date:'Date',payee:'Merchant',amount:'Amount',id:'ID'}};
function golden(){const r=new MemoryRepository();loadCanonical(r);const b=new Portability(r).backup();r.close();return b;}
const input={name:'fictional.csv',text:'Date,Merchant,Amount,ID\n2026-09-15,Fictional shop,-1.23,bank-1',options};
const fields=r=>Object.fromEntries(['income','grossCharges','refunds','spending','surplus','netWorth','balances','postedCount','pendingCount'].map(k=>[k,r[k]]));
async function restored(path){const n=processTransport(path),s=createAsyncNativeService(n);await s.execute({name:'backup.restore',input:{backup:golden(),confirmEmpty:true}});return {n,s};}

test('Native SQLite: golden parity, exact IDs, historic balances, credit payments and budgets',async()=>{
 const dir=folder();try{
  const {s}=await restored(resolve(dir,'native.sqlite'));
  const state=await s.execute({name:'state.read'});const data=golden().data;assert.deepEqual(state,{accounts:data.accounts,transactions:data.transactions,budgets:data.budgets});
  const report=await s.execute({name:'reports.read',input:{start:'2026-09-01',end:'2026-10-01'}});
  for(const field of ['income','grossCharges','refunds','spending','surplus','netWorth','balances'])assert.deepEqual(report[field],expected[field]);
  assert.equal((await s.execute({name:'reports.read',input:{end:'2026-08-31'}})).netWorth,null);
  assert.equal((await s.execute({name:'reports.read',input:{end:'2026-09-06'}})).balances.checking,'430000');
  assert.equal((await s.execute({name:'reports.read',input:{start:'2026-09-30',end:'2026-10-01'}})).postedCount,0);
  assert.equal(budgetActual(state.accounts,state.transactions,'2026-09',state.budgets[0].category,state.budgets[0].planned).actual,'18000');
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Identical edit/refund/pending/transfer/budget/CSV outcomes across three adapters',async()=>{
 const dir=folder(),repos=[new Repository(resolve(dir,'node.sqlite')),new MemoryRepository()];try{
  const services=repos.map(nodeService);services.push((await restored(resolve(dir,'native.sqlite'))).s);
  for(const s of services.slice(0,2))await s.execute({name:'backup.restore',input:{backup:golden(),confirmEmpty:true}});
  const results=[];
  for(const s of services){
   let state=await s.execute({name:'state.read'});const ordinary=state.transactions.find(t=>t.classification==='expense'&&t.status==='posted');
   await s.execute({name:'transactions.update',id:ordinary.id,input:{amount:'2500',revision:1}});
   const pending=state.transactions.find(t=>t.status==='pending');await s.execute({name:'transactions.void',id:pending.id,input:{revision:1}});await s.execute({name:'transactions.undo',id:pending.id,input:{revision:2}});
   const leg=state.transactions.find(t=>t.transferId),pair=state.transactions.filter(t=>t.transferId===leg.transferId);
   await s.execute({name:'transfers.update',id:leg.transferId,input:{date:'2026-09-08',amount:'35000',revisions:Object.fromEntries(pair.map(t=>[t.id,t.revision]))}});
   await s.execute({name:'transactions.void',id:leg.id,input:{revision:2}});await s.execute({name:'transactions.undo',id:leg.id,input:{revision:3}});
   await s.execute({name:'budgets.set',input:{month:'2026-09',category:'Groceries',planned:'30000'}});
   const preview=await s.execute({name:'imports.preview',input});assert.equal((await s.execute({name:'imports.commit',input:{id:preview.id,decisions:[]}})).added,1);
   assert.equal((await s.execute({name:'imports.preview',input})).replayed,true);
   const before=await s.execute({name:'state.read'});
   await assert.rejects(s.execute({name:'transactions.update',id:ordinary.id,input:{amount:'3',revision:1}}),/changed/);
   await assert.rejects(s.execute({name:'transactions.create',input:{account:'checking',date:'2026-08-31',amount:'1',payee:'Fictional',category:'Other',classification:'income'}}),/Pre-anchor/);
   assert.deepEqual(await s.execute({name:'state.read'}),before);
   results.push(fields(await s.execute({name:'reports.read',input:{start:'2026-09-01',end:'2026-10-01'}})));
  }
  assert.deepEqual(results[0],results[1]);assert.deepEqual(results[0],results[2]);
 }finally{repos.forEach(r=>r.close());rmSync(dir,{recursive:true,force:true});}
});

test('Native async service creates exact large-negative accounts and links/creates transfers',async()=>{
 const dir=folder(),s=createAsyncNativeService(processTransport(resolve(dir,'ledger.sqlite')));try{
  const a=await s.execute({name:'accounts.create',input:{name:'Fictional A',type:'checking',anchor:'2026-08-31',opening:'-9007199254740993'}});
  const b=await s.execute({name:'accounts.create',input:{name:'Fictional B',type:'credit',anchor:'2026-08-31',opening:'-5000'}});
  const tx=(account,amount)=>({account,date:'2026-09-01',amount,payee:'Fictional',category:'Other',classification:'expense'});
  const first=await s.execute({name:'transactions.create',input:tx(a.id,'-1000')}),second=await s.execute({name:'transactions.create',input:tx(b.id,'1000')});
  await s.execute({name:'transfers.link',input:{first:first.id,second:second.id,revisions:{[first.id]:1,[second.id]:1}}});
  await s.execute({name:'transfers.create',input:{from:a.id,to:b.id,date:'2026-09-02',amount:'2000',note:''}});
  assert.equal((await s.execute({name:'reports.read'})).netWorth,'-9007199254745993');
  await s.execute({name:'accounts.update',id:a.id,input:{name:'Fictional renamed',revision:1}});
  await assert.rejects(s.execute({name:'accounts.delete',id:a.id}),/identifier|Unknown/);
  await assert.rejects(s.execute({name:'accounts.archive',id:a.id}),/identifier|Unknown/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('CSV preview survives native-process restart; aliases, imports, void history and v1 backups round-trip',async()=>{
 const dir=folder();let node;try{
  const path=resolve(dir,'native.sqlite');let {s}=await restored(path);
  const p=await s.execute({name:'transactions.create',input:{account:'checking',date:'2026-09-16',amount:'-250',payee:'Fictional Coffee',classification:'expense',category:'Dining',status:'pending'}});
  const aliasInput={...input,text:'Date,Merchant,Amount,ID\n2026-09-17,Fictional Coffee,-2.50,bank-alias'};
  const preview=await s.execute({name:'imports.preview',input:aliasInput});s=createAsyncNativeService(processTransport(path));
  assert.equal((await s.execute({name:'imports.commit',input:{id:preview.id,decisions:[{row:2,action:'match',targetId:p.id,revision:1}]}})).matched,1);
  await s.execute({name:'transactions.void',id:p.id,input:{revision:2}});
  const backup=await s.execute({name:'backup.read'});assert.equal(backup.version,1);assert.equal(backup.data.sourceAliases.length,1);
  node=new Repository(resolve(dir,'roundtrip-node.sqlite'));new Portability(node).restore({backup,confirmEmpty:true});
  const t=createAsyncNativeService(processTransport(resolve(dir,'empty-native.sqlite')));await t.execute({name:'backup.restore',input:{backup:new Portability(node).backup(),confirmEmpty:true}});
  assert.deepEqual((await t.execute({name:'backup.read'})).data,backup.data);
  assert.equal((await t.execute({name:'imports.preview',input:aliasInput})).replayed,true);
  await t.execute({name:'transactions.undo',id:p.id,input:{revision:3}});assert.equal((await t.execute({name:'state.read'})).transactions.find(t=>t.id===p.id).status,'posted');
  await assert.rejects(t.execute({name:'backup.restore',input:{backup,confirmEmpty:true}}),/existing/);
 }finally{node?.close();rmSync(dir,{recursive:true,force:true});}
});

test('Actual application-service process exits/restarts recover same accounts, transaction and export',()=>{
 const dir=folder();try{
  const worker=resolve(import.meta.dirname,'restart-worker.mjs'),path=resolve(dir,'ledger.sqlite');
  const first=JSON.parse(execFileSync(process.execPath,[worker,'write',path],{encoding:'utf8'}));
  const second=JSON.parse(execFileSync(process.execPath,[worker,'read',path],{encoding:'utf8'}));
  assert.deepEqual(second,first);assert.equal(second.balance,'125099');assert.equal(second.data.transactions.length,1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('CSV provenance property order survives persistence, v1 checksums, isolated restore and undo',async()=>{
 const dir=folder();try{
  const path=resolve(dir,'order.sqlite');let {s}=await restored(path);
  const preview=await s.execute({name:'imports.preview',input});
  const committed=await s.execute({name:'imports.commit',input:{id:preview.id,decisions:[]}});
  const id=committed.transactionIds[0];
  const original=(await s.execute({name:'state.read'})).transactions.find(t=>t.id===id);
  assert.equal(original.amount,'-123');assert.equal(original.provenance.kind,'csv');
  await s.execute({name:'transactions.void',id,input:{revision:1}});
  s=createAsyncNativeService(processTransport(path));
  const backup=await s.execute({name:'backup.read'});
  const removed=backup.data.transactions.find(t=>t.id===id);
  assert.equal(JSON.stringify(removed.provenance),JSON.stringify(original.provenance));
  const r=new MemoryRepository();try{
   const portable=new Portability(r);portable.validate(backup);
   const reorder=value=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,reorder(value[k])])):value;
   const sorted=reorder(backup);
   // Sorting a v1 envelope is incompatible even if its financial values agree.
   assert.throws(()=>portable.validate(sorted),/checksum/);
   sorted.sha256=hash(sorted.data);
   // Recomputing a checksum cannot repair audit JSON strings whose nested
   // provenance order differs. Preserve serialization; never weaken validation.
   assert.throws(()=>portable.validate(sorted),/Void history disagrees/);
  }finally{r.close();}
  const recovery=createAsyncNativeService(processTransport(resolve(dir,'empty.sqlite')));
  await recovery.execute({name:'backup.restore',input:{backup:JSON.parse(JSON.stringify(backup)),confirmEmpty:true}});
  assert.deepEqual((await recovery.execute({name:'backup.read'})).data,backup.data);
  await recovery.execute({name:'transactions.undo',id,input:{revision:2}});
  const undone=(await recovery.execute({name:'state.read'})).transactions.find(t=>t.id===id);
  assert.equal(undone.status,'posted');assert.equal(undone.amount,'-123');
  assert.equal(JSON.stringify(undone.provenance),JSON.stringify(original.provenance));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Native constraints reject malformed money, missing FK, invalid dates and unpaired transfers atomically',async()=>{
 const dir=folder();try{
  const {n}=await restored(resolve(dir,'ledger.sqlite')),before=await n.read();
  for(const change of [d=>d.transactions[0].account='missing',d=>d.transactions[0].amount='9223372036854775808',d=>d.transactions[0].amount='1.5',d=>d.accounts[0].anchor='2026-02-30',d=>d.accounts[0].anchor='2026-99-01',d=>d.transactions.find(t=>t.transferId).amount='1',d=>d.transactions[0].unexpected='DROP TABLE accounts',d=>d.accounts=[]]){
   const data=structuredClone(before.data);change(data);await assert.rejects(n.commit(before.revision,data));assert.deepEqual(await n.read(),before);
  }
  const data=structuredClone(before.data);data.transactions[0].amount=1;await assert.rejects(n.commit(before.revision,data),/INVALID_SNAPSHOT/);
  const path=resolve(dir,'ledger.sqlite');
  for(const request of ['{malformed',JSON.stringify({op:'read',sql:'DROP TABLE accounts'}),JSON.stringify({op:'sql.execute',sql:'DROP TABLE accounts'})]){
   const response=JSON.parse(execFileSync(nativeBinary,[realpathSync(path)],{input:request,encoding:'utf8'}));assert.match(response.code,/INVALID_REQUEST|UNKNOWN_OPERATION/);assert.deepEqual(await n.read(),before);
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Concurrent native writers use compare-and-swap; exactly one commits without partial changes',async()=>{
 const dir=folder();try{
  const path=resolve(dir,'ledger.sqlite'),n=processTransport(path),before=await n.read();
  const first=structuredClone(before.data),second=structuredClone(before.data);first.budgets.push({month:'2026-09',category:'A',planned:'1'});second.budgets.push({month:'2026-09',category:'B',planned:'2'});
  const results=await Promise.allSettled([n.commit(0,first),processTransport(path).commit(0,second)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'CONFLICT');
  const after=await n.read();assert.equal(after.revision,1);assert.equal(after.data.budgets.length,1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Service concurrency conflict is recoverable and cannot report an unsaved success',async()=>{
 const dir=folder();try{
  const n=processTransport(resolve(dir,'ledger.sqlite'));await n.read();let reads=0,release;const gate=new Promise(r=>release=r);const timer=setTimeout(()=>release(),3000);
  const gated={...n,async read(){const v=await n.read();if(++reads===2)release();await gate;return v;}};
  const services=[createAsyncNativeService(gated),createAsyncNativeService(gated)];
  const result=await Promise.allSettled(services.map((s,i)=>s.execute({name:'accounts.create',input:{name:'Fictional '+i,type:'checking',anchor:'2026-08-31',opening:'0'}})));
  clearTimeout(timer);assert.equal(reads,2);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.match(result.find(r=>r.status==='rejected').reason.message,/Reload/);
  assert.equal((await n.read()).data.accounts.length,1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Process termination after writes before COMMIT recovers prior durable state',async()=>{
 const dir=folder();try{
  const path=resolve(dir,'ledger.sqlite'),{n}=await restored(path),before=await n.read(),data=structuredClone(before.data);data.budgets[0].planned='999';
  const crashing=processTransport(path,{binary:resolve(nativeBinary,'../sqlite-store-fault-test'),env:{...process.env,ODARAIA_TEST_CRASH:'1'}});
  await assert.rejects(crashing.commit(before.revision,data),/86/);assert.deepEqual(await processTransport(path).read(),before);
  const db=new DatabaseSync(path);assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);db.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Canonical migration 1→3 succeeds; failed migration rolls back schema and user_version',async()=>{
 const dir=folder();try{
  const path=resolve(dir,'migration.sqlite'),db=new DatabaseSync(path);
  db.exec(readFileSync(new URL('../../db/migrations/001-ledger.sql',import.meta.url),'utf8'));db.exec('PRAGMA user_version=1');db.close();
  await processTransport(path).read();const upgraded=new DatabaseSync(path);assert.equal(upgraded.prepare('PRAGMA user_version').get().user_version,3);upgraded.close();
  const bad=resolve(dir,'failed.sqlite'),d=new DatabaseSync(bad);d.exec(readFileSync(new URL('../../db/migrations/001-ledger.sql',import.meta.url),'utf8'));d.exec('PRAGMA user_version=1; CREATE TABLE previews(collision TEXT)');d.close();
  await assert.rejects(processTransport(bad).read(),/MIGRATION_FAILED/);const checked=new DatabaseSync(bad);assert.equal(checked.prepare('PRAGMA user_version').get().user_version,1);assert.equal(checked.prepare("SELECT count(*) n FROM sqlite_master WHERE name='imports'").get().n,0);checked.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Corrupt files, future schemas and symlinks are refused without reset; private file modes',async()=>{
 const dir=folder();try{
  const bad=resolve(dir,'broken.sqlite');writeFileSync(bad,'synthetic corrupt database');const original=readFileSync(bad);await assert.rejects(processTransport(bad).read());assert.deepEqual(readFileSync(bad),original);
  const future=resolve(dir,'future.sqlite'),db=new DatabaseSync(future);db.exec('PRAGMA user_version=999');db.close();await assert.rejects(processTransport(future).read(),/UNSUPPORTED_SCHEMA/);
  const path=resolve(dir,'ledger.sqlite');await processTransport(path).read();assert.equal(statSync(path).mode&0o777,0o600);
  const link=resolve(dir,'link.sqlite');symlinkSync(path,link);await assert.rejects(processTransport(link).read(),/UNSAFE_PATH/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Unknown capabilities and private backup fail clearly before opening persistence',async()=>{
 let calls=0;const s=createAsyncNativeService({read(){calls++;throw new Error('Unexpected read');},commit(){throw new Error('Unexpected write');}});
 for(const name of ['sql.execute','fs.read','shell.execute'])await assert.rejects(s.execute({name,input:{path:'/secret',sql:'DROP TABLE accounts'}}));
 await assert.rejects(s.execute({name:'backup.private'}),/unavailable/);assert.equal(calls,0);
});

test('Concurrent first initialization never leaves a partially migrated store',async()=>{
 const dir=folder();try{
  for(let i=0;i<8;i++){
   const path=resolve(dir,'initial-'+i+'.sqlite');const results=await Promise.allSettled([processTransport(path).read(),processTransport(path).read()]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,2,JSON.stringify(results));
   assert.deepEqual(results[0].value,results[1].value);assert.equal((await processTransport(path).read()).revision,0);
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Shared frontend returns from demo to native service and uses scoped export instead of HTTP',async()=>{
 const api=await import('../../web/api.ts');let calls=0,exports=0;
 const native={async execute(command){calls++;return command.name==='backup.read'?{synthetic:true}:{native:true};}};
 api.configureApplicationService(native,{privateBackup:false,exportFile:async file=>{exports++;assert.equal(file.text,'{"synthetic":true}');}});
 try{
  api.useApplicationService({async execute(){return {demo:true};}});assert.deepEqual(await api.api('/state'),{demo:true});
  api.useApplicationService(null);assert.deepEqual(await api.api('/state'),{native:true});assert.equal(api.supportsPrivateBackup(),false);
  await api.download('/backup','odaraia-backup.json');assert.equal(exports,1);assert.equal(calls,2);
 }finally{api.configureApplicationService(native);}
});

test('Native normalized contract retains signed-int64 endpoints and excludes future postings from historical reports',async()=>{
 const dir=folder();try{
  const s=createAsyncNativeService(processTransport(resolve(dir,'ledger.sqlite')));
  const a=await s.execute({name:'accounts.create',input:{name:'Fictional endpoints',type:'liability',anchor:'0000-01-01',opening:'-9223372036854775808'}});
  await s.execute({name:'transactions.create',input:{account:a.id,date:'2026-09-01',amount:'9223372036854775807',payee:'Fictional',category:'Other',classification:'income'}});
  await s.execute({name:'transactions.create',input:{account:a.id,date:'2099-01-01',amount:'1',payee:'Fictional future',category:'Other',classification:'income'}});
  assert.equal((await s.execute({name:'reports.read',input:{end:'2026-10-01'}})).netWorth,'-1');
  assert.equal((await s.execute({name:'reports.read',input:{end:'2100-01-01'}})).netWorth,'0');
  const b=await s.execute({name:'backup.read'});const memory=new MemoryRepository();try{new Portability(memory).restore({backup:b,confirmEmpty:true});assert.deepEqual(new Portability(memory).backup().data,b.data);}finally{memory.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
