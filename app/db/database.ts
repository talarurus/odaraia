// SPDX-License-Identifier: MPL-2.0
import {DatabaseSync} from 'node:sqlite';
import {readFileSync, mkdirSync, chmodSync, existsSync, lstatSync} from 'node:fs';
import {dirname} from 'node:path';
import {SCHEMA_VERSION} from '../domain/contracts.ts';
export {SCHEMA_VERSION} from '../domain/contracts.ts';
export function openDatabase(path: string, target=SCHEMA_VERSION) {
 if(path!==':memory:') {mkdirSync(dirname(path),{recursive:true,mode:0o700});if(existsSync(path)&&lstatSync(path).isSymbolicLink())throw new Error('Database path must not be a symbolic link');}
 const db=new DatabaseSync(path);
 try {
  if(path!==':memory:')chmodSync(path,0o600);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  const version=Number(db.prepare('PRAGMA user_version').get()!.user_version);
  if(version>target || target<1 || target>SCHEMA_VERSION)throw new Error('Unsupported database schema version');
  // Refuse damaged stores without deleting, resetting, or trying to repair them.
  if(db.prepare('PRAGMA quick_check').all().some(row=>row.quick_check!=='ok'))throw new Error('Database integrity check failed. Preserve this file and restore a verified backup into a new database.');
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Database contains broken references. Preserve this file and restore a verified backup into a new database.');
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  db.exec('BEGIN IMMEDIATE');
  try {for(let n=version+1;n<=target;n++){const file=['001-ledger.sql','002-imports.sql','003-source-aliases.sql'][n-1];db.exec(readFileSync(new URL('./migrations/'+file,import.meta.url),'utf8'));db.exec(`PRAGMA user_version=${n}`);}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  return db;
 }catch(e){db.close();throw e;}
}
