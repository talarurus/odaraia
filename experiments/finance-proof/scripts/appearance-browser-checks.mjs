// SPDX-License-Identifier: MPL-2.0
// These tests require a genuine Playwright page; never invoked when launch is blocked.
import assert from 'node:assert/strict';
export async function appearanceBrowserChecks(page,check,base,name){
 const url=(screen)=>{const u=new URL(base);u.searchParams.set('page',screen);return u.href;};
 await page.setViewportSize({width:1440,height:900});
 await check(`${name}: appearance persistence and live System response`,async()=>{
  await page.goto(url('settings'));await page.getByRole('radio',{name:/Light Always/}).check();await page.emulateMedia({colorScheme:'dark'});assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.getByRole('radio',{name:/Dark Always/}).check();await page.reload();assert(await page.getByRole('radio',{name:/Dark Always/}).isChecked());assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await page.emulateMedia({colorScheme:'light'});assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.getByRole('radio',{name:/System Follow/}).check();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['talarurus.appearance']);
 });
 await check(`${name}: Sankey hover, destination spacing and keyboard activation`,async()=>{
  await page.goto(url('cashflow'));await page.waitForTimeout(200);const link=page.locator('.flow-link').first();await link.hover();assert.equal(await link.getAttribute('stroke-opacity'),'0.68');
  const labels=page.locator('.flow-label[data-kind="expense"],.flow-label[data-kind="surplus"]');const boxes=await labels.evaluateAll(xs=>xs.map(x=>{const r=x.getBoundingClientRect();return {top:r.top,bottom:r.bottom,right:r.right};}).sort((a,b)=>a.top-b.top));assert(boxes.length>=10);for(let i=1;i<boxes.length;i++)assert(boxes[i].top>=boxes[i-1].bottom,JSON.stringify(boxes));assert(boxes.every(x=>x.right<=1440));
  await page.locator('.flow-label[data-kind="expense"]').first().focus();await page.keyboard.press('Enter');assert.equal(await page.locator('h1').innerText(),'Transactions');
 });
 await check(`${name}: normal motion and reduced-motion computed styles`,async()=>{
  await page.goto(url('spending'));await page.emulateMedia({reducedMotion:'no-preference'});assert.equal(await page.locator('.page-content').evaluate(x=>getComputedStyle(x).animationDuration),'0.16s');await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.page-content').evaluate(x=>getComputedStyle(x).animationName),'none');assert.equal(await page.locator('.card').first().evaluate(x=>getComputedStyle(x).transitionDuration),'0s');assert((await page.locator('.stats').innerText()).includes('$3,567.25'));
 });
 await check(`${name}: mobile More/Settings, theme keyboard choice and touch targets`,async()=>{
  await page.setViewportSize({width:390,height:844});await page.goto(url('transactions'));const opener=page.getByRole('button',{name:'Transaction filters',exact:true});await opener.click();await page.locator('.filter-sheet select').first().selectOption('card');await page.getByRole('button',{name:'Show transactions'}).click();assert(await opener.evaluate(x=>x===document.activeElement));
  for(const button of await page.locator('.bottom-nav button,.transaction-search > button').all()){const box=await button.boundingBox();assert(box.width>=44&&box.height>=44);}
  await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Appearance settings'}).click();assert.equal(await page.locator('h1').innerText(),'Settings');await page.getByRole('radio',{name:/Light Always/}).focus();await page.keyboard.press('ArrowRight');assert(await page.getByRole('radio',{name:/Dark Always/}).isChecked());assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 });
 await check(`${name}: account/category filters and previous/next period controls`,async()=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(url('transactions'));await page.getByRole('button',{name:'Posted',exact:true}).click();await page.getByLabel('Filter category',{exact:true}).selectOption('Housing');assert.equal(await page.getByTestId('transaction-count').innerText(),'1 transactions');await page.getByLabel('Filter account',{exact:true}).selectOption('card');assert.equal(await page.getByTestId('transaction-count').innerText(),'0 transactions');await page.getByRole('button',{name:/Clear filters/}).first().click();await page.getByRole('button',{name:'Previous period'}).click();assert.equal(await page.getByLabel('Report period').inputValue(),'08');await page.getByRole('button',{name:'Next period'}).click();assert.equal(await page.getByLabel('Report period').inputValue(),'09');
 });
}
