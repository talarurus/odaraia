// SPDX-License-Identifier: MPL-2.0
// Historical report adapter. Ledger arithmetic and end-exclusive anchor rules
// remain in the existing helpers; a requested period is not an observation.
import {assertDate,balanceSummary} from '../domain/finance.mjs';
import {netWorthHistory,nextDate} from './ui-model.mjs';

export function observedNetWorthHistory(fixture,filters,asOf=new Date().toLocaleDateString('en-CA')){
 assertDate(asOf);assertDate(filters.start);assertDate(filters.end);
 if(filters.start>=filters.end)throw new Error('Choose a nonempty historical period');
 const selected=filters.account?{...fixture,accounts:fixture.accounts.filter(a=>a.id===filters.account),transactions:fixture.transactions.filter(t=>t.account===filters.account)}:fixture;
 const end=filters.end<nextDate(asOf)?filters.end:nextDate(asOf);
 const future=filters.start>=end;
 const history=future?{days:[],beginning:null,change:null,largest:[],reason:'This period has not started'}:netWorthHistory(selected,{...filters,end});
 const summary=future?{netWorth:null,assets:null,liabilities:null,balances:{}}:balanceSummary(selected.accounts,selected.transactions,{end});
 const known=history.days.filter(d=>d.minor!==null);
 const through=history.days.at(-1)?.date??null;
 return {...history,summary,accounts:selected.accounts,today:asOf,start:filters.start,end,asOf:through,count:history.days.length,
  requestedEnd:filters.end,futureExcluded:filters.end>nextDate(asOf),observations:history.days,
  firstKnown:known[0]?.date??null,partial:history.days.some(d=>d.minor===null),
  flat:known.length>1&&known.every(d=>d.minor===known[0].minor),knownCount:known.length};
}
