// SPDX-License-Identifier: MPL-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync,symlinkSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {realpathSync} from 'node:fs';
import {Repository} from '../db/repository.ts';
import {createAPI} from '../server/api.ts';
import {sameSecret} from '../server/local-security.ts';
import {desktopDataDirectory,prepareDesktopStorage} from '../desktop/storage.mjs';
import {readWindowAppearance,saveWindowAppearance,effectiveWindowAppearance} from '../web/desktop.mjs';
import {loadCanonical} from './canonical-fixture.mjs';
import {Portability} from '../server/portability.ts';

test('Desktop data uses a stable per-user support directory, private modes, and never the development database',()=>{
 assert.equal(desktopDataDirectory({home:'/Users/example'}),'/Users/example/Library/Application Support/com.talarurus.odaraia');
 assert.throws(()=>desktopDataDirectory({override:'relative.sqlite'}));
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'odaraia-storage-')));try{
  const path=prepareDesktopStorage(directory);assert.equal(statSync(directory).mode&0o777,0o700);const repo=new Repository(path);loadCanonical(repo);repo.close();assert.equal(statSync(path).mode&0o777,0o600);
  const link=join(directory,'linked');symlinkSync(directory,link);assert.throws(()=>prepareDesktopStorage(link),/real directory/);
  const second=join(directory,'second');mkdirSync(second);symlinkSync(path,join(second,'finance.sqlite'));assert.throws(()=>prepareDesktopStorage(second),/symbolic link/);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test('Desktop database restarts and legacy JSON recovery preserve balances, import identities and exact reports',()=>{
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'odaraia-restart-'))),path=prepareDesktopStorage(directory);let repo;
 try{repo=new Repository(path);loadCanonical(repo);const state=repo.state(),r=repo.report();const backup=new Portability(repo).backup();repo.close();repo=new Repository(path);assert.deepEqual(repo.state(),state);assert.deepEqual(repo.report(),r);assert.equal(backup.format,'talarurus-finance');
  const restored=new Repository(join(directory,'restored.sqlite'));try{new Portability(restored).restore({backup,confirmEmpty:true});assert.deepEqual(restored.state(),state);assert.deepEqual(restored.report(),r);assert.throws(()=>new Portability(repo).restore({backup,confirmEmpty:true}));}finally{restored.close();}
 }finally{repo?.close();rmSync(directory,{recursive:true,force:true});}
});
test('Private local API cannot bootstrap sessions without launch authorization, and rejects foreign sites and stale credentials',async()=>{
 const repo=new Repository();loadCanonical(repo);const before=repo.state(),origin='http://127.0.0.1:51487',secret='a'.repeat(64),handle=createAPI(repo,origin,secret);
 const call=(path,headers={},method='GET',body)=>handle(new Request(origin+'/api'+path,{method,headers:{host:new URL(origin).host,...headers},...(body?{body:JSON.stringify(body)}:{})}));
 try{
  assert.equal((await call('/session')).status,403);assert.equal((await call('/session',{'x-odaraia-launch':'b'.repeat(64)})).status,403);
  assert.equal((await call('/session',{'x-odaraia-launch':secret,origin:'https://attacker.example'})).status,400);
  assert.equal((await call('/session',{'x-odaraia-launch':secret,'sec-fetch-site':'cross-site'})).status,403);
  const session=await call('/session',{'x-odaraia-launch':secret});assert.equal(session.status,200);assert.equal(session.headers.get('set-cookie'),null);const cookie='odaraia-local-access='+secret;const {token}=await session.json();const nativeSession=await call('/session',{cookie});assert(nativeSession.headers.get('set-cookie').includes('HttpOnly'));assert(nativeSession.headers.get('set-cookie').includes('SameSite=Strict'));
  assert.equal((await call('/state',{'x-talarurus-session':token})).status,403);
  assert.deepEqual(await (await call('/state',{'x-odaraia-access':secret,'x-talarurus-session':token})).json(),before);
  const headers={cookie,'x-talarurus-session':token};assert.deepEqual(await (await call('/state',headers)).json(),before);
  assert.equal((await call('/state',{...headers,host:'localhost:51487'})).status,400);
  assert.equal((await call('/state',{...headers,origin:'http://127.0.0.1:4174'})).status,400);
  assert.equal((await call('/state',{...headers,'sec-fetch-site':'cross-site'})).status,403);
  assert.equal((await call('/accounts',{...headers,'content-type':'application/json'},'POST',{})).status,400);
  const restarted=createAPI(repo,origin,'b'.repeat(64));assert.equal((await restarted(new Request(origin+'/api/session',{headers:{host:new URL(origin).host,cookie}}))).status,403);
  assert.equal(sameSecret('é'.repeat(64),secret),false);assert.deepEqual(repo.state(),before);
 }finally{repo.close();}
});
test('Window appearance persists and is reversible while browsers and Reduce Transparency always remain solid',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 assert.equal(readWindowAppearance(storage),'solid');assert(saveWindowAppearance(storage,'translucent'));assert.equal(readWindowAppearance(storage),'translucent');assert.equal(effectiveWindowAppearance('translucent',true,false),'translucent');assert.equal(effectiveWindowAppearance('translucent',false,false),'solid');assert.equal(effectiveWindowAppearance('translucent',true,true),'solid');
 saveWindowAppearance(storage,'solid');assert.equal(readWindowAppearance(storage),'solid');assert.throws(()=>saveWindowAppearance(storage,'unknown'));assert.equal(readWindowAppearance({getItem(){throw Error('private')}}),'solid');
});
