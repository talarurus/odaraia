// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {productIdentity} from '../app/product-identity.mjs';
const root=resolve(import.meta.dirname,'..'),read=p=>readFileSync(resolve(root,p),'utf8'),json=p=>JSON.parse(read(p));
mkdirSync(resolve(root,'app/artifacts'),{recursive:true});
const version=json('release/version.json').version;
assert.equal(json('app/package.json').version,version);assert.equal(json('app/package-lock.json').packages[''].version,version);
assert.equal(productIdentity.version,version);assert.equal(json('experiments/tauri-desktop/src-tauri/tauri.conf.json').version,version);
assert(read('experiments/tauri-desktop/src-tauri/Cargo.toml').includes(`version = "${version}"`));
assert(read('experiments/tauri-desktop/src-tauri/Cargo.lock').includes(`name = "odaraia-sqlite-prototype"\nversion = "${version}"`));
assert.equal(json('release/version.json').consumerRelease,false);
console.log('PASS: preview metadata agrees; database schema and backup identities preserved.');
