// SPDX-License-Identifier: MPL-2.0
import {MemoryRepository} from '../storage/memory.ts';
import {createApplicationService} from './application.ts';
import {canonical} from '../domain/fixture.mjs';
import {account,transaction,integrity} from '../domain/validation.ts';

export function createDemoSession(){
 const repo=new MemoryRepository();
 repo.atomic(()=>{
  for(const a of canonical.accounts)repo.saveAccount(account({...a,revision:1}));
  const rows=canonical.transactions.map(t=>transaction({id:t.id,account:t.account,date:t.date,amount:t.amount,payee:t.payee,category:t.category,classification:t.classification,status:t.status,sourceId:t.sourceId,note:'Synthetic demonstration',transferId:t.transferId||null,sourceKey:'demo:'+t.id,revision:1,provenance:null}));
  integrity(repo.accounts(),rows);for(const t of rows)repo.saveRow(t);
  for(const b of canonical.budgets)repo.saveBudget(b);
 });
 // File capabilities deliberately absent. A demo cannot read, import into, or
 // write backups beside the real store, even through a direct service command.
 return {service:createApplicationService(repo),close:()=>repo.close()};
}
