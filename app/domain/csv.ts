// SPDX-License-Identifier: MPL-2.0
import {utf8Size} from './contracts.ts';
import {parseDollars} from './finance.mjs';
import {check,InputError,object,keys,text as validText,date,amount} from './validation.ts';
export function cells(input: string, delimiter=','): string[][] {
 check(typeof input==='string' && utf8Size(input)<=10*1024*1024,'CSV must be at most 10 MiB');
 check(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input),'CSV contains unsupported control characters');
 check([',',';','\t'].includes(delimiter),'Unsupported delimiter');
 const content=input.replace(/^\uFEFF/,''),rows: string[][]=[];let row: string[]=[],field='',quoted=false,closed=false;
 for(let i=0;i<=content.length;i++){
  const c=content[i];
  if(quoted){if(c===undefined)throw new InputError('Unclosed CSV quote');if(c==='"'){if(content[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;}
  else if(c==='"'){check(!field&&!closed,'Invalid CSV quote');quoted=true;}
  else {
   check(!closed||c===delimiter||c==='\r'||c==='\n'||c===undefined,'Unexpected text after CSV quote');
   if(c===delimiter){row.push(field);field='';closed=false;}
   else if(c==='\n'||c==='\r'||c===undefined){if(c==='\r'&&content[i+1]==='\n')i++;row.push(field);if(row.some(x=>x!==''))rows.push(row);row=[];field='';closed=false;check(rows.length<=50001,'CSV row limit: 50,000 transactions');}
   else field+=c;
  }
  check(field.length<=4096,'CSV field exceeds 4096 characters');check(row.length<=100,'CSV column limit');
 }
 return rows;
}
export function currency(value: string): string {
 let v=value.trim(),negative=false;
 if(/^\(.*\)$/.test(v)){negative=true;v=v.slice(1,-1).trim();}
 v=v.replace(/^([-+]?)\$\s*/, '$1');
 check(!v.includes(',')||/^[-+]?\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(v),'Invalid thousands separators');
 check(!negative||!/^[-+]/.test(v),'Conflicting amount signs');
 try {return parseDollars((negative?'-':'')+v.replaceAll(',',''));}catch(e){throw new InputError((e as Error).message);}
}
export function parseCSV(input: string, options: unknown){
 const o=object(options);keys(o,['account','delimiter','dateFormat','amountMode','columns','defaultClassification','defaultCategory']);
 validText(o.account,'destination account',100);
 const grid=cells(input,o.delimiter||','),[headers,...raw]=grid;check(headers?.length,'CSV has no header');check(new Set(headers).size===headers.length,'CSV has duplicate column headers');
 const columns=object(o.columns);keys(columns,['date','payee','amount','debit','credit','id','category','classification','status','currency','note']);
 for(const [field,name] of Object.entries(columns))check(name===''||typeof name==='string'&&headers.includes(name),`Column for ${field} does not exist`);
 check(columns.date && columns.payee,'Map the date and merchant/payee columns');
 check(['ISO','MDY','DMY'].includes(o.dateFormat),'Choose ISO, MDY or DMY dates');
 check(['signed','inverted','debit-credit'].includes(o.amountMode),'Choose an amount convention');
 check(o.amountMode==='debit-credit'?columns.debit&&columns.credit:columns.amount,'Map the amount column(s)');
 check(!o.defaultClassification||['unclassified','income','expense'].includes(o.defaultClassification),'Invalid default classification');
 const rows: any[]=[],errors: any[]=[];
 const get=(values: string[],field: string)=>columns[field]?values[headers.indexOf(columns[field])]?.trim()||'':'';
 raw.forEach((values,index)=>{try{
  check(values.length===headers.length,'Column count differs from header');let day=get(values,'date');
  if(o.dateFormat!=='ISO'){check(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(day),'Date must match the declared slash format');const [first,second,year]=day.split('/');day=`${year}-${(o.dateFormat==='MDY'?first:second).padStart(2,'0')}-${(o.dateFormat==='MDY'?second:first).padStart(2,'0')}`;}
  date(day);check(!get(values,'currency')||get(values,'currency')==='USD','Only USD is supported');
  let cents: string;
  if(o.amountMode==='debit-credit'){const d=get(values,'debit'),c=get(values,'credit');check(!(d&&c&&BigInt(currency(d))!==0n&&BigInt(currency(c))!==0n),'Both debit and credit contain amounts');const debit=currency(d||'0'),credit=currency(c||'0');check(BigInt(debit)>=0n&&BigInt(credit)>=0n,'Debit/credit columns must be nonnegative');cents=amount(String(BigInt(credit)-BigInt(debit)));}
  else {cents=currency(get(values,'amount'));if(o.amountMode==='inverted')cents=amount(String(-BigInt(cents)));}
  const classification=get(values,'classification')||o.defaultClassification||'unclassified';check(['unclassified','income','expense'].includes(classification),'Transfers require a paired transfer review');
  const status=get(values,'status').toLowerCase()||'posted';check(['posted','pending'].includes(status),'Status must be posted or pending');
  const record={account:o.account,date:day,amount:cents,payee:validText(get(values,'payee'),'payee',200),category:validText(get(values,'category')||o.defaultCategory||'Unclassified','category'),classification,status,note:validText(get(values,'note'),'note',4000,true),sourceId:get(values,'id')?validText(get(values,'id'),'source ID',200):null};
  rows.push({row:index+2,record,raw:values});
 }catch(e){errors.push({row:index+2,message:(e as Error).message});}});
 return {headers,grid,rows,errors,rowCount:raw.length};
}
