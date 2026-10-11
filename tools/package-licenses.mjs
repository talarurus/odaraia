// SPDX-License-Identifier: MPL-2.0
// Local review packaging only; target-specific binary clearance is a separate gate.
import {cpSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
export function packageLicenses(destination){
 mkdirSync(destination,{recursive:true});
 for(const name of ['LICENSE','LICENSING.md','THIRD_PARTY_NOTICES.md','ODARAIA_BRAND_AND_TRADEMARK_POLICY.md'])cpSync(join(root,name),join(destination,name));
 for(const [source,name] of [['LICENSES','licenses'],['brand/talarurus-assets.json','publisher-provenance.json'],['app/desktop/third-party/monocode','monocode'],['app/notices/third-party','npm-notices']])cpSync(join(root,source),join(destination,name),{recursive:true});
 writeFileSync(join(destination,'SOURCE_ACCESS.txt'),'Odaraia 0.3.1 Developer Preview — internal review only.\nThe corresponding preferred-form source is supplied separately as the reviewed\nodaraia-v0.3.1-source-review.tar.gz source archive. No public source URL exists yet.\nThis file is not a public source offer. Before public binary/frontend distribution,\nprovide recipients access to the exact covered source and complete target-specific\nthird-party notices. Current bundles are not cleared for public redistribution.\n');
}
