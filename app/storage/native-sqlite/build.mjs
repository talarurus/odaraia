// SPDX-License-Identifier: MPL-2.0
import './generate.mjs';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const root=import.meta.dirname,out=resolve(root,'../../artifacts/persistent-platform');
mkdirSync(out,{recursive:true});
for(const testing of [false,true])execFileSync(process.env.CC||'cc',['-std=c11','-D_DARWIN_C_SOURCE','-D_POSIX_C_SOURCE=200809L','-Wall','-Wextra','-Werror',...(testing?['-DODARAIA_TESTING']:[]),resolve(root,'store.c'),resolve(root,'cli.c'),'-lsqlite3','-o',resolve(out,testing?'sqlite-store-fault-test':'sqlite-store')],{stdio:'inherit'});
console.log('Built native SQLite core and separate fault-test executable.');

if(process.argv.includes('--sanitize'))execFileSync(process.env.CC||'cc',['-std=c11','-D_DARWIN_C_SOURCE','-D_POSIX_C_SOURCE=200809L','-fsanitize=address,undefined','-fno-omit-frame-pointer','-g',resolve(root,'store.c'),resolve(root,'cli.c'),'-lsqlite3','-o',resolve(out,'sqlite-store-sanitized')],{stdio:'inherit'});
