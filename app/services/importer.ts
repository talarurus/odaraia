// SPDX-License-Identifier: MPL-2.0
import {parseCSV,cells} from '../domain/csv.ts';
import {check,object,keys,transaction,integrity,fileName,ConflictError} from '../domain/validation.ts';
import type {Ledger} from '../services/ledger.ts';
export class ImportService {
 repo: Ledger;
 hash:(value:unknown)=>string;
 constructor(repo: Ledger,hash:(value:unknown)=>string){this.repo=repo;this.hash=hash;}
 inspect(input: unknown){const i=object(input);keys(i,['text','delimiter']);const grid=cells(i.text,i.delimiter||',');check(grid.length,'Empty CSV');return {headers:grid[0],sample:grid.slice(1,6),count:grid.length-1};}
 preview(input: unknown){const i=object(input);keys(i,['text','name','options']);const name=fileName(i.name),o=object(i.options);const parsed=parseCSV(i.text,o),account=this.repo.accounts().find(a=>a.id===o.account);check(account,'Destination account not found');
  const fileKey=this.hash([account.id,parsed.grid]);
  const previous=this.repo.findImport(fileKey);if(previous)return {replayed:true,summary:JSON.parse(previous.result as string)};
  const existing=this.repo.rows(),aliases=new Map(this.repo.listAliases().map(a=>[a.source_key,a.transaction_id])),seen=new Map(),rows: any[]=[],errors=[...parsed.errors];
  for(const inputRow of parsed.rows){try {
   const r=inputRow.record;check(r.date>account.anchor,'Transaction is on/before opening balance date. Review the opening anchor first.');
   const sourceKey=r.sourceId?`csv:${account.id}:id:${r.sourceId}`:`csv:${account.id}:file:${fileKey}:row:${inputRow.row}`;
   const same=existing.find(t=>t.sourceKey===sourceKey)||existing.find(t=>aliases.get(sourceKey)===t.id);
   const repeat=seen.has(sourceKey);if(repeat)check(['date','amount','payee','status'].every(k=>seen.get(sourceKey)[k]===r[k]),'Repeated transaction ID has conflicting financial details');else seen.set(sourceKey,r);
   const matches=existing.filter(t=>t.account===r.account&&t.status!=='removed'&&((t.amount===r.amount&&t.payee===r.payee&&(t.date===r.date||t.status==='pending'&&Math.abs(Date.parse(t.date)-Date.parse(r.date))<=7*86400000))||(t.provenance as any)?.normalized?.date===r.date&&(t.provenance as any)?.normalized?.amount===r.amount&&(t.provenance as any)?.normalized?.payee===r.payee));
   const pending=same?.status==='pending'&&r.status==='posted';
   const t=transaction({...r,id:globalThis.crypto.randomUUID(),transferId:null,sourceKey,revision:1,provenance:{kind:'csv',fileKey,fileName:name,row:inputRow.row,normalized:r,columns:parsed.headers,raw:inputRow.raw}});
   rows.push({row:inputRow.row,transaction:t,duplicate:repeat||Boolean(same&&!pending),existingId:same?.id||null,candidates:(same?[same]:matches).map(t=>({id:t.id,date:t.date,amount:t.amount,payee:t.payee,status:t.status,classification:t.classification,revision:t.revision})),sourceChanged:Boolean(same&&!pending&&['date','amount','payee','status'].some(k=>((same.provenance as any)?.normalized||same)[k]!==r[k])),requiresReview:!repeat&&(pending||!same&&matches.length>0)});
  }catch(e){errors.push({row:inputRow.row,message:(e as Error).message});}}
  const id=globalThis.crypto.randomUUID(),payload={id,fileKey,name,account:account.id,rows,errors,rowCount:parsed.rowCount,options:o};
  // Previews contain untrusted inert text; they expire and never alter the ledger.
  this.repo.savePreview(payload);
  return payload;
 }
 commit(input: unknown){const i=object(input);keys(i,['id','decisions']);check(typeof i.id==='string','Preview ID required');check(Array.isArray(i.decisions),'Import decisions required');return this.repo.atomic(()=>{
  const stored=this.repo.getPreview(i.id);check(stored,'Preview expired or missing; preview again');check(Date.parse(stored.created_at as string)>Date.now()-86400000,'Preview expired; preview again');const p=JSON.parse(stored.payload as string);
  const prior=this.repo.findImport(p.fileKey);if(prior)return {...JSON.parse(prior.result as string),replayed:true};
  const decisionMap=new Map();for(const item of i.decisions){const d=object(item);keys(d,['row','action','targetId','revision']);check(Number.isInteger(d.row)&&p.rows.some((r: any)=>r.row===d.row)&&!decisionMap.has(d.row),'Invalid or repeated import decision');check(['add','skip','match'].includes(d.action),'Invalid import action');decisionMap.set(d.row,d);}
  let added=0,matched=0,duplicates=0,skipped=0;const txIds: string[]=[],current=this.repo.rows(),bySource=new Map(current.map(t=>[t.sourceKey,t])),byId=new Map(current.map(t=>[t.id,t]));const aliases=new Map(this.repo.listAliases().map(a=>[a.source_key,a.transaction_id]));
  for(const row of p.rows){const t=row.transaction,decision:any=decisionMap.get(row.row);const known=bySource.get(t.sourceKey)||byId.get(aliases.get(t.sourceKey) as string);
   if(row.duplicate || known && !(known.status==='pending'&&t.status==='posted')){duplicates++;continue;}
   if(row.requiresReview || known)check(decision,'Choose add, skip or reconcile for every potential duplicate');
   if(decision?.action==='skip'){skipped++;continue;}
   if(decision?.action==='match'){
    const old=byId.get(decision.targetId);check(old && old.account===t.account && old.status!=='removed' && !old.transferId,'Reconciliation target must be an active non-transfer in this account');check(row.candidates.some((c: any)=>c.id===old.id),'Choose a candidate shown in the preview');if(old.revision!==decision.revision)throw new ConflictError('Reconciliation target changed; preview again');
    let after=old;
    if(old.status==='pending'&&t.status==='posted'){after=transaction({...old,date:t.date,amount:t.amount,status:'posted',revision:old.revision+1});this.repo.saveRow(after);byId.set(after.id,after);bySource.set(after.sourceKey,after);this.repo.audit('import.pending-posted',old.id,old,after);}
    else check((old.date===t.date && old.amount===t.amount)||((old.provenance as any)?.normalized?.date===t.date && (old.provenance as any)?.normalized?.amount===t.amount && (old.provenance as any)?.normalized?.payee===t.payee),'Posted reconciliation must have matching date and amount');
    if(old.sourceKey!==t.sourceKey)this.repo.saveAlias({source_key:t.sourceKey,transaction_id:old.id,evidence:JSON.stringify(t.provenance)});this.repo.audit('import.reconcile',old.id,old,{transaction:after,evidence:t.provenance});aliases.set(t.sourceKey,old.id);matched++;txIds.push(old.id);
   }else {
    check(!known,'Known pending transaction must be reconciled or skipped');this.repo.saveRow(t);byId.set(t.id,t);bySource.set(t.sourceKey,t);this.repo.audit('import.add',t.id,null,t);added++;txIds.push(t.id);
   }
  }
  integrity(this.repo.accounts(),this.repo.rows());
  const result={fileKey:p.fileKey,name:p.name,added,matched,duplicates,skipped,invalid:p.errors.length,total:p.rowCount,transactionIds:txIds,replayed:false};
  this.repo.saveImport({file_key:p.fileKey,account:p.account,name:p.name,time:new Date().toISOString(),result:JSON.stringify(result)});return result;
 });}
}
