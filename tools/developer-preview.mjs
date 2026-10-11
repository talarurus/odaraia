// SPDX-License-Identifier: MPL-2.0
// Synthetic isolated profiles only; never opens app/data or native user profiles.
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {Repository} from '../app/db/repository.ts';
import {Portability} from '../app/server/portability.ts';
import {loadCanonical} from '../app/tests/canonical-fixture.mjs';
import {createAsyncNativeService} from '../app/storage/async-native.ts';
import {processTransport} from '../app/storage/native-sqlite/transport.mjs';
const root=resolve(import.meta.dirname,'..'),out=join(root,'app/artifacts/v031');
mkdirSync(out,{recursive:true,mode:0o700});
const command=process.argv[2]||'journey';
if(command==='web'){
 const profile=mkdtempSync(join(out,'web-synthetic-')),path=join(profile,'finance.sqlite');
 const repo=new Repository(path);if(!process.argv.includes('--empty'))loadCanonical(repo);repo.close();
 console.log('Disposable fictional review profile: '+profile);
 const result=spawnSync(process.execPath,['scripts/start.mjs'],{cwd:join(root,'app'),env:{...process.env,FINANCE_DB:path},stdio:'inherit'});
 process.exitCode=result.status??1;
}else if(command==='journey'){
 const profile=mkdtempSync(join(out,'journey-')),path=join(profile,'fictional.sqlite');
 const native=process.argv.includes('--rust'),binary=join(root,'app/artifacts/tauri-validation/store-contract');
 const make=p=>createAsyncNativeService(processTransport(p,{binary}));
 let repo,service;
 if(native)service=make(path);else{
  const {createApplicationService}=await import('../app/services/application.ts');
  const {Importer}=await import('../app/server/importer.ts');
  repo=new Repository(path);service=createApplicationService(repo,{importer:new Importer(repo),portability:new Portability(repo)});
 }
 const run=(name,input)=>service.execute({name,...(input===undefined?{}:{input})});
 try{
  assert.equal((await run('state.read')).accounts.length,0);
  const account=await run('accounts.create',{name:'Fictional Developer Checking',type:'checking',anchor:'2026-08-31',opening:'100000'});
  assert.equal((await run('reports.read')).netWorth,'100000');
  await run('transactions.create',{account:account.id,date:'2026-09-01',amount:'-1250',payee:'Fictional Stationery',category:'Office',classification:'expense'});
  assert.equal((await run('reports.read')).balances[account.id],'98750');
  await run('budgets.set',{month:'2026-09',category:'Groceries',planned:'25000'});
  await run('budgets.set',{month:'2026-09',category:'Groceries',planned:'30000'});
  const text=readFileSync(join(root,'app/fixtures/sample-checking.csv'),'utf8');
  const options={account:account.id,delimiter:',',dateFormat:'ISO',amountMode:'signed',columns:{date:'Date',payee:'Merchant',amount:'Amount',id:'ID',category:'Category',classification:'Classification',status:'Status',note:'Note'}};
  const preview=await run('imports.preview',{text,name:'sample-checking.csv',options});
  assert.equal(preview.errors.length,0);assert.equal(preview.rows.length,7);
  assert.equal((await run('imports.commit',{id:preview.id,decisions:[]})).added,7);
  const reports=await run('reports.read',{start:'2026-09-01',end:'2026-10-01'});
  assert.equal(reports.netWorth,'429750');assert.equal(reports.income,'500000');assert.equal(reports.spending,'170250');assert.equal(reports.surplus,'329750');
  const backup=await run('backup.read');assert.equal(backup.data.budgets[0].planned,'30000');
  await run('backup.validate',{backup});
  writeFileSync(join(profile,'synthetic-backup.json'),JSON.stringify(backup),{mode:0o600});
  const csv=await run('export.csv');assert(csv.csv.includes('Fictional Stationery'));
  const targetPath=join(profile,'empty-recovery.sqlite');
  if(native){const target=make(targetPath);await target.execute({name:'backup.restore',input:{backup,confirmEmpty:true}});assert.deepEqual((await target.execute({name:'backup.read'})).data,backup.data);await assert.rejects(target.execute({name:'backup.restore',input:{backup,confirmEmpty:true}}),/existing/);}
  else{const target=new Repository(targetPath);try{new Portability(target).restore({backup,confirmEmpty:true});assert.deepEqual(new Portability(target).backup().data,backup.data);assert.throws(()=>new Portability(target).restore({backup,confirmEmpty:true}),/existing/);}finally{target.close();}}
  repo?.close();repo=undefined;
  // Every native command crosses a fresh Rust process; Node reopens its real DB.
  if(native){const reopened=make(path);assert.deepEqual((await reopened.execute({name:'backup.read'})).data,backup.data);assert.equal((await reopened.execute({name:'reports.read'})).netWorth,'429750');}
  else{repo=new Repository(path);assert.deepEqual(new Portability(repo).backup().data,backup.data);assert.equal(repo.report().netWorth,'429750');}
  const result={status:'PASS',adapter:native?'Rust FFI + bundled SQLite':'Node SQLite',fictional:true,openingMinor:'100000',afterManualTransaction:'98750',finalBalanceMinor:'429750',incomeMinor:'500000',spendingMinor:'170250',csvRows:7,budgetModified:true,backupValidated:true,emptyRestore:true,mergeRefused:true,reopenIdentical:true,gui:'NOT VERIFIED'};
  writeFileSync(join(out,native?'journey-rust.json':'journey-node.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }finally{repo?.close();}
}else throw Error('Use web [--empty] or journey [--rust]');
