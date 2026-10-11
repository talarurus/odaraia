// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonical,expected,sample} from '../shared/fixture.mjs';
import {report,flowData,budgetActual,parseDollars,minor,money,validateRows} from '../shared/finance.mjs';
import {previewCSV,cells} from './csv.mjs';
const period={start:'2026-09-01',end:'2026-10-01'};
test('F1/F3/F8 canonical posted income, expenses, refunds, surplus and balances are exact',()=>{
 const r=report(canonical.accounts,canonical.transactions,period);
 for(const key of ['income','grossCharges','refunds','spending','surplus','netWorth','postedCount','expenseCount','balances'])assert.deepEqual(r[key],expected[key],key);
 assert.equal(r.externalCount,7);assert.equal(r.transferDeposits,'50000');assert.equal(r.complete,true);
});
test('F13 monthly spending target deducts the net refund-adjusted actual',()=>assert.deepEqual(budgetActual(canonical.accounts,canonical.transactions,'2026-09','Groceries','25000'),{planned:'25000',actual:'18000',remaining:'7000'}));
test('F8 Sankey mass and net surplus reconcile exactly',()=>{
 const r=report(canonical.accounts,canonical.transactions,period),g=flowData(r),center=g.nodes.findIndex(n=>n.kind==='center');
 const incoming=g.links.filter(l=>l.target===center).reduce((s,l)=>s+l.value,0),out=g.links.filter(l=>l.source===center).reduce((s,l)=>s+l.value,0);
 assert.equal(incoming,500000);assert.equal(out,incoming);assert.equal(g.nodes.find(n=>n.kind==='surplus').value,'321000');assert(g.links.every(l=>l.value>=0));
});
const custom=rows=>report([{id:'x',name:'X',type:'checking',currency:'USD',anchor:'2026-08-31',opening:'0'}],rows.map((r,i)=>({id:String(i),account:'x',date:'2026-09-03',category:r.classification==='income'?'Pay':'Costs',status:'posted',payee:'Fictional',...r})),period);
test('F8 deficit creates a balancing source, never negative links',()=>{const r=custom([{amount:'10000',classification:'income'},{amount:'-15000',classification:'expense'}]);assert.equal(r.surplus,'-5000');assert.equal(flowData(r).nodes.find(n=>n.kind==='deficit').value,'5000');});
test('F8 net-credit category and income reversal produce balanced nonnegative flows',()=>{
 const r=custom([{amount:'10000',classification:'income'},{amount:'-2000',classification:'income'},{amount:'-2000',classification:'expense'},{amount:'3000',classification:'expense'}]);
 assert.equal(r.income,'8000');assert.equal(r.spending,'-1000');assert.equal(r.surplus,'9000');assert.equal(flowData(r).nodes.find(n=>n.kind==='credit').value,'1000');
});
test('F8 net-negative income source is a labeled reversal sink',()=>{const r=custom([{amount:'-10000',classification:'income'}]);const f=flowData(r);assert(f.nodes.some(n=>n.kind==='reversal'));assert(f.nodes.some(n=>n.kind==='deficit'));});
test('F7 no-income/empty states and unclassified receipts are distinct',()=>{
 assert.equal(flowData(custom([])).total,'0');const r=custom([{amount:'5500',classification:'unclassified'}]);assert.equal(r.income,'0');assert.equal(r.unresolvedIn,'5500');assert.equal(r.complete,false);
});
test('F3 a filtered transfer leg remains excluded from spending/income',()=>{
 const r=report(canonical.accounts,canonical.transactions,{...period,account:'savings'});assert.equal(r.income,'0');assert.equal(r.spending,'0');assert.equal(r.netWorth,'70000');
});
test('F1 pending does not alter posted net worth and debt/credit signs are correct',()=>{
 const r=report(canonical.accounts,canonical.transactions,{end:'2026-09-10'});assert.equal(r.balances.card,'-10000');assert.equal(r.liabilities,'10000');
 assert.equal(report(canonical.accounts,canonical.transactions,period).balances.card,'0');
 const credited=custom([{amount:'3000',classification:'expense'}]);assert.equal(credited.assets,'3000');assert.equal(credited.liabilities,'0');
});
test('F7 future opening anchors do not manufacture earlier zero balance history',()=>{const r=report(canonical.accounts,[],{end:'2026-07-01'});assert.deepEqual(r.balances,{});assert.equal(r.netWorth,null);assert.equal(r.balanceComplete,false);assert.deepEqual(r.unknownBalanceAccounts,['checking','savings','card']);});
test('F1 exact arithmetic exceeds JS safe integer without rounding',()=>{const value='9007199254740993';assert.equal(minor(value).toString(),value);assert.equal(money(value),'$90,071,992,547,409.93');assert.throws(()=>minor('9223372036854775808'));});
test('F2 CSV preserves multiplicity, commas/newlines/BOM and explicit mapping',()=>{
 const p=previewCSV('\uFEFFdate,payee,amount,category,classification\n2026-09-07,"Blue, Kettle",-5.00,Dining,expense\n2026-09-07,"Blue, Kettle",-5.00,Dining,expense\n',{account:'checking'});assert(p.valid);assert.equal(p.rows.length,2);assert.equal(p.rows[0].payee,'Blue, Kettle');assert.notEqual(p.rows[0].id,p.rows[1].id);
 assert.deepEqual(cells('a,b\n"two\nlines","quoted ""text"""'),[['a','b'],['two\nlines','quoted "text"']]);
});
test('F2 ambiguous date is rejected until a convention is declared',()=>{
 const text='date,payee,amount\n09/10/2026,Acorn Books,-9.00';assert(!previewCSV(text,{account:'checking'}).valid);
 assert.equal(previewCSV(text,{account:'checking',dateFormat:'MDY'}).rows[0].date,'2026-09-10');
});
test('F2 malformed date, quotes, fractional cents and foreign currency fail',()=>{
 for(const [date,amount,currency] of [['2026-02-30','1.00','USD'],['2026-09-01','1.001','USD'],['2026-09-01','1.00','EUR']])assert(!previewCSV(`date,payee,amount,currency\n${date},Fictional,${amount},${currency}`,{account:'checking'}).valid);
 assert.throws(()=>cells('a,b\n"broken'));assert.throws(()=>parseDollars('1e3'));assert.throws(()=>parseDollars('NaN'));
});
test('F2 debit/credit and alternate delimiters produce the same signed amount',()=>{
 const r=previewCSV('date;payee;debit;credit\n2026-09-01;Fictional;12.50;',{account:'checking',delimiter:';',amountColumn:'debit-credit'});assert.equal(r.rows[0].amount,'-1250');
 assert(!previewCSV('date,payee,debit,credit\n2026-09-01,Fictional,1,2',{account:'checking',amountColumn:'debit-credit'}).valid);
});
test('F3 incomplete/imbalanced transfers and pre-anchor rows fail validation',()=>{
 assert.throws(()=>validateRows(canonical.accounts,canonical.transactions.filter(r=>r.id!=='saving-in')),/transfer/);
 assert.throws(()=>validateRows(canonical.accounts,[{...canonical.transactions[0],date:'2026-08-31'}]),/anchor/);
});
test('Density sample values are driven by transactions and cross-page equations remain exact',()=>{
 validateRows(sample.accounts,sample.transactions);const r=report(sample.accounts,sample.transactions,period);
 assert.equal(BigInt(r.income)-BigInt(r.spending),BigInt(r.surplus));assert.equal(r.expenses.reduce((s,n)=>s+BigInt(n.value),0n),BigInt(r.spending));assert.equal(BigInt(r.assets)-BigInt(r.liabilities),BigInt(r.netWorth));
 assert.equal(flowData(r).total,r.income);assert(r.expenses.length>=8);
 assert.equal(r.income,'900000');assert.equal(r.grossCharges,'360225');assert.equal(r.refunds,'3500');assert.equal(r.spending,'356725');assert.equal(r.surplus,'543275');assert.equal(r.netWorth,'4214964');
});
