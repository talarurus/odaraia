// SPDX-License-Identifier: MPL-2.0
import {execFileSync} from 'node:child_process';
import {existsSync,realpathSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const run=(command,args)=>execFileSync(command,args,{encoding:'utf8'});
export function dependencies(path){return run('/usr/bin/otool',['-L',path]).split('\n').slice(1).map(line=>line.trim().split(' (')[0]).filter(Boolean);}
export function rpaths(path){const lines=run('/usr/bin/otool',['-l',path]).split('\n'),paths=[];for(let i=0;i<lines.length;i++)if(lines[i].trim()==='cmd LC_RPATH'){const match=lines[i+2]?.trim().match(/^path (.+) \(offset/);if(match)paths.push(match[1]);}return paths;}
export function minimum(path){const commands=run('/usr/bin/otool',['-l',path]);const value=commands.match(/\bminos (\d+(?:\.\d+)+)/)?.[1]||commands.match(/cmd LC_VERSION_MIN_MACOSX\s+cmdsize \d+\s+version (\d+(?:\.\d+)+)/)?.[1];if(!value)throw new Error('Cannot determine macOS minimum for '+path);return value;}
export function later(a,b){const left=a.split('.').map(Number),right=b.split('.').map(Number);for(let i=0;i<3;i++)if((left[i]||0)!==(right[i]||0))return (left[i]||0)>(right[i]||0);return false;}
export function locate(dependency,parent){
 if(dependency.startsWith('/'))return dependency;
 if(dependency.startsWith('@loader_path/'))return resolve(dirname(parent),dependency.slice(13));
 if(dependency.startsWith('@executable_path/'))return resolve(dirname(parent),dependency.slice(17));
 if(dependency.startsWith('@rpath/'))for(const path of rpaths(parent)){const full=resolve(path.replace('@loader_path',dirname(parent)),dependency.slice(7));if(existsSync(full))return full;}
 throw new Error('Unresolved runtime dependency: '+dependency+' in '+parent);
}
export function auditRuntime(node){
 const seen=new Set(),files=[];let minimumMacOS='14.0';
 function visit(path){path=realpathSync(path);if(seen.has(path))return;seen.add(path);const min=minimum(path),deps=dependencies(path);if(later(min,minimumMacOS))minimumMacOS=min;files.push({path,minimumMacOS:min,dependencies:deps});
  for(const dep of deps)if(!dep.startsWith('/usr/lib/')&&!dep.startsWith('/System/Library/'))visit(locate(dep,path));
 }
 visit(node);return {minimumMacOS,files};
}
