// SPDX-License-Identifier: MPL-2.0
// Original synthetic records. The canonical case follows MVP_SCOPE.md exactly.
export const canonicalAccounts = [
  {id:'checking',name:'Harbor Checking',type:'checking',currency:'USD',anchor:'2026-08-31',opening:'100000'},
  {id:'savings',name:'Reserve Savings',type:'savings',currency:'USD',anchor:'2026-08-31',opening:'20000'},
  {id:'card',name:'Everyday Card',type:'credit',currency:'USD',anchor:'2026-08-31',opening:'0'},
];
const row=(id,date,account,amount,payee,category,classification='expense',extra={})=>({id,date,account,amount:String(amount),payee,category,classification,status:'posted',sourceId:id,connection:'synthetic',revision:1,...extra});
export const canonicalTransactions=[
 row('salary-1','2026-09-02','checking',500000,'Northwind Studio','Paychecks','income'),
 row('rent-1','2026-09-03','checking',-150000,'Willow Home','Housing'),
 row('grocery-1','2026-09-05','checking',-20000,'Paper Birch Market','Groceries'),
 row('refund-1','2026-09-06','checking',2000,'Paper Birch Market','Groceries'),
 row('coffee-1','2026-09-07','checking',-500,'Blue Kettle Cafe','Dining'),
 row('coffee-2','2026-09-07','checking',-500,'Blue Kettle Cafe','Dining'),
 row('card-buy-1','2026-09-08','card',-10000,'Willow Goods','Household'),
 row('saving-out','2026-09-10','checking',-50000,'To Reserve Savings','Transfers','transfer',{transferId:'T1'}),
 row('saving-in','2026-09-10','savings',50000,'From Harbor Checking','Transfers','transfer',{transferId:'T1'}),
 row('card-pay-out','2026-09-12','checking',-10000,'Everyday Card payment','Transfers','transfer',{transferId:'T2'}),
 row('card-pay-in','2026-09-12','card',10000,'Harbor Checking payment','Transfers','transfer',{transferId:'T2'}),
 row('pending-1','2026-09-30','card',-3000,'Willow Goods','Household','expense',{status:'pending'}),
];
export const canonical={id:'canonical',name:'Canonical integrity fixture',accounts:canonicalAccounts,transactions:canonicalTransactions,budgets:[{month:'2026-09',category:'Groceries',planned:'25000'}]};
export const expected={income:'500000',grossCharges:'181000',refunds:'2000',spending:'179000',surplus:'321000',netWorth:'441000',openingNetWorth:'120000',postedCount:11,expenseCount:6,balances:{checking:'371000',savings:'70000',card:'0'}};

// A separate, original density fixture uses the same rules. No reference values.
const demoAccounts=canonicalAccounts.map(a=>({...a,anchor:'2026-06-30',opening:({checking:'840000',savings:'1860000',card:'-120000'})[a.id]}));
const demoRows=[];
for(const [i,month] of ['07','08','09'].entries()){
 const prefix=`demo-${month}`;
 demoRows.push(row(`${prefix}-pay-a`,`2026-${month}-02`,'checking',620000,'Northwind Studio','Paychecks','income'));
 demoRows.push(row(`${prefix}-pay-b`,`2026-${month}-16`,'checking',280000,'Juniper Design','Freelance','income'));
 const specs=[['Housing','Willow Home',195000,'checking'],['Groceries','Paper Birch Market',18500,'card'],['Groceries','Meadow Pantry',12400,'checking'],['Dining','Blue Kettle Cafe',1800,'card'],['Dining','Juniper Kitchen',8600,'card'],['Household','Willow Goods',16500,'card'],['Bills','Lantern Internet',7900,'checking'],['Bills','Harbor Utilities',14600,'checking'],['Transport','Cedar Transit',9200,'card'],['Health','Cedar Clinic',7500,'checking'],['Travel','Hearth Rail',24500,'card'],['Shopping','Field & Thread',10900,'card'],['Lifestyle','Acorn Books',3200,'card']];
 specs.forEach(([cat,merchant,amount,account],j)=>{
   const day=3+j;
   demoRows.push(row(`${prefix}-purchase-${j}`,`2026-${month}-${String(day).padStart(2,'0')}`,account,-(amount+i*75),merchant,cat));
 });
 for(let j=0;j<18;j++)demoRows.push(row(`${prefix}-daily-${j}`,`2026-${month}-${String(7+j).padStart(2,'0')}`,j%3?'card':'checking',-(750+j*83+i*41),j%2?'Paper Birch Market':'Blue Kettle Cafe',j%2?'Groceries':'Dining'));
 demoRows.push(row(`${prefix}-refund`,`2026-${month}-24`,'card',3500,'Willow Goods','Household'));
 demoRows.push(row(`${prefix}-reserve-out`,`2026-${month}-25`,'checking',-180000,'To Reserve Savings','Transfers','transfer',{transferId:`${prefix}-T1`}));
 demoRows.push(row(`${prefix}-reserve-in`,`2026-${month}-25`,'savings',180000,'From Harbor Checking','Transfers','transfer',{transferId:`${prefix}-T1`}));
 demoRows.push(row(`${prefix}-payment-out`,`2026-${month}-27`,'checking',-140000,'Everyday Card payment','Transfers','transfer',{transferId:`${prefix}-T2`}));
 demoRows.push(row(`${prefix}-payment-in`,`2026-${month}-27`,'card',140000,'Harbor Checking payment','Transfers','transfer',{transferId:`${prefix}-T2`}));
}
demoRows.push(row('demo-pending','2026-09-30','card',-4290,'Field & Thread','Shopping','expense',{status:'pending'}));
export const sample={id:'sample',name:'Synthetic sample household',accounts:demoAccounts,transactions:demoRows,budgets:[{month:'2026-09',category:'Groceries',planned:'60000'}]};
export const palette={Housing:'#2f78cc',Groceries:'#d39a00',Dining:'#e3b348',Household:'#9d9d97',Bills:'#198b26',Transport:'#ca6394',Health:'#8eaaa6',Travel:'#92958e',Shopping:'#b5b6af',Lifestyle:'#c9cbc4',Paychecks:'#219d79',Freelance:'#64b9a0','Net surplus':'#31a67f'};
export const samples={sample,canonical};
