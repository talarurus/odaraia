// SPDX-License-Identifier: MPL-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {Repository} from '../db/repository.ts';
import {MemoryRepository} from '../storage/memory.ts';
import {Importer,hash} from '../server/importer.ts';
import {Portability} from '../server/portability.ts';
import {createApplicationService,commandFor,routeFor} from '../services/application.ts';
import {createDemoSession} from '../services/demo.ts';
import {loadCanonical} from './canonical-fixture.mjs';
import {expected} from '../domain/fixture.mjs';

const factories=[['SQLite',()=>new Repository()],['memory (ephemeral)',()=>new MemoryRepository()]];
const service=r=>createApplicationService(r,{importer:new Importer(r),portability:new Portability(r)});
const aInput={name:'Fictional Cash',type:'checking',anchor:'2026-08-31',opening:'-9007199254740993'};
const txInput=account=>({account,date:'2026-09-01',amount:'1',payee:'Fictional refund',classification:'expense',category:'Groceries'});

for(const [name,make] of factories){
 test(`${name}: identical golden transfer/refund/budget/history results`,()=>{
  const repo=make();try{loadCanonical(repo);const report=repo.report({start:'2026-09-01',end:'2026-10-01'});
   for(const field of ['income','grossCharges','refunds','spending','surplus','netWorth','balances'])assert.deepEqual(report[field],expected[field]);
   assert.equal(repo.report({end:'2026-08-31'}).netWorth,null);
   assert.equal(repo.budgetReport('2026-09')[0].actual,'18000');
   assert.equal(repo.report({start:'2026-09-30',end:'2026-10-01'}).postedCount,0);
   assert.equal(repo.report({end:'2026-09-06'}).balances.checking,'430000');
  }finally{repo.close();}
 });
 test(`${name}: validated commands preserve exact large negatives and reject stale edits atomically`,async()=>{
  const r=make(),s=service(r);try{
   const a=await s.execute({name:'accounts.create',input:aInput});
   const t=await s.execute({name:'transactions.create',input:txInput(a.id)});
   assert.equal((await s.execute({name:'reports.read'})).netWorth,'-9007199254740992');
   await s.execute({name:'transactions.update',id:t.id,input:{amount:'2',revision:1}});
   const before=r.state();await assert.rejects(s.execute({name:'transactions.update',id:t.id,input:{amount:'3',revision:1}}),/changed/);
   await assert.rejects(s.execute({name:'transactions.create',input:{...txInput(a.id),date:a.anchor}}),/Pre-anchor/);
   await assert.rejects(s.execute({name:'transactions.create',input:{...txInput(a.id),amount:'0.1'}}),/integer/);
   assert.deepEqual(r.state(),before);
   await s.execute({name:'transactions.void',id:t.id,input:{revision:2}});await s.execute({name:'transactions.undo',id:t.id,input:{revision:3}});
   assert.equal(r.rows()[0].status,'posted');assert.equal(r.report().netWorth,'-9007199254740991');
  }finally{r.close();}
 });
 test(`${name}: linking, editing, voiding and undoing transfer pairs conserve worth`,()=>{
  const r=make();try{
   const a=r.createAccount({...aInput,opening:'10000'}),b=r.createAccount({...aInput,name:'Fictional Card',type:'credit',opening:'-5000'});
   const first=r.createTransaction({...txInput(a.id),amount:'-1000'}),second=r.createTransaction({...txInput(b.id),amount:'1000'});
   const linked=r.linkTransfer({first:first.id,second:second.id,revisions:{[first.id]:1,[second.id]:1}});
   assert.equal(r.report().spending,'0');assert.equal(r.report().netWorth,'5000');
   r.updateTransfer(linked[0].transferId,{date:'2026-09-02',amount:'2000',revisions:Object.fromEntries(linked.map(t=>[t.id,t.revision]))});
   r.voidTransaction(first.id,3);assert.equal(r.rows().filter(t=>t.status==='removed').length,2);r.voidTransaction(first.id,4,true);
   assert.equal(r.report().balances[a.id],'8000');assert.equal(r.report().balances[b.id],'-3000');assert.equal(r.report().netWorth,'5000');
  }finally{r.close();}
 });
 test(`${name}: failed batch rollback includes records, budgets and audit`,()=>{
  const r=make();try{const before=r.state();assert.throws(()=>r.atomic(()=>{// use storage writes inside one transaction
    r.saveAccount({id:'batch',...aInput,currency:'USD',revision:1});r.saveBudget({month:'2026-09',category:'Groceries',planned:'100'});
    r.audit('test.batch','batch',null,{synthetic:true});throw new Error('Injected failure');
   }),/Injected/);assert.deepEqual(r.state(),before);assert.deepEqual(r.auditEntries(),[]);
  }finally{r.close();}
 });
}

for(const [fromName,from] of factories)for(const [toName,to] of factories){
 test(`${fromName} export → ${toName} restore retains identities, undo, imports and exact results`,()=>{
  const source=from(),target=to();try{
   loadCanonical(source);const pending=source.rows().find(t=>t.status==='pending');source.voidTransaction(pending.id,pending.revision);
   const imp=new Importer(source),options={account:'checking',delimiter:',',dateFormat:'ISO',amountMode:'signed',columns:{date:'Date',payee:'Merchant',amount:'Amount',id:'ID'}};
   const input={name:'fictional.csv',text:'Date,Merchant,Amount,ID\n2026-09-15,Fictional shop,-1.23,bank-1',options};
   const preview=imp.preview(input);imp.commit({id:preview.id,decisions:[]});
   const pendingAlias=source.createTransaction({account:'checking',date:'2026-09-16',amount:'-250',payee:'Fictional Coffee',classification:'expense',category:'Dining',status:'pending'});
   const aliasInput={...input,name:'alias.csv',text:'Date,Merchant,Amount,ID\n2026-09-17,Fictional Coffee,-2.50,bank-alias'};
   const aliasPreview=imp.preview(aliasInput);imp.commit({id:aliasPreview.id,decisions:[{row:2,action:'match',targetId:pendingAlias.id,revision:1}]});
   const backup=new Portability(source).backup();assert.equal(backup.data.sourceAliases.length,1);
   const p=new Portability(target);p.restore({backup,confirmEmpty:true});assert.deepEqual(target.state(),source.state());assert.deepEqual(p.backup().data,backup.data);
   assert.deepEqual(target.report({start:'2026-09-01',end:'2026-10-01'}),source.report({start:'2026-09-01',end:'2026-10-01'}));
   assert.equal(new Importer(target).preview(input).replayed,true);assert.throws(()=>p.restore({backup,confirmEmpty:true}),/existing/);
   const overlap=new Importer(target).preview({...aliasInput,text:aliasInput.text+'\n2026-09-18,Fictional Other,-1.00,bank-other'});assert.equal(new Importer(target).commit({id:overlap.id,decisions:[]}).duplicates,1);
   target.voidTransaction(pending.id,2,true);assert.equal(target.rows().find(t=>t.id===pending.id).status,'pending');
   const bad=structuredClone(backup);bad.data.transactions[0].account='missing';bad.sha256=hash(bad.data);
   assert.throws(()=>p.validate(bad),/account/);
  }finally{source.close();target.close();}
 });
}

test('Demo edits and file capabilities are isolated from saved SQLite data',async()=>{
 const real=new Repository(),before=real.state(),demo=createDemoSession();try{
  const state=await demo.service.execute({name:'state.read'});assert.equal(state.accounts.length,3);
  const a=await demo.service.execute({name:'accounts.create',input:aInput});await demo.service.execute({name:'transactions.create',input:txInput(a.id)});
  for(const name of ['backup.read','backup.private','backup.restore','export.csv','imports.commit'])await assert.rejects(demo.service.execute({name,input:{}}),/unavailable/);
  assert.deepEqual(real.state(),before);demo.close();await assert.rejects(demo.service.execute({name:'state.read'}),/ended/);
  const again=createDemoSession();assert.equal((await again.service.execute({name:'state.read'})).accounts.length,3);again.close();
 }finally{real.close();demo.close();}
});

test('Shared ledger, CSV, import and backup services bundle for browsers without Node shims',async()=>{
 const result=await build({stdin:{contents:"export * from './services/demo.ts'; export * from './services/importer.ts'; export * from './services/portability.ts'; export * from './domain/csv.ts';",resolveDir:resolve(import.meta.dirname,'..')},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',metafile:true,logLevel:'silent'});
 assert.equal(result.errors.length,0);assert(!result.outputFiles[0].text.includes('Buffer.byteLength'));assert(!Object.keys(result.metafile.inputs).some(p=>/node_modules|db\/database|server\//.test(p)));
});

test('Capability translation rejects arbitrary SQL/filesystem commands and foreign routes',async()=>{
 const r=new MemoryRepository(),s=service(r);try{
  for(const name of ['sql.execute','fs.read','shell.execute','__proto__','constructor'])await assert.rejects(s.execute({name,input:{sql:'DROP TABLE accounts'}}));
  for(const path of ['https://attacker.test/state','/../state','/state?file=private','/accounts/id/../../state'])assert.throws(()=>commandFor(path));
  for(const name of ['accounts.update','transactions.update','transfers.update'])assert.throws(()=>routeFor({name,id:'../private'}));
  await assert.rejects(s.execute({name:'reports.read',input:{start:'2026-02-30'}}),/date/);
  await assert.rejects(s.execute({name:'reports.read',input:{start:'2026-10-01',end:'2026-09-01'}}),/after/);
  assert.deepEqual(r.state(),{accounts:[],transactions:[],budgets:[]});
 }finally{r.close();}
});

test('Persistent SQLite restart retains a shared-service export unchanged',async()=>{
 const dir=mkdtempSync(resolve(tmpdir(),'odaraia-contract-'));let r;try{
  r=new Repository(resolve(dir,'ledger.sqlite'));loadCanonical(r);const backup=new Portability(r).backup();r.close();r=new Repository(resolve(dir,'ledger.sqlite'));
  assert.deepEqual(new Portability(r).backup().data,backup.data);
  const result=await service(r).execute(commandFor('/reports?start=2026-09-01&end=2026-10-01'));assert.equal(result.netWorth,expected.netWorth);
 }finally{r?.close();rmSync(dir,{recursive:true,force:true});}
});
