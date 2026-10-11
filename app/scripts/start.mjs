// SPDX-License-Identifier: MPL-2.0
import {resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {realpathSync,mkdirSync,chmodSync} from 'node:fs';
import {buildApp,root} from './build.mjs';
import {startServer} from '../server/http.ts';
const workspace=resolve(root,'..'),path=resolve(root,process.env.FINANCE_DB||'data/finance.sqlite');
const rel=relative(workspace,path);if(rel.startsWith('..')||isAbsolute(rel))throw new Error('Database must stay inside the finance-product workspace');
mkdirSync(resolve(path,'..'),{recursive:true,mode:0o700});const realParent=realpathSync(resolve(path,'..')),parentRel=relative(realpathSync(workspace),realParent);if(parentRel.startsWith('..')||isAbsolute(parentRel))throw new Error('Database directory must stay inside this workspace');
const port=Number(process.env.PORT||4174);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('PORT must be 1024–65535');
mkdirSync(resolve(root,"data"),{recursive:true,mode:0o700});chmodSync(resolve(root,"data"),0o700);
await buildApp();const {server}=startServer({path,port});let stopping=false;for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{if(stopping)return;stopping=true;server.close(()=>process.exit(0));});
server.on('error',e=>{console.error('Local server could not start: '+e.code+'. Check the port and run this command in normal Terminal.');process.exitCode=1;});
