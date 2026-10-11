// SPDX-License-Identifier: MPL-2.0
import {utf8Size} from '../domain/contracts.ts';
import {SCHEMA_VERSION,BACKUP_FORMAT as FORMAT,BACKUP_VERSION as VERSION} from '../domain/contracts.ts';
import {account,transaction,budget,integrity,object,keys,check,text,identifier,date,InputError} from '../domain/validation.ts';
import {transactionsCSV} from '../domain/export.mjs';
import type {Ledger} from '../services/ledger.ts';
function timestamp(value: unknown){text(value,'timestamp',40);check(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value as string)&&!Number.isNaN(Date.parse(value as string))&&new Date(value as string).toISOString()===value,'Invalid timestamp');}
function list(value: unknown,max=100000): any[]{check(Array.isArray(value)&&value.length<=max,'Invalid or oversized backup collection');return value;}
function unique(values: string[],label: string){check(new Set(values).size===values.length,`Duplicate ${label}`);}
function jsonText(value: unknown,label: string){const raw=text(value,label,2*1024*1024,true);try{JSON.parse(raw);}catch{throw new InputError('Malformed '+label);}return raw;}
function provenance(value: unknown){if(value===null)return;const p=object(value);keys(p,['kind','fileKey','fileName','row','normalized','columns','raw']);check(p.kind==='csv','Unsupported transaction provenance');text(p.fileKey,'file hash',64);check(/^[a-f0-9]{64}$/.test(p.fileKey),'Invalid file hash');text(p.fileName,'file name');check(Number.isInteger(p.row)&&p.row>=2&&p.row<=50001,'Invalid source row');const n=object(p.normalized);keys(n,['account','date','amount','payee','category','classification','status','note','sourceId']);transaction({...n,id:'source-evidence',transferId:null,sourceKey:'evidence',revision:1,provenance:null});for(const v of list(p.raw,101))text(v,'source cell',4096,true);for(const v of list(p.columns,101))text(v,'column',4096,true);check(p.columns.length===p.raw.length,'Invalid source columns');}
export class PortableDataService {
 repo: Ledger;
 hash:(value:unknown)=>string;
 constructor(repo: Ledger,hash:(value:unknown)=>string){this.repo=repo;this.hash=hash;}
 backup(){return this.repo.snapshot(()=>{const data={...this.repo.state(),imports:this.repo.listImports(),sourceAliases:this.repo.listAliases(),audit:this.repo.auditEntries()};const backup={format:FORMAT,version:VERSION,schemaVersion:SCHEMA_VERSION,currency:'USD',createdAt:new Date().toISOString(),sha256:this.hash(data),data};check(utf8Size(JSON.stringify(backup))<=16*1024*1024,'Backup exceeds this MVP’s 16 MiB limit');return backup;});}
 validate(input: unknown){
  const b=object(input);keys(b,['format','version','schemaVersion','currency','createdAt','sha256','data']);check(b.format===FORMAT&&b.version===VERSION&&b.schemaVersion===SCHEMA_VERSION&&b.currency==='USD','Unsupported backup format, currency or version');timestamp(b.createdAt);object(b.data);check(typeof b.sha256==='string'&&b.sha256===this.hash(b.data),'Backup checksum mismatch');check(utf8Size(JSON.stringify(b))<=16*1024*1024,'Backup exceeds 16 MiB');
  const d=object(b.data);keys(d,['accounts','transactions','budgets','imports','sourceAliases','audit']);const accounts=list(d.accounts,1000).map(account),rows=list(d.transactions).map(transaction),budgets=list(d.budgets,10000).map(budget);
  integrity(accounts,rows);unique(rows.map(t=>t.id),'transaction ID');unique(budgets.map(b=>b.month+':'+b.category),'budget');
  const accountIds=new Set(accounts.map(a=>a.id)),txIds=new Set(rows.map(t=>t.id)),sources=new Map(rows.map(t=>[t.sourceKey,t.id]));for(const t of rows)provenance(t.provenance);
  const imports=list(d.imports,10000);unique(imports.map(i=>i.file_key),'import');
  for(const row of imports){const i=object(row);keys(i,['file_key','account','name','time','result']);check(typeof i.file_key==='string'&&/^[a-f0-9]{64}$/.test(i.file_key),'Invalid import hash');check(accountIds.has(i.account),'Import account missing');text(i.name,'file name');timestamp(i.time);const result=JSON.parse(jsonText(i.result,'import result'));keys(object(result),['fileKey','name','added','matched','duplicates','skipped','invalid','total','transactionIds','replayed']);check(result.fileKey===i.file_key&&result.name===i.name&&result.replayed===false,'Invalid import result identity');for(const count of ['added','matched','duplicates','skipped','invalid','total'])check(Number.isSafeInteger(result[count])&&result[count]>=0&&result[count]<=50000,'Invalid import count');check(result.total===result.added+result.matched+result.duplicates+result.skipped+result.invalid,'Import counts disagree');check(list(result.transactionIds,50000).length===result.added+result.matched && result.transactionIds.every((id:string)=>txIds.has(id)),'Missing imported transaction');}
  const aliases=list(d.sourceAliases);unique(aliases.map(i=>i.source_key),'source alias');for(const item of aliases){const a=object(item);keys(a,['source_key','transaction_id','evidence']);text(a.source_key,'source alias',400);check(txIds.has(a.transaction_id),'Alias transaction missing');check(!sources.has(a.source_key)||sources.get(a.source_key)===a.transaction_id,'Conflicting source alias');provenance(JSON.parse(jsonText(a.evidence,'alias evidence')));}
  const audit=list(d.audit,200000);unique(audit.map(i=>i.id),'audit ID');for(const item of audit){const a=object(item);keys(a,['id','time','action','entity','before_json','after_json']);identifier(a.id);timestamp(a.time);text(a.action,'audit action',80);text(a.entity,'audit entity',400);if(a.before_json!==null)jsonText(a.before_json,'audit before');jsonText(a.after_json,'audit after');}
  // An undo must have a validated prior status; restoring arbitrary JSON may never
  // invent a posting for a formerly pending transaction.
  const voidEvents=new Map(audit.filter(a=>a.action==='transaction.void').map(a=>[a.entity,a]));
  for(const t of rows.filter(t=>t.status==='removed')){const event=voidEvents.get(t.id);check(event,'Voided transaction is missing undo history');const before=transaction(JSON.parse(event.before_json));check(before.id===t.id&&['pending','posted'].includes(before.status),'Invalid void history');const after=transaction(JSON.parse(event.after_json));check(before.revision+1===t.revision&&JSON.stringify(transaction({...before,status:'removed',revision:t.revision}))===JSON.stringify(t)&&JSON.stringify(after)===JSON.stringify(t),'Void history disagrees with the saved transaction');}
  return {version:VERSION,accounts:accounts.length,transactions:rows.length,budgets:budgets.length,data:{accounts,transactions:rows,budgets,imports,sourceAliases:aliases,audit}};
 }
 restore(input: unknown){const i=object(input);keys(i,['backup','confirmEmpty']);check(i.confirmEmpty===true,'Confirm restore into an empty database');const validated=this.validate(i.backup);return this.repo.atomic(()=>{
  check(this.repo.empty(),'Restore refused: existing local data. Start with a new empty database file.');
  const d=validated.data;for(const a of d.accounts)this.repo.saveAccount(a);for(const t of d.transactions)this.repo.saveRow(t);for(const b of d.budgets)this.repo.saveBudget(b);
  for(const i of d.imports)this.repo.saveImport(i);
  for(const a of d.sourceAliases)this.repo.saveAlias(a);
  for(const a of d.audit)this.repo.saveAudit(a);
  integrity(this.repo.accounts(),this.repo.rows());return {accounts:validated.accounts,transactions:validated.transactions,budgets:validated.budgets};
 });}
 exportCSV(){return {csv:transactionsCSV(this.repo.state(),{})};}
}
