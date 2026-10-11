// SPDX-License-Identifier: MPL-2.0
// Server-rendered structure only. These assertions do not establish browser layout.
import test from 'node:test';import assert from 'node:assert/strict';
import {build} from 'esbuild';import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {renderToStaticMarkup} from 'react-dom/server';import React from 'react';
mkdirSync('.runtime',{recursive:true});const outfile=resolve('.runtime/visual-ssr.mjs');
await build({entryPoints:['visual/app.jsx'],outfile,bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},logLevel:'silent'});
const {App}=await import(pathToFileURL(outfile).href);
const render=(page,dataset='sample')=>{globalThis.location={search:`?page=${page}&dataset=${dataset}`};return renderToStaticMarkup(React.createElement(App));};
test('Visual structure: all four page components contain original navigation and synthetic disclosures',()=>{for(const page of ['cashflow','spending','transactions','networth']){const html=render(page);assert(html.includes('Talarurus'));assert(html.includes('Mobile navigation'));assert(html.includes('No bank connections'));assert(!html.includes('SharkFin logo'));}});
test('Visual structure: canonical cash flow reports exact income and spending',()=>{const html=render('cashflow','canonical');assert(html.includes('$5,000.00'));assert(html.includes('$1,790.00'));assert(html.includes('$3,210.00'));assert(html.includes('$500.00'));});
test('Visual structure: spending and net-worth cards share the canonical contract',()=>{assert(render('spending','canonical').includes('$1,790.00'));const html=render('networth','canonical');assert(html.includes('$4,410.00'));assert(html.includes('+$3,210.00'));});
test('Visual structure: transaction screen uses a semantic table and retains two identical coffees',()=>{const html=render('transactions','canonical');assert(html.includes('<table'));assert(html.includes('scope="col"'));assert.equal((html.match(/Blue Kettle Cafe/g)||[]).length,6);assert(html.includes('Pending'));});
test('Visual structure: Settings exposes all three real appearance choices and financial navigation',()=>{const html=render('settings');assert(html.includes('Appearance preference'));for(const preference of ['light','dark','system'])assert(html.includes(`value="${preference}"`));assert.equal((html.match(/type="radio"/g)||[]).length,3);assert(html.includes('Reduce Motion'));assert(html.includes('Settings'));assert(!html.includes('Report period'));});
