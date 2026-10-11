// SPDX-License-Identifier: MPL-2.0
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {root,buildVisual} from './build.mjs';
if(!process.argv.includes('--built'))await buildVisual();
const publicRoot=resolve(root,'visual/dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.map':'application/json'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');const requested=decodeURIComponent(url.pathname);
  let path=resolve(publicRoot,'.'+requested);
  if(path!==publicRoot&&!path.startsWith(publicRoot+sep)){res.writeHead(403).end();return;}
  if(path===publicRoot)path=resolve(publicRoot,'index.html');
  try{if(!(await stat(path)).isFile())throw new Error('Not file');}catch{if(extname(path)){res.writeHead(404).end();return;}path=resolve(publicRoot,'index.html');}
  res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(await readFile(path));
 }catch{res.writeHead(400).end('Invalid request');}
});
server.listen(4173,'127.0.0.1',()=>console.log('Synthetic prototype: http://127.0.0.1:4173 — loopback only, no banking or authentication.'));
server.on('error',error=>{console.error(`Local preview unavailable: ${error.code}. Open visual/dist/offline.html directly instead.`);process.exitCode=1;});
process.on('SIGTERM',()=>server.close());
