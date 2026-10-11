// SPDX-License-Identifier: MPL-2.0
// Offline license metadata checks; advisory services are a separate online check.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const npm=[];
for(const project of ['app','experiments/finance-proof']){
 const lock=read(project+'/package-lock.json'),pkg=read(project+'/package.json');
 assert.equal(lock.packages[''].license,pkg.license,'Original package license metadata must agree');
 for(const [name,version] of Object.entries({...pkg.dependencies,...pkg.devDependencies})){assert(/^\d+\.\d+\.\d+$/.test(version));assert.equal(lock.packages['node_modules/'+name].version,version);}
 for(const [path,p] of Object.entries(lock.packages))if(path){assert(p.integrity&&p.resolved?.startsWith('https://registry.npmjs.org/'));assert(p.license,'Missing npm license: '+path);npm.push({project,name:path.split('node_modules/').at(-1),version:p.version,license:p.license,dev:!!p.dev,optional:!!p.optional});}
}
const cargo=read('release/cargo-licenses.json').packages;
const lockText=readFileSync(resolve(root,'experiments/tauri-desktop/src-tauri/Cargo.lock'),'utf8');
const locked=[...lockText.matchAll(/\[\[package\]\]\nname = \"([^\"]+)\"\nversion = \"([^\"]+)\"/g)].map(m=>m[1]+'@'+m[2]);
assert.deepEqual([...new Set(cargo.map(v=>v.name+'@'+v.version))].sort(),[...new Set(locked)].sort(),'Cargo license inventory must match the lockfile');
const unknown=cargo.filter(p=>!p.license&&p.name!=='odaraia-sqlite-prototype');
assert.equal(unknown.length,0,'Unresolved third-party Cargo license metadata');
const out=resolve(root,'app/artifacts/v031');mkdirSync(out,{recursive:true});
writeFileSync(resolve(out,'dependency-license-inventory.json'),JSON.stringify({scope:'Lockfile/recorded Cargo SPDX metadata; no advisory or legal approval claim',npm,cargo},null,2)+'\n');
console.log(JSON.stringify({npmLockedPackages:npm.length,cargoPackages:cargo.length,unknownThirdPartyLicenses:unknown.length,originalLicenses:{app:read('app/package.json').license,proof:read('experiments/finance-proof/package.json').license,rust:cargo.find(p=>p.name==='odaraia-sqlite-prototype')?.license},advisoryScan:'separate online command',cargoLicenseExpressions:[...new Set(cargo.map(v=>v.license))].sort()},null,2));
