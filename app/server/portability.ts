// SPDX-License-Identifier: MPL-2.0
import {PortableDataService} from '../services/portability.ts';
import {hash} from './importer.ts';
import {check} from '../domain/validation.ts';
import type {Ledger} from '../services/ledger.ts';
import {mkdirSync,chmodSync,lstatSync,existsSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync,unlinkSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
export class Portability extends PortableDataService {
 constructor(repo:Ledger){super(repo,hash);}
 savePrivateBackup(){
  check(this.repo.path!==':memory:','Private file backups require a persistent database');
  const backup=this.backup(),dir=resolve(dirname(this.repo.path),'backups');
  check(!existsSync(dir)||!lstatSync(dir).isSymbolicLink(),'Backup directory must not be a symbolic link');
  mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700);
  const file=resolve(dir,'finance-'+Date.now()+'-'+randomUUID()+'.json'),temporary=file+'.tmp';let fd: number|undefined;
  try{fd=openSync(temporary,'wx',0o600);writeFileSync(fd,JSON.stringify(backup));fsyncSync(fd);closeSync(fd);fd=undefined;renameSync(temporary,file);return {file};}catch(e){if(fd!==undefined)closeSync(fd);if(existsSync(temporary))unlinkSync(temporary);throw e;}
 }
}
