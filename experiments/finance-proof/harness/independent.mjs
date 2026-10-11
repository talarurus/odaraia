// SPDX-License-Identifier: MPL-2.0
// Disposable local mechanism proof. SQLite is NOT a PostgreSQL/RLS validation.
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {validateRows,minor,assertDate,report,budgetActual,balanceSummary} from '../shared/finance.mjs';
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const clone=x=>structuredClone(x);
export class IndependentProof {
 constructor(path=':memory:',{version=2}={}){
  this.db=new DatabaseSync(path);this.db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  this.db.exec(`
   CREATE TABLE IF NOT EXISTS households(id TEXT PRIMARY KEY,name TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS accounts(household TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(household,id),FOREIGN KEY(household) REFERENCES households(id));
   CREATE TABLE IF NOT EXISTS transactions(household TEXT NOT NULL,id TEXT NOT NULL,account_id TEXT NOT NULL,date TEXT NOT NULL,amount INTEGER NOT NULL,status TEXT NOT NULL,source_key TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(household,id),UNIQUE(household,source_key),FOREIGN KEY(household,account_id) REFERENCES accounts(household,id));
   CREATE INDEX IF NOT EXISTS transactions_period ON transactions(household,date,id);
   CREATE TABLE IF NOT EXISTS previews(household TEXT NOT NULL,id TEXT NOT NULL,file_key TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(household,id),FOREIGN KEY(household) REFERENCES households(id));
   CREATE TABLE IF NOT EXISTS imports(household TEXT NOT NULL,file_key TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(household,file_key));
   CREATE TABLE IF NOT EXISTS budgets(household TEXT NOT NULL,month TEXT NOT NULL,category TEXT NOT NULL,planned TEXT NOT NULL,PRIMARY KEY(household,month,category));
   CREATE TABLE IF NOT EXISTS connections(household TEXT NOT NULL,id TEXT NOT NULL,cursor TEXT NOT NULL,status TEXT NOT NULL,PRIMARY KEY(household,id));
   CREATE TABLE IF NOT EXISTS sync_runs(household TEXT NOT NULL,connection TEXT NOT NULL,id TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(household,connection,id));
  `);
  const current=this.db.prepare('PRAGMA user_version').get().user_version;
  if(current>2)throw new Error('Unsupported future schema');
  if(current===0)this.db.exec('PRAGMA user_version=1');
  if(version===2&&this.db.prepare('PRAGMA user_version').get().user_version===1){
   this.atomic(()=>{this.db.exec("ALTER TABLE transactions ADD COLUMN user_note TEXT NOT NULL DEFAULT ''; UPDATE transactions SET user_note=COALESCE(json_extract(payload,'$.note'),''); PRAGMA user_version=2;");});
  }
  this.version=this.db.prepare('PRAGMA user_version').get().user_version;
 }
 atomic(fn){this.db.exec('BEGIN IMMEDIATE');try{const r=fn();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 readSnapshot(fn){if(this.db.isTransaction)return fn();this.db.exec('BEGIN');try{const r=fn();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 requireScope(id){if(!this.db.prepare('SELECT id FROM households WHERE id=?').get(id))throw new Error('Unknown household');}
 createHousehold(id,accounts,name=id){
  if(!id||typeof id!=='string')throw new Error('Household ID required');
  for(const a of accounts){assertDate(a.anchor);minor(a.opening);if(a.currency!=='USD')throw new Error('Unsupported currency');}
  this.atomic(()=>{this.db.prepare('INSERT INTO households VALUES(?,?)').run(id,name);for(const a of accounts)this.db.prepare('INSERT INTO accounts VALUES(?,?,?)').run(id,a.id,JSON.stringify(a));});
 }
 accounts(hh){this.requireScope(hh);return this.db.prepare('SELECT payload FROM accounts WHERE household=? ORDER BY id').all(hh).map(x=>JSON.parse(x.payload));}
 rows(hh,filters={}){
  this.requireScope(hh);const parts=['household=?'],params=[hh];
  if(filters.start){parts.push('date>=?');params.push(filters.start);}
  if(filters.end){parts.push('date<?');params.push(filters.end);}
  if(filters.account){parts.push('account_id=?');params.push(filters.account);}
  if(filters.status){parts.push('status=?');params.push(filters.status);}
  let sql=`SELECT payload FROM transactions WHERE ${parts.join(' AND ')} ORDER BY date DESC,id`;
  if(filters.limit!==undefined){if(!Number.isInteger(filters.limit)||filters.limit<1||filters.limit>100)throw new Error('List limit');sql+=' LIMIT ?';params.push(filters.limit);}
  return this.db.prepare(sql).all(...params).map(x=>JSON.parse(x.payload));
 }
 sourceKey(row,fileKey,index){return `${row.connection||'csv'}|${row.account}|${row.sourceId||`${fileKey}|row:${index}`}`;}
 store(hh,row,key,{replacesKey}={}){
  const previous=this.db.prepare('SELECT source_key FROM transactions WHERE household=? AND id=?').get(hh,row.id);
  if(previous&&previous.source_key!==key&&previous.source_key!==replacesKey)throw new Error('Record ID collision');
  const fields=[hh,row.id,row.account,row.date,minor(row.amount),row.status,key,JSON.stringify(row)];
  const sql=this.version===2?'INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(household,id) DO UPDATE SET account_id=excluded.account_id,date=excluded.date,amount=excluded.amount,status=excluded.status,source_key=excluded.source_key,payload=excluded.payload,user_note=excluded.user_note':'INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(household,id) DO UPDATE SET account_id=excluded.account_id,date=excluded.date,amount=excluded.amount,status=excluded.status,source_key=excluded.source_key,payload=excluded.payload';
  if(this.version===2)fields.push(row.note||'');this.db.prepare(sql).run(...fields);
 }
 preview(hh,input,{fileKey=hash(input)}={}){
  this.requireScope(hh);const rows=clone(input),existing=this.rows(hh),candidateDuplicates=[];
  for(const [index,r] of rows.entries()){
   // Keep normalized import evidence before any user correction; not raw credential data.
   if(!r.sourceEvidence)r.sourceEvidence=clone(input[index]);
   r.revision=1;r.sourceKey=this.sourceKey(r,fileKey,index);
   if(existing.some(e=>e.id===r.id&&e.sourceKey!==r.sourceKey))throw new Error('Record ID collision');
   if(existing.some(e=>e.amount===r.amount&&e.date===r.date&&e.payee===r.payee&&e.account===r.account&&e.sourceKey!==r.sourceKey))candidateDuplicates.push(r.id);
  }
  const sourceExisting=new Set(existing.map(x=>x.sourceKey));
  const fresh=rows.filter(r=>!sourceExisting.has(r.sourceKey));
  validateRows(this.accounts(hh),[...existing,...fresh]);
  const seen=new Set();for(const r of rows){if(seen.has(r.sourceKey))throw new Error('Repeated source ID in preview');seen.add(r.sourceKey);}
  const id=randomUUID();this.db.prepare('INSERT INTO previews VALUES(?,?,?,?)').run(hh,id,fileKey,JSON.stringify(rows));
  return {id,fileKey,rowCount:rows.length,candidateDuplicates,previewOnly:true};
 }
 commit(hh,id,{failAfter=Infinity}={}){
  this.requireScope(hh);const p=this.db.prepare('SELECT * FROM previews WHERE household=? AND id=?').get(hh,id);if(!p)throw new Error('Foreign or missing preview');
  return this.atomic(()=>{
   const previous=this.db.prepare('SELECT result FROM imports WHERE household=? AND file_key=?').get(hh,p.file_key);if(previous)return {...JSON.parse(previous.result),replayed:true};
   const rows=JSON.parse(p.payload);let added=0;
   for(const r of rows){
    if(this.db.prepare('SELECT id FROM transactions WHERE household=? AND source_key=?').get(hh,r.sourceKey))continue;
    this.store(hh,r,r.sourceKey);added++;if(added>=failAfter)throw new Error('Injected import failure');
   }
   validateRows(this.accounts(hh),this.rows(hh));
   const result={added,fileKey:p.file_key,replayed:false};this.db.prepare('INSERT INTO imports VALUES(?,?,?)').run(hh,p.file_key,JSON.stringify(result));return result;
  });
 }
 load(hh,fixture){this.createHousehold(hh,fixture.accounts,fixture.name);const p=this.preview(hh,fixture.transactions,{fileKey:'canonical-statement'});this.commit(hh,p.id);for(const b of fixture.budgets||[])this.setBudget(hh,b.month,b.category,b.planned);}
 update(hh,id,changes,expectedRevision){
  const allowed=['date','amount','payee','category','classification','note'];
  if(Object.keys(changes).some(k=>!allowed.includes(k)))throw new Error('Uneditable field');
  return this.atomic(()=>{const rows=this.rows(hh),r=rows.find(x=>x.id===id);if(!r)throw new Error('Foreign or missing record');if(r.revision!==expectedRevision)throw new Error('Revision conflict');
   Object.assign(r,changes);r.overrides={...r.overrides,...changes};r.revision++;validateRows(this.accounts(hh),rows);this.store(hh,r,r.sourceKey);return clone(r);
  });
 }
 rebase(hh,account,anchor,opening){
  assertDate(anchor);minor(opening);return this.atomic(()=>{const a=this.accounts(hh).find(x=>x.id===account);if(!a)throw new Error('Foreign account');a.anchor=anchor;a.opening=opening;
   const all=this.accounts(hh).map(x=>x.id===account?a:x);validateRows(all,this.rows(hh));this.db.prepare('UPDATE accounts SET payload=? WHERE household=? AND id=?').run(JSON.stringify(a),hh,account);
  });
 }
 setBudget(hh,month,category,planned){this.requireScope(hh);if(!/^\d{4}-\d{2}$/.test(month))throw new Error('Invalid month');assertDate(month+'-01');if(minor(planned)<0n)throw new Error('Negative budget');this.db.prepare('INSERT INTO budgets VALUES(?,?,?,?) ON CONFLICT(household,month,category) DO UPDATE SET planned=excluded.planned').run(hh,month,category,planned);}
 budget(hh,month,category){this.requireScope(hh);const b=this.db.prepare('SELECT planned FROM budgets WHERE household=? AND month=? AND category=?').get(hh,month,category);return budgetActual(this.accounts(hh),this.rows(hh),month,category,b?.planned||'0');}
 reportRows(hh,filters={}){
  this.requireScope(hh);const parts=['household=?',"status='posted'"],params=[hh];
  // Period activity is separate from the exact streamed balance history below.
  if(filters.start){parts.push('date>=?');params.push(filters.start);}
  if(filters.end){parts.push('date<?');params.push(filters.end);}
  if(filters.account){parts.push('account_id=?');params.push(filters.account);}
  // Read only report fields, without materializing/re-serializing source evidence.
  // CAST to text and the shared BigInt policy retain exactness, including aggregate
  // totals beyond SQLite SUM's signed-64-bit range. There is no report cache.
  const sql=`SELECT account_id AS account,date,CAST(amount AS TEXT) AS amount,status,
   json_extract(payload,'$.classification') AS classification,
   json_extract(payload,'$.category') AS category,json_type(payload,'$.category') AS categoryType,
   json_extract(payload,'$.payee') AS payee,json_type(payload,'$.payee') AS payeeType
   FROM transactions WHERE ${parts.join(' AND ')} ORDER BY date DESC,id`;
  const field=(value,type)=>type===null?undefined:['array','object'].includes(type)?JSON.parse(value):type==='true'?true:type==='false'?false:value;
  const rows=[];
  // Iterate avoids retaining the driver's 50k dictionary objects alongside mapped rows.
  for(const row of this.db.prepare(sql).iterate(...params))rows.push({account:row.account,date:row.date,amount:row.amount,status:row.status,classification:row.classification,category:field(row.category,row.categoryType),payee:field(row.payee,row.payeeType)});
  return rows;
 }
 report(hh,filters={}){
  return this.readSnapshot(()=>{
  const accounts=this.accounts(hh),activity=report(accounts,this.reportRows(hh,filters),filters);
  const selected=accounts.filter(a=>!filters.account||a.id===filters.account),minAnchor=selected.reduce((min,a)=>a.anchor<min?a.anchor:min,'9999-12-31');
  const params=[hh,minAnchor,filters.end||'9999-12-31'],accountClause=filters.account?' AND account_id=?':'';if(filters.account)params.push(filters.account);
  const history=this.db.prepare(`SELECT account_id AS account,date,CAST(amount AS TEXT) AS amount,status FROM transactions WHERE household=? AND status='posted' AND date>? AND date<?${accountClause}`).iterate(...params);
  return {...activity,...balanceSummary(accounts,history,filters)};
  });
 }
 sync(hh,connection,{id,expectedCursor='',nextCursor,rows=[],removed=[],replacements=[],failAfter=Infinity}={}){
  this.requireScope(hh);if(!id||nextCursor===undefined)throw new Error('Sync identity/checkpoint required');
  return this.atomic(()=>{
   const replay=this.db.prepare('SELECT result FROM sync_runs WHERE household=? AND connection=? AND id=?').get(hh,connection,id);if(replay)return {...JSON.parse(replay.result),replayed:true};
   const c=this.db.prepare('SELECT * FROM connections WHERE household=? AND id=?').get(hh,connection);
   if(c&&c.status!=='active')throw new Error('Disconnected or revocation-pending connection');if((c?.cursor||'')!==expectedCursor)throw new Error('Cursor conflict');
   let count=0;
   for(const incoming of rows){
    const source={...incoming,connection,revision:1};const key=this.sourceKey(source,'sync',0);
    let existing=this.db.prepare('SELECT payload FROM transactions WHERE household=? AND source_key=?').get(hh,key),replacesKey;
    const replacement=replacements.find(x=>x.account===source.account&&x.newId===source.sourceId);
    if(!existing&&replacement){const oldkey=this.sourceKey({...source,sourceId:replacement.oldId},'sync',0);existing=this.db.prepare('SELECT payload FROM transactions WHERE household=? AND source_key=?').get(hh,oldkey);if(!existing||JSON.parse(existing.payload).status!=='pending')throw new Error('Unconfirmed pending replacement');replacesKey=oldkey;}
    let r;if(existing){const old=JSON.parse(existing.payload);r={...source,id:old.id,sourceEvidence:source,overrides:old.overrides||{},revision:old.revision+1,...old.overrides};}else r={...source,sourceEvidence:source};
    r.sourceKey=key;this.store(hh,r,key,{replacesKey});count++;if(count>=failAfter)throw new Error('Injected sync failure');
   }
   for(const removal of removed){const key=this.sourceKey({...removal,connection},'sync',0);const found=this.db.prepare('SELECT payload FROM transactions WHERE household=? AND source_key=?').get(hh,key);if(found){const r=JSON.parse(found.payload);r.status='removed';r.revision++;this.store(hh,r,key);}}
   validateRows(this.accounts(hh),this.rows(hh));
   this.db.prepare('INSERT INTO connections VALUES(?,?,?,?) ON CONFLICT(household,id) DO UPDATE SET cursor=excluded.cursor,status=excluded.status').run(hh,connection,nextCursor,'active');
   const result={applied:count,cursor:nextCursor,replayed:false};this.db.prepare('INSERT INTO sync_runs VALUES(?,?,?,?)').run(hh,connection,id,JSON.stringify(result));return result;
  });
 }
 connection(hh,id){this.requireScope(hh);return this.db.prepare('SELECT id,cursor,status FROM connections WHERE household=? AND id=?').get(hh,id)||null;}
 disconnect(hh,id,{remoteConfirmed=false}={}){this.requireScope(hh);if(!this.connection(hh,id))throw new Error('Foreign connection');this.db.prepare('UPDATE connections SET status=? WHERE household=? AND id=?').run(remoteConfirmed?'disconnected':'revocation_pending',hh,id);}
 export(hh){
  this.requireScope(hh);const payload={schemaVersion:2,household:{id:hh,name:this.db.prepare('SELECT name FROM households WHERE id=?').get(hh).name},accounts:this.accounts(hh),transactions:this.rows(hh),budgets:this.db.prepare('SELECT month,category,planned FROM budgets WHERE household=? ORDER BY month,category').all(hh),imports:this.db.prepare('SELECT file_key,result FROM imports WHERE household=? ORDER BY file_key').all(hh),connections:this.db.prepare('SELECT id,cursor,status FROM connections WHERE household=? ORDER BY id').all(hh),syncRuns:this.db.prepare('SELECT connection,id,result FROM sync_runs WHERE household=? ORDER BY connection,id').all(hh)};
  return {payload,checksum:hash(payload)};
 }
 restore(snapshot,targetHousehold=snapshot.payload?.household?.id){
  if(!snapshot?.payload||snapshot.checksum!==hash(snapshot.payload))throw new Error('Export checksum mismatch');
  const p=clone(snapshot.payload);if(p.schemaVersion!==2)throw new Error('Export schema unsupported');if(p.household.id!==targetHousehold)throw new Error('Foreign restore scope');
  if(this.db.prepare('SELECT id FROM households WHERE id=?').get(targetHousehold))throw new Error('Restore requires empty household');
  validateRows(p.accounts,p.transactions);for(const a of p.accounts){assertDate(a.anchor);minor(a.opening);}
  this.atomic(()=>{
   this.db.prepare('INSERT INTO households VALUES(?,?)').run(targetHousehold,p.household.name);
   for(const a of p.accounts)this.db.prepare('INSERT INTO accounts VALUES(?,?,?)').run(targetHousehold,a.id,JSON.stringify(a));
   for(const r of p.transactions)this.store(targetHousehold,r,r.sourceKey);
   for(const b of p.budgets)this.setBudget(targetHousehold,b.month,b.category,b.planned);
   for(const i of p.imports)this.db.prepare('INSERT INTO imports VALUES(?,?,?)').run(targetHousehold,i.file_key,i.result);
   for(const c of p.connections)this.db.prepare('INSERT INTO connections VALUES(?,?,?,?)').run(targetHousehold,c.id,c.cursor,c.status);
   for(const r of p.syncRuns)this.db.prepare('INSERT INTO sync_runs VALUES(?,?,?,?)').run(targetHousehold,r.connection,r.id,r.result);
  });return targetHousehold;
 }
 close(){this.db.close();}
}
