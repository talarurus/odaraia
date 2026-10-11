// SPDX-License-Identifier: MPL-2.0
import {Ledger} from '../services/ledger.ts';
import type {Account,Transaction,Budget} from '../domain/types.ts';
import type {ImportRecord,SourceAlias,AuditRecord,PreviewRecord} from '../domain/storage.ts';
import {openDatabase} from './database.ts';
import {account,transaction,budget,integrity} from '../domain/validation.ts';
export class Repository extends Ledger {
 db: ReturnType<typeof openDatabase>;
 path: string;
 constructor(path=':memory:'){super();this.path=path;this.db=openDatabase(path);try{const accounts=this.accounts().map(account),rows=this.rows().map(transaction);this.budgets().forEach(budget);integrity(accounts,rows);}catch{this.db.close();throw new Error('Stored financial data failed validation. Preserve this file and restore a verified backup into a new database.');}}
 close(){this.db.close();}
 atomic<T>(fn: ()=>T): T {this.db.exec('BEGIN IMMEDIATE');try{const result=fn();if(result instanceof Promise)throw new Error('Storage transactions must be synchronous');this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 snapshot<T>(fn: ()=>T): T {if(this.db.isTransaction)return fn();this.db.exec('BEGIN');try{const r=fn();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 accounts(): Account[] {return this.db.prepare('SELECT id,name,type,currency,anchor,CAST(opening AS TEXT) opening,revision FROM accounts ORDER BY id').all().map(a=>({...a})) as unknown as Account[];}
 rows(): Transaction[] {return this.db.prepare('SELECT id,account,date,CAST(amount AS TEXT) amount,payee,category,classification,status,note,transfer_id transferId,source_key sourceKey,source_id sourceId,revision,provenance FROM transactions ORDER BY date DESC,id').all().map(t=>({...t,provenance:JSON.parse(t.provenance as string)})) as unknown as Transaction[];}
 budgets(): Budget[] {return this.db.prepare('SELECT month,category,CAST(planned AS TEXT) planned FROM budgets ORDER BY month,category').all().map(b=>({...b})) as unknown as Budget[];}
 saveAccount(a: Account){this.db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,anchor=excluded.anchor,opening=excluded.opening,revision=excluded.revision').run(a.id,a.name,a.type,a.currency,a.anchor,BigInt(a.opening),a.revision);}
 saveRow(t: Transaction){this.db.prepare('INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET account=excluded.account,date=excluded.date,amount=excluded.amount,payee=excluded.payee,category=excluded.category,classification=excluded.classification,status=excluded.status,note=excluded.note,revision=excluded.revision,transfer_id=excluded.transfer_id').run(t.id,t.account,t.date,BigInt(t.amount),t.payee,t.category,t.classification,t.status,t.note,t.transferId,t.sourceKey,t.sourceId,t.revision,JSON.stringify(t.provenance));}
 // Import and recovery services use these storage operations. SQL remains inside
 // this SQLite adapter so a later database migration has one concrete boundary.
 findImport(fileKey: string):ImportRecord|undefined{return this.db.prepare('SELECT * FROM imports WHERE file_key=?').get(fileKey) as unknown as ImportRecord|undefined;}
 listImports():ImportRecord[]{return this.db.prepare('SELECT * FROM imports ORDER BY file_key').all().map(r=>({...r})) as unknown as ImportRecord[];}
 saveImport(i: ImportRecord){this.db.prepare('INSERT INTO imports VALUES(?,?,?,?,?)').run(i.file_key,i.account,i.name,i.time,i.result);}
 getPreview(id: string):PreviewRecord|undefined{return this.db.prepare('SELECT payload,created_at FROM previews WHERE id=?').get(id) as unknown as PreviewRecord|undefined;}
 savePreview(p: any){this.db.prepare('DELETE FROM previews WHERE created_at < ?').run(new Date(Date.now()-86400000).toISOString());this.db.prepare('INSERT INTO previews VALUES(?,?,?,?,?)').run(p.id,p.fileKey,p.account,JSON.stringify(p),new Date().toISOString());}
 listAliases():SourceAlias[]{return this.db.prepare('SELECT * FROM source_aliases ORDER BY source_key').all().map(r=>({...r})) as unknown as SourceAlias[];}
 saveAlias(a: SourceAlias){this.db.prepare('INSERT INTO source_aliases VALUES(?,?,?)').run(a.source_key,a.transaction_id,a.evidence);}
 auditEntries():AuditRecord[]{return this.db.prepare('SELECT * FROM audit ORDER BY rowid').all().map(r=>({...r})) as unknown as AuditRecord[];}
 saveAudit(a: AuditRecord){this.db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').run(a.id,a.time,a.action,a.entity,a.before_json,a.after_json);}
 saveBudget(b: Budget){this.db.prepare('INSERT INTO budgets VALUES(?,?,?) ON CONFLICT(month,category) DO UPDATE SET planned=excluded.planned').run(b.month,b.category,BigInt(b.planned));}
 empty(){return ['accounts','transactions','budgets','audit','imports','source_aliases','previews'].every(table=>this.db.prepare(`SELECT count(*) n FROM ${table}`).get()!.n===0);}
}
