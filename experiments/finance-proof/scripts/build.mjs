// SPDX-License-Identifier: MPL-2.0
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {appearanceBootstrap} from '../shared/appearance.mjs';
import {presentationBootstrap} from '../visual/ui-model.mjs';
export const root=fileURLToPath(new URL('../',import.meta.url));
export async function buildVisual(){
 await mkdir(resolve(root,'visual/dist'),{recursive:true});
 await build({absWorkingDir:root,entryPoints:['visual/app.jsx'],outdir:'visual/dist',bundle:true,format:'esm',platform:'browser',target:['es2022'],sourcemap:true,minify:false,define:{'process.env.NODE_ENV':'"development"'},logLevel:'warning'});
 const {readFile}=await import('node:fs/promises');
 const index=await readFile(resolve(root,'visual/index.html'),'utf8');
 // Served startup remains compatible with the existing script-src 'self' CSP.
 await writeFile(resolve(root,'visual/dist/appearance.js'),appearanceBootstrap+presentationBootstrap);
 await writeFile(resolve(root,'visual/dist/index.html'),index.replace('<!-- appearance-bootstrap -->','<script src="/appearance.js"></script>'));
 // An original, self-contained local file preview avoids requiring an HTTP listener.
 // No reference images, fonts, remote scripts, or real financial records are embedded.
 const offline=await build({absWorkingDir:root,entryPoints:['visual/app.jsx'],bundle:true,format:'iife',platform:'browser',target:['es2022'],write:false,minify:false,define:{'process.env.NODE_ENV':'"development"'},outfile:'offline.js',logLevel:'warning'});
 const js=offline.outputFiles.find(x=>x.path.endsWith('.js')).text.replaceAll('</script','<\\/script');
 const css=offline.outputFiles.find(x=>x.path.endsWith('.css')).text;
 await writeFile(resolve(root,'visual/dist/offline.html'),`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Talarurus Finance — isolated prototype</title><script>${appearanceBootstrap}${presentationBootstrap}</script><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){await buildVisual();console.log('Built isolated visual prototype.');}
