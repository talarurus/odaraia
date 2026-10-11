// SPDX-License-Identifier: MPL-2.0
import {MemoryRepository} from './memory.ts';
import {PortableDataService} from '../services/portability.ts';
import {ImportService} from '../services/importer.ts';
import {createApplicationService,routeFor} from '../services/application.ts';
import type {ApplicationService,Command} from '../services/application.ts';
import {check,object,keys,ConflictError} from '../domain/validation.ts';
import {BACKUP_FORMAT,BACKUP_VERSION,SCHEMA_VERSION,utf8Size} from '../domain/contracts.ts';

export interface StorageSnapshot {revision:number;data:{accounts:any[];transactions:any[];budgets:any[];imports:any[];sourceAliases:any[];audit:any[];previews:any[]}}
export interface NativePersistence {
 read():Promise<StorageSnapshot>;
 commit(expected:number,data:StorageSnapshot['data']):Promise<StorageSnapshot>;
 privateBackup?(backup:unknown):Promise<{file:string}>;
}
const reads=new Set(['state.read','reports.read','imports.inspect','backup.read','backup.validate','export.csv']);
export async function sha256(value:unknown):Promise<string>{const bytes=new TextEncoder().encode(JSON.stringify(value));return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');}
function envelope(data:any,hash:string){return {format:BACKUP_FORMAT,version:BACKUP_VERSION,schemaVersion:SCHEMA_VERSION,currency:'USD',createdAt:new Date().toISOString(),sha256:hash,data};}
function records(repo:MemoryRepository){return {...repo.state(),imports:repo.listImports(),sourceAliases:repo.listAliases(),audit:repo.auditEntries()};}
class NeedHash {value:unknown;key:string;constructor(value:unknown,key:string){this.value=value;this.key=key;}}
// No native transaction crosses an await. Each command computes in an isolated
// workspace; one native transaction checks the store revision and commits it all.
export function createAsyncNativeService(native:NativePersistence):ApplicationService {
 let queue:Promise<unknown>=Promise.resolve();
 async function execute(command:Command){
  keys(object(command),['name','id','input']);routeFor(command);
  check(command.name!=='backup.private'||native.privateBackup,'Private local backups are unavailable in this prototype. Use Download financial backup.');
  const snapshot=await native.read();
  keys(object(snapshot),['revision','data']);check(Number.isSafeInteger(snapshot.revision)&&snapshot.revision>=0,'Invalid native revision');
  const source=object(snapshot.data);keys(source,['accounts','transactions','budgets','imports','sourceAliases','audit','previews']);
  check(Array.isArray(source.previews)&&source.previews.length<=1000,'Invalid stored previews');
  const {previews,...data}=source;
  const initialHash=await sha256(data),hashes=new Map([[JSON.stringify(data),initialHash]]);
  // Existing synchronous import/backup contracts receive WebCrypto hashes from
  // an async memoization boundary. No custom digest or Node shim is introduced.
  const hash=(value:unknown)=>{const key=JSON.stringify(value);if(!hashes.has(key))throw new NeedHash(value,key);return hashes.get(key)!;};
  for(let attempt=0;attempt<8;attempt++){
   const repo=new MemoryRepository();
   try{
    const portability=new PortableDataService(repo,hash);
    portability.restore({backup:envelope(data,initialHash),confirmEmpty:true});
    for(const p of previews){keys(object(p),['id','file_key','account','payload','created_at']);repo.hydratePreview(p);}
    const service=createApplicationService(repo,{portability,importer:new ImportService(repo,hash)});
    if(command.name==='backup.private')return await native.privateBackup!(portability.backup());
    const result=await service.execute(command);
    if(!reads.has(command.name)){
     const next=records(repo),digest=await sha256(next);
     // Full existing portability validation before crossing the native boundary.
     new PortableDataService(repo,value=>JSON.stringify(value)===JSON.stringify(next)?digest:hash(value)).validate(envelope(next,digest));
     const payload={...next,previews:repo.storagePreviews()};
     check(utf8Size(JSON.stringify(payload))<=32*1024*1024,'Prototype storage limit exceeded; no changes saved');
     try{await native.commit(snapshot.revision,payload);}catch(error){if((error as any)?.code==='CONFLICT')throw new ConflictError('Local data changed in another window. Reload and try again; no changes were saved.');throw error;}
    }
    return result;
   }catch(error){if(error instanceof NeedHash){hashes.set(error.key,await sha256(error.value));continue;}throw error;}
   finally{repo.close();}
  }
  throw new Error('Hash preparation failed; no changes saved');
 }
 return {execute(command){const pending=queue.then(()=>execute(command));queue=pending.catch(()=>{});return pending;}};
}
