// SPDX-License-Identifier: MPL-2.0
// The existing desktop host compilation path, shared by full and focused builds.
import {execFileSync} from 'node:child_process';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function compileHost({root,out,binary,experimentalGlass=false,cache=join(root,'artifacts/odaraia/swift-cache')}){
 const run=(command,args)=>execFileSync(command,args,{encoding:'utf8',stdio:'pipe'});
 const sources=join(out,'host-source');await mkdir(sources,{recursive:true});await mkdir(cache,{recursive:true});
 await copyFile(join(root,'desktop/plainbalance.swift'),join(sources,'main.swift'));
 const sdk=run('xcrun',['--show-sdk-path']).trim(),startupObject=join(out,'StartupBridge.o');
 run('xcrun',['clang','-fobjc-arc','-target','arm64-apple-macos14.0','-isysroot',sdk,'-c',join(root,'desktop/StartupBridge.m'),'-o',startupObject]);
 const header=join(sources,'HostBridge.h');await writeFile(header,'#import "'+join(root,'desktop/StartupBridge.h')+'"\n'+(experimentalGlass?'#import "'+join(root,'desktop/ExperimentalGlassBridge.h')+'"\n':''));
 const flags=['-import-objc-header',header,startupObject];
 if(experimentalGlass){
  const object=join(out,'ExperimentalGlassBridge.o');
  run('xcrun',['clang','-fobjc-arc','-target','arm64-apple-macos14.0','-isysroot',sdk,'-c',join(root,'desktop/ExperimentalGlassBridge.m'),'-o',object]);
  flags.push('-D','ODARAIA_EXPERIMENTAL_GLASS',object);
 }
 run('xcrun',['swiftc','-swift-version','5','-O','-target','arm64-apple-macos14.0','-module-cache-path',cache,...flags,join(root,'desktop/Compositing.swift'),join(root,'desktop/DesktopGlass.swift'),join(sources,'main.swift'),'-o',binary]);
}
