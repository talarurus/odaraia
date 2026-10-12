// SPDX-License-Identifier: MPL-2.0
import {build} from '../../app/node_modules/esbuild/lib/main.js';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicAssets} from '../../app/product-identity.mjs';
import {appearanceBootstrap} from '../../app/domain/appearance.mjs';
import {presentationBootstrap} from '../../app/web/ui-model.mjs';
const here=import.meta.dirname;
await mkdir(new URL('./dist/',import.meta.url),{recursive:true});
const result=await build({absWorkingDir:here,entryPoints:['entry.ts'],outfile:'dist/app.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,metafile:true,define:{'process.env.NODE_ENV':'"production"'},logLevel:'warning'});
if(Object.keys(result.metafile.inputs).some(p=>/\/server\/|\/db\/|node:/.test(p)))throw new Error('Unexpected backend dependency in frontend');
for(const asset of publicAssets){const to=new URL('./dist/assets/'+asset.file,import.meta.url);await mkdir(new URL('.',to),{recursive:true});await copyFile(new URL('../../app/public/'+asset.file,import.meta.url),to);}
await writeFile(new URL('./dist/appearance.js',import.meta.url),appearanceBootstrap+presentationBootstrap);
await writeFile(new URL('./dist/index.html',import.meta.url),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>plainbalance by Talarurus — SQLite prototype</title><script src="/appearance.js"></script><link rel="stylesheet" href="/app.css"></head><body><div id="root"><p role="status">Opening synthetic prototype…</p></div><script type="module" src="/app.js"></script></body></html>');
await mkdir(new URL('../../app/artifacts/tauri-validation/',import.meta.url),{recursive:true});
await writeFile(new URL('../../app/artifacts/tauri-validation/frontend-build.json',import.meta.url),JSON.stringify({status:'PASS',kind:'browser bundle compilation only; native acceptance is separate',nodeBackendInputs:false,inputs:Object.keys(result.metafile.inputs).length,outputs:result.metafile.outputs},null,2));
console.log('Built isolated Tauri frontend; native acceptance is recorded separately.');
