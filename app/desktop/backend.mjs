// SPDX-License-Identifier: MPL-2.0
// Launched only by the native host. Bundled Node, original SQLite/repository and migrations.
import {startServer} from '../server/http.ts';
import {desktopDataDirectory,prepareDesktopStorage} from './storage.mjs';
const directory=desktopDataDirectory({override:process.env.ODARAIA_TEST_SUPPORT});
process.umask(0o077);
const path=prepareDesktopStorage(directory);
const accessToken=process.env.ODARAIA_DESKTOP_TOKEN;
delete process.env.ODARAIA_DESKTOP_TOKEN;
if(!accessToken||!/^[a-f0-9]{64}$/.test(accessToken))throw new Error('Native launch authorization is required');
const parent=Number(process.env.ODARAIA_PARENT_PID);
if(!Number.isInteger(parent)||parent<1)throw new Error('Native parent process is required');
const {server,ready}=startServer({path,port:0,accessToken,quiet:true});
let stopping=false;
function stop(){if(stopping)return;stopping=true;clearInterval(parentWatch);server.close(()=>process.exit(0));server.closeIdleConnections();setTimeout(()=>{server.closeAllConnections();},2000).unref();}
const parentWatch=setInterval(()=>{try{process.kill(parent,0);}catch{stop();}},2000);parentWatch.unref();
process.stdin.resume();process.stdin.on('end',stop);
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,stop);
try{const {origin}=await ready;process.stdout.write(JSON.stringify({type:'ready',origin,pid:process.pid})+'\n');}
catch(error){process.stderr.write('plainbalance backend could not start: '+error.code+'. Data was not deleted.\n');process.exitCode=1;process.stdin.pause();}
