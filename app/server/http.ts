// SPDX-License-Identifier: MPL-2.0
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {Repository} from '../db/repository.ts';
import {createAPI} from './api.ts';
import {productIdentity,publicAssets} from '../product-identity.mjs';
import {authorizedLocalRequest} from './local-security.ts';
export function startServer({path,port=4174,accessToken=randomBytes(32).toString('hex'),quiet=false,staticDirectory=fileURLToPath(new URL('../dist/',import.meta.url)),assets=publicAssets}: {path:string;port?:number;accessToken?:string;quiet?:boolean;staticDirectory?:string;assets?:typeof publicAssets}) {
 process.umask(0o077);
 if(!/^[a-f0-9]{64}$/.test(accessToken))throw new Error('Local access requires a random 256-bit hexadecimal launch token');
 const repo=new Repository(path);let origin='',handle:ReturnType<typeof createAPI>;let readyResolve:(value:{origin:string})=>void,readyReject:(reason:unknown)=>void;const ready=new Promise<{origin:string}>((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});ready.catch(()=>{});
 const server=createServer(async(req,res)=>{
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
  try{
   if(req.headers.host!==new URL(origin).host){res.writeHead(403,headers).end('Unrecognized local host');return;}
   const url=new URL(req.url||'/',origin);
   if(url.pathname.startsWith('/api/')){
    // Reject foreign requests before buffering their bodies. No CORS grants.
    if(req.headers.origin&&req.headers.origin!==origin){res.writeHead(403,headers).end('Cross-origin request denied');return;}
    const boundary=new Request(url,{method:req.method,headers:req.headers as any});
    if(!authorizedLocalRequest(boundary,accessToken)){res.writeHead(403,headers).end('Private local session required');return;}
    let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;if(size>16*1024*1024){res.writeHead(413,headers).end('Request too large');return;}chunks.push(chunk);}
    const request=new Request(url,{method:req.method,headers:req.headers as any,...(req.method==='GET'||req.method==='HEAD'?{}:{body:Buffer.concat(chunks)})});
    const response=await handle(request);res.writeHead(response.status,{...headers,...Object.fromEntries(response.headers)});res.end(await response.text());return;
   }
   const files:Record<string,[string,string]>={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/app.css':['app.css','text/css'],'/appearance.js':['appearance.js','text/javascript'],...Object.fromEntries(assets.map(a=>[a.url,['assets/'+a.file,a.type]]))};const file=Object.hasOwn(files,url.pathname)?files[url.pathname]:undefined;if(!file||req.method!=='GET'){res.writeHead(404,headers).end('Not found');return;}res.writeHead(200,{...headers,'Content-Type':file[1]});res.end(readFileSync(resolve(staticDirectory,file[0])));
  }catch{if(!res.headersSent)res.writeHead(500,headers);res.end('Local operation failed');}
 });
 server.requestTimeout=30000;server.headersTimeout=10000;
 server.on('error',error=>{repo.close();readyReject(error);});server.on('close',()=>{try{repo.close();}catch{}});
 server.listen(port,'127.0.0.1',()=>{const address=server.address();if(!address||typeof address==='string')return;origin=`http://127.0.0.1:${address.port}`;handle=createAPI(repo,origin,accessToken);readyResolve({origin});if(!quiet)console.log(`${productIdentity.name}: ${origin}/#access=${accessToken}\nDatabase: ${path}\nPrivate startup link; do not share. Press Ctrl-C to stop.`);});return {server,repo,ready};
}
