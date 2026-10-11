// SPDX-License-Identifier: MPL-2.0
import {commandFor,routeFor} from '../services/application.ts';
import type {ApplicationService} from '../services/application.ts';
import {nativeMessage} from './desktop.mjs';
import {startupStage} from './startup.mjs';
let token='';
let access='';
function privateAccess(){
 const launch=new URLSearchParams(location.hash.slice(1)).get('access');
 if(launch&&/^[a-f0-9]{64}$/.test(launch)){access=launch;try{sessionStorage.setItem('odaraia.local-session',access);}catch{}}
 if(!access)try{access=sessionStorage.getItem('odaraia.local-session')||'';}catch{}
 return access?{'X-Odaraia-Access':access}:{};
}
async function httpRequest(path: string, method='GET', body?: unknown): Promise<any> {
 const authorization=privateAccess();
 if(!token){
  startupStage('SESSION_REQUESTED');let failure='SESSION_NETWORK';
  try{
   const r=await fetch('/api/session',{cache:'no-store',headers:authorization});
   if(!r.ok){failure='SESSION_HTTP';throw new Error('Open the private startup link printed in Terminal, or launch the Odaraia Mac app.');}
   failure='SESSION_RESPONSE';const session=await r.json();
   if(typeof session.token!=='string'||!session.token)throw new Error('The local session response was invalid.');
   token=session.token;startupStage('SESSION_ESTABLISHED');
   if(location.hash)history.replaceState({},'',location.pathname+location.search);
  }catch(error){startupStage('SESSION_FAILED',failure);throw error;}
 }
 const stateRequest=path==='/state'&&method==='GET';
 if(stateRequest)startupStage('STATE_FETCH_STARTED');
 let failure='STATE_NETWORK';
 try{
  const r=await fetch('/api'+path,{method,cache:'no-store',headers:{...authorization,'X-Talarurus-Session':token,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  failure=r.ok?'STATE_RESPONSE':'STATE_HTTP';
  const data=await r.json();if(!r.ok)throw new Error(data.error||'Request failed');
  if(stateRequest)startupStage('STATE_FETCHED');return data;
 }catch(error){if(stateRequest)startupStage('STATE_FETCH_FAILED',failure);throw error;}
}
export async function download(path: string, filename: string, csv=false) {const data=await api(path),text=csv?data.csv:JSON.stringify(data);if(platformExport){await platformExport({filename,text,csv});return;}if((window as any).__ODARAIA_NATIVE__){nativeMessage('export',{filename,text,csv});return;}const blob=new Blob([text],{type:csv?'text/csv;charset=utf-8':'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

const httpService:ApplicationService={execute(command){const route=routeFor(command);return httpRequest(route.path,route.method,route.body);}};
let service:ApplicationService=httpService;
let defaultService:ApplicationService=httpService;
let platformExport:((file:{filename:string;text:string;csv:boolean})=>Promise<void>)|undefined;
let privateBackup=true;
export function supportsPrivateBackup(){return privateBackup;}
// Trusted platform entry point only. Ending a demo returns to its own durable
// adapter, rather than accidentally falling back to localhost HTTP.
export function configureApplicationService(value:ApplicationService,options:{exportFile?:typeof platformExport;privateBackup?:boolean}={}){defaultService=value;service=value;platformExport=options.exportFile;privateBackup=options.privateBackup!==false;}
// Installed by the trusted app entry point, never by URL flags or web messages.
export function useApplicationService(value:ApplicationService|null){service=value||defaultService;}
export async function api(path:string,method='GET',body?:unknown):Promise<any>{return service.execute(commandFor(path,method,body));}
