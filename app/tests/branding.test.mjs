// SPDX-License-Identifier: MPL-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {productIdentity,pageTitle,publicAssets} from '../product-identity.mjs';
import {prepareReview,reviewPages} from '../scripts/cretodus-brand-review.mjs';
import {buildApp} from '../scripts/build.mjs';
import {Repository} from '../db/repository.ts';
import {Portability} from '../server/portability.ts';
import {loadCanonical} from './canonical-fixture.mjs';
import {appearanceKey,readPreference} from '../domain/appearance.mjs';
import {preferenceKey,readPresentation} from '../web/ui-model.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const render=await prepareReview();

test('Brand: product and publisher are distinct across all nine current screens and appearances',()=>{
 assert.equal(productIdentity.name,'plainbalance');assert.equal(productIdentity.publisher,'Talarurus');assert.equal(productIdentity.bundleIdentifier,'com.talarurus.odaraia');assert.equal(productIdentity.dataIdentifier,'com.talarurus.odaraia');
 for(const page of reviewPages)for(const theme of ['light','dark'])for(const width of [1440,390]){
  const html=render({page,theme,width});assert(html.includes('class="product-name">plainbalance</span>'));
  assert(html.includes('mobile-product-brand'));assert(html.includes('plainbalance · by Talarurus'));
  assert(!html.includes('Talarurus Finance'));assert(!html.includes('brand-mark'));assert(html.includes('by Talarurus'));assert(!html.includes('Cretodus'));assert(html.includes('plainbalance-symbol.svg'));assert(!/\bOdaraia\b/.test(html));
  assert(!html.includes('publisher-lockup'));
  if(page==='settings'){
   assert(html.includes('About plainbalance'));const about=render({page,theme,width,section:'about'});assert(about.includes('Published by'));assert(about.includes('publisher-lockup'));
   assert(html.includes('Appearance preference'));for(const url of Object.values(productIdentity.publisherLogos))assert(about.includes(url));
  }
  if(page==='accounts')assert(html.includes('$4,410.00'));
 }
});
test('Brand: official publisher assets match recorded hashes, original exports and production copies',async()=>{
 await buildApp();const manifest=JSON.parse(readFileSync('../brand/talarurus-assets.json'));
 for(const a of manifest.assets){const copy=readFileSync('../'+a.file);assert.equal(digest(copy),a.sha256);if(existsSync(a.source))assert.deepEqual(copy,readFileSync(a.source));assert.deepEqual(copy,readFileSync(a.file.replace('app/public/','dist/assets/')));}
 for(const a of publicAssets){assert(existsSync('dist/assets/'+a.file));assert.equal(a.type,'image/svg+xml');assert(!a.url.includes('candidates'));}
 const html=readFileSync('dist/index.html','utf8');assert(html.includes('<title>plainbalance</title>'));assert(html.includes('name="application-name" content="plainbalance"'));assert(html.includes(productIdentity.icon));assert(!html.includes('Talarurus Finance'));
 assert.equal(pageTitle('Accounts'),'Accounts · plainbalance');
 const css=readFileSync('web/branding.css','utf8');assert(css.includes(':root[data-theme=dark] .publisher-logo-dark{display:block}'));assert(css.includes(':root[data-theme=dark] .publisher-logo-light{display:none}'));
});
test('Brand: legacy backup data and existing appearance preferences survive the presentation rename',()=>{
 const source=new Repository(),target=new Repository();try{
  loadCanonical(source);const backup=new Portability(source).backup();assert.equal(backup.format,'talarurus-finance');assert.equal(backup.version,1);
  new Portability(target).restore({backup,confirmEmpty:true});assert.deepEqual(target.state(),source.state());assert.deepEqual(target.report(),source.report());
 }finally{source.close();target.close();}
 assert.equal(appearanceKey,'talarurus.appearance');assert.equal(preferenceKey,'talarurus.presentation');
 const values=new Map([[appearanceKey,'dark'],[preferenceKey,JSON.stringify({hidden:true,format:'code',reduceMotion:true})]]),storage={getItem:key=>values.get(key)};
 assert.equal(readPreference(storage),'dark');assert.deepEqual(readPresentation(storage),{hidden:true,format:'code',reduceMotion:true});
 assert.equal(productIdentity.downloads.backup,'plainbalance-backup.json');
});
test('Brand: archived concepts are absent from the public build asset allowlist',()=>{
 for(const a of publicAssets)assert(!/candidates|cretodus|archive|review-v1|preferred-review/i.test(a.file));
 assert.equal(productIdentity.markStatus,'Founder-preferred original corner; final publication review pending');
});
test('Brand: the preferred corner preserves original geometry and active vector copies',()=>{
 assert.equal(productIdentity.workingMark,'original-corner');
 const svg=readFileSync('../brand/plainbalance/placeholder/favicon.svg','utf8');
 assert(svg.includes('<rect width="64" height="64" rx="14" fill="#111111"/>'));
 assert(svg.includes('<path d="M24 20H44V40H38V26H24Z" fill="#FFFFFF"/>'));
 assert.deepEqual(readFileSync('../brand/plainbalance/placeholder/app-icon.svg'),Buffer.from(svg));
 assert.deepEqual(readFileSync('public/brand/plainbalance-symbol.svg'),readFileSync('../brand/plainbalance/placeholder/symbol-light.svg'));
 assert.deepEqual(readFileSync('public/brand/plainbalance-favicon.svg'),readFileSync('../brand/plainbalance/'+productIdentity.markDirectory+'/favicon.svg'));
});
