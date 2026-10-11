// SPDX-License-Identifier: MPL-2.0
import {check,date,identifier,keys,object,InputError} from '../domain/validation.ts';
import type {Ledger} from './ledger.ts';

export type CommandName='state.read'|'reports.read'|'accounts.create'|'accounts.update'|'transactions.create'|'transactions.update'|'transactions.void'|'transactions.undo'|'transfers.create'|'transfers.update'|'transfers.link'|'budgets.set'|'imports.inspect'|'imports.preview'|'imports.commit'|'backup.read'|'backup.private'|'backup.validate'|'backup.restore'|'export.csv';
export interface Command {name:CommandName;id?:string;input?:unknown}
export interface ApplicationService {execute(command:Command):Promise<any>}
const routes: [string,string,CommandName][]=[
 ['GET','/state','state.read'],['GET','/reports','reports.read'],['POST','/accounts','accounts.create'],
 ['POST','/transactions','transactions.create'],['POST','/transfers','transfers.create'],['POST','/transfers/link','transfers.link'],['POST','/budgets','budgets.set'],
 ['POST','/import/inspect','imports.inspect'],['POST','/import/preview','imports.preview'],['POST','/import/commit','imports.commit'],
 ['GET','/backup','backup.read'],['POST','/backup/private','backup.private'],['POST','/restore/validate','backup.validate'],['POST','/restore','backup.restore'],['GET','/export','export.csv']
];
const entityRoutes: [string,RegExp,CommandName][]=[
 ['PATCH',/^\/accounts\/([\w-]+)$/,'accounts.update'],['PATCH',/^\/transactions\/([\w-]+)$/,'transactions.update'],
 ['POST',/^\/transactions\/([\w-]+)\/void$/,'transactions.void'],['POST',/^\/transactions\/([\w-]+)\/undo$/,'transactions.undo'],['PATCH',/^\/transfers\/([\w-]+)$/,'transfers.update']
];
function unknown():never{const error=new InputError('Unknown application operation');error.status=404;throw error;}
// Compatibility translation for the existing UI/localhost transport. Adapters use
// named, capability-scoped commands; no filesystem paths or SQL commands exist.
export function commandFor(path:string,method='GET',input?:unknown):Command {
 const [pathname,query]=path.split('?');
 if(query&&!(pathname==='/reports'&&method==='GET'))unknown();
 const fixed=routes.find(([m,p])=>method===m&&pathname===p);
 if(fixed)return {name:fixed[2],...(fixed[2]==='reports.read'?{input:Object.fromEntries(new URLSearchParams(query))}:input===undefined?{}:{input})};
 for(const [m,pattern,name] of entityRoutes){const match=pathname.match(pattern);if(method===m&&match)return {name,id:match[1],input};}
 return unknown();
}
export function routeFor(command:Command):{path:string;method:string;body?:unknown} {
 const fixed=routes.find(r=>r[2]===command.name);
 if(fixed)return {method:fixed[0],path:fixed[1]+(command.name==='reports.read'?'?'+new URLSearchParams(command.input as Record<string,string>).toString():''),...(command.name==='reports.read'||command.input===undefined?{}:{body:command.input})};
 const id=identifier(command.id);
 const path=command.name==='accounts.update'?'/accounts/'+id:command.name==='transactions.update'?'/transactions/'+id:command.name==='transfers.update'?'/transfers/'+id:command.name==='transactions.void'?'/transactions/'+id+'/void':command.name==='transactions.undo'?'/transactions/'+id+'/undo':unknown();
 return {path,method:command.name==='transactions.void'||command.name==='transactions.undo'?'POST':'PATCH',body:command.input};
}
export function createApplicationService(repo:Ledger,integrations:{importer?:any;portability?:any}={}):ApplicationService {
 return {async execute(command:Command){
  const c=object(command);keys(c,['name','id','input']);routeFor(command); // reject unknown capabilities before dispatch
  const i=c.input;
  switch(c.name){
   case 'state.read':return repo.state();
   case 'reports.read':{const filters=object(i||{});keys(filters,['start','end','account','category']);if(filters.start)date(filters.start);if(filters.end)date(filters.end);if(filters.account)identifier(filters.account);if(filters.start&&filters.end)check(filters.start<filters.end,'Report end must be after start');return repo.report(filters);}
   case 'accounts.create':return repo.createAccount(i);
   case 'accounts.update':return repo.updateAccount(identifier(c.id),i);
   case 'transactions.create':return repo.createTransaction(i);
   case 'transactions.update':return repo.updateTransaction(identifier(c.id),i);
   case 'transactions.void':case 'transactions.undo':{const value=object(i);keys(value,['revision']);return repo.voidTransaction(identifier(c.id),value.revision,c.name==='transactions.undo');}
   case 'transfers.create':return repo.createTransfer(i);
   case 'transfers.update':return repo.updateTransfer(identifier(c.id),i);
   case 'transfers.link':return repo.linkTransfer(i);
   case 'budgets.set':return repo.setBudget(i);
   case 'imports.inspect':case 'imports.preview':case 'imports.commit':check(integrations.importer,'CSV import is unavailable in this mode');return integrations.importer[c.name.split('.')[1]](i);
   case 'backup.read':case 'backup.private':case 'backup.validate':case 'backup.restore':case 'export.csv':{
    const p=integrations.portability;check(p,'Financial files are unavailable in this mode');
    if(c.name==='backup.read')return p.backup();
    if(c.name==='backup.private')return p.savePrivateBackup();
    if(c.name==='export.csv')return p.exportCSV();
    if(c.name==='backup.restore')return p.restore(i);
    const value=object(i);keys(value,['backup']);const {data,...summary}=p.validate(value.backup);return summary;
   }
   default:return unknown();
  }
 }};
}
