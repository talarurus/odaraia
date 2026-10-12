// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,dirname,basename,extname} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),read=p=>readFileSync(resolve(root,p),'utf8');
const manifest=JSON.parse(read('release/source-files.json')),paths=manifest.files;
const sha=p=>createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex');
const mit=new Set(['app/desktop/DesktopGlass.swift','app/desktop/ExperimentalGlassBridge.m']);
const art=new Set(JSON.parse(read('brand/talarurus-assets.json')).assets.map(a=>a.file));
export function licenseFor(p){
 if(art.has(p))return 'LicenseRef-Talarurus-Publisher-Artwork';
 if(mit.has(p))return 'MIT';
 if(p==='brand/plainbalance/source/fonts/inter-latin-wght.woff2')return 'OFL-1.1';
 if(p==='brand/plainbalance/source/fonts/OFL.txt')return 'retained-legal-text-or-provenance';
 if(p==='LICENSE'||p==='DCO'||p.startsWith('LICENSES/')||p.includes('/notices/third-party/')||p.includes('/third-party/monocode/'))return 'retained-legal-text-or-provenance';
 return 'MPL-2.0';
}
const inline=p=>['.mjs','.ts','.tsx','.jsx','.swift','.c','.h','.m','.rs'].includes(extname(p))&&p!=='app/storage/native-sqlite/schema.h'&&!p.includes('/fixtures/');
const notice=p=>inline(p)?p:(dirname(p)==='.'?'LICENSES.md':dirname(p)+'/LICENSES.md');
const exhibit='This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.';
const mode=process.argv[2]||'check';
if(mode==='notices'){
 const groups=new Map();
 for(const p of paths){const license=licenseFor(p);if(license==='retained-legal-text-or-provenance')continue;
  if(inline(p)){
   const content=read(p),header='// SPDX-License-Identifier: '+license+'\n';
   if(!content.includes('SPDX-License-Identifier:'))writeFileSync(resolve(root,p),content.startsWith('#!')?content.replace(/\n/,'\n'+header):header+content);
  }else{const n=notice(p);if(!groups.has(n))groups.set(n,[]);groups.get(n).push({path:basename(p),license});}
 }
 for(const [p,rows] of groups){
  const text='<!-- SPDX-License-Identifier: MPL-2.0 -->\n# File license notices\n\n'+exhibit+'\n\nThe following exact files use the indicated terms. Other upstream legal texts retain their own terms.\n\n| File | SPDX / treatment |\n| --- | --- |\n'+rows.sort((a,b)=>a.path.localeCompare(b.path)).map(v=>'| `'+v.path+'` | `'+v.license+'` |').join('\n')+'\n\nMPL text: repository LICENSE. MIT adaptation text: app/desktop/third-party/monocode/LICENSE. Publisher artwork permission: LICENSES/LicenseRef-Talarurus-Publisher-Artwork.txt. No trademark clearance or endorsement is implied.\n';
  mkdirSync(dirname(resolve(root,p)),{recursive:true});writeFileSync(resolve(root,p),text);
 }
 console.log(JSON.stringify({directoryNotices:[...groups.keys()].sort()}));
}else if(mode==='coverage'){
 const rows=paths.map(p=>({path:p,license:licenseFor(p),notice:licenseFor(p)==='retained-legal-text-or-provenance'?p:notice(p),sha256:p==='licensing/coverage.json'?null:sha(p)}));
 const counts={};for(const row of rows)counts[row.license]=(counts[row.license]||0)+1;
 writeFileSync(resolve(root,'licensing/coverage.json'),JSON.stringify({status:'Locally implemented; public publication not authorized',defaultLicense:'MPL-2.0',secondaryLicenseIncompatibilityNoticeAttached:false,selfHash:'Own digest is in the external source publication audit, avoiding a recursive self-hash',counts,files:rows},null,2)+'\n');
 console.log(JSON.stringify({files:rows.length,counts}));
}else if(mode==='check'){
 assert.equal(sha('LICENSE'),'f35b870c59c69f29f127265bb7adb7417c6fe0d19a75c2dd8a50fd8447e66536','Standard MPL text changed');
 assert.equal(sha('DCO'),'7d79039e26a06fea799511cb337c1e736b20d53f640dd0b5798e4a1c741f1d0c','Standard DCO text changed');
 const coverage=JSON.parse(read('licensing/coverage.json'));assert.deepEqual(coverage.files.map(v=>v.path),paths);
 for(const row of coverage.files){
  assert.equal(row.license,licenseFor(row.path));assert.equal(row.notice,row.license==='retained-legal-text-or-provenance'?row.path:notice(row.path));
  if(row.sha256!==null)assert.equal(sha(row.path),row.sha256,'Coverage digest: '+row.path);else assert.equal(row.path,'licensing/coverage.json');
  if(row.license==='retained-legal-text-or-provenance')continue;
  if(inline(row.path))assert(read(row.path).startsWith('// SPDX-License-Identifier: '+row.license+'\n')||read(row.path).startsWith('#!')&&read(row.path).includes('// SPDX-License-Identifier: '+row.license+'\n'));
  else {assert(paths.includes(row.notice),'Notice must be in publication manifest');const text=read(row.notice);assert(text.includes('`'+basename(row.path)+'` | `'+row.license+'`'));assert(text.includes(exhibit));}
 }
 for(const a of JSON.parse(read('brand/talarurus-assets.json')).assets)assert.equal(sha(a.file),a.sha256,'Official export changed');
 for(const [project,license] of [['app','MPL-2.0 AND MIT'],['experiments/finance-proof','MPL-2.0']]){const pkg=JSON.parse(read(project+'/package.json')),lock=JSON.parse(read(project+'/package-lock.json'));assert.equal(pkg.license,license);assert.equal(lock.packages[''].license,license);assert.equal(pkg.private,true);}
 assert(read('experiments/tauri-desktop/src-tauri/Cargo.toml').includes('license = "MPL-2.0"'));
 for(const p of mit)assert(read(p).includes('SPDX-License-Identifier: MIT'));
 console.log(JSON.stringify({status:'PASS',coveredFiles:paths.length,counts:coverage.counts,standardMPL:true,standardDCO:true,officialArtworkUnchanged:true,packageMetadata:'file-specific cumulative licenses; no whole-application MIT option'}));
}else throw Error('Use check, notices or coverage');
