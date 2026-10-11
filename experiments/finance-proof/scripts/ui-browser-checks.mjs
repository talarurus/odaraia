// SPDX-License-Identifier: MPL-2.0
// Genuine browser assertions. They run only after a browser has launched.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {demos} from '../visual/scenarios.mjs';
import {cells} from '../harness/csv.mjs';
export async function uiBrowserChecks(page,check,base,name,dir,result){
 const url=(screen,dataset='sample')=>{const u=new URL(base);u.searchParams.set('page',screen);u.searchParams.set('dataset',dataset);return u.href;};
 const reset=async()=>{await page.goto(url('settings'));await page.getByLabel('USD display').selectOption('symbol');await page.getByRole('checkbox',{name:/Hide financial amounts/}).uncheck();await page.getByRole('checkbox',{name:/Reduce Motion/}).uncheck();};
 await reset();
 await check(`${name}: Sankey inspector survives pointer/focus departure and drills correctly`,async()=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(url('cashflow','canonical'));await page.locator('.flow-label[data-kind="expense"]').filter({hasText:'Housing'}).focus();await page.keyboard.press('Tab');
  const action=page.locator('.flow-inspector').getByRole('button',{name:'View transactions'});await action.focus();await page.keyboard.press('Enter');assert.equal(await page.getByTestId('transaction-count').innerText(),'1 transactions');
 });
 await check(`${name}: refund-aware category drill-down and reversible filters`,async()=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(url('spending','canonical'));await page.locator('.rank-row').filter({hasText:'Groceries'}).click();
  assert.equal(await page.getByTestId('transaction-count').innerText(),'2 transactions');assert((await page.locator('.drill-context').innerText()).includes('posted · expense · Groceries'));
  assert((await page.locator('.transaction-summary').innerText()).includes('$20.00 in'));await page.getByRole('button',{name:/Clear filters/}).click();assert.equal(await page.getByTestId('transaction-count').innerText(),'12 transactions');assert((await page.locator('.drill-context').innerText()).includes('all statuses · all types'));
  await page.getByRole('button',{name:'Back to Spending'}).click();assert.equal(await page.locator('h1').innerText(),'Spending');
 });
 await check(`${name}: merchant grouping updates chart, legend and filter`,async()=>{
  await page.goto(url('spending','canonical'));await page.getByRole('button',{name:'Merchants',exact:true}).click();assert(await page.getByLabel('Spending by merchants').isVisible());await page.locator('.rank-row').filter({hasText:'Blue Kettle Cafe'}).click();assert.equal(await page.getByTestId('transaction-count').innerText(),'2 transactions');
  await page.getByRole('button',{name:'Back to Spending'}).click();assert.equal(await page.getByRole('button',{name:'Merchants',exact:true}).getAttribute('aria-pressed'),'true');
 });
 for(const theme of ['light','dark'])for(const [width,height] of [[1440,900],[820,1180],[430,932],[390,844],[375,812],[320,800]]){
  await page.setViewportSize({width,height});await page.evaluate(theme=>localStorage.setItem('talarurus.appearance',theme),theme);
  for(const dataset of Object.keys(demos).filter(x=>!['sample','canonical'].includes(x)))for(const screen of ['cashflow','spending','transactions','networth']){
   await check(`${name}: ${dataset} ${screen} ${theme} ${width}`,async()=>{
    await page.goto(url(screen,dataset));await page.locator('h1').waitFor();await page.waitForTimeout(180);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const text=await page.locator('main').innerText();assert(!text.includes('NaN'));assert(!text.includes('Infinity'));
    if(screen==='cashflow'&&['no-accounts','no-transactions','all-pending','needs-review'].includes(dataset))assert.equal(await page.locator('.flow-link').count(),0);
    if(screen==='networth'&&['no-accounts','missing-history'].includes(dataset))assert.equal(await page.locator('.networth-plot').count(),0);
    if([1440,390].includes(width)&&['no-accounts','all-pending','missing-history','negative-flow'].includes(dataset)&&screen===(dataset==='missing-history'?'networth':'cashflow')){const path=resolve(dir,`${name}-${dataset}-${screen}-${theme}-${width}.png`);await page.screenshot({path,fullPage:true,animations:'disabled'});result.screenshots.push(path);}
   });
  }
 }
 await check(`${name}: mobile Sankey scroll stays within the page and keyboard alternative works`,async()=>{
  await page.setViewportSize({width:320,height:800});await page.goto(url('cashflow'));await page.getByRole('button',{name:'Sankey',exact:true}).click();assert(await page.locator('.mobile-sankey-scroll').evaluate(x=>x.scrollWidth>x.clientWidth));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('button',{name:'Profit & loss',exact:true}).click();const row=page.locator('.profit-row').filter({hasText:'Housing'});await row.focus();await page.keyboard.press('Enter');assert.equal(await page.getByTestId('transaction-count').innerText(),'1 transactions');
 });
 await check(`${name}: privacy/format preferences persist without hover or detail disclosure`,async()=>{
  await page.setViewportSize({width:390,height:844});await page.goto(url('settings','canonical'));await page.getByLabel('USD display').selectOption('code');await page.getByRole('checkbox',{name:/Hide financial amounts/}).check();await page.reload();assert(await page.getByRole('checkbox',{name:/Hide financial amounts/}).isChecked());assert.equal(await page.getByLabel('USD display').inputValue(),'code');assert(await page.getByRole('button',{name:/Export selected-period/}).isDisabled());
  for(const screen of ['cashflow','spending','transactions','networth']){await page.goto(url(screen,'canonical'));const text=await page.locator('main').innerText();assert(!/[$][\d,]+|USD [\d,]+|\d+\.\d%/.test(text));assert.equal(await page.locator('.sankey-plot,.donut-plot,.trend-plot,.networth-plot').count(),0);}
  await page.goto(url('transactions','canonical'));await page.locator('.mobile-tx').first().click();assert((await page.locator('dialog').innerText()).includes('••••'));assert(!/[$][\d,]+|USD [\d,]+/.test(await page.locator('dialog').innerText()));await page.keyboard.press('Escape');
  await page.goto(url('settings','canonical'));await page.getByRole('checkbox',{name:/Hide financial amounts/}).uncheck();await page.goto(url('networth','canonical'));assert((await page.locator('.stats').innerText()).includes('USD 4,410.00'));
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('talarurus.presentation')));assert.deepEqual(Object.keys(stored).sort(),['format','hidden','reduceMotion']);
 });
 await check(`${name}: app and OS Reduce Motion combine correctly and survive reload`,async()=>{
  await page.goto(url('settings'));await page.emulateMedia({reducedMotion:'no-preference'});await page.getByRole('checkbox',{name:/Reduce Motion/}).check();await page.reload();assert.equal(await page.locator('html').getAttribute('data-motion'),'reduce');assert.equal(await page.locator('.page-content').evaluate(x=>getComputedStyle(x).animationName),'none');
  await page.getByRole('checkbox',{name:/Reduce Motion/}).uncheck();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.documentElement.dataset.motion==='reduce');await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.documentElement.dataset.motion==='normal');
 });
 await check(`${name}: actual browser CSV download includes every canonical transaction`,async()=>{
  await reset();await page.goto(url('settings','canonical'));const event=page.waitForEvent('download');await page.getByRole('button',{name:/Export selected-period/}).click();const download=await event;assert.equal(download.suggestedFilename(),'talarurus-synthetic-2026-09-01.csv');const path=resolve(dir,`${name}-canonical-export.csv`);await download.saveAs(path);assert.equal(cells(readFileSync(path,'utf8')).length,13);
 });
 await check(`${name}: failed export gives a visible error and a genuine retry succeeds`,async()=>{
  await page.goto(url('settings'));await page.evaluate(()=>{window.originalCreateObjectURL=URL.createObjectURL;URL.createObjectURL=()=>{throw Error('injected browser download failure');};});await page.getByRole('button',{name:/Export selected-period/}).click();assert((await page.locator('main').innerText()).includes('Export could not be created'));
  await page.evaluate(()=>{URL.createObjectURL=window.originalCreateObjectURL;delete window.originalCreateObjectURL;});const event=page.waitForEvent('download');await page.getByRole('button',{name:/Export selected-period/}).click();await event;
 });
 await reset();await page.emulateMedia({reducedMotion:'reduce'});
}
