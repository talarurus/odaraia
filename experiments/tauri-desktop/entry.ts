// SPDX-License-Identifier: MPL-2.0
import {configureApplicationService} from '../../app/web/api.ts';
import {createAsyncNativeService} from '../../app/storage/async-native.ts';
// Tauri injects this API only into the bundled local window. No localhost API,
// Node sidecar, SQL plugin or filesystem plugin is used.
const invoke=(command:string,args?:unknown)=>{
 const tauri=(window as any).__TAURI__;
 if(!tauri?.core?.invoke)throw new Error('Launch the native Tauri prototype. This is not a browser-local edition.');
 return tauri.core.invoke(command,args).then((r:any)=>{
  if(r?.error){const messages:Record<string,string>={BUSY:'Saved data is busy in another window. Wait briefly and try again.',CORRUPT_STORE:'Saved data could not be opened. Keep the file and restore a verified backup into a new empty profile.',MIGRATION_FAILED:'The database upgrade failed. Keep the existing file and use a verified backup to recover.',UNSUPPORTED_SCHEMA:'This database needs a compatible version of plainbalance.',CONFLICT:'Saved data changed in another window. Reload and try again.'};throw Object.assign(new Error(messages[r.code]||'The change could not be saved. Reload saved data and try again.'),{code:r.code});}
  return r;
 }).catch((error:unknown)=>{throw error instanceof Error?error:new Error(typeof error==='string'?error:'The native operation could not be completed.');});
};
configureApplicationService(createAsyncNativeService({
 read:()=>invoke('store_read'),
 commit:(expected,data)=>invoke('store_commit',{expected,data})
}),{privateBackup:false,exportFile:async file=>{await invoke('export_file',{file});}});
// Presentation flag only: Swift's native navigation/material flag is intentionally separate.
(window as any).__ODARAIA_EXPERIMENTAL__=true;
import('../../app/web/app.tsx');
