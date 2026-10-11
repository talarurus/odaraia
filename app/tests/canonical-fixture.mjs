// SPDX-License-Identifier: MPL-2.0
import {canonical} from '../domain/fixture.mjs';
import {account,transaction,integrity} from '../domain/validation.ts';
export function loadCanonical(r){r.atomic(()=>{for(const a of canonical.accounts)r.saveAccount(account({...a,revision:1}));const rows=canonical.transactions.map(t=>transaction({id:t.id,account:t.account,date:t.date,amount:t.amount,payee:t.payee,category:t.category,classification:t.classification,status:t.status,note:'',transferId:t.transferId||null,sourceKey:'fixture:'+t.id,sourceId:t.sourceId,revision:1,provenance:null}));integrity(r.accounts(),rows);for(const t of rows)r.saveRow(t);});r.setBudget(canonical.budgets[0]);}
