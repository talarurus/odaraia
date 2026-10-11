// SPDX-License-Identifier: MPL-2.0
// Downloads an official redistributable runtime into project artifacts; no installer/Homebrew.
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditRuntime} from './runtime-audit.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'artifacts/odaraia/runtime');
const name='node-v24.21.0-darwin-arm64',archive=name+'.tar.gz',base='https://nodejs.org/dist/v24.21.0/';
await mkdir(out,{recursive:true});
const result={status:'PENDING',version:'24.21.0',archiveURL:base+archive,checksumURL:base+'SHASUMS256.txt',checksumVerification:'SHA-256 from official HTTPS origin; not a detached-signature verification'};
try{
 for(const file of [archive,'SHASUMS256.txt'])execFileSync('/usr/bin/curl',['--fail','--location','--proto','=https','--tlsv1.2','--connect-timeout','15','--max-time','180','--output',join(out,file+'.download'),base+file],{stdio:'pipe'});
 const sums=await readFile(join(out,'SHASUMS256.txt.download'),'utf8');const expected=sums.split('\n').map(line=>line.trim().split(/\s+/)).find(row=>row[1]===archive)?.[0];
 if(!expected||!/^[a-f0-9]{64}$/.test(expected))throw new Error('Official checksum entry is absent');
 const digest=createHash('sha256').update(await readFile(join(out,archive+'.download'))).digest('hex');if(digest!==expected)throw new Error('Runtime archive checksum mismatch');
 // Extract only the verified official archive. Preserve any existing runtime until download succeeds.
 const stage=join(out,'verified-extraction');await rm(stage,{recursive:true,force:true});await mkdir(stage);
 execFileSync('/usr/bin/tar',['-xzf',join(out,archive+'.download'),'-C',stage]);
 const binary=join(stage,name,'bin/node');const audit=auditRuntime(binary);
 if(audit.minimumMacOS!=='14.0'||audit.files.length!==1)throw new Error('Official runtime is not self-contained at macOS 14.0: '+JSON.stringify(audit));
 const probe=JSON.parse(execFileSync(binary,['--input-type=module','-e',"import {DatabaseSync} from 'node:sqlite';const d=new DatabaseSync(':memory:');console.log(JSON.stringify({version:process.version,arch:process.arch,sqlite:d.prepare('select 42 as value').get().value}));d.close();"],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 if(probe.version!=='v24.21.0'||probe.arch!=='arm64'||probe.sqlite!==42)throw new Error('Unexpected runtime/SQLite probe '+JSON.stringify(probe));
 const {rename}=await import('node:fs/promises');await rm(join(out,name),{recursive:true,force:true});await rename(join(stage,name),join(out,name));
 result.status='PASS';result.archiveSha256=digest;result.executableSha256=createHash('sha256').update(await readFile(join(out,name,'bin/node'))).digest('hex');result.audit=audit;result.runtimeProbe=probe;result.runtime=join(out,name,'bin/node');
 console.log('Verified official runtime: '+result.runtime);
}catch(error){result.status=/resolve host|ENOTFOUND|EACCES|EPERM/.test(error.stderr?.toString()||error.message)?'BLOCKED':'FAIL';result.reason=error.stderr?.toString()||error.message;console.error(result.reason);process.exitCode=result.status==='BLOCKED'?2:1;}
await writeFile(join(out,'prepare-result.json'),JSON.stringify(result,null,2));
