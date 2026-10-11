// SPDX-License-Identifier: MPL-2.0
// Genuine visual checks against an isolated synthetic database. Never reads app/data.
import {chromium,firefox,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {Repository} from '../db/repository.ts';
import {loadCanonical} from '../tests/canonical-fixture.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const artifacts=resolve(root,'artifacts/ui-polish');await mkdir(artifacts,{recursive:true});process.env.TMPDIR=artifacts;
const result={status:'BLOCKED',assertionsExecuted:0,launches:[],screenshots:[],errors:[]};
let browser,server,context,launchAccess='';
async function check(fn){await fn();result.assertionsExecuted++;}
try {
 for(const [name,engine,options] of [['Chrome',chromium,{executablePath:process.env.CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',chromiumSandbox:true}],['Firefox',firefox,{}],['WebKit',webkit,{}]]) {
  try {const instance=await engine.launch({headless:true,timeout:10000,...options});result.launches.push({name,status:'PASS',version:instance.version()});if(!browser)browser=instance;else await instance.close();}
  catch(e){result.launches.push({name,status:'BLOCKED',reason:String(e.message).slice(0,600)+'\n…\n'+String(e.message).slice(-2000)});}
 }
 if(!browser)throw new Error('Browsers could not launch; no screenshots or browser assertions executed.');
 const dbPath=resolve(artifacts,'visual-'+Date.now()+'.sqlite'),db=new Repository(dbPath);
 try{loadCanonical(db);db.setBudget({month:'2026-09',category:'Housing',planned:'100000'});db.setBudget({month:'2026-09',category:'Dining',planned:'2000'});}finally{db.close();}
 server=spawn(process.execPath,['scripts/start.mjs'],{cwd:root,env:{...process.env,PORT:'4176',FINANCE_DB:dbPath},stdio:['ignore','pipe','pipe']});
 await new Promise((done,fail)=>{let log='';const timeout=setTimeout(()=>fail(new Error('Server startup timed out')),15000);server.stderr.on('data',b=>log+=b);server.stdout.on('data',b=>{log+=b;if(log.includes('Press Ctrl-C')){launchAccess=log.match(/#access=([a-f0-9]{64})/)?.[1]||'';clearTimeout(timeout);done();}});server.once('exit',()=>{clearTimeout(timeout);fail(new Error(log));});});
 context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function open(id){await page.goto('http://127.0.0.1:4176/?page='+id+'#access='+launchAccess);await page.locator('.page-content').waitFor();await page.getByText('Loading saved data…',{exact:true}).waitFor({state:'hidden'});if(!['accounts','import','settings'].includes(id))await page.getByLabel('Report month',{exact:true}).fill('2026-09');}
 async function screenshot(name){await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));await check(async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Document overflow: '+name));const path=resolve(artifacts,name+'.png');await page.screenshot({path,fullPage:true});result.screenshots.push(path);}
 for(const theme of ['light','dark']) {
  await open('settings');await page.getByRole('radio',{name:theme==='light'?'Light Always use the light theme.':'Dark Always use the dark theme.'}).check();
  await check(async()=>assert.equal(await page.locator('html').getAttribute('data-theme'),theme));
  for(const width of [1440,1024,820,390,320]) {
   await page.setViewportSize({width,height:1000});
   for(const id of ['cashflow','spending','transactions','networth','accounts','budgets','settings','import']) {
    await open(id);
    if(id==='import') {await page.getByLabel('CSV file',{exact:true}).setInputFiles(resolve(root,'fixtures/sample-checking.csv'));await screenshot(`${theme}-${width}-import-mapping`);await page.getByRole('button',{name:'Preview transactions',exact:true}).click();await page.getByRole('heading',{name:'Review before saving'}).waitFor();}
    await screenshot(`${theme}-${width}-${id}`);
    if(id==='transactions') {await page.getByLabel('Search transactions').fill('Paper Birch');await check(async()=>assert.equal(await page.getByTestId('transaction-count').textContent(),'2 transactions'));await page.getByRole('button',{name:'Clear filters (1)',exact:true}).click();}
    if(id==='accounts') {await page.getByRole('button',{name:'Create account',exact:true}).click();await screenshot(`${theme}-${width}-account-form`);await page.keyboard.press('Escape');await check(async()=>assert(await page.getByRole('button',{name:'Create account',exact:true}).evaluate(e=>e===document.activeElement)));}
   }
  }
 }
 await check(()=>assert.deepEqual(errors,[]));
 // Keyboard chart interaction, masking and the mobile navigation sheet.
 await page.setViewportSize({width:1440,height:1000});await open('cashflow');const node=page.locator('.desktop-only .flow-label').first();await node.focus();await page.keyboard.press('Enter');await check(async()=>{await page.getByRole('heading',{name:'Transactions',exact:true}).waitFor();});
 await open('settings');await page.getByRole('button',{name:'Display & privacy',exact:true}).click();await page.getByRole('checkbox',{name:/Hide financial amounts/}).check();await open('spending');await check(async()=>assert.equal(await page.locator('.recharts-responsive-container').count(),0));await open('settings');await page.getByRole('button',{name:'Display & privacy',exact:true}).click();await page.getByRole('checkbox',{name:/Hide financial amounts/}).uncheck();
 await page.setViewportSize({width:390,height:844});await open('budgets');await check(async()=>assert.equal(await page.getByRole('button',{name:'More',exact:true}).getAttribute('aria-current'),'page'));await page.getByRole('button',{name:'More',exact:true}).click();await page.keyboard.press('Escape');
 result.status='PASS';
}catch(e){result.errors.push(String(e.message).slice(0,6000));result.status=result.assertionsExecuted?'FAIL':'BLOCKED';}
finally{await context?.close();await browser?.close();if(server?.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}await writeFile(resolve(artifacts,'visual-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,assertionsExecuted:result.assertionsExecuted,screenshots:result.screenshots.length,launches:result.launches.map(({name,status})=>({name,status})),errors:result.errors},null,2));process.exitCode=result.status==='PASS'?0:result.status==='BLOCKED'?2:1;}
