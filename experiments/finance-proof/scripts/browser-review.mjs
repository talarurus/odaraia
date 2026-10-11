// SPDX-License-Identifier: MPL-2.0
// Real browser captures only. Never creates substitute images on failure.
import {chromium,firefox,webkit} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {appearanceBrowserChecks} from './appearance-browser-checks.mjs';
import {uiBrowserChecks} from './ui-browser-checks.mjs';
const evidence=resolve(process.env.UI_EVIDENCE_DIR||'artifacts/evidence-completion');
const dir=resolve(evidence,'screenshots'),runtime=resolve('.runtime/browser-tmp');mkdirSync(dir,{recursive:true});mkdirSync(runtime,{recursive:true});process.env.TMPDIR=runtime;
const base=process.env.PROTOTYPE_URL||pathToFileURL(resolve('visual/dist/offline.html')).href;
const candidates=[['chromium',chromium,process.env.CHROMIUM_PATH],['firefox',firefox,process.env.FIREFOX_PATH],['webkit',webkit,undefined]];
const result={date:new Date().toISOString(),base,browsers:[],checks:[],screenshots:[],status:'BLOCKED',zoom:'100% CSS viewport; deviceScaleFactor 1',motion:'Reduced motion for deterministic captures; normal transitions checked separately',limitations:[]};
let failures=0,successful=0;
async function check(name,fn){try{await fn();result.checks.push({name,status:'PASS'});}catch(error){failures++;result.checks.push({name,status:'FAIL',error:error.message});}}
for(const [name,type,path] of candidates){
 let browser;try{browser=await type.launch({headless:true,...(name==='chromium'?{chromiumSandbox:true,ignoreDefaultArgs:['--unsafely-disable-devtools-self-xss-warnings']}:{}),...(path&&existsSync(path)?{executablePath:path}:{}),timeout:15000});}catch(error){result.browsers.push({name,status:'BLOCKED',error:error.message});continue;}
 successful++;result.browsers.push({name,status:'LAUNCHED',version:browser.version()});
 try{
  const page=await browser.newPage({deviceScaleFactor:1});await page.emulateMedia({reducedMotion:'reduce',colorScheme:'light'});const errors=[],consoleErrors=[];page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  for(const theme of ['light','dark']){await page.evaluate(theme=>localStorage.setItem('talarurus.appearance',theme),theme);
  for(const [width,height] of [[1440,900],[1280,800],[820,1180],[430,932],[390,844],[375,812],[360,800],[320,800]]){
   await page.setViewportSize({width,height});
   for(const screen of ['cashflow','spending','transactions','networth','settings']){
    await page.goto(`${base}?page=${screen}`);await page.locator('h1').waitFor();await page.waitForTimeout(300);
    await check(`${name} ${screen} ${width} ${theme}: theme and no page overflow`,async()=>{assert.equal(await page.locator('html').getAttribute('data-theme'),theme);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));});
    await check(`${name} ${screen} ${width} ${theme}: navigation placement`,async()=>{assert.equal(await page.locator('.sidebar').isVisible(),width>=768);assert.equal(await page.locator('.bottom-nav').isVisible(),width<768);});
    if(width===1440||width===390){const path=resolve(dir,`${name}-${screen}-${theme}-${width}x${height}.png`);await page.screenshot({path,fullPage:true,animations:'disabled'});result.screenshots.push(path);}
    if(screen==='transactions')await check(`${name} transactions ${width}: visible row density`,async()=>{const selector=width<768?'.mobile-tx':'.transaction-table tr:not(.date-row) td:first-child';const n=await page.locator(selector).evaluateAll(xs=>xs.filter(x=>{const r=x.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight-(innerWidth<768?62:0);}).length);if(width===1440)assert(n>=8,`Visible rows ${n}`);if(width===390)assert(n>=5,`Visible rows ${n}`);});
   }
  }
  }
  await page.setViewportSize({width:1440,height:900});await page.goto(`${base}?page=transactions`);
  await check(`${name}: search and clearing`,async()=>{await page.getByRole('textbox',{name:'Search transactions'}).fill('Paper Birch');assert(await page.getByTestId('transaction-count').innerText()==='10 transactions');await page.getByRole('textbox',{name:'Search transactions'}).fill('does-not-exist');assert.equal(await page.getByTestId('transaction-count').innerText(),'0 transactions');await page.getByRole('textbox',{name:'Search transactions'}).fill('');});
  await check(`${name}: pending filter`,async()=>{await page.getByRole('button',{name:'Pending',exact:true}).click();assert.equal(await page.getByTestId('transaction-count').innerText(),'1 transactions');});
  await check(`${name}: period selection`,async()=>{await page.getByLabel('Report period').selectOption('08');assert.equal(await page.getByTestId('transaction-count').innerText(),'38 transactions');});
  await check(`${name}: chart drill-down`,async()=>{await page.goto(`${base}?page=spending`);await page.locator('.rank-row').filter({hasText:'Housing'}).first().click();assert.equal(await page.locator('h1').innerText(),'Transactions');assert.equal(await page.getByTestId('transaction-count').innerText(),'1 transactions');});
  await check(`${name}: canonical UI totals`,async()=>{await page.goto(`${base}?page=spending&dataset=canonical`);assert((await page.locator('.stats').innerText()).includes('$1,790.00'));await page.locator('.sidebar').getByRole('button',{name:'Net worth',exact:true}).click();assert((await page.locator('.stats').innerText()).includes('$4,410.00'));});
  await check(`${name}: mobile filters and detail dialog`,async()=>{await page.setViewportSize({width:390,height:844});await page.goto(`${base}?page=transactions`);await page.getByRole('button',{name:'Transaction filters',exact:true}).click();assert(await page.locator('dialog').isVisible());await page.getByRole('button',{name:'Close dialog'}).click();await page.locator('.mobile-tx').first().click();assert((await page.locator('dialog').innerText()).includes('Pending'));await page.keyboard.press('Escape');assert(!(await page.locator('dialog').isVisible()));});
  await appearanceBrowserChecks(page,check,base,name);
  await uiBrowserChecks(page,check,base,name,dir,result);
  const axe=readFileSync(resolve('node_modules/axe-core/axe.min.js'),'utf8');
  for(const theme of ['light','dark']){await page.evaluate(theme=>localStorage.setItem('talarurus.appearance',theme),theme);
  for(const [width,height] of [[1440,900],[390,844]])for(const screen of ['cashflow','spending','transactions','networth','settings']){
   await page.setViewportSize({width,height});await page.goto(`${base}?page=${screen}`);await page.addScriptTag({content:axe});const a=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
   writeFileSync(resolve(evidence,`${name}-axe-${screen}-${theme}-${width}.json`),JSON.stringify(a,null,2));await check(`${name}: axe ${screen} ${theme} ${width}`,async()=>assert.equal(a.violations.length,0,JSON.stringify(a.violations.map(x=>({id:x.id,impact:x.impact,nodes:x.nodes.length})))));
  }
  }
  await check(`${name}: no page runtime errors`,async()=>{assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);});
 }catch(error){failures++;result.checks.push({name:`${name} review execution`,status:'FAIL',error:error.message});}finally{await browser.close();}
}
result.status=successful?(failures?'FAIL':'PASS'):'BLOCKED';result.limitations.push('Automated checks are not founder visual approval, full screen-reader testing, real iOS Safari or Android coverage.');
writeFileSync(resolve(evidence,'browser-review.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,browsers:result.browsers.map(({name,status,version})=>({name,status,version})),checks:result.checks.length,failures,screenshots:result.screenshots},null,2));
if(result.status!=='PASS')process.exitCode=1;
