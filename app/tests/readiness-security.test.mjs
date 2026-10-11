// SPDX-License-Identifier: MPL-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {Repository} from '../db/repository.ts';
import {MemoryRepository} from '../storage/memory.ts';
import {Importer} from '../server/importer.ts';
import {createAPI} from '../server/api.ts';
import {startServer} from '../server/http.ts';
import {cells} from '../domain/csv.ts';
import {Portability} from '../server/portability.ts';
import {hash} from '../server/importer.ts';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';

test('Corrupt and foreign-key-broken SQLite stores fail closed without reset or deletion',()=>{
 const dir=mkdtempSync(resolve(tmpdir(),'odaraia-damaged-'));try{
  const corrupt=resolve(dir,'corrupt.sqlite'),bytes=Buffer.from('synthetic invalid database bytes');writeFileSync(corrupt,bytes);
  assert.throws(()=>new Repository(corrupt));assert.deepEqual(readFileSync(corrupt),bytes);
  const broken=resolve(dir,'broken.sqlite');new Repository(broken).close();const db=new DatabaseSync(broken);
  db.exec("PRAGMA foreign_keys=OFF; INSERT INTO transactions VALUES('dangling','missing','2026-09-01',1,'Synthetic','Synthetic','expense','posted','',NULL,'synthetic:key',NULL,1,'null')");db.close();
  assert.throws(()=>new Repository(broken),/broken references/);
  const verify=new DatabaseSync(broken);assert.equal(verify.prepare('SELECT count(*) n FROM transactions').get().n,1);assert.equal(verify.prepare('PRAGMA user_version').get().user_version,3);verify.close();
  const invalid=resolve(dir,'invalid-calendar.sqlite');const store=new Repository(invalid);const account=store.createAccount({name:'Synthetic',type:'checking',anchor:'2026-08-31',opening:'0'});store.db.prepare('UPDATE accounts SET anchor=? WHERE id=?').run('2026-02-30',account.id);store.close();assert.throws(()=>new Repository(invalid),/financial data failed validation/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Malicious filename paths and CSV control characters cannot enter a preview or ledger',()=>{
 for(const r of [new Repository(),new MemoryRepository()])try{
  const a=r.createAccount({name:'Synthetic',type:'checking',anchor:'2026-08-31',opening:'0'}),imp=new Importer(r);
  const input={text:'Date,Payee,Amount\n2026-09-01,Synthetic,-1',options:{account:a.id,delimiter:',',dateFormat:'ISO',amountMode:'signed',columns:{date:'Date',payee:'Payee',amount:'Amount'}}};
  for(const name of ['../../private.csv','C:\\private.csv','bad\nfile.csv','.','..'])assert.throws(()=>imp.preview({...input,name}),/file name/);
  for(const text of ['a\u0000,b','"unfinished','a,b\n"ok"malicious,b'])assert.throws(()=>cells(text));
  assert.equal(r.rows().length,0);assert.equal(r.listImports().length,0);
 }finally{r.close();}
});

test('Local API rejects foreign/null origins, malicious capabilities and session replay without logging payloads',async()=>{
 const r=new Repository(),secret='a'.repeat(64),origin='http://127.0.0.1:4174',handler=createAPI(r,origin,secret);
 const call=(path,headers={},method='GET',body)=>handler(new Request(origin+'/api'+path,{method,headers:{host:'127.0.0.1:4174','x-odaraia-access':secret,...headers},...(body===undefined?{}:{body})}));
 try{
  const response=await call('/session');const {token}=await response.json();
  for(const value of ['null','http://localhost:4174','http://127.0.0.1:4175','https://attacker.example'])assert.equal((await call('/state',{origin:value,'x-talarurus-session':token})).status,400);
  assert.equal((await call('/state',{'sec-fetch-site':'cross-site','x-talarurus-session':token})).status,403);
  const headers={origin,'content-type':'application/json','x-talarurus-session':token};
  for(const path of ['/sql','/filesystem','/shell','/accounts/path/extra'])assert.equal((await call(path,headers,'POST','{}')).status,404);
  const invalid=await call('/accounts',headers,'POST',JSON.stringify({name:'Synthetic sensitive name',type:'checking',anchor:'2026-08-31',opening:'not-cents'}));
  assert.equal(invalid.status,400);assert(!(await invalid.text()).includes('Synthetic sensitive name'));assert.equal(r.accounts().length,0);
  assert.equal((await createAPI(r,origin,'b'.repeat(64))(new Request(origin+'/api/state',{headers:{host:'127.0.0.1:4174','x-odaraia-access':secret,'x-talarurus-session':token}}))).status,403);
 }finally{r.close();}
});

test('HTTP server refuses weak launch credentials before opening any database',()=>{
 assert.throws(()=>startServer({path:':memory:',port:0,accessToken:'weak',quiet:true}),/256-bit/);
});

test('Restore rejects inconsistent undo evidence and normalized invalid calendar timestamps',()=>{
 const r=new Repository(),target=new Repository();try{
  const a=r.createAccount({name:'Synthetic',type:'checking',anchor:'2026-08-31',opening:'0'}),t=r.createTransaction({account:a.id,date:'2026-09-01',amount:'-100',payee:'Synthetic',classification:'expense'});r.voidTransaction(t.id,1);
  const backup=new Portability(r).backup(),p=new Portability(target),bad=structuredClone(backup);
  const event=bad.data.audit.find(a=>a.action==='transaction.void'),before=JSON.parse(event.before_json);before.amount='-101';event.before_json=JSON.stringify(before);bad.sha256=hash(bad.data);
  assert.throws(()=>p.restore({backup:bad,confirmEmpty:true}),/history disagrees/);assert(target.empty());
  assert.throws(()=>p.validate({...backup,createdAt:'2026-02-30T00:00:00.000Z'}),/timestamp/);
  p.restore({backup,confirmEmpty:true});target.voidTransaction(t.id,2,true);assert.equal(target.rows()[0].amount,'-100');
 }finally{r.close();target.close();}
});

test('A valid near-limit backup exports compactly and remains restorable instead of expanding beyond the native/file limit',async()=>{
 const r=new Repository(),dir=mkdtempSync(resolve(tmpdir(),'odaraia-export-'));const previous=globalThis.window;
 try{
  const a=r.createAccount({name:'Synthetic',type:'checking',anchor:'2026-08-31',opening:'0'}),p=new Portability(r),backup=p.backup();
  backup.data.transactions=Array.from({length:40000},(_,i)=>({id:'record-'+String(i).padStart(6,'0'),account:a.id,date:'2026-09-01',amount:'-100',payee:'Fictional Market',category:'Groceries',classification:'expense',status:'posted',note:'',transferId:null,sourceKey:'manual:record-'+i,sourceId:null,revision:1,provenance:null}));backup.sha256=hash(backup.data);
  assert(Buffer.byteLength(JSON.stringify(backup))<16*1024*1024);assert(Buffer.byteLength(JSON.stringify(backup,null,2))>16*1024*1024);assert.equal(p.validate(backup).transactions,40000);
  const file=resolve(dir,'api.mjs');await build({entryPoints:[resolve(import.meta.dirname,'../web/api.ts')],outfile:file,bundle:true,platform:'node',format:'esm',logLevel:'silent'});
  const messages=[];globalThis.window={__ODARAIA_NATIVE__:{},webkit:{messageHandlers:{odaraia:{postMessage:value=>messages.push(value)}}}};
  const {download,useApplicationService}=await import(pathToFileURL(file));useApplicationService({async execute(){return backup;}});await download('/backup','odaraia-backup.json');
  assert.equal(messages.length,1);const text=messages[0].value.text;assert(Buffer.byteLength(text)<=16*1024*1024);assert.equal(p.validate(JSON.parse(text)).transactions,40000);useApplicationService(null);
 }finally{globalThis.window=previous;r.close();rmSync(dir,{recursive:true,force:true});}
});
