// SPDX-License-Identifier: MPL-2.0
// Development/contract transport. Not shipped with the Tauri application.
import {spawn} from 'node:child_process';
import {mkdirSync,lstatSync,realpathSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
export const nativeBinary=process.env.ODARAIA_TEST_NATIVE_BINARY||resolve(import.meta.dirname,'../../artifacts/persistent-platform/sqlite-store');
export function processTransport(path,{binary=nativeBinary,env=process.env}={}){
 mkdirSync(dirname(path),{recursive:true,mode:0o700});
 if(lstatSync(dirname(path)).isSymbolicLink())throw new Error('Unsafe profile directory');
 path=resolve(realpathSync(dirname(path)),path.split(/[\\/]/).at(-1));
 function call(request){return new Promise((resolve,reject)=>{
  const child=spawn(binary,[path],{stdio:['pipe','pipe','pipe'],env});let out='',err='';
  child.on('error',reject);child.stdout.on('data',b=>{out+=b;if(out.length>40*1024*1024)child.kill();});child.stderr.on('data',b=>{err+=b;if(err.length>4096)child.kill();});
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(request));
  child.on('close',code=>{if(code!==0)return reject(new Error('Native storage process failed ('+code+')'));try{const value=JSON.parse(out);if(value.error)throw Object.assign(new Error(value.error),{code:value.code});resolve(value);}catch(e){reject(e);}});
 });}
 return {read:()=>call({op:'read'}),commit:(expected,data)=>call({op:'commit',expected,data})};
}
