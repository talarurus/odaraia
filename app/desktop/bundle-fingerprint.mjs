// SPDX-License-Identifier: MPL-2.0
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
// CodeResources seals the signed resource tree; codesign --verify is also required.
export function bundleFingerprint(app){const hash=createHash('sha256');for(const file of ['Contents/MacOS/Odaraia','Contents/Info.plist','Contents/_CodeSignature/CodeResources'])hash.update(readFileSync(join(app,file)));return hash.digest('hex');}
