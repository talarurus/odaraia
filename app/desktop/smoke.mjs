// SPDX-License-Identifier: MPL-2.0
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {runLifecycle} from './lifecycle-smoke.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'artifacts/odaraia',process.argv.includes('--experimental-desktop-glass')?'monocode/native':'native'),app=join(out,'plainbalance.app'),resources=join(app,'Contents/Resources'),node=join(resources,'runtime/node');
const directory=join(out,'backend-smoke-'+Date.now());await mkdir(directory,{recursive:true,mode:0o700});
const result={engine:'PENDING',lifecycle:'PENDING',assertions:0,errors:[]};
const literal=JSON.stringify;
const probe=`
import assert from 'node:assert/strict';
import {Repository} from ${literal(pathToFileURL(join(resources,'backend/db/repository.ts')).href)};
import {Portability} from ${literal(pathToFileURL(join(resources,'backend/server/portability.ts')).href)};
import {openDatabase} from ${literal(pathToFileURL(join(resources,'backend/db/database.ts')).href)};
import {canonical} from ${literal(pathToFileURL(join(resources,'backend/domain/fixture.mjs')).href)};
import {account,transaction,integrity} from ${literal(pathToFileURL(join(resources,'backend/domain/validation.ts')).href)};
import {chmodSync,statSync} from 'node:fs';
let assertions=0;const check=(fn)=>{fn();assertions++};
const old=openDatabase(${literal(join(directory,'finance.sqlite'))},2);old.close();
let repo=new Repository(${literal(join(directory,'finance.sqlite'))});
repo.atomic(()=>{for(const a of canonical.accounts)repo.saveAccount(account({...a,revision:1}));const rows=canonical.transactions.map(t=>transaction({id:t.id,account:t.account,date:t.date,amount:t.amount,payee:t.payee,category:t.category,classification:t.classification,status:t.status,note:'',transferId:t.transferId||null,sourceKey:'fixture:'+t.id,sourceId:t.sourceId,revision:1,provenance:null}));integrity(repo.accounts(),rows);for(const t of rows)repo.saveRow(t)});repo.setBudget(canonical.budgets[0]);
const before=repo.state(),report=repo.report({start:'2026-09-01',end:'2026-10-01'});check(()=>assert.equal(report.netWorth,'441000'));check(()=>assert.equal(report.income,'500000'));check(()=>assert.equal(report.spending,'179000'));check(()=>assert.equal(report.surplus,'321000'));
const backup=new Portability(repo).backup();check(()=>assert.equal(backup.format,'talarurus-finance'));const local=new Portability(repo).savePrivateBackup();check(()=>assert.equal(statSync(local.file).mode&511,384));repo.close();repo=new Repository(${literal(join(directory,'finance.sqlite'))});check(()=>assert.deepEqual(repo.state(),before));check(()=>assert.deepEqual(repo.report({start:'2026-09-01',end:'2026-10-01'}),report));
const target=new Repository(${literal(join(directory,'restored.sqlite'))});new Portability(target).restore({backup,confirmEmpty:true});check(()=>assert.deepEqual(target.state(),before));check(()=>assert.deepEqual(target.report({start:'2026-09-01',end:'2026-10-01'}),report));check(()=>assert.throws(()=>new Portability(repo).restore({backup,confirmEmpty:true})));target.close();repo.close();
check(()=>assert.equal(statSync(${literal(join(directory,'finance.sqlite'))}).mode&511,384));
console.log(JSON.stringify({assertions,node:process.version,executable:process.execPath,netWorth:report.netWorth}));
`;
try{
 const output=execFileSync(node,['--input-type=module','-e',probe],{cwd:'/',env:{PATH:'/usr/bin:/bin',HOME:directory},encoding:'utf8',stdio:['ignore','pipe','pipe']});const value=JSON.parse(output.trim());result.engine='PASS';result.assertions=value.assertions;result.engineProbe=value;
}catch(error){result.engine='FAIL';result.errors.push(error.stderr?.toString()||error.message);}
try{
 const lifecycle=await runLifecycle({node,resources,directory});result.lifecycle='PASS';result.lifecycleProbe=lifecycle;result.assertions+=lifecycle.assertions;
}catch(error){result.lifecycle=/EPERM|EACCES/.test(error.message)?'BLOCKED':'FAIL';result.errors.push(error.message);}
result.status=result.engine==='FAIL'||result.lifecycle==='FAIL'?'FAIL':result.lifecycle==='BLOCKED'?'PARTIAL_BLOCKED':'PASS';
await writeFile(join(out,'smoke-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='PASS'?0:result.status==='PARTIAL_BLOCKED'?2:1;
