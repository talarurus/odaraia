// SPDX-License-Identifier: MPL-2.0
import {build} from 'esbuild';
import {mkdir,writeFile,copyFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {appearanceBootstrap} from '../domain/appearance.mjs';
import {presentationBootstrap} from '../web/ui-model.mjs';
import {productIdentity,publicAssets} from '../product-identity.mjs';
import {packageLicenses} from '../../tools/package-licenses.mjs';
export const root=fileURLToPath(new URL('../',import.meta.url));
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export async function buildApp(){
 await rm(new URL('../dist/',import.meta.url),{recursive:true,force:true});
 await mkdir(new URL('../dist/',import.meta.url),{recursive:true});
 packageLicenses(fileURLToPath(new URL('../dist/legal/',import.meta.url)));
 const compiled=await build({absWorkingDir:root,entryPoints:['web/app.tsx'],outdir:'dist',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,metafile:true,define:{'process.env.NODE_ENV':'"production"'},logLevel:'warning'});
 for(const asset of publicAssets){
  const target=new URL('../dist/assets/'+asset.file,import.meta.url);
  await mkdir(new URL('.',target),{recursive:true});
  await copyFile(new URL('../public/'+asset.file,import.meta.url),target);
 }
 await writeFile(new URL('../dist/appearance.js',import.meta.url),appearanceBootstrap+presentationBootstrap);
 await writeFile(new URL('../dist/index.html',import.meta.url),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${escape(productIdentity.name)}</title><meta name="application-name" content="${escape(productIdentity.name)}"><meta name="description" content="${escape(productIdentity.description)}"><link rel="icon" type="image/svg+xml" href="${productIdentity.icon}"><script src="/appearance.js"></script><link rel="stylesheet" href="/app.css"></head><body><div id="root"><p role="status">Opening plainbalance by Talarurus…</p></div><script type="module" src="/app.js"></script></body></html>`);
 return compiled.metafile;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){await buildApp();console.log(`Built ${productIdentity.name}.`);}
