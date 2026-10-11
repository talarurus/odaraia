// SPDX-License-Identifier: MPL-2.0
import {assertDate,parseDollars} from '../shared/finance.mjs';
// Bounded proof parser; supports quoted fields/newlines, BOM and explicit delimiter.
// It does not claim all bank CSV formats or a production mapping UI.
export function cells(text,delimiter=','){
 if(Buffer.byteLength(text)>10*1024*1024)throw new Error('CSV size limit');
 if(![',',';','\t'].includes(delimiter))throw new Error('Unsupported delimiter');
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false,closed=false;
 for(let i=0;i<=text.length;i++){
  const c=text[i];
  if(quoted){if(c===undefined)throw new Error('Unclosed quote');if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c==='"'){if(field||closed)throw new Error('Invalid quote');quoted=true;continue;}
  if(closed&&c!==delimiter&&c!=='\r'&&c!=='\n'&&c!==undefined)throw new Error('Unexpected text after quote');
  if(c===delimiter){row.push(field);field='';closed=false;}
  else if(c==='\n'||c===undefined){row.push(field);if(row.some(x=>x!==''))rows.push(row);row=[];field='';closed=false;if(rows.length>50001)throw new Error('CSV row limit');}
  else if(c!=='\r')field+=c;
  if(field.length>4096)throw new Error('CSV field limit');
 }return rows;
}
export function previewCSV(text,{account,delimiter=',',dateFormat='ISO',amountColumn='amount'}={}){
 if(!account)throw new Error('Account required');
 const [headers,...input]=cells(text,delimiter);if(!headers)throw new Error('Empty CSV');
 if(new Set(headers).size!==headers.length)throw new Error('Duplicate columns');
 const out=[],errors=[];
 input.forEach((values,i)=>{try{
  if(values.length!==headers.length)throw new Error('Column count');
  const r=Object.fromEntries(headers.map((h,j)=>[h,values[j]]));let date=r.date;
  if(dateFormat==='MDY'){if(!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date))throw new Error('Declared MDY required');const[m,d,y]=date.split('/');date=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;}
  else if(dateFormat!=='ISO')throw new Error('Unsupported date mapping');
  assertDate(date);if(r.currency&&r.currency!=='USD')throw new Error('Unsupported currency');
  let amount;if(amountColumn==='debit-credit'){if(r.debit&&r.credit)throw new Error('Both debit and credit');const debit=BigInt(parseDollars(r.debit||'0')),credit=BigInt(parseDollars(r.credit||'0'));if(debit<0n||credit<0n)throw new Error('Negative debit/credit');amount=String(credit-debit);}else amount=parseDollars(r[amountColumn]);
  out.push({id:r.id||`csv-row-${i}`,sourceId:r.id||null,account,date,amount,payee:r.payee||'',category:r.category||'Unclassified',classification:r.classification||'unclassified',status:r.status||'posted',connection:'csv',revision:1});
 }catch(e){errors.push({row:i+2,message:e.message});}});
 return {rows:out,errors,valid:errors.length===0};
}
