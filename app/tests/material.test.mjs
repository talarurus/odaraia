// SPDX-License-Identifier: MPL-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultMaterial,normalizeMaterial,readMaterial,saveMaterial,applyMaterialPresentation} from '../web/desktop.mjs';
import {prepareReview} from '../scripts/cretodus-brand-review.mjs';

test('Glass preferences migrate legacy levels, persist reversibly and reject unsafe/unrelated values',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 assert.deepEqual(readMaterial(storage),defaultMaterial);
 assert(saveMaterial(storage,{glass:1,scrim:0.42,sidebarOpacity:0.3,wallpaperInfluence:0.9,account:'private'}));assert.deepEqual(readMaterial(storage),{version:2,glass:1});
 saveMaterial(storage,{glass:0});assert.deepEqual(readMaterial(storage),{version:2,glass:0});
 for(const [value,glass] of [[{},0.55],[{glass:0},0],[{glass:1},1],[{glass:-10},0],[{glass:100},1],[{glass:true},0.55],[{glass:Infinity},0.55],[{intensity:'high'},0.9]])assert.deepEqual(normalizeMaterial(value),{version:2,glass});
 assert.equal(normalizeMaterial({intensity:'low'}).glass,0.1);assert.equal(normalizeMaterial({intensity:'unknown'}).glass,0.55);
 storage.setItem('talarurus.material','broken');assert.deepEqual(readMaterial(storage),defaultMaterial);
 assert.equal(saveMaterial({setItem(){throw Error('disabled')}},defaultMaterial),false);assert.equal(saveMaterial(undefined,defaultMaterial),false);
});
test('Browser and reduced-transparency stay solid; surface roles remain independent of native Glass intensity',()=>{
 const previous=globalThis.document,properties=new Map();globalThis.document={documentElement:{dataset:{},style:{setProperty:(key,value)=>properties.set(key,value)}}};
 try{
  for(const glass of [0,0.5,1]){applyMaterialPresentation({requested:'translucent',material:{glass},native:true,available:true});assert.equal(document.documentElement.dataset.compositingMode,'native-desktop-glass');assert.equal(properties.get('--glass-intensity'),String(glass));assert.equal(properties.has('--panel-alpha'),false);}
  for(const options of [{native:false,available:true},{native:true,available:false},{native:true,available:true,reduceTransparency:true}]){applyMaterialPresentation({requested:'translucent',material:{glass:1},...options});assert.equal(document.documentElement.dataset.windowStyle,'solid');assert.equal(document.documentElement.dataset.compositingMode,'solid');assert.equal(properties.has('--panel-alpha'),false);}
 }finally{globalThis.document=previous;}
});
test('Compact first-run setup retains real actions; one glass control replaces redundant controls without removing recovery',async()=>{
 const render=await prepareReview();const overview=render({page:'dashboard',empty:true});
 assert(overview.includes('Welcome to Odaraia'));assert(overview.includes('Add account'));assert(!overview.includes('overview-period'));assert(!overview.includes('welcome-scene'));assert(!overview.includes('data-testid="dashboard-total"'));assert(!overview.includes('$4,410.00'));
 const settings=render({page:'settings',native:true,candidate:true,windowStyle:'translucent',material:{glass:1}});
 for(const label of ['Glass intensity','by Talarurus'])assert(settings.includes(label),label);
 const recovery=render({page:'settings',native:true,section:'recovery'});for(const label of ['Restore a backup','Complete financial backup'])assert(recovery.includes(label));assert(!settings.includes('Restore a backup'));
 for(const label of ['Background dimming','Sidebar opacity','Wallpaper influence','material-preview'])assert(!settings.includes(label),label);
 assert.equal((settings.match(/type="range"/g)||[]).length,1);const range=settings.match(/<input[^>]*aria-label="Glass intensity"[^>]*>/)?.[0];assert(range);assert(!range.includes('disabled'));
});
test('Normal founder build explains the desktop proof gate instead of advertising ineffective full-window glass',async()=>{
 const render=await prepareReview();const settings=render({page:'settings',native:true,candidate:false,windowStyle:'translucent'});
 assert(settings.includes('Glass requires the experimental desktop build and explicit review flag.'));
 const range=settings.match(/<input[^>]*aria-label="Glass intensity"[^>]*>/)?.[0];assert(range?.includes('disabled'));
 assert(!settings.includes('Native materials span the window'));assert(settings.includes('aria-labelledby="page-title"'));// A negative tabindex permits recovery focus without adding a keyboard tab stop.
 assert(settings.includes('id="page-title" tabindex="-1"'));assert(!settings.includes('id="page-title" tabindex="0"'));
});
test('Native content has one navigation owner; browser retains complete navigation',async()=>{
 const render=await prepareReview();
 for(const page of ['dashboard','accounts','cashflow','spending','transactions','budgets','settings']){
  const native=render({page,native:true});
  for(const label of ['aria-label="Primary navigation"','aria-label="Mobile navigation"','class="workspace-toolbar"'])assert(!native.includes(label),page+': duplicate '+label);
  assert(native.includes('by Talarurus'));assert(native.includes('id="main"'));assert(native.includes('id="page-title"'));
 }
 const browser=render({page:'accounts'});assert(browser.includes('aria-label="Primary navigation"'));assert(browser.includes('aria-label="Mobile navigation"'));
});
test('Rejected native activation remains visibly solid and disables tint instead of reporting glass as active',async()=>{
 const render=await prepareReview();
 const settings=render({page:'settings',native:true,candidate:true,windowStyle:'translucent',effectiveWindowStyle:'solid',glassError:'WindowServer blur rejected (-1000). Solid fallback.'});
 assert(settings.includes('WindowServer blur rejected (-1000). Solid fallback.'));
 assert(settings.match(/<input[^>]*aria-label="Glass intensity"[^>]*>/)?.[0].includes('disabled'));
 assert(!settings.includes('Experimental native glass requested.'));
});
