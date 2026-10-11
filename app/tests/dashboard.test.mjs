// SPDX-License-Identifier: MPL-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareReview} from '../scripts/cretodus-brand-review.mjs';
const render=await prepareReview();
test('Overview promotes authoritative net worth and exact cash flow without counting pending or paired transfers',()=>{
 const html=render({page:'dashboard'});assert(html.includes('data-testid="dashboard-total">$4,410.00'));assert(html.includes('$5,000.00'));assert(html.includes('$1,790.00'));assert(html.includes('$3,210.00'));assert(html.includes('Transfers excluded'));assert(html.includes('Overview history timeframe'));assert(html.includes('Recent transactions'));assert(html.includes('Pending'));assert(html.includes('role="slider"'));
});
test('Every current screen has the shared product header, persistent publisher attribution and workspace navigation',()=>{
 for(const page of ['dashboard','accounts','cashflow','spending','transactions','networth','budgets','settings','import']){
  const html=render({page});assert(html.includes('by Talarurus'));assert(!html.includes('workspace-toolbar'));assert(html.includes('Collapse sidebar'));assert(html.includes('aria-label="Primary navigation"'));assert(html.includes('aria-label="Mobile navigation"'));assert(html.includes('aria-current="page"'));assert(!html.includes('Cretodus'));
 }
 const settings=render({page:'settings'});assert(settings.includes('Appearance preference'));assert(!settings.includes('Window appearance'));assert(!settings.includes('Restore a backup'));
 const nativeSettings=render({page:'settings',native:true});assert(nativeSettings.includes('Window appearance'));assert(nativeSettings.includes('aria-pressed="true">Solid'));
});

test('Overview amount masking removes every amount and the interactive history',()=>{
 const html=render({page:'dashboard',hidden:true});assert(!/\$[\d,]+/.test(html));assert(!html.includes('role="slider"'));assert(!html.includes('accounts-chart-line'));assert(html.includes('Recent transactions'));
});
