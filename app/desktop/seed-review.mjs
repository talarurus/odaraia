// SPDX-License-Identifier: MPL-2.0
// Seed an explicitly requested EMPTY synthetic review directory with the packaged engine.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const resources=resolve(root,'artifacts/odaraia/native/Odaraia.app/Contents/Resources/backend');
const directory=process.argv[2];if(!directory||!isAbsolute(directory))throw new Error('Supply an absolute EMPTY review directory');
await mkdir(directory,{recursive:true,mode:0o700});process.umask(0o077);
const {Repository}=await import(pathToFileURL(join(resources,'db/repository.ts')));
const {canonical}=await import(pathToFileURL(join(resources,'domain/fixture.mjs')));
const {account,transaction,integrity}=await import(pathToFileURL(join(resources,'domain/validation.ts')));
const repo=new Repository(join(directory,'finance.sqlite'));
try{
 assert.equal(repo.state().accounts.length,0,'Review database must be empty');assert.equal(repo.state().transactions.length,0);
 repo.atomic(()=>{for(const a of canonical.accounts)repo.saveAccount(account({...a,revision:1}));const rows=canonical.transactions.map(t=>transaction({id:t.id,account:t.account,date:t.date,amount:t.amount,payee:t.payee,category:t.category,classification:t.classification,status:t.status,note:'',transferId:t.transferId||null,sourceKey:'fixture:'+t.id,sourceId:t.sourceId,revision:1,provenance:null}));integrity(repo.accounts(),rows);for(const t of rows)repo.saveRow(t);});repo.setBudget(canonical.budgets[0]);
 await writeFile(join(directory,'expected-state.json'),JSON.stringify(repo.state(),null,2));
 console.log('Synthetic review database: '+directory+'; September 2026 net worth $4,410.00, income $5,000.00, spending $1,790.00, surplus $3,210.00.');
}finally{repo.close();}
