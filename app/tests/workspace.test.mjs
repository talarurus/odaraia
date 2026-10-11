// SPDX-License-Identifier: MPL-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareReview} from '../scripts/cretodus-brand-review.mjs';
const render=await prepareReview();

test('Overview uses an open semantic canvas with exact balances and accessible history controls',()=>{
 for(const theme of ['light','dark'])for(const windowStyle of ['solid','translucent']){
  const html=render({page:'dashboard',theme,native:true,candidate:true,windowStyle});
  assert.match(html,/class="workspace-surface dashboard-wealth" data-surface="canvas" aria-labelledby="overview-worth"/);
  assert(html.includes('data-testid="dashboard-total">$4,410.00'));
  const hero=html.slice(html.indexOf('class="workspace-surface dashboard-wealth"'),html.indexOf('class="workspace-surface overview-period"'));
  assert(!hero.includes('surface-content'));assert(!hero.includes('foreground-surface'));
  assert.match(hero,/role="slider"[^>]*aria-label="Net worth history"/);
  assert(hero.includes('Overview history timeframe'));assert(hero.includes('Missing balances are unavailable'));
  assert.match(html,/<fieldset class="period-controls"><legend class="sr-only">Report period and accounts<\/legend>/);
  for(const label of ['Period mode','Report month','Report account'])assert(html.includes('aria-label="'+label+'"'));
 }
});
test('Report charts share the canvas; account ledgers, transactions and recovery keep distinct surfaces',()=>{
 for(const [page,section] of [['accounts','accounts-hero'],['cashflow','report-section cashflow-main'],['spending','report-section spending-stage'],['networth','report-section worth-history-stage'],['budgets','report-section budget-planner']]){
  const html=render({page,native:true,theme:'dark',candidate:true,windowStyle:'translucent'});
  assert(html.includes('class="workspace-surface '+section+'" data-surface="canvas"'),page);
  assert(!html.includes('foreground-surface'),page);
 }
 const accounts=render({page:'accounts'});assert.match(accounts,/data-surface="dense" aria-labelledby="accounts-group-/);
 const records=render({page:'transactions'});assert.match(records,/class="workspace-surface transaction-card" data-surface="dense"/);assert(records.includes('<table'));assert(records.includes('transactions grouped by date')||records.includes('Transactions grouped by date'));
 const settings=render({page:'settings',section:'recovery'});assert(settings.includes('data-surface="canvas"'));assert(settings.includes('Restore a backup'));assert(!settings.includes('Appearance preference'));
});
test('Frameless Overview retains amount masking and empty-account actions',()=>{
 const hidden=render({page:'dashboard',hidden:true,native:true});assert(!hidden.includes('$4,410.00'));assert(!hidden.includes('aria-label="Net worth history"'));assert(hidden.includes('Financial amounts hidden'));
 const empty=render({page:'dashboard',empty:true,native:true,dismissed:true});assert(empty.includes('Add your first account'));assert(!empty.includes('data-testid="dashboard-total"'));
});
