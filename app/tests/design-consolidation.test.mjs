// SPDX-License-Identifier: MPL-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareReview} from '../scripts/cretodus-brand-review.mjs';
const render=await prepareReview();

test('First run has one welcome, one primary account action and optional detailed guidance; other routes contain no onboarding',()=>{
 const first=render({page:'dashboard',empty:true,experimental:true});
 assert(first.includes('Welcome to plainbalance'));assert(first.includes('>Add account</button>'));assert(first.includes('>Explore demo</button>'));
 assert(first.includes('<details class="setup-guidance">'));assert(!first.includes('guide-progress'));assert(!first.includes('overview-period'));assert(!first.includes('overview-lower'));
 for(const page of ['settings','accounts','transactions','import'])assert(!render({page,empty:true}).includes('getting-started-title'),page);
 const dismissed=render({page:'dashboard',empty:true,dismissed:true});assert(!dismissed.includes('getting-started-title'));assert(dismissed.includes('Add your first account'));assert(!dismissed.includes('overview-period'));
 const populated=render({page:'dashboard'});assert(!populated.includes('getting-started-title'));assert(populated.includes('data-testid="dashboard-total">$4,410.00'));assert(populated.indexOf('Net worth')<populated.indexOf('overview-period'));
});

test('Settings mounts exactly the requested category and preserves exports, recovery, masking and security disclosures',()=>{
 const markers={appearance:'Appearance preference',display:'Hide financial amounts',recovery:'Restore a backup',about:'Published by'};
 for(const [section,marker] of Object.entries(markers)){
  const html=render({page:'settings',section,empty:true,experimental:true});assert(html.includes(marker),section);
  for(const [other,text] of Object.entries(markers))if(section!==other)assert(!html.includes(text),section+': residual '+other);
  assert(!html.includes('getting-started-title'));assert(!html.includes('data-surface="elevated"'));assert(!html.includes('href="#settings-'));
 }
 const about=render({page:'settings',section:'about',experimental:true});
 for(const text of ['unencrypted','synthetic data only','not ready for sensitive financial data','Public release remains blocked','Open getting started guide'])assert(about.includes(text),text);
 const fallback=render({page:'settings',section:'invalid'});assert(fallback.includes('Appearance preference'));
});

test('Desktop navigation shares native group destinations and collapsed navigation retains accessible names',()=>{
 const expanded=render({page:'accounts'}),collapsed=render({page:'accounts',collapsed:true});
 for(const text of ['Finances','Insights','Activity','Overview','Accounts','Transactions','Cash flow','Spending','Net worth','Budgets','Import CSV','Settings'])assert(expanded.includes('aria-label="'+text+'"'),text);
 assert(!expanded.includes('account-nav'));assert(!expanded.includes('workspace-toolbar'));
 assert(collapsed.includes('data-sidebar="collapsed"'));assert(collapsed.includes('aria-label="Expand sidebar"'));assert(collapsed.includes('aria-label="Transactions"'));
 assert(collapsed.includes('aria-label="Mobile navigation"'));assert(collapsed.includes('aria-label="Settings"'));
 const native=render({page:'accounts',native:true});assert(!native.includes('aria-label="Primary navigation"'));assert(!native.includes('sidebar-toggle'));
});

test('Every host has one ordered CSS entry; legacy theme aliases cannot override shared tokens',()=>{
 const entry=readFileSync('web/workspace.css','utf8'),app=readFileSync('web/app.tsx','utf8'),legacy=readFileSync('web/style.css','utf8');
 assert(app.includes("import './workspace.css'"));assert(!app.includes("import './style.css'"));
 const sheets=[...entry.matchAll(/@import '\.\/(.*?)';/g)].map(m=>m[1]);
 assert.deepEqual(sheets,['style.css','application.css','accounts.css','design-system.css','branding.css','mac-workspace.css','window-workspace.css']);
 assert(!legacy.includes('--canvas:#'));assert(!legacy.includes('--muted:var(--muted)'));
 const css=readFileSync('web/design-system.css','utf8');for(const token of ['--tf-font','--tf-weight-medium','--tf-space-4','--tf-radius-control','--tf-grouped','--tf-separator','--tf-positive','--tf-negative','--tf-duration','--tf-focus'])assert(css.includes(token),token);
});
