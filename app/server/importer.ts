// SPDX-License-Identifier: MPL-2.0
import {createHash} from 'node:crypto';
import {ImportService} from '../services/importer.ts';
import type {Ledger} from '../services/ledger.ts';
export const hash=(value:unknown)=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export class Importer extends ImportService {constructor(repo:Ledger){super(repo,hash);}}
