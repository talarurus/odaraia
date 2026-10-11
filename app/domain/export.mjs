// SPDX-License-Identifier: MPL-2.0
import {selectRows} from './finance.mjs';
function csvText(value){const text=String(value??'');const safe=/^[\s\uFEFF]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text)?`'${text}`:text;return `"${safe.replaceAll('"','""')}"`;}
export function transactionsCSV(fixture,period){
 const header=['ID','Date','Account','Merchant','Category','Status','Classification','Currency','Note','Source ID','Amount (USD)'];
 const rows=selectRows(fixture.transactions,period).filter(x=>x.status!=='removed').map(t=>{const n=BigInt(t.amount),abs=n<0n?-n:n;const amount=`${n<0n?'-':''}${abs/100n}.${String(abs%100n).padStart(2,'0')}`;return [t.id,t.date,fixture.accounts.find(a=>a.id===t.account)?.name||t.account,t.payee,t.category,t.status,t.classification,'USD',t.note||'',t.sourceId||''].map(csvText).concat(amount).join(',');});
 return header.map(csvText).join(',')+'\r\n'+rows.join('\r\n')+'\r\n';
}
