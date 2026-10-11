// SPDX-License-Identifier: MPL-2.0
// One exact report policy consumed by both candidate adapters and the visual proof.
export function assertDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw new Error('Invalid date');
 return value;
}
export function minor(value){
 if(typeof value!=='string'||!/^[-+]?\d+$/.test(value))throw new Error('Money must be an integer decimal string');
 const n=BigInt(value);if(n<-(2n**63n)||n>2n**63n-1n)throw new Error('Money outside signed 64-bit range');return n;
}
export function parseDollars(value){
 if(typeof value!=='string'||!/^[-+]?\d+(\.\d{1,2})?$/.test(value))throw new Error('Invalid USD amount; fractional cents rejected');
 const negative=value[0]==='-';const [whole,frac='']=value.replace(/^[-+]/,'').split('.');return minor(((BigInt(whole)*100n+BigInt(frac.padEnd(2,'0')))*(negative?-1n:1n)).toString()).toString();
}
export function money(value,{signed=false,whole=false}={}){
 const n=BigInt(value),negative=n<0n,abs=negative?-n:n;
 return `${negative?'−':signed&&n>0n?'+':''}$${new Intl.NumberFormat('en-US').format(abs/100n)}${whole?'':'.'+String(abs%100n).padStart(2,'0')}`;
}
export function checkedChartNumber(value){const n=BigInt(value);if(n>BigInt(Number.MAX_SAFE_INTEGER)||n<BigInt(Number.MIN_SAFE_INTEGER))throw new Error('Chart number outside safe range');return Number(n);}
const sum=(rows)=>rows.reduce((s,r)=>s+minor(r.amount),0n);
export function selectRows(rows,{start='0001-01-01',end='9999-12-31',account='',category='',status=''}={}){
 return rows.filter(r=>r.date>=start&&r.date<end&&(!account||r.account===account)&&(!category||r.category===category)&&(!status||r.status===status));
}
export function report(accounts,transactions,filters={}){
 const visible=selectRows(transactions,filters).filter(r=>r.status==='posted');
 const expense=visible.filter(r=>r.classification==='expense');
 const income=visible.filter(r=>r.classification==='income');
 const unresolved=visible.filter(r=>r.classification==='unclassified');
 const groups=(rows,invert=false)=>Object.entries(Object.groupBy(rows,r=>r.category)).map(([name,items])=>({name,value:(sum(items)*(invert?-1n:1n)).toString(),count:items.length})).sort((a,b)=>BigInt(a.value)===BigInt(b.value)?a.name.localeCompare(b.name):BigInt(a.value)>BigInt(b.value)?-1:1);
 const spending=-sum(expense),netIncome=sum(income);
 const balance=balanceSummary(accounts,transactions,filters);
 return {income:netIncome.toString(),grossCharges:(-sum(expense.filter(r=>minor(r.amount)<0n))).toString(),refunds:sum(expense.filter(r=>minor(r.amount)>0n)).toString(),spending:spending.toString(),surplus:(netIncome-spending).toString(),expenses:groups(expense,true),incomes:groups(income),merchants:Object.entries(Object.groupBy(expense,r=>r.payee)).map(([name,rows])=>({name,value:(-sum(rows)).toString(),count:rows.length})).sort((a,b)=>Number(BigInt(b.value)-BigInt(a.value))),...balance,postedCount:visible.length,expenseCount:expense.length,externalCount:expense.length+income.length,unresolvedCount:unresolved.length,unresolvedIn:sum(unresolved.filter(r=>minor(r.amount)>0n)).toString(),unresolvedOut:(-sum(unresolved.filter(r=>minor(r.amount)<0n))).toString(),complete:unresolved.length===0,transferDeposits:sum(visible.filter(r=>r.classification==='transfer'&&accounts.some(a=>a.id===r.account&&a.type==='savings')&&minor(r.amount)>0n)).toString()};
}
// Shared exact balance policy also accepts a streamed, narrow persisted projection.
export function balanceSummary(accounts,transactions,filters={}){
 const cutoff=filters.end||'9999-12-31';
 const selected=accounts.filter(a=>!filters.account||filters.account===a.id);
 const known=selected.filter(a=>a.anchor<cutoff),map=new Map(known.map(a=>[a.id,a]));
 const balances=Object.fromEntries(known.map(a=>[a.id,minor(a.opening)]));
 for(const r of transactions){const a=map.get(r.account);if(a&&r.status==='posted'&&r.date>a.anchor&&r.date<cutoff)balances[r.account]+=minor(r.amount);}
 const unknownBalanceAccounts=selected.filter(a=>a.anchor>=cutoff).map(a=>a.id),balanceComplete=unknownBalanceAccounts.length===0;
 let netWorth=0n,assets=0n,liabilities=0n;for(const n of Object.values(balances)){netWorth+=n;if(n>0n)assets+=n;if(n<0n)liabilities-=n;}
 return {balances:Object.fromEntries(Object.entries(balances).map(([id,n])=>[id,n.toString()])),netWorth:balanceComplete?netWorth.toString():null,assets:balanceComplete?assets.toString():null,liabilities:balanceComplete?liabilities.toString():null,balanceComplete,unknownBalanceAccounts};
}
export function flowData(r){
 const sources=r.incomes.filter(x=>BigInt(x.value)>0n).map(x=>({...x,kind:'income'}));
 const destinations=r.expenses.filter(x=>BigInt(x.value)>0n).map(x=>({...x,kind:'expense'}));
 for(const x of r.expenses.filter(x=>BigInt(x.value)<0n))sources.push({name:`Net credit · ${x.name}`,value:String(-BigInt(x.value)),kind:'credit'});
 for(const x of r.incomes.filter(x=>BigInt(x.value)<0n))destinations.push({name:`Income reversal · ${x.name}`,value:String(-BigInt(x.value)),kind:'reversal'});
 if(BigInt(r.surplus)>0n)destinations.unshift({name:'Net surplus',value:r.surplus,kind:'surplus'});
 if(BigInt(r.surplus)<0n)sources.push({name:'Net deficit',value:String(-BigInt(r.surplus)),kind:'deficit'});
 const total=sources.reduce((s,n)=>s+BigInt(n.value),0n);
 const center=sources.length,nodes=[...sources,{name:'Available',value:total.toString(),kind:'center'},...destinations];
 const links=[...sources.map((n,i)=>({source:i,target:center,value:checkedChartNumber(n.value),name:n.name,kind:n.kind})),...destinations.map((n,i)=>({source:center,target:center+1+i,value:checkedChartNumber(n.value),name:n.name,kind:n.kind}))];
 if(destinations.reduce((s,n)=>s+BigInt(n.value),0n)!==total)throw new Error('Unbalanced flow');
 return {nodes,links,total:total.toString()};
}
export function budgetActual(accounts,rows,month,category,planned){
 const [y,m]=month.split('-').map(Number),end=`${m===12?String(y+1).padStart(4,'0'):String(y).padStart(4,'0')}-${m===12?'01':String(m+1).padStart(2,'0')}-01`;
 const actual=report(accounts,rows,{start:month+'-01',end,category}).spending;
 return {planned:String(planned),actual,remaining:(minor(String(planned))-BigInt(actual)).toString()};
}
export function validateRows(accounts,rows){
 // Narrow proof guard: normalized financial records must never contain credential fields.
 // This is not a secret scanner, encryption system, or a production provider adapter.
 const rejectCredentialFields=value=>{if(!value||typeof value!=='object')return;for(const [key,v] of Object.entries(value)){if(/^(access_?token|refresh_?token|password|client_?secret|private_?key|authorization)$/i.test(key))throw new Error('Credential field forbidden in financial records');rejectCredentialFields(v);}};
 rejectCredentialFields(accounts);rejectCredentialFields(rows);
 const map=new Map(accounts.map(a=>[a.id,a]));
 const ids=new Set();
 for(const r of rows){
  if(ids.has(r.id))throw new Error('Duplicate record ID');ids.add(r.id);
  const a=map.get(r.account);if(!a)throw new Error('Foreign or missing account');
  assertDate(r.date);minor(r.amount);
  if(r.date<=a.anchor)throw new Error('Pre-anchor record requires explicit rebase');
  if(a.currency!=='USD'||r.currency&&r.currency!=='USD')throw new Error('Unsupported currency');
  if(!['posted','pending','removed'].includes(r.status)||!['income','expense','transfer','unclassified','adjustment'].includes(r.classification))throw new Error('Invalid classification/status');
  if(r.classification==='transfer'&&!r.transferId)throw new Error('Unpaired transfer');
 }
 const transfers=Object.groupBy(rows.filter(r=>r.classification==='transfer'&&r.status!=='removed'),r=>r.transferId);
 for(const pair of Object.values(transfers))if(pair.length!==2||sum(pair)!==0n||pair[0].account===pair[1].account||pair.some(r=>r.status!=='posted'))throw new Error('Invalid transfer pair');
}
