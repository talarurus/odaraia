// SPDX-License-Identifier: MPL-2.0
// Local macOS bundle builder. No network, developer credentials, or database migration.
import {execFileSync} from 'node:child_process';
import {mkdir,copyFile,cp,writeFile,chmod,rm,readFile} from 'node:fs/promises';
import {readFileSync,existsSync,realpathSync} from 'node:fs';
import {resolve,dirname,basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildApp} from '../scripts/build.mjs';
import {compileHost} from './compile-host.mjs';
import {productIdentity} from '../product-identity.mjs';
import {dependencies,rpaths,locate,auditRuntime,minimum} from './runtime-audit.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),workspace=resolve(root,'..');
const experimentalGlass=process.argv.includes('--experimental-glass');
const out=resolve(root,'artifacts/odaraia',experimentalGlass?'monocode/native':'native'),app=join(out,productIdentity.name+'.app'),contents=join(app,'Contents'),resources=join(contents,'Resources'),runtime=join(resources,'runtime');
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:'pipe',encoding:'utf8'});
if(process.platform!=='darwin'||process.arch!=='arm64')throw new Error('This local build requires Apple Silicon macOS. Build each architecture with its matching Node runtime.');
if(!/^v24\.21\./.test(process.version))throw new Error('Use the validated Node 24.21.x runtime.');
const bundleIdentifier=process.env.ODARAIA_BUNDLE_ID||(productIdentity.bundleIdentifier+(experimentalGlass?'.glass-review':''));
const diagnostic=process.argv.includes('--diagnostic-homebrew');
const nodeSource=process.env.ODARAIA_NODE_RUNTIME||(diagnostic ? process.execPath:join(root,'artifacts/odaraia/runtime/node-v24.21.0-darwin-arm64/bin/node'));
if(!existsSync(nodeSource))throw new Error('Compatible Node runtime is unavailable. Run node desktop/prepare-runtime.mjs in normal Terminal first. No implicit Homebrew runtime fallback.');
if(!run('/usr/bin/file',[nodeSource]).includes('arm64'))throw new Error('The packaged Node runtime must support arm64');
if(!/^v24\.21\./.test(run(nodeSource,['--version']).trim()))throw new Error('The packaged runtime must be Node 24.21.x');
if(!/^[a-zA-Z][\w-]*(\.[\w-]+)+$/.test(bundleIdentifier))throw new Error('Invalid bundle identifier');
const sourceAudit=auditRuntime(nodeSource);
if(!diagnostic&&sourceAudit.minimumMacOS!=='14.0')throw new Error('Runtime requires macOS '+sourceAudit.minimumMacOS+'; expected deployment floor 14.0. Use an official compatible Node 24.21.x distribution.');
if(process.argv.includes('--dmg'))throw new Error('Build the app, pass native acceptance, then run desktop/package-dmg.mjs. DMG creation no longer rebuilds an unverified app.');
const frontendBuild=await buildApp();await mkdir(out,{recursive:true});
// Remove generated bundles only, never application-support or development data.
await rm(app,{recursive:true,force:true});await mkdir(join(contents,'MacOS'),{recursive:true});await mkdir(runtime,{recursive:true});
const backend=join(resources,'backend');await mkdir(backend,{recursive:true});
for(const directory of ['server','db','domain','services','storage','dist'])await cp(join(root,directory),join(backend,directory),{recursive:true});
// Portability imports the pure CSV exporter; include its financial helper module.
await mkdir(join(backend,'web'),{recursive:true});await copyFile(join(root,'web/ui-model.mjs'),join(backend,'web/ui-model.mjs'));
await mkdir(join(backend,'desktop'),{recursive:true});for(const file of ['backend.mjs','storage.mjs'])await copyFile(join(root,'desktop',file),join(backend,'desktop',file));
await copyFile(join(root,'product-identity.mjs'),join(backend,'product-identity.mjs'));await writeFile(join(backend,'package.json'),JSON.stringify({type:'module',private:true}));
await writeFile(join(resources,'product.json'),JSON.stringify({...productIdentity,bundleIdentifier,dataIdentifier:productIdentity.dataIdentifier+(experimentalGlass?'-glass-review':'')},null,2));
const cache=join(root,'artifacts/odaraia/swift-cache');await mkdir(cache,{recursive:true});
run('xcrun',['swiftc','-swift-version','5','-module-cache-path',cache,join(workspace,'brand/plainbalance/render.swift'),'-o',join(out,'render-icons')]);run(join(out,'render-icons'),[join(workspace,'brand/plainbalance')]);
await copyFile(join(workspace,'brand/plainbalance',productIdentity.markDirectory||('candidates/'+productIdentity.workingMark),'icon-128.png'),join(resources,'product-icon.png'));
const iconset=join(out,'plainbalance.iconset');await mkdir(iconset,{recursive:true});for(const size of [16,32,128,256,512])for(const density of [1,2]){await copyFile(join(workspace,'brand/plainbalance',productIdentity.markDirectory||('candidates/'+productIdentity.workingMark),`icon-${size*density}.png`),join(iconset,`icon_${size}x${size}${density===2?'@2x':''}.png`));}
// Write the documented PNG-backed ICNS chunks directly. iconutil rejected a
// complete, dimension-verified iconset on this managed Mac; PNGs remain reviewable.
const iconChunks=[];for(const [type,size] of [['icp4',16],['icp5',32],['icp6',64],['ic07',128],['ic08',256],['ic09',512],['ic10',1024]]){
 const png=await readFile(join(workspace,'brand/plainbalance',productIdentity.markDirectory||('candidates/'+productIdentity.workingMark),`icon-${size}.png`)),header=Buffer.alloc(8);header.write(type);header.writeUInt32BE(png.length+8,4);iconChunks.push(header,png);
}
const iconHeader=Buffer.alloc(8);iconHeader.write('icns');iconHeader.writeUInt32BE(8+iconChunks.reduce((sum,chunk)=>sum+chunk.length,0),4);await writeFile(join(resources,'plainbalance.icns'),Buffer.concat([iconHeader,...iconChunks]));
// Relocate the exact available Node runtime and its entire non-system dependency graph.
// A Homebrew-linked executable alone is NOT standalone.
const copies=new Map(),names=new Map();
const runtimeManifest=[];
async function copyRuntime(source,name){
 source=realpathSync(source);if(copies.has(source))return copies.get(source);
 const target=join(runtime,name||basename(source));if(names.has(target)&&names.get(target)!==source)throw new Error('Runtime dependency name collision');names.set(target,source);copies.set(source,target);
 await copyFile(source,target);await chmod(target,0o755);
 const sourceHash=createHash('sha256').update(readFileSync(source)).digest('hex');
 const deps=dependencies(source);for(const dependency of deps){if(dependency.startsWith('/usr/lib/')||dependency.startsWith('/System/Library/'))continue;
  const original=locate(dependency,source);if(realpathSync(original)===source)continue;
  const relocated=await copyRuntime(original);run('/usr/bin/install_name_tool',['-change',dependency,'@loader_path/'+basename(relocated),target]);
 }
 if(name!=='node')run('/usr/bin/install_name_tool',['-id','@loader_path/'+basename(target),target]);
 for(const path of rpaths(target))if(path.includes('/opt/homebrew'))run('/usr/bin/install_name_tool',['-delete_rpath',path,target]);
 run('/usr/bin/codesign',['--force','--sign','-',target]);
 runtimeManifest.push({source,file:'runtime/'+basename(target),originalSha256:sourceHash,bundledSha256:createHash('sha256').update(readFileSync(target)).digest('hex')});return target;
}
await copyRuntime(nodeSource,'node');
for(const target of copies.values())for(const dep of dependencies(target)){if(!dep.startsWith('/usr/lib/')&&!dep.startsWith('/System/Library/')&&!dep.startsWith('@loader_path/'))throw new Error('External runtime dependency remains: '+dep);if(dep.startsWith('@loader_path/')&&!existsSync(resolve(dirname(target),dep.slice(13))))throw new Error('Missing relocated library: '+dep);}
const xmlEscape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const minimumMacOS=sourceAudit.minimumMacOS,runtimeMinimums=[...copies.values()].map(target=>({file:basename(target),minimumMacOS:minimum(target)}));
await writeFile(join(contents,'Info.plist'),`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleName</key><string>${xmlEscape(productIdentity.name)}</string><key>CFBundleDisplayName</key><string>${xmlEscape(productIdentity.name)}</string><key>CFBundleExecutable</key><string>plainbalance</string><key>CFBundleIdentifier</key><string>${xmlEscape(bundleIdentifier)}</string><key>CFBundleShortVersionString</key><string>${xmlEscape(productIdentity.version)}</string><key>CFBundleVersion</key><string>2</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleSupportedPlatforms</key><array><string>MacOSX</string></array><key>CFBundleIconFile</key><string>plainbalance.icns</string><key>LSMinimumSystemVersion</key><string>${minimumMacOS}</string><key>NSHighResolutionCapable</key><true/><key>NSHumanReadableCopyright</key><string>plainbalance by Talarurus</string><key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict></dict></plist>`);
await compileHost({root,out,binary:join(contents,'MacOS/plainbalance'),experimentalGlass,cache});
// Required local ad-hoc signature; NOT a Developer ID release signature/notarization.
run('/usr/bin/codesign',['--force','--sign','-',app]);run('/usr/bin/codesign',['--verify','--deep','--strict',app]);
const probe=run(join(runtime,'node'),['--input-type=module','-e',"import {DatabaseSync} from 'node:sqlite';const d=new DatabaseSync(':memory:');d.exec('CREATE TABLE probe (x INTEGER); INSERT INTO probe VALUES (42)');console.log(JSON.stringify({node:process.version,sqlite:d.prepare('SELECT x FROM probe').get().x}));d.close();"]);
await writeFile(join(out,'build-result.json'),JSON.stringify({status:'BUILT_NOT_GUI_VERIFIED',experimentalGlass,privateAPI:experimentalGlass?'COMPILED_LOCAL_REVIEW_ONLY, requires --experimental-desktop-glass':'EXCLUDED',runtimeStrategy:diagnostic?'EXPLICIT_HOMEbrew_DIAGNOSTIC':'COMPATIBLE_RUNTIME',app,architecture:'arm64',hostDeploymentTarget:'14.0',minimumMacOS,runtimeMinimums,bundleIdentifier,runtimeProbe:JSON.parse(probe.trim()),runtimeManifest,signature:'Local ad-hoc only; no Developer ID or notarization'},null,2));
// Runtime licence includes bundled dependency notices; retain individual installed notices too.
const notices=join(resources,'ThirdPartyNotices');await mkdir(notices,{recursive:true});for(const source of [resolve(dirname(realpathSync(nodeSource)),'../share/doc/node/LICENSE'),resolve(dirname(realpathSync(nodeSource)),'../LICENSE')])if(existsSync(source))await copyFile(source,join(notices,'NODE-LICENSE.txt'));
const {packageLicenses}=await import('../../tools/package-licenses.mjs');packageLicenses(join(resources,'Legal'));
await cp(join(root,'desktop/third-party/monocode'),join(notices,'monocode'),{recursive:true});
for(const entry of runtimeManifest){const cellar=entry.source.match(/^(\/opt\/homebrew\/Cellar\/[^/]+\/[^/]+)\//)?.[1];if(!cellar)continue;for(const name of ['LICENSE','LICENSE.txt','COPYING','LICENSE-MIT','LICENSE-APACHE','LICENSE.md'])if(existsSync(join(cellar,name)))await copyFile(join(cellar,name),join(notices,basename(dirname(cellar))+'-'+name));}
const packages=new Set(Object.keys(frontendBuild.inputs).filter(path=>path.includes('node_modules/')).map(path=>{
 const tail=path.split('node_modules/')[1].split('/');return tail[0].startsWith('@')?tail.slice(0,2).join('/'):tail[0];
}));
const npmNotices=[];for(const name of packages){const directory=join(root,'node_modules',name),metadata=JSON.parse(await readFile(join(directory,'package.json'),'utf8'));npmNotices.push({name:metadata.name,version:metadata.version,license:metadata.license});for(const file of ['LICENSE','LICENSE.txt','LICENSE.md','LICENCE','COPYING','NOTICE'])if(existsSync(join(directory,file)))await copyFile(join(directory,file),join(notices,name.replaceAll('/','-')+'-'+file));}
await writeFile(join(notices,'frontend-packages.json'),JSON.stringify(npmNotices,null,2));
// Notices change resources: sign and verify final bundle once more.
run('/usr/bin/codesign',['--force','--sign','-',app]);run('/usr/bin/codesign',['--verify','--deep','--strict',app]);
console.log('Built local review app: '+app+'\nBundled Node/SQLite probe: '+probe.trim());
