// SPDX-License-Identifier: MPL-2.0
// Genuine Accounts-only screenshots and interaction checks. Uses isolated synthetic records.
import {chromium,firefox,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {Repository} from '../db/repository.ts';
import {loadCanonical} from '../tests/canonical-fixture.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),artifacts=resolve(root,'artifacts/accounts-design');
await mkdir(artifacts,{recursive:true});process.env.TMPDIR=artifacts;
const evidence={status:'BLOCKED',assertionsExecuted:0,launches:[],screenshots:[],errors:[]};
let browser,server,context,launchAccess='';
const base='http://127.0.0.1:4178';
async function check(fn){await fn();evidence.assertionsExecuted++;}
try {
 for(const [name,engine,options] of [['Chrome',chromium,{executablePath:process.env.CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',chromiumSandbox:true}],['Firefox',firefox,{}],['WebKit',webkit,{}]]) {
  try{const instance=await engine.launch({headless:true,timeout:10000,...options});evidence.launches.push({name,status:'PASS',version:instance.version()});if(!browser)browser=instance;else await instance.close();}
  catch(e){evidence.launches.push({name,status:'BLOCKED',reason:String(e.message).slice(0,600)+'\n…\n'+String(e.message).slice(-2200)});}
 }
 if(!browser)throw new Error('BLOCKED: No browser could launch. Zero screenshots and browser assertions.');
 const dbPath=resolve(artifacts,'accounts-'+Date.now()+'.sqlite'),db=new Repository(dbPath);try{loadCanonical(db);}finally{db.close();}
 server=spawn(process.execPath,['scripts/start.mjs'],{cwd:root,env:{...process.env,PORT:'4178',FINANCE_DB:dbPath},stdio:['ignore','pipe','pipe']});
 await new Promise((done,fail)=>{let log='';const timeout=setTimeout(()=>fail(new Error('Server startup timed out')),15000);server.stderr.on('data',b=>log+=b);server.stdout.on('data',b=>{log+=b;if(log.includes('Press Ctrl-C')){launchAccess=log.match(/#access=([a-f0-9]{64})/)?.[1]||'';clearTimeout(timeout);done();}});server.once('exit',()=>{clearTimeout(timeout);fail(new Error(log));});});
 context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 async function open(id='accounts'){await page.goto(base+'/?page='+id+'#access='+launchAccess);await page.locator('.page-content').waitFor();await page.getByText('Loading saved data…',{exact:true}).waitFor({state:'hidden'});}
 async function screenshot(name){await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));await check(async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Document overflow: '+name));const path=resolve(artifacts,name+'.png');await page.screenshot({path,fullPage:true});evidence.screenshots.push(path);}
 await open();await check(async()=>assert.equal(await page.getByTestId('accounts-total').textContent(),'$4,410.00'));await check(async()=>assert.equal(await page.getByTestId('accounts-period-change').textContent(),'+$3,210.00'));
 for(const theme of ['light','dark']) {
  await open('settings');await page.getByRole('radio',{name:theme==='light'?'Light Always use the light theme.':'Dark Always use the dark theme.'}).check();
  await check(async()=>assert.equal(await page.locator('html').getAttribute('data-theme'),theme));
  for(const width of [1440,1024,820,390,320]) {
   await page.setViewportSize({width,height:1000});await open();
   await screenshot(`${theme}-${width}-accounts`);
   for(const range of ['1M','3M','6M','1Y','All']){await page.getByRole('button',{name:range,exact:true}).click();await check(async()=>assert.equal(await page.getByRole('button',{name:range,exact:true}).getAttribute('aria-pressed'),'true'));}
   const slider=page.getByRole('slider',{name:'Net worth history'});await slider.focus();await page.keyboard.press('Home');await check(async()=>assert((await page.getByTestId('accounts-inspection-value').textContent()).includes('$1,200.00')));await page.keyboard.press('ArrowRight');await check(async()=>assert.equal(await slider.getAttribute('aria-valuenow'),'1'));await page.keyboard.press('End');await check(async()=>assert((await page.getByTestId('accounts-inspection-value').textContent()).includes('$4,410.00')));
   const bounds=await slider.boundingBox();await page.mouse.move(bounds.x+18,bounds.y+bounds.height/2);await check(async()=>assert((await page.getByTestId('accounts-inspection-value').textContent()).includes('$1,200.00')));await screenshot(`${theme}-${width}-inspection`);
   await page.getByRole('button',{name:'Return to latest',exact:true}).click();await page.getByRole('button',{name:/Open Harbor Checking,/}).click();await screenshot(`${theme}-${width}-account-details`);await page.keyboard.press('Escape');await check(async()=>assert(await page.getByRole('button',{name:/Open Harbor Checking,/}).evaluate(e=>e===document.activeElement)));
   await page.getByRole('button',{name:'3M',exact:true}).click();await slider.focus();await page.keyboard.press('Home');await check(async()=>assert((await page.getByTestId('accounts-inspection-value').textContent()).includes('Unavailable')));await screenshot(`${theme}-${width}-missing-coverage`);
  }
 }
 // Accounts has its own timeframe and must not inherit an invalid report-period error.
 await page.setViewportSize({width:1440,height:1000});await open('transactions');await page.getByLabel('Period mode',{exact:true}).selectOption('custom');await page.getByLabel('From date',{exact:true}).fill('2020-01-01');await page.getByRole('button',{name:'Accounts',exact:true}).first().click();await check(async()=>assert.equal(await page.getByTestId('accounts-total').textContent(),'$4,410.00'));
 // Account navigation and chained details/edit modal preserve the original invoking focus.
 await page.setViewportSize({width:1440,height:1000});await open();await page.getByRole('button',{name:/Open Harbor Checking,/}).click();await page.getByRole('button',{name:'Edit account',exact:true}).click();await check(async()=>assert.equal(await page.getByLabel('Account name',{exact:true}).inputValue(),'Harbor Checking'));await page.keyboard.press('Escape');await check(async()=>assert(await page.getByRole('button',{name:/Open Harbor Checking,/}).evaluate(e=>e===document.activeElement)));
 await page.getByRole('button',{name:/Open Harbor Checking,/}).click();await page.getByRole('button',{name:'View transactions',exact:true}).click();await check(async()=>assert.equal(await page.getByLabel('Filter account',{exact:true}).inputValue(),'checking'));await check(async()=>assert.equal(await page.getByLabel('Report month',{exact:true}).inputValue(),'2026-09'));await page.getByRole('button',{name:'Back to Accounts',exact:true}).click();
 // System theme responds to media changes; amount masking removes plotted financial values.
 await open('settings');await page.getByRole('radio',{name:'System Follow your device’s appearance.'}).check();for(const scheme of ['dark','light']){await page.emulateMedia({colorScheme:scheme});await check(async()=>assert.equal(await page.locator('html').getAttribute('data-theme'),scheme));await open();await screenshot(`system-${scheme}-1440-accounts`);await open('settings');}
 await page.getByRole('button',{name:'Display & privacy',exact:true}).click();await page.getByRole('checkbox',{name:/Hide financial amounts/}).check();await open();await check(async()=>assert.equal(await page.getByRole('slider').count(),0));await check(async()=>assert(!(await page.locator('.accounts-overview').innerText()).match(/\$[\d,]+/)));await screenshot('masked-1440-accounts');await open('settings');await page.getByRole('button',{name:'Display & privacy',exact:true}).click();await page.getByRole('checkbox',{name:/Hide financial amounts/}).uncheck();await page.getByRole('checkbox',{name:/Reduce Motion/}).check();await open();await check(async()=>assert.equal(await page.getByRole('button',{name:'All',exact:true}).evaluate(e=>getComputedStyle(e).transitionDuration),'0s'));
 await open('settings');await page.getByRole('button',{name:'Display & privacy',exact:true}).click();await page.getByRole('checkbox',{name:/Reduce Motion/}).uncheck();await page.emulateMedia({reducedMotion:'reduce'});await open();await check(async()=>assert.equal(await page.getByRole('button',{name:'All',exact:true}).evaluate(e=>getComputedStyle(e).transitionDuration),'0s'));
 // Genuine touch pointer input in a mobile context, without changing financial values.
 const touchContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),touch=await touchContext.newPage();try{await touch.goto(base+'/?page=accounts#access='+launchAccess);await touch.locator('.accounts-overview').waitFor();const plot=touch.getByRole('slider',{name:'Net worth history'});await plot.scrollIntoViewIfNeeded();const box=await plot.boundingBox();await touch.touchscreen.tap(box.x+18,box.y+box.height/2);await check(async()=>assert((await touch.getByTestId('accounts-inspection-value').textContent()).includes('$1,200.00')));const path=resolve(artifacts,'touch-390-accounts.png');await touch.screenshot({path,fullPage:true});evidence.screenshots.push(path);}finally{await touchContext.close();}
 // Real additional accounts and an unavailable future anchor through the unchanged API.
 const session=await (await context.request.get(base+'/api/session',{headers:{'x-odaraia-access':launchAccess}})).json();async function create(body){const response=await context.request.post(base+'/api/accounts',{headers:{'x-talarurus-session':session.token,'x-odaraia-access':launchAccess,origin:base},data:body});assert.equal(response.status(),201);}
 await create({name:'Synthetic manual holding',type:'asset',anchor:'2026-08-31',opening:'100000'});await create({name:'Synthetic manual debt',type:'liability',anchor:'2026-08-31',opening:'-40000'});await open();await check(async()=>assert.equal(await page.getByTestId('accounts-total').textContent(),'$5,010.00'));await screenshot('manual-groups-1440-accounts');await create({name:'Synthetic future opening',type:'asset',anchor:'9999-01-01',opening:'100000'});await open();await check(async()=>assert.equal(await page.getByTestId('accounts-total').textContent(),'Unavailable'));await check(async()=>assert.equal(await page.getByRole('slider').count(),0));await screenshot('unavailable-1440-accounts');
 await check(()=>assert.deepEqual(errors,[]));evidence.status='PASS';
}catch(e){const message=String(e.message);evidence.errors.push(message.slice(0,6000));evidence.status=/BLOCKED:|EPERM/.test(message)?'BLOCKED':'FAIL';}
finally{await context?.close();await browser?.close();if(server?.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}await writeFile(resolve(artifacts,'browser-result.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({status:evidence.status,assertionsExecuted:evidence.assertionsExecuted,screenshots:evidence.screenshots.length,launches:evidence.launches.map(({name,status})=>({name,status})),errors:evidence.errors},null,2));process.exitCode=evidence.status==='PASS'?0:evidence.status==='BLOCKED'?2:1;}
