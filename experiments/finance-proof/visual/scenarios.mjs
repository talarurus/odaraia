// SPDX-License-Identifier: MPL-2.0
import {samples,canonical} from '../shared/fixture.mjs';
const account={...canonical.accounts[0]};
const salary=canonical.transactions[0],expense=canonical.transactions[1];
const demo=(id,name,accounts,transactions)=>({id,name,accounts,transactions,budgets:[]});
export const demos={...samples,
 'no-accounts':demo('no-accounts','No accounts',[],[]),
 'one-account':demo('one-account','One account',[account],canonical.transactions.filter(t=>t.account==='checking'&&t.classification!=='transfer')),
 'no-transactions':demo('no-transactions','No transactions',canonical.accounts,[]),
 'one-transaction':demo('one-transaction','One transaction',[account],[expense]),
 'no-spending':demo('no-spending','No spending',[account],[salary]),
 'no-income':demo('no-income','No income',[account],[expense]),
 'all-pending':demo('all-pending','All transactions pending',[account],[{...expense,status:'pending'}]),
 'missing-history':demo('missing-history','Missing balance history',[{...account,anchor:'2026-10-31'}],[]),
 'negative-flow':demo('negative-flow','Negative cash flow',[account],[{...salary,amount:'100000'},expense]),
 'net-credit':demo('net-credit','Refund exceeds category spending',[account],[salary,{...expense,amount:'20000'}]),
 'income-reversal':demo('income-reversal','Negative income adjustment',[account],[salary,{...expense,category:'Adjustment',classification:'income',amount:'-10000'}]),
 'needs-review':demo('needs-review','Unclassified transaction',[account],[{...expense,category:'Unclassified',classification:'unclassified'}]),
};
