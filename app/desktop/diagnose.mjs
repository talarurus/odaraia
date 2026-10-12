// SPDX-License-Identifier: MPL-2.0
// Read-only environment/bundle audit. No GUI launch, network, user database or OS changes.
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditRuntime,minimum,dependencies,rpaths} from './runtime-audit.mjs';
import {bundleFingerprint} from './bundle-fingerprint.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'artifacts/odaraia/acceptance'),app=resolve(root,'artifacts/odaraia/native/plainbalance.app');await mkdir(out,{recursive:true});
const command=(path,args)=>{const r=spawnSync(path,args,{encoding:'utf8',timeout:15000});return {command:[path,...args],exitCode:r.status,signal:r.signal,stdout:r.stdout?.trim(),stderr:r.stderr?.trim(),error:r.error?.message};};
const result={recordedAt:new Date().toISOString(),os:command('/usr/bin/sw_vers',[]),architecture:command('/usr/bin/uname',['-m']),sdk:command('/usr/bin/xcrun',['--show-sdk-version']),sdkPath:command('/usr/bin/xcrun',['--show-sdk-path']),bootstrapManager:command('/bin/launchctl',['managername']),info:command('/usr/bin/plutil',['-p',join(app,'Contents/Info.plist')]),signature:command('/usr/bin/codesign',['--verify','--deep','--strict',app]),signatureIdentity:command('/usr/bin/codesign',['-d','--verbose=4',app]),host:{file:command('/usr/bin/file',[join(app,'Contents/MacOS/plainbalance')]),minimumMacOS:minimum(join(app,'Contents/MacOS/plainbalance'))},bundleFingerprint:bundleFingerprint(app)};
const runtime=auditRuntime(join(app,'Contents/Resources/runtime/node'));
result.runtime={minimumMacOS:runtime.minimumMacOS,files:runtime.files.map(x=>({...x,path:x.path.slice(app.length+1),rpaths:rpaths(x.path)})),selfContained:runtime.files.every(x=>x.path.startsWith(app+'/')&&x.dependencies.every(dep=>dep.startsWith('/usr/lib/')||dep.startsWith('/System/Library/')||dep.startsWith('@loader_path/')))};
const backend=join(app,'Contents/Resources/backend');result.requiredPaths=Object.fromEntries(['desktop/backend.mjs','desktop/storage.mjs','server/http.ts','server/api.ts','server/portability.ts','db/repository.ts','db/database.ts','db/migrations/001-ledger.sql','db/migrations/002-imports.sql','db/migrations/003-source-aliases.sql','domain/fixture.mjs','web/ui-model.mjs','dist/index.html','dist/app.js','dist/app.css'].map(file=>[file,existsSync(join(backend,file))]));
result.packagedRuntime=command(join(app,'Contents/Resources/runtime/node'),['--input-type=module','-e',"import {DatabaseSync} from 'node:sqlite';const d=new DatabaseSync(':memory:');console.log(JSON.stringify({node:process.version,arch:process.arch,sqlite:d.prepare('select sqlite_version() as version').get().version}));d.close();"]);
await writeFile(join(out,'environment.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
