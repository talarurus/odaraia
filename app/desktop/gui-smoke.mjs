// SPDX-License-Identifier: MPL-2.0
// Normal LaunchServices launches; isolated synthetic storage, close/reopen and Cmd-Q path.
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {bundleFingerprint} from './bundle-fingerprint.mjs';
const experimentalGlass=process.argv.includes('--experimental-desktop-glass');
const root=fileURLToPath(new URL('../',import.meta.url)),out=process.argv.includes('--readiness')?resolve(root,'artifacts/readiness/mac'):resolve(root,'artifacts/odaraia',experimentalGlass?'monocode/native':'native'),app=join(out,'plainbalance.app'),directory=join(out,'gui-smoke-'+Date.now());await mkdir(directory,{recursive:true,mode:0o700});
const resources=join(app,'Contents/Resources'),node=join(resources,'runtime/node');
const result={status:'PENDING',launch:'PENDING',workspace:'PENDING',shutdown:'PENDING',directory,runs:[],visualAcceptance:'MANUAL_REVIEW_REQUIRED'};
const pause=ms=>new Promise(done=>setTimeout(done,ms));
function alive(pid){try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}}
try{
 execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',app],{stdio:'pipe'});result.bundleFingerprint=bundleFingerprint(app);
 execFileSync(node,[join(root,'desktop/seed-review.mjs'),directory],{stdio:'pipe',env:{PATH:'/usr/bin:/bin'}});
 const expected=JSON.parse(await readFile(join(directory,'expected-state.json'),'utf8'));
 for(const close of [true,false]){
  let previous=[];try{previous=(await readFile(join(directory,'native-events.jsonl'),'utf8')).trim().split('\n').filter(Boolean);}catch{}
  execFileSync('/usr/bin/open',['-n','-a',app,'--args','--smoke-test',directory,'--smoke-exit',...(close?['--smoke-close']:[]),...(experimentalGlass?['--experimental-desktop-glass']:[])],{stdio:'pipe'});
  const deadline=Date.now()+35000;let events=[];
  while(Date.now()<deadline){try{events=(await readFile(join(directory,'native-events.jsonl'),'utf8')).trim().split('\n').filter(Boolean).slice(previous.length).map(JSON.parse);}catch{}
   if(events.some(e=>['STARTUP_FAILED','BACKEND_LAUNCH_FAILED','BACKEND_TIMEOUT','BACKEND_EXITED','WEB_LOAD_FAILED','WEB_PROCESS_EXITED'].includes(e.status)))throw new Error('Native startup failed: '+JSON.stringify(events.at(-1)));
   if(events.some(e=>e.status==='STOPPED'))break;await pause(250);
  }
  const workspace=events.find(e=>e.status==='WORKSPACE_READY');assert(workspace?.windowVisible,'Native window and loaded workspace not observed');assert(events.some(e=>e.status==='STOPPED'),'No clean termination event');
  const backend=events.find(e=>e.status==='BACKEND_READY'&&e.backendPID>0);assert(backend,'No backend identity recorded');
  // STOPPED is recorded inside applicationWillTerminate, just before the process exits.
  for(let i=0;i<40&&(alive(workspace.pid)||alive(backend.backendPID));i++)await pause(100);
  assert(!alive(workspace.pid),'Native process remains');assert(!alive(backend.backendPID),'Backend process remains');
  let listening=false;try{await fetch(backend.backendOrigin,{signal:AbortSignal.timeout(1000)});listening=true;}catch{}assert(!listening,'Backend port remains occupied');
  const state=JSON.parse(execFileSync(node,['--input-type=module','-e',`import {Repository} from ${JSON.stringify(pathToFileURL(join(resources,'backend/db/repository.ts')).href)};const r=new Repository(${JSON.stringify(join(directory,'finance.sqlite'))});console.log(JSON.stringify(r.state()));r.close();`],{encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{PATH:'/usr/bin:/bin'}}));assert.deepEqual(state,expected,'Native restart changed fixture state');
  result.runs.push({action:close?'close-last-window':'quit',status:'PASS',nativePID:workspace.pid,backendPID:backend.backendPID,windowVisible:true,workspaceLoaded:true,persistence:'PASS',backendExited:true,portClosed:true});
 }
 result.status='PASS';result.launch='PASS';result.workspace='PASS';result.shutdown='PASS';
}catch(error){result.status=/kLSNoExecutableErr|EPERM|EACCES|not permitted/i.test(error.stderr?.toString()||error.message)?'BLOCKED':'FAIL';result.reason=error.stderr?.toString()||error.message;for(const field of ['launch','workspace','shutdown'])if(result[field]==='PENDING')result[field]=result.status==='BLOCKED'?'BLOCKED':'NOT_EXECUTED';}
await writeFile(join(out,'gui-smoke-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='PASS'?0:result.status==='BLOCKED'?2:1;
