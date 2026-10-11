// SPDX-License-Identifier: MPL-2.0
// Records process/LaunchServices evidence only. Does not certify UI workflows.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const out=resolve(import.meta.dirname,'../../app/artifacts/tauri-validation');
const {bundle}=JSON.parse(readFileSync(join(out,'mac/package.json'),'utf8'));
function run(command,args){const r=spawnSync(command,args,{encoding:'utf8',timeout:15000,maxBuffer:32768});return {command:[command,...args],exit:r.status,signal:r.signal,error:r.error?.code||null,stdout:r.stdout||'',stderr:r.stderr||''};}
const launchServices=run('/usr/bin/open',['-n','-a',bundle]);
const direct=launchServices.exit===0?null:run(join(bundle,'Contents/MacOS/odaraia-sqlite-prototype'),[]);
const visible=!!direct&&/ODARAIA_NATIVE_PAGE_FINISHED window_visible=true/.test(direct.stderr);
const result={recordedAt:new Date().toISOString(),bundle,launchServices,direct,
 nativeWindow:visible?'PASS':launchServices.exit===0?'NOT VERIFIED':'BLOCKED',
 accountCreation:'NOT VERIFIED',transactionPersistence:'NOT VERIFIED',restartPersistence:'NOT VERIFIED',
 financialParity:'NOT VERIFIED in native UI; separate bridge contracts PASS',backupRestore:'NOT VERIFIED in native UI',
 note:'Successful open or a running process alone cannot certify a visible working application. No financial data is collected.'};
writeFileSync(join(out,'native-launch-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
