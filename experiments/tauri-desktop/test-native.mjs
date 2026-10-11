// SPDX-License-Identifier: MPL-2.0
// Executed contract harness, not a substitute for native WebView/UI acceptance.
import {execFileSync} from 'node:child_process';
import {mkdirSync,copyFileSync,existsSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),host=resolve(import.meta.dirname,'src-tauri');
const out=join(root,'app/artifacts/tauri-validation');mkdirSync(out,{recursive:true});
const cache=join(out,'cargo-home');
const env={...process.env,MACOSX_DEPLOYMENT_TARGET:'14.0',...(existsSync(join(cache,'registry/cache'))?{CARGO_HOME:cache}:{})};
await import('./build-web.mjs');
function cargo(args,log){
 const output=execFileSync('cargo',[...args,'--offline','--locked','--manifest-path',join(host,'Cargo.toml')],{cwd:root,env,encoding:'utf8',maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});
 writeFileSync(join(out,log),output);
 return output;
}
// Capture actual build-script metadata, rather than guessing SQLite's archive.
const messages=cargo(['build','--bin','store-contract','--features','contract-harness','--message-format=json'],'rust-harness-build.jsonl').trim().split('\n').map(JSON.parse);
const sqlite=messages.find(m=>m.reason==='build-script-executed'&&m.package_id.includes('libsqlite3-sys@'));
if(!sqlite)throw new Error('Missing bundled SQLite build metadata');
const archive=join(sqlite.out_dir,'libsqlite3.a');
if(!existsSync(archive))throw new Error('Missing bundled SQLite archive');
const include=readFileSync(join(sqlite.out_dir,'../output'),'utf8').match(/^cargo:include=(.+)$/m)?.[1];
if(!include||!existsSync(join(include,'sqlite3.h')))throw new Error('Missing bundled SQLite headers');
const target=process.env.CARGO_TARGET_DIR?resolve(root,process.env.CARGO_TARGET_DIR):join(host,'target');
copyFileSync(join(target,'debug/store-contract'),join(out,'store-contract'));
// Deliberate crash is isolated to a C test executable, with the same bundled
// SQLite archive as the Rust host. It is never linked into either review app.
execFileSync(process.env.CC||'cc',['-std=c11','-D_DARWIN_C_SOURCE','-D_POSIX_C_SOURCE=200809L','-DODARAIA_TESTING',
 '-Wall','-Wextra','-Werror','-I',include,
 join(root,'app/storage/native-sqlite/store.c'),join(root,'app/storage/native-sqlite/cli.c'),archive,'-o',join(out,'sqlite-store-fault-test')],{env,stdio:'inherit'});
const result=execFileSync(process.execPath,['--test',join(root,'app/tests/persistent-platform/adapter.test.mjs')],{cwd:root,
 env:{...env,ODARAIA_TEST_NATIVE_BINARY:join(out,'store-contract')},encoding:'utf8',maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
writeFileSync(join(out,'rust-adapter-tests.log'),result);console.log(result);
const tests=execFileSync('cargo',['test','--offline','--locked','--lib','--manifest-path',join(host,'Cargo.toml')],{cwd:root,env,encoding:'utf8',maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
writeFileSync(join(out,'cargo-tests.log'),tests);console.log(tests);
writeFileSync(join(out,'sqlite-linkage.json'),JSON.stringify({archive,source:sqlite.package_id,crashHelper:'same bundled SQLite; C-only test executable; ODARAIA_TESTING absent from host build'},null,2));
