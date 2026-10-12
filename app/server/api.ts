// SPDX-License-Identifier: MPL-2.0
import {Portability} from './portability.ts';
import {Importer} from './importer.ts';
import {randomBytes} from 'node:crypto';
import {Repository} from '../db/repository.ts';
import {createApplicationService,commandFor} from '../services/application.ts';
import {InputError,check,object} from '../domain/validation.ts';
import {authorizedLocalRequest,accessCookie,hasAccess} from './local-security.ts';
export function createAPI(repo: Repository, origin='http://127.0.0.1:4174',accessToken?:string) {
 const service=createApplicationService(repo,{importer:new Importer(repo),portability:new Portability(repo)});
 const token=randomBytes(32).toString('hex');
 const json=(data: unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 return async function handle(request: Request): Promise<Response> {
  try {
   const url=new URL(request.url);
   check(request.headers.get('host')===new URL(origin).host,'Unrecognized local host');
   check(!request.headers.has('origin')||request.headers.get('origin')===origin,'Cross-origin request denied');
   if(!authorizedLocalRequest(request,accessToken))return json({error:'Open plainbalance from its private startup link or Mac application.'},403);
   const path=url.pathname, method=request.method;
   if(path==='/api/session' && method==='GET'){
    const response=json({token});
    // Only the hermetic native WebKit host uses cookies. Browser authentication
    // uses origin/port-scoped tab storage, so another loopback server never gets it.
    if(accessToken&&hasAccess(request.headers,accessToken))response.headers.set('Set-Cookie',`${accessCookie}=${accessToken}; HttpOnly; SameSite=Strict; Path=/`);
    return response;
   }
   check(request.headers.get('x-talarurus-session')===token,'Local session required');
   let body: any;
   if(method!=='GET'){
    check(request.headers.get('origin')===origin,'Same-origin request required');
    check(request.headers.get('content-type')?.split(';')[0]==='application/json','Expected JSON content type');
    const raw=await request.text();check(Buffer.byteLength(raw)<=16*1024*1024,'Request size limit exceeded');
    try {body=object(JSON.parse(raw));}catch(e){if(e instanceof InputError)throw e;throw new InputError('Malformed JSON');}
   }
   const command=commandFor(path.replace(/^\/api/,'')+url.search,method,body);
   const result=await service.execute(command);
   return json(result,['accounts.create','transactions.create','transfers.create'].includes(command.name)?201:200);
  } catch(e) {
   if(e instanceof InputError)return json({error:e.message},e.status);
   // Never log request bodies, SQL parameters, or financial records.
   return json({error:'Operation failed. No partial changes were saved. Reload and retry.'},500);
  }
 };
}
