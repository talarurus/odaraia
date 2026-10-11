// SPDX-License-Identifier: MPL-2.0
// Preference/controller unit tests. Browser paint and real OS events are separate blocked checks.
import test from 'node:test';import assert from 'node:assert/strict';import {runInNewContext} from 'node:vm';
import {readPreference,resolveTheme,observeAppearance,appearanceKey,appearanceBootstrap} from '../shared/appearance.mjs';
function environment(saved='system',dark=false){
 const values=new Map([[appearanceKey,saved]]),listeners=new Set(),events=[];
 const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 const root={dataset:{},style:{}},media={matches:dark,addEventListener:(type,fn)=>listeners.add(fn),removeEventListener:(type,fn)=>listeners.delete(fn)};
 const controller=observeAppearance({root,storage,media,onChange:e=>events.push(e)});
 return {values,storage,root,media,events,controller,listeners,change(dark){media.matches=dark;listeners.forEach(fn=>fn());}};
}
test('Appearance defaults to System and invalid/unavailable storage is handled',()=>{
 assert.equal(readPreference(), 'system');assert.equal(readPreference({getItem:()=> 'invalid'}),'system');assert.equal(readPreference({getItem:()=>{throw Error('denied');}}),'system');
 assert.equal(resolveTheme('system',true),'dark');assert.equal(resolveTheme('system',false),'light');
});
test('Appearance explicit Light/Dark remain fixed across system changes',()=>{
 for(const preference of ['light','dark']){const e=environment(preference);e.change(true);e.change(false);assert.equal(e.root.dataset.theme,preference);assert.equal(e.root.style.colorScheme,preference);e.controller.dispose();}
});
test('Appearance System responds to changes and disposes its listener',()=>{
 const e=environment();e.change(true);assert.equal(e.root.dataset.theme,'dark');e.change(false);assert.equal(e.root.dataset.theme,'light');e.controller.dispose();assert.equal(e.listeners.size,0);
});
test('Appearance stores only the selected non-sensitive preference and reloads it',()=>{
 const e=environment();e.controller.setPreference('dark');assert.equal(e.values.size,1);assert.equal(e.values.get(appearanceKey),'dark');assert.equal(readPreference(e.storage),'dark');assert.throws(()=>e.controller.setPreference('arbitrary'),/Invalid/);e.controller.dispose();
});
test('Appearance denied writes keep an active preference and report non-persistence',()=>{
 const e=environment();e.storage.setItem=()=>{throw Error('denied');};e.controller.setPreference('dark');assert.equal(e.root.dataset.theme,'dark');assert.equal(e.events.at(-1).persistent,false);e.controller.setPreference('system');e.change(true);assert.equal(e.root.dataset.theme,'dark');e.controller.dispose();
});
test('Appearance startup script applies the saved theme before React without writing storage',()=>{
 for(const [saved,dark,want] of [['light',true,'light'],['dark',false,'dark'],['system',true,'dark'],['invalid',false,'light']]){
  const root={dataset:{},style:{}};runInNewContext(appearanceBootstrap,{localStorage:{getItem:()=>saved,setItem:()=>assert.fail('Bootstrap must not write')},matchMedia:()=>({matches:dark}),document:{documentElement:root}});assert.equal(root.dataset.theme,want);assert.equal(root.style.colorScheme,want);
 }
 const root={dataset:{},style:{}};runInNewContext(appearanceBootstrap,{localStorage:{getItem:()=>{throw Error('denied');}},matchMedia:()=>({matches:true}),document:{documentElement:root}});assert.equal(root.dataset.theme,'dark');
});
