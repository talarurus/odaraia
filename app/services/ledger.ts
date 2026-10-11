// SPDX-License-Identifier: MPL-2.0
// Platform-independent application rules. Financial arithmetic stays in domain/finance.mjs.
import {account,transaction,budget,integrity,object,keys,revision,amount,check,ConflictError} from '../domain/validation.ts';
import {report,budgetActual} from '../domain/finance.mjs';
import type {Account,Transaction,Budget} from '../domain/types.ts';
import type {ImportRecord,SourceAlias,AuditRecord,PreviewRecord} from '../domain/storage.ts';
export abstract class Ledger {
 abstract path: string;
 abstract close(): void;
 abstract atomic<T>(fn: ()=>T): T;
 abstract snapshot<T>(fn: ()=>T): T;
 abstract accounts(): Account[];
 abstract rows(): Transaction[];
 abstract budgets(): Budget[];
 abstract saveAccount(a: Account): void;
 abstract saveRow(t: Transaction): void;
 abstract saveBudget(b: Budget): void;
 abstract findImport(key: string): ImportRecord | undefined;
 abstract listImports(): ImportRecord[];
 abstract saveImport(i: ImportRecord): void;
 abstract getPreview(id: string): PreviewRecord | undefined;
 abstract savePreview(p: any): void;
 abstract listAliases(): SourceAlias[];
 abstract saveAlias(a: SourceAlias): void;
 abstract auditEntries(): AuditRecord[];
 abstract saveAudit(a: AuditRecord): void;
 abstract empty(): boolean;
 lastVoid(id: string){const event=this.auditEntries().findLast(a=>a.entity===id&&a.action==='transaction.void');check(event?.before_json,'Undo history missing; restore a verified backup');return event;}
 state(){return this.snapshot(()=>({accounts:this.accounts(),transactions:this.rows(),budgets:this.budgets() as any}));}
 report(filters={}){return this.snapshot(()=>report(this.accounts(),this.rows(),filters));}
 audit(action: string, entity: string, before: unknown, after: unknown){this.saveAudit({id:globalThis.crypto.randomUUID(),time:new Date().toISOString(),action,entity,before_json:before===null?null:JSON.stringify(before),after_json:JSON.stringify(after)});}
 createAccount(input: unknown){const i=object(input);keys(i,['name','type','anchor','opening']);const a=account({...i,id:globalThis.crypto.randomUUID(),currency:'USD',revision:1});return this.atomic(()=>{this.saveAccount(a);this.audit('account.create',a.id,null,a);return a;});}
 updateAccount(id: string,input: unknown){const i=object(input);keys(i,['name','type','anchor','opening','revision','confirmRebase']);return this.atomic(()=>{const old=this.accounts().find(a=>a.id===id);check(old,'Account not found');if(old.revision!==revision(i.revision))throw new ConflictError('Account changed; reload before saving');const {confirmRebase,revision:ignored,...changes}=i;const a=account({...old,...changes,revision:old.revision+1});if(a.anchor!==old.anchor || a.opening!==old.opening)check(confirmRebase===true,'Changing opening history requires explicit confirmation');integrity(this.accounts().map(x=>x.id===id?a:x),this.rows());this.saveAccount(a);this.audit('account.edit',id,old,a);return a;});}
 createTransaction(input: unknown){const i=object(input);keys(i,['account','date','amount','payee','category','classification','status','note']);check(!i.status||['posted','pending'].includes(i.status),'New transactions must be posted or pending');check(i.classification!=='transfer','Use the paired transfer action');const id=globalThis.crypto.randomUUID();const t=transaction({...i,id,category:i.category||'Unclassified',classification:i.classification||'unclassified',status:i.status||'posted',note:i.note||'',transferId:null,sourceKey:'manual:'+id,sourceId:null,revision:1,provenance:null});return this.atomic(()=>{integrity(this.accounts(),[...this.rows(),t]);this.saveRow(t);this.audit('transaction.create',id,null,t);return t;});}
 updateTransaction(id: string,input: unknown){const i=object(input);keys(i,['account','date','amount','payee','category','classification','status','note','revision']);return this.atomic(()=>{const rows=this.rows(),old=rows.find(t=>t.id===id);check(old,'Transaction not found');if(old.revision!==revision(i.revision))throw new ConflictError('Transaction changed; reload before saving');check(old.status!=='removed','Restore voided transactions before editing');check(!i.status||['posted','pending'].includes(i.status),'Use the void action to remove transactions');check(!old.transferId,'Edit transfers using the paired transfer action');check(i.classification!=='transfer','Use the paired transfer action');const t=transaction({...old,...i,revision:old.revision+1});integrity(this.accounts(),rows.map(r=>r.id===id?t:r));this.saveRow(t);this.audit('transaction.edit',id,old,t);return t;});}
 voidTransaction(id: string, expected: unknown, undo=false){return this.atomic(()=>{const rows=this.rows(),t=rows.find(x=>x.id===id);check(t,'Transaction not found');if(t.revision!==revision(expected))throw new ConflictError('Transaction changed; reload before saving');check(undo?t.status==='removed':t.status!=='removed',undo?'Transaction is not voided':'Already voided');const pair=t.transferId?rows.filter(r=>r.transferId===t.transferId):[t];const changes=pair.map(r=>({...r,status:undo?JSON.parse(this.lastVoid(r.id).before_json as string).status:'removed',revision:r.revision+1} as Transaction));integrity(this.accounts(),rows.map(r=>changes.find(x=>x.id===r.id)||r));for(const r of changes){this.saveRow(r);this.audit(undo?'transaction.undo-void':'transaction.void',r.id,pair.find(x=>x.id===r.id),r);}return changes;});}
 createTransfer(input: unknown){const i=object(input);keys(i,['from','to','date','amount','note']);const id=globalThis.crypto.randomUUID();check(i.from!==i.to,'Choose two different accounts');check(BigInt(amount(i.amount))>0n,'Transfer amount must be positive cents');const legs=[{account:i.from,amount:String(-BigInt(i.amount)),payee:'Transfer to '+i.to},{account:i.to,amount:i.amount,payee:'Transfer from '+i.from}].map(x=>{const tid=globalThis.crypto.randomUUID();return transaction({...x,id:tid,date:i.date,category:'Transfers',classification:'transfer',status:'posted',note:i.note||'',transferId:id,sourceKey:'manual:'+tid,sourceId:null,revision:1,provenance:null});});return this.atomic(()=>{integrity(this.accounts(),[...this.rows(),...legs]);for(const t of legs){this.saveRow(t);this.audit('transfer.create',t.id,null,t);}return legs;});}
 updateTransfer(id: string,input: unknown){const i=object(input);keys(i,['date','amount','note','revisions']);return this.atomic(()=>{const rows=this.rows(),pair=rows.filter(t=>t.transferId===id);check(pair.length===2 && pair.every(t=>t.status==='posted'),'Active transfer not found');check(BigInt(amount(i.amount))>0n,'Transfer amount must be positive cents');const revisions=object(i.revisions);for(const t of pair)if(revisions[t.id]!==t.revision)throw new ConflictError('Transfer changed; reload before saving');const changes=pair.map(t=>transaction({...t,date:i.date,amount:String(BigInt(t.amount)<0n?-BigInt(i.amount):BigInt(i.amount)),note:i.note||'',revision:t.revision+1}));integrity(this.accounts(),rows.map(r=>changes.find(t=>t.id===r.id)||r));for(const t of changes){this.saveRow(t);this.audit('transfer.edit',t.id,pair.find(x=>x.id===t.id),t);}return changes;});}
 linkTransfer(input: unknown){const i=object(input);keys(i,['first','second','revisions']);return this.atomic(()=>{const rows=this.rows(),pair=rows.filter(t=>[i.first,i.second].includes(t.id));check(pair.length===2 && pair.every(t=>t.status==='posted'&&!t.transferId),'Select two posted transactions');const revisions=object(i.revisions);for(const t of pair)if(t.revision!==revisions[t.id])throw new ConflictError('Transaction changed; reload before pairing');const id=globalThis.crypto.randomUUID(),changes=pair.map(t=>transaction({...t,classification:'transfer',category:'Transfers',transferId:id,revision:t.revision+1}));integrity(this.accounts(),rows.map(r=>changes.find(t=>t.id===r.id)||r));for(const t of changes){this.saveRow(t);this.audit('transfer.link',t.id,pair.find(x=>x.id===t.id),t);}return changes;});}
 setBudget(input: unknown){const b=budget(input);return this.atomic(()=>{this.saveBudget(b);this.audit('budget.set',b.month+':'+b.category,null,b);return b;});}
 budgetReport(month: string){return this.snapshot(()=>this.budgets().filter(b=>b.month===month).map(b=>({...b,...budgetActual(this.accounts(),this.rows(),month,b.category,b.planned)})));}
}
