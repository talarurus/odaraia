// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {publicAssets} from '../app/product-identity.mjs';
const root=resolve(import.meta.dirname,'..'),read=p=>readFileSync(resolve(root,p));
for(const a of JSON.parse(read('brand/talarurus-assets.json')).assets)assert.equal(createHash('sha256').update(read(a.file)).digest('hex'),a.sha256);
for(const a of publicAssets){assert.equal(a.type,'image/svg+xml');assert(!/candidates|cretodus/.test(a.file));read('app/public/'+a.file);}
assert.deepEqual(read('brand/odaraia/placeholder/favicon.svg'),read('app/public/brand/odaraia-favicon.svg'));
console.log('PASS: official publisher hashes unchanged; active placeholder only; public asset allowlist complete.');
