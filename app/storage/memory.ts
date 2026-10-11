// SPDX-License-Identifier: MPL-2.0
import {Ledger} from '../services/ledger.ts';
import type {Account,Transaction,Budget} from '../domain/types.ts';
import type {ImportRecord,SourceAlias,AuditRecord,PreviewRecord} from '../domain/storage.ts';
import {check} from '../domain/validation.ts';

// Ephemeral synthetic demo / contract adapter. Never a persistence fallback.
export class MemoryRepository extends Ledger {
 path=':memory:';
 private closed=false;
 private writing=false;
 private data={accounts:[] as Account[],rows:[] as Transaction[],budgets:[] as Budget[],imports:[] as ImportRecord[],aliases:[] as SourceAlias[],audit:[] as AuditRecord[],previews:[] as {id:string;payload:string;created_at:string}[]};
 private guard(){check(!this.closed,'Demo has ended');}
 private read<T>(value:T):T{this.guard();return structuredClone(value);}
 close(){this.data={accounts:[],rows:[],budgets:[],imports:[],aliases:[],audit:[],previews:[]};this.closed=true;}
 atomic<T>(fn:()=>T):T{this.guard();check(!this.writing,'Nested writes are unsupported');const before=structuredClone(this.data);this.writing=true;try{const result=fn();check(!(result instanceof Promise),'Storage transactions must be synchronous');return result;}catch(error){this.data=before;throw error;}finally{this.writing=false;}}
 snapshot<T>(fn:()=>T):T{this.guard();return fn();}
 accounts(){return this.read([...this.data.accounts].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0));}
 rows(){return this.read([...this.data.rows].sort((a,b)=>a.date===b.date?(a.id<b.id?-1:a.id>b.id?1:0):a.date>b.date?-1:1));}
 budgets(){return this.read([...this.data.budgets].sort((a,b)=>a.month===b.month?(a.category<b.category?-1:a.category>b.category?1:0):a.month<b.month?-1:1));}
 saveAccount(a:Account){this.guard();this.data.accounts=this.data.accounts.filter(v=>v.id!==a.id).concat(structuredClone(a));}
 saveRow(t:Transaction){this.guard();check(this.data.accounts.some(a=>a.id===t.account),'Foreign or missing account');check(!this.data.rows.some(r=>r.id!==t.id&&r.sourceKey===t.sourceKey),'Duplicate source identity');this.data.rows=this.data.rows.filter(v=>v.id!==t.id).concat(structuredClone(t));}
 saveBudget(b:Budget){this.guard();this.data.budgets=this.data.budgets.filter(v=>v.month!==b.month||v.category!==b.category).concat(structuredClone(b));}
 findImport(key:string){return this.read(this.data.imports.find(v=>v.file_key===key));}
 listImports(){return this.read([...this.data.imports].sort((a,b)=>a.file_key<b.file_key?-1:1));}
 saveImport(i:ImportRecord){this.guard();check(this.data.accounts.some(a=>a.id===i.account),'Import account missing');check(!this.findImport(i.file_key),'Duplicate import');this.data.imports.push(structuredClone(i));}
 getPreview(id:string):PreviewRecord|undefined{return this.read(this.data.previews.find(p=>p.id===id));}
 // Trusted async-adapter workspace hydration; not an application/IPC capability.
 storagePreviews(){return this.read(this.data.previews.map(p=>{const v=JSON.parse(p.payload);return {...p,file_key:v.fileKey,account:v.account};}));}
 hydratePreview(p:{id:string;file_key:string;account:string;payload:string;created_at:string}){this.guard();const v=JSON.parse(p.payload);check(v.id===p.id&&v.fileKey===p.file_key&&v.account===p.account&&this.data.accounts.some(a=>a.id===p.account)&&!this.data.previews.some(a=>a.id===p.id)&&Number.isFinite(Date.parse(p.created_at)),'Invalid stored import preview');this.data.previews.push({id:p.id,payload:p.payload,created_at:p.created_at});}
 savePreview(p:any){this.guard();check(this.data.accounts.some(a=>a.id===p.account),'Preview account missing');this.data.previews=this.data.previews.filter(v=>Date.parse(v.created_at)>Date.now()-86400000);check(!this.data.previews.some(v=>v.id===p.id),'Duplicate preview');this.data.previews.push({id:p.id,payload:JSON.stringify(p),created_at:new Date().toISOString()});}
 listAliases(){return this.read([...this.data.aliases].sort((a,b)=>a.source_key<b.source_key?-1:1));}
 saveAlias(a:SourceAlias){this.guard();check(this.data.rows.some(t=>t.id===a.transaction_id),'Alias transaction missing');check(!this.data.aliases.some(v=>v.source_key===a.source_key),'Duplicate source alias');this.data.aliases.push(structuredClone(a));}
 auditEntries(){return this.read(this.data.audit);}
 saveAudit(a:AuditRecord){this.guard();check(!this.data.audit.some(v=>v.id===a.id),'Duplicate audit ID');this.data.audit.push(structuredClone(a));}
 empty(){this.guard();return Object.values(this.data).every(v=>v.length===0);}
}
