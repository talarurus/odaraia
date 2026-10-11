// SPDX-License-Identifier: MPL-2.0
// Fixed SQL only. This generator consumes the canonical schema; no UI SQL input.
import {readFileSync,writeFileSync} from 'node:fs';
const tables=[
 ['accounts','accounts',[['id','id'],['name','name'],['type','type'],['currency','currency'],['anchor','anchor'],['opening','opening','money'],['revision','revision','revision']]],
 ['transactions','transactions',[['id','id'],['account','account'],['date','date'],['amount','amount','money'],['payee','payee'],['category','category'],['classification','classification'],['status','status'],['note','note'],['transfer_id','transferId','nullable'],['source_key','sourceKey'],['source_id','sourceId','nullable'],['revision','revision','revision'],['provenance','provenance','json']]],
 ['budgets','budgets',[['month','month'],['category','category'],['planned','planned','money']]],
 ['audit','audit',[['id','id'],['time','time'],['action','action'],['entity','entity'],['before_json','before_json','nullable'],['after_json','after_json']]],
 ['imports','imports',[['file_key','file_key'],['account','account'],['name','name'],['time','time'],['result','result']]],
 ['source_aliases','sourceAliases',[['source_key','source_key'],['transaction_id','transaction_id'],['evidence','evidence']]],
 ['previews','previews',[['id','id'],['file_key','file_key'],['account','account'],['payload','payload'],['created_at','created_at']]]
];
const quote=JSON.stringify;
let header='// Generated from canonical migrations and fixed descriptors by generate.mjs.\n';
header+='static const char *migrations[]={'+[1,2,3].map((n)=>quote(readFileSync(new URL('../../db/migrations/'+['001-ledger.sql','002-imports.sql','003-source-aliases.sql'][n-1],import.meta.url),'utf8'))).join(',')+'};\n';
const extracts=tables.map(([table,key,cols])=>`'${key}',json((SELECT json_group_array(json(v)) FROM (SELECT json_object(${cols.flatMap(([sql,name,kind])=>["'"+name+"'",kind==='money'?`CAST(${sql} AS TEXT)`:kind==='json'?`json(${sql})`:sql]).join(',')}) v FROM ${table} ORDER BY ${table==='audit'?'rowid':table==='transactions'?'date DESC,id':table==='budgets'?'month,category':cols[0][0]})))`);
header+='static const char *read_data='+quote('SELECT json_object('+extracts.join(',')+')')+';\n';
header+='static const char *inserts[]={'+tables.map(([table,key,cols])=>quote(`INSERT INTO ${table} SELECT ${cols.map(([,name,kind])=>kind==='money'?`CAST(json_extract(value,'$.${name}') AS INTEGER)`:kind==='json'?`COALESCE(json_extract(value,'$.${name}'),'null')`:`json_extract(value,'$.${name}')`).join(',')} FROM json_each(?1,'$.data.${key}')`)).join(',')+'};\n';
const validation=[];
validation.push("SELECT json_valid(?1)=1 AND json_type(?1)='object' AND json_type(?1,'$.data')='object' AND json_type(?1,'$.expected')='integer' AND json_extract(?1,'$.expected') BETWEEN 0 AND 9007199254740990 AND NOT EXISTS(SELECT 1 FROM json_each(?1) WHERE key NOT IN ('op','expected','data')) AND NOT EXISTS(SELECT 1 FROM json_each(?1,'$.data') WHERE key NOT IN ('accounts','transactions','budgets','audit','imports','sourceAliases','previews'))");
for(const [,key,cols] of tables){
 const checks=cols.map(([,name,kind])=>{const type=`json_type(r.value,'$.${name}')`,value=`json_extract(r.value,'$.${name}')`;return kind==='money'?`(${type}='text' AND ${value}=CAST(CAST(${value} AS INTEGER) AS TEXT))`:kind==='revision'?`(${type}='integer' AND ${value} BETWEEN 1 AND 9007199254740991)`:kind==='json'?`(${type} IN ('object','null'))`:kind==='nullable'?`(${type} IN ('text','null'))`:`(${type}='text' AND length(${value})<=2097152 AND instr(${value},char(0))=0)`;});
 validation.push(`SELECT json_type(?1,'$.data.${key}')='array' AND json_array_length(?1,'$.data.${key}')<=200000 AND NOT EXISTS(SELECT 1 FROM json_each(?1,'$.data.${key}') r WHERE json_type(r.value)!='object' OR NOT COALESCE((${checks.join(' AND ')}),0) OR EXISTS(SELECT 1 FROM json_each(r.value) WHERE key NOT IN (${cols.map(([,name])=>"'"+name+"'").join(',')})))`);
}
header+='static const char *validations[]={'+validation.map(quote).join(',')+'};\n';
writeFileSync(new URL('./schema.h',import.meta.url),header);
