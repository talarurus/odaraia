// SPDX-License-Identifier: MPL-2.0
// Real browser captures of the bundled Tauri frontend, using the actual Rust
// contract process against disposable synthetic profiles. This is not a native
// WebView/window test. No production capabilities or transport are changed.
import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {MemoryRepository} from '../storage/memory.ts';
import {PortableDataService} from '../services/portability.ts';
import {hash} from '../server/importer.ts';
import {loadCanonical} from '../tests/canonical-fixture.mjs';
import {processTransport} from '../storage/native-sqlite/transport.mjs';
import {createAsyncNativeService} from '../storage/async-native.ts';
const root=resolve(import.meta.dirname,'../..'),out=join(root,'app/artifacts/v031/screenshots');
await mkdir(out,{recursive:true});
const result={status:'BLOCKED',scope:'Browser pixels of real Tauri bundle + Rust process contract; native WebView acceptance separate',assertions:0,launches:[],screenshots:[],errors:[],unavailable:[]};
let browser,temporary;const servers=[],contexts=[];
async function check(fn){await fn();result.assertions++;}
async function serve(folder){
 const server=createServer(async(req,res)=>{try{const path=resolve(folder,'.'+new URL(req.url,'http://local').pathname);if(path!==folder&&!path.startsWith(folder+sep)){res.writeHead(403).end();return;}const file=path===folder||req.url==='/'?join(folder,'index.html'):path;res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});servers.push(server);return 'http://127.0.0.1:'+server.address().port;
}
const memory=new MemoryRepository();loadCanonical(memory);const backup=new PortableDataService(memory,hash).backup();memory.close();
async function session(origin,{empty=false,theme='light',dismissed=false,collapsed=false}={}){
 const profile=await mkdtemp(join(temporary,'profile-')),transport=processTransport(join(profile,'synthetic.sqlite'),{binary:join(root,'app/artifacts/tauri-validation/store-contract')});
 const service=createAsyncNativeService(transport);if(!empty)await service.execute({name:'backup.restore',input:{backup,confirmEmpty:true}});
 const context=await browser.newContext({viewport:{width:1320,height:900},reducedMotion:'reduce',colorScheme:theme});contexts.push(context);
 await context.exposeBinding('__reviewInvoke',async(_source,command,args)=>{
  if(command==='store_read')return transport.read();if(command==='store_commit')return transport.commit(args.expected,args.data);
  if(command==='export_file'){result.exports=(result.exports||[]).concat({filename:args.file.filename,bytes:args.file.text.length});return {ok:true};}throw Error('Unexpected test capability');
 });
 await context.addInitScript(({theme,dismissed,collapsed})=>{
  if(!localStorage.getItem('design-review-initialized')){localStorage.setItem('talarurus.appearance',theme);localStorage.setItem('talarurus.presentation',JSON.stringify({hidden:false,format:'symbol',reduceMotion:true}));if(dismissed)localStorage.setItem('odaraia.onboarding','dismissed-v1');localStorage.setItem('odaraia.sidebar.collapsed',String(collapsed));localStorage.setItem('design-review-initialized','true');}
  window.__TAURI__={core:{invoke:(command,args)=>window.__reviewInvoke(command,args)}};
 },{theme,dismissed,collapsed});
 const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
 async function open(id='dashboard',section='appearance'){
  await page.goto(origin+'/?page='+id+'&section='+section);await page.locator('.page-content').waitFor();await page.getByText('Loading saved data…',{exact:true}).waitFor({state:'hidden'});
  if(await page.getByLabel('Report month',{exact:true}).count())await page.getByLabel('Report month',{exact:true}).fill('2026-09');
 }
 await open();return {page,open,service,transport,context};
}
async function screenshot(page,name){
 await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 await check(async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow: '+name));
 const path=join(out,name+'.png');await page.screenshot({path,fullPage:true});result.screenshots.push({name,path});
}
try{
 for(const [name,engine,options] of [['Chrome',chromium,{executablePath:process.env.CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}],['Chromium',chromium,{}],['WebKit',webkit,{}]]){
  try{browser=await engine.launch({headless:true,timeout:10000,...options});result.launches.push({name,status:'PASS',version:browser.version()});break;}catch(e){result.launches.push({name,status:'BLOCKED',reason:e.message.slice(0,600)+'\n…\n'+e.message.slice(-1700)});}
 }
 if(!browser)throw Error('All browser engines aborted before rendering. No screenshots or interaction assertions executed.');
 temporary=await mkdtemp(join(tmpdir(),'odaraia-design-'));
 const origins={after:await serve(join(root,'experiments/tauri-desktop/dist'))};
 for(const [version,origin] of Object.entries(origins))for(const theme of ['light','dark']){
  const {page,open,context}=await session(origin,{theme});
  for(const id of ['dashboard','accounts','transactions','spending','cashflow','networth','budgets','import','settings']){await open(id);await screenshot(page,version+'-'+theme+'-'+id);}
  if(version==='after'){
   await open('settings','display');await screenshot(page,version+'-'+theme+'-privacy');
   await open('settings','recovery');await screenshot(page,version+'-'+theme+'-recovery');
   await open('dashboard');await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();await screenshot(page,version+'-'+theme+'-collapsed');
   await check(async()=>assert.equal(await page.locator('.finance-shell').getAttribute('data-sidebar'),'collapsed'));
  }else result.unavailable.push(version+'-'+theme+'-collapsed: baseline has no sidebar collapse');
  await page.setViewportSize({width:390,height:844});await open('dashboard');await screenshot(page,version+'-'+theme+'-mobile');
  await context.close();
  const first=await session(origin,{theme,empty:true});await screenshot(first.page,version+'-'+theme+'-onboarding');await first.open('settings');await screenshot(first.page,version+'-'+theme+'-empty-settings');await first.open();
  await first.page.getByRole('button',{name:'Skip guide',exact:true}).click();await first.page.reload();await first.page.locator('.page-content').waitFor();await screenshot(first.page,version+'-'+theme+'-empty');await first.context.close();
 }
 const {page,open,service,transport,context}=await session(origins.after,{empty:true});
 await page.getByRole('button',{name:'Skip guide',exact:true}).click();await page.reload();await check(async()=>assert.equal(await page.locator('#getting-started-title').count(),0));
 await page.getByRole('button',{name:'Settings',exact:true}).first().click();await check(async()=>{assert.equal(await page.locator('#getting-started-title').count(),0);assert.equal(await page.evaluate(()=>scrollY),0);});
 await page.getByRole('button',{name:'About Odaraia',exact:true}).click();await page.getByRole('button',{name:'Open getting started guide',exact:true}).click();await page.getByRole('button',{name:'Add account',exact:true}).click();
 await check(async()=>assert(await page.getByRole('dialog').isVisible()));await screenshot(page,'after-account-modal');
 await page.getByLabel('Account name',{exact:true}).fill('Fictional Checking');await page.getByLabel('Opening balance date',{exact:true}).fill('2026-08-31');await page.getByLabel('Opening balance',{exact:true}).fill('1250.00');await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await check(async()=>{assert.equal((await service.execute({name:'state.read'})).accounts.length,1);assert.equal(await page.locator('#getting-started-title').count(),0);});
 await page.keyboard.press('Control+n');await page.getByRole('dialog').waitFor();await page.getByLabel('Transaction date',{exact:true}).fill('2026-09-01');await page.getByLabel('Transaction amount',{exact:true}).fill('0.99');await page.getByLabel('Merchant/payee',{exact:true}).fill('Fictional refund');await page.getByLabel('Transaction classification',{exact:true}).selectOption('expense');await page.getByLabel('Transaction category',{exact:true}).fill('Groceries');await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await check(async()=>assert.equal((await service.execute({name:'reports.read',input:{end:'2026-10-01'}})).netWorth,'125099'));
 await page.reload();await page.getByTestId('dashboard-total').waitFor();await check(async()=>assert.equal(await page.getByTestId('dashboard-total').textContent(),'$1,250.99'));
 await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await page.getByRole('button',{name:'Settings',exact:true}).first().click();await check(async()=>{assert.equal(await page.evaluate(()=>scrollY),0);assert.equal(await page.locator('#getting-started-title').count(),0);});await page.getByRole('button',{name:'Display & privacy',exact:true}).click();await check(async()=>assert.equal(await page.locator('#settings-recovery').count(),0));
 await page.getByRole('button',{name:'Appearance',exact:true}).click();await page.getByRole('radio',{name:'Dark Always use the dark theme.',exact:true}).check();await check(async()=>assert.equal(await page.locator('html').getAttribute('data-theme'),'dark'));
 await page.getByRole('button',{name:'About Odaraia',exact:true}).click();const saved=await transport.read();await page.getByRole('button',{name:'Explore synthetic demo',exact:true}).click();await page.getByRole('button',{name:'Exit demo',exact:true}).waitFor();await page.getByRole('button',{name:'Exit demo',exact:true}).click();await page.getByTestId('dashboard-total').waitFor();await check(async()=>assert.deepEqual(await transport.read(),saved));
 await page.keyboard.press('Control+b');await check(async()=>assert.equal(await page.locator('.finance-shell').getAttribute('data-sidebar'),'collapsed'));await page.reload();await page.getByTestId('dashboard-total').waitFor();await check(async()=>assert.equal(await page.locator('.finance-shell').getAttribute('data-sidebar'),'collapsed'));
 for(const id of ['accounts','transactions','cashflow','spending','networth','budgets','import','settings']){await open(id);await check(async()=>{assert.equal(await page.locator('.finance-shell').getAttribute('data-page'),id);assert.equal(await page.evaluate(()=>scrollY),0);});}
 await page.keyboard.press('Tab');await check(async()=>assert(await page.evaluate(()=>document.activeElement!==document.body)));
 for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});await open('dashboard');await screenshot(page,'after-resize-'+width);}
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'More',exact:true}).click();await check(async()=>assert(await page.getByRole('dialog').isVisible()));await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.addScriptTag({content:await readFile(join(root,'app/node_modules/axe-core/axe.min.js'),'utf8')});result.accessibility=await page.evaluate(async()=>{const r=await window.axe.run();return r.violations.filter(v=>['critical','serious'].includes(v.impact)).map(v=>({id:v.id,count:v.nodes.length}));});await check(()=>assert.deepEqual(result.accessibility,[]));
 await check(()=>assert.deepEqual(result.errors,[]));await context.close();result.status='PASS';
}catch(e){result.errors.push(e.message);result.status=result.assertions?'FAIL':'BLOCKED';}
finally{
 for(const context of contexts)await context.close().catch(()=>{});await browser?.close();for(const server of servers)await new Promise(yes=>server.close(yes));if(temporary)await rm(temporary,{recursive:true,force:true});
 await writeFile(join(out,'browser-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='PASS'?0:result.status==='BLOCKED'?2:1;
}
