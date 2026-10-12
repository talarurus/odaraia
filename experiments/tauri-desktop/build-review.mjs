// SPDX-License-Identifier: MPL-2.0
// Internal macOS bundle from the actual locked Cargo host, without requiring
// cargo-tauri. Uses embedded frontend assets and an ad hoc review signature.
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,copyFileSync,writeFileSync,existsSync,renameSync,lstatSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {packageLicenses} from '../../tools/package-licenses.mjs';
const root=resolve(import.meta.dirname,'../..'),host=join(import.meta.dirname,'src-tauri');
if(process.platform!=='darwin')throw new Error('This review bundler is macOS-only');
const recovery=process.argv.includes('--recovery');
const config=JSON.parse(readFileSync(join(host,'tauri.conf.json'),'utf8'));
// Build-time isolation, never a renderer-selected or runtime-selected path.
// Fresh acceptance builds cannot open any existing prototype/recovery profile.
const fresh=process.argv.includes('--fresh-profile')?Date.now().toString(36):'';
const name=config.productName+(recovery?' Recovery':'')+(fresh?' Review '+fresh:'');
const identifier=config.identifier+(recovery?'-recovery':'')+(fresh?'.review-'+fresh:'');
const out=resolve(root,'app/artifacts/tauri-validation/mac');mkdirSync(out,{recursive:true});
const cache=resolve(root,'app/artifacts/tauri-validation/cargo-home');
const env={...process.env,MACOSX_DEPLOYMENT_TARGET:config.bundle.macOS.minimumSystemVersion,
 ...(existsSync(join(cache,'registry/cache'))?{CARGO_HOME:cache}:{}),
 TAURI_CONFIG:JSON.stringify({identifier,productName:name})};
// Cargo does not run Tauri CLI's beforeBuildCommand; build the real UI first.
await import('./build-web.mjs');
execFileSync('cargo',['build','--offline','--locked','--release','--bin','odaraia-sqlite-prototype'],{cwd:host,env,stdio:'inherit'});
const bundle=join(out,name+'.app'),stage=join(out,name+'.staging-'+process.pid+'.app');
if(existsSync(stage))throw new Error('Review staging path already exists');
mkdirSync(join(stage,'Contents/MacOS'),{recursive:true});mkdirSync(join(stage,'Contents/Resources'));
const executable='odaraia-sqlite-prototype';
const target=process.env.CARGO_TARGET_DIR?resolve(host,process.env.CARGO_TARGET_DIR):join(host,'target');
copyFileSync(join(target,'release',executable),join(stage,'Contents/MacOS',executable));
copyFileSync(join(host,'icons/plainbalance.icns'),join(stage,'Contents/Resources/plainbalance.icns'));
packageLicenses(join(stage,'Contents/Resources/Legal'));
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const values={CFBundleDevelopmentRegion:'en',CFBundleExecutable:executable,CFBundleIdentifier:identifier,
 CFBundleName:name,CFBundleDisplayName:name,CFBundlePackageType:'APPL',CFBundleInfoDictionaryVersion:'6.0',
 CFBundleShortVersionString:config.version,CFBundleVersion:config.version,CFBundleIconFile:'plainbalance.icns',
 LSMinimumSystemVersion:config.bundle.macOS.minimumSystemVersion,LSApplicationCategoryType:'public.app-category.finance',NSPrincipalClass:'NSApplication'};
writeFileSync(join(stage,'Contents/Info.plist'),'<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>'+Object.entries(values).map(([k,v])=>`<key>${k}</key><string>${escape(v)}</string>`).join('')+'<key>NSHighResolutionCapable</key><true/><key>NSSupportsAutomaticGraphicsSwitching</key><true/></dict></plist>\n');
execFileSync('/usr/bin/plutil',['-lint',join(stage,'Contents/Info.plist')],{stdio:'inherit'});
execFileSync('/usr/bin/codesign',['--force','--sign','-','--timestamp=none',stage],{stdio:'inherit'});
execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',stage],{stdio:'inherit'});
if(existsSync(bundle)){
 if(lstatSync(bundle).isSymbolicLink())throw new Error('Unsafe review destination');
 const previous=readFileSync(join(bundle,'Contents/Info.plist'),'utf8');
 if(!previous.includes('<string>'+identifier+'</string>'))throw new Error('Refusing to replace another application');
 renameSync(bundle,bundle+'.previous-'+Date.now());
}
renameSync(stage,bundle);
const binary=join(bundle,'Contents/MacOS',executable);
const metadata={status:'PASS',kind:'internal ad hoc macOS bundle; GUI acceptance separate',bundle,identifier,
 version:config.version,architecture:process.arch,declaredMinimum:env.MACOSX_DEPLOYMENT_TARGET,
 executableSHA256:createHash('sha256').update(readFileSync(binary)).digest('hex'),
 linkage:execFileSync('/usr/bin/otool',['-L',binary],{encoding:'utf8'}),
 deployment:execFileSync('/usr/bin/vtool',['-show-build',binary],{encoding:'utf8'}),
 size:execFileSync('/usr/bin/du',['-sk',bundle],{encoding:'utf8'}).trim(),
 lockSHA256:createHash('sha256').update(readFileSync(join(host,'Cargo.lock'))).digest('hex')};
writeFileSync(join(out,recovery?'recovery-package.json':'package.json'),JSON.stringify(metadata,null,2));
console.log(bundle);
