// SPDX-License-Identifier: MPL-2.0
import {join,isAbsolute} from 'node:path';
import {homedir} from 'node:os';
import {mkdirSync,chmodSync,lstatSync,existsSync,realpathSync} from 'node:fs';
import {productIdentity} from '../product-identity.mjs';
// Stable across display-name changes and app updates. Never reads the development database.
export function desktopDataDirectory({home=homedir(),override}={}){
 if(override){if(!isAbsolute(override))throw new Error('Test data directory must be absolute');return override;}
 return join(home,'Library','Application Support',productIdentity.dataIdentifier);
}
export function prepareDesktopStorage(directory){
 mkdirSync(directory,{recursive:true,mode:0o700});
 if(lstatSync(directory).isSymbolicLink()||realpathSync(directory)!==directory)throw new Error('Application support must be a real directory');
 chmodSync(directory,0o700);const path=join(directory,'finance.sqlite');
 if(existsSync(path)&&lstatSync(path).isSymbolicLink())throw new Error('Database must not be a symbolic link');
 return path;
}
