// SPDX-License-Identifier: MPL-2.0
// Read-only checks. No downloads, installations or configuration changes.
import {spawnSync} from 'node:child_process';
import {existsSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {homedir,platform,arch} from 'node:os';
const probes=[['node','--version'],['npm','--version'],['rustc','--version'],['cargo','--version'],['cargo-tauri','--version'],['xcodebuild','-version'],['xcode-select','-p'],['clang','--version'],['sqlite3','--version'],['docker','--version'],['docker','info','--format','{{.OSType}} {{.Architecture}}'],['xcrun','simctl','list','devices','available'],['pod','--version'],['adb','version'],['gradle','--version']];
const results=probes.map(([command,...args])=>{const p=spawnSync(command,args,{encoding:'utf8',timeout:15000,maxBuffer:32768});return {command:[command,...args],exitCode:p.status,error:p.error?.code||null,stdout:(p.stdout||'').slice(0,4000),stderr:(p.stderr||'').slice(0,4000)};});
const paths=['.cargo/bin/rustc','Library/Android/sdk'].map(p=>({path:resolve(homedir(),p),exists:existsSync(resolve(homedir(),p))}));
paths.push({path:'/Applications/Android Studio.app',exists:existsSync('/Applications/Android Studio.app')});
const out=resolve(import.meta.dirname,'../../app/artifacts/persistent-platform');mkdirSync(out,{recursive:true});
writeFileSync(resolve(out,'toolchain.json'),JSON.stringify({recordedAt:new Date().toISOString(),host:{platform:platform(),arch:arch()},results,paths,networkProbe:{executedOnce:'curl --head --max-time 10 https://static.rust-lang.org/dist/channel-rust-stable.toml',exitCode:6,error:'Could not resolve host: static.rust-lang.org',scope:'shell execution environment; normal Terminal not tested'},installationPerformed:false},null,2));
console.log('Recorded toolchain evidence; no installation attempted.');
