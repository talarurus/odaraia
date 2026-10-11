// SPDX-License-Identifier: MPL-2.0
// Synthetic process-restart / portable data evidence; no native GUI claims.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {Repository} from '../../app/db/repository.ts';
import {Portability} from '../../app/server/portability.ts';
import {createAsyncNativeService} from '../../app/storage/async-native.ts';
import {processTransport} from '../../app/storage/native-sqlite/transport.mjs';
const root=resolve(import.meta.dirname,'../..'),out=join(root,'app/artifacts/tauri-validation');
mkdirSync(out,{recursive:true});
const profile=mkdtempSync(join(out,'synthetic-')),path=join(profile,'native.sqlite');
const binary=join(out,'store-contract'),env={...process.env,ODARAIA_TEST_NATIVE_BINARY:binary};
const worker=join(root,'app/tests/persistent-platform/restart-worker.mjs');
const run=mode=>JSON.parse(execFileSync(process.execPath,[worker,mode,path],{env,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const first=run('write'),second=run('read');assert.deepEqual(second,first);assert.equal(first.balance,'125099');
const service=createAsyncNativeService(processTransport(path,{binary}));
const backup=await service.execute({name:'backup.read'});
writeFileSync(join(profile,'odaraia-backup.json'),JSON.stringify(backup),{mode:0o600});
const recovery=createAsyncNativeService(processTransport(join(profile,'recovered-native.sqlite'),{binary}));
await recovery.execute({name:'backup.restore',input:{backup,confirmEmpty:true}});
assert.deepEqual((await recovery.execute({name:'backup.read'})).data,backup.data);
await assert.rejects(recovery.execute({name:'backup.restore',input:{backup,confirmEmpty:true}}),/existing/);
const reference=new Repository(join(profile,'node-reference.sqlite'));
try{
 const portability=new Portability(reference);portability.restore({backup,confirmEmpty:true});
 assert.deepEqual(portability.backup().data,backup.data);
 assert.equal(reference.report({}).netWorth,first.balance);
}finally{reference.close();}
const result={status:'PASS',scope:'Node shared services through the exact Rust FFI wrapper and bundled SQLite; not native UI',
 profile,accountCreation:'PASS',transactionPersistence:'PASS',restartPersistence:'PASS',backupRestore:'PASS',
 repeatedRestoreRefused:'PASS',nodeSQLiteParity:'PASS',balanceMinorUnits:first.balance,recordsIdentical:true,
 nativeWindow:'NOT VERIFIED',nativeFileDialog:'NOT VERIFIED',encryption:'NOT IMPLEMENTED'};
writeFileSync(join(out,'synthetic-data-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
