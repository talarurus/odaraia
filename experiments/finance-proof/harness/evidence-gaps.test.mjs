// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdirSync,rmSync} from 'node:fs';import {resolve} from 'node:path';
import {IndependentProof} from './independent.mjs';
import {report,flowData} from '../shared/finance.mjs';
import {canonical,sample} from '../shared/fixture.mjs';
import {flowLabelLayout} from '../visual/flow-labels.mjs';
import {report as previousReport} from './fixtures/report-policy-previous.mjs';
const period={start:'2026-09-01',end:'2026-10-01'};
test('Report projection equals the full ledger policy across dates, filters and unknown anchors',()=>{
 for(const fixture of [canonical,sample]){const e=new IndependentProof();try{e.load('one',fixture);
  for(const filter of [{},{end:'2026-07-01'},period,{start:'2026-07-01',end:'2026-10-01'},{...period,account:'card'},{...period,category:'Groceries'},{...period,status:'pending'},{...period,account:'savings',category:'Transfers'}]){assert.deepEqual(e.report('one',filter),report(e.accounts('one'),e.rows('one'),filter),JSON.stringify(filter));assert.deepEqual(e.report('one',filter),previousReport(e.accounts('one'),e.rows('one'),filter),`Previous policy ${JSON.stringify(filter)}`);}
  assert(e.reportRows('one',period).every(r=>r.status==='posted'&&!('sourceEvidence' in r)&&!('overrides' in r)));assert(e.rows('one').every(r=>r.sourceEvidence));
 }finally{e.close();}}
});
test('Report projection retains exact aggregates beyond SQLite SUM and JS safe integers',()=>{
 const e=new IndependentProof();try{const huge='9223372036854775807';const f={accounts:[{id:'a',name:'Synthetic',currency:'USD',opening:'0',anchor:'2026-08-31'}],transactions:[0,1].map(i=>({id:'r'+i,sourceId:'r'+i,account:'a',date:'2026-09-02',amount:huge,category:'Income',payee:'Synthetic',classification:'income',status:'posted'}))};e.load('one',f);assert.equal(e.report('one',period).income,'18446744073709551614');assert.equal(e.report('one',period).netWorth,'18446744073709551614');}finally{e.close();}
});
test('Sync cannot overwrite an unrelated record that collides with its incoming ID',()=>{
 const e=new IndependentProof();try{e.load('one',canonical);const before=e.export('one');assert.throws(()=>e.sync('one','new-source',{id:'collision',nextCursor:'c1',rows:[{...canonical.transactions[0],sourceId:'new-source-id',amount:'1'}]}),/collision/i);assert.deepEqual(e.export('one'),before);assert.equal(e.connection('one','new-source'),null);}finally{e.close();}
});
test('Failed sync survives database close/reopen, retries once and restores its checkpoint',()=>{
 mkdirSync('.runtime/tests',{recursive:true});const path=resolve('.runtime/tests/restart-sync.db');for(const suffix of ['','-wal','-shm'])rmSync(path+suffix,{force:true});let e=new IndependentProof(path);const restored=new IndependentProof();
 const rows=[{...canonical.transactions[1],id:'bank-a',sourceId:'bank-a',amount:'-1700'},{...canonical.transactions[1],id:'bank-b',sourceId:'bank-b',amount:'-1800'}],packet={id:'job-1',nextCursor:'cursor-1',rows};
 try{e.load('one',canonical);assert.throws(()=>e.sync('one','fake-bank',{...packet,failAfter:1}),/Injected/);e.close();e=new IndependentProof(path);assert.equal(e.rows('one').length,12);assert.equal(e.connection('one','fake-bank'),null);e.sync('one','fake-bank',packet);assert(e.sync('one','fake-bank',packet).replayed);restored.restore(e.export('one'));assert.deepEqual(restored.connection('one','fake-bank'),e.connection('one','fake-bank'));assert.deepEqual(restored.report('one',period),e.report('one',period));assert.equal(e.report('one',period).spending,'182500');}finally{e.close();restored.close();for(const suffix of ['','-wal','-shm'])rmSync(path+suffix,{force:true});}
});
test('Sankey destination labels reserve separate readable slots without changing flow values',()=>{
 for(const fixture of [canonical,sample]){const graph=flowData(report(fixture.accounts,fixture.transactions,period)),before=structuredClone(graph),layout=flowLabelLayout(graph);const positions=graph.nodes.slice(layout.center+1).map((n,i)=>layout.labelY(layout.center+i+1));for(let i=1;i<positions.length;i++)assert(positions[i]-positions[i-1]>=32);assert(positions[0]>layout.top);assert(positions.at(-1)+12<=layout.height-layout.bottom);assert.deepEqual(graph,before);}
});
test('A real concurrent write between report queries cannot mix financial snapshots',()=>{
 mkdirSync('.runtime/tests',{recursive:true});const path=resolve('.runtime/tests/report-snapshot.db');for(const suffix of ['','-wal','-shm'])rmSync(path+suffix,{force:true});const writer=new IndependentProof(path);writer.db.exec('PRAGMA journal_mode=WAL');writer.load('one',canonical);const reader=new IndependentProof(path),readRows=reader.reportRows.bind(reader);let changed=false;
 reader.reportRows=(...args)=>{const rows=readRows(...args);if(!changed){changed=true;writer.update('one','rent-1',{amount:'-100000'},1);}return rows;};
 try{const during=reader.report('one',period);assert.equal(during.spending,'179000');assert.equal(during.netWorth,'441000');const after=reader.report('one',period);assert.equal(after.spending,'129000');assert.equal(after.netWorth,'491000');assert.equal(reader.db.isTransaction,false);}finally{reader.close();writer.close();for(const suffix of ['','-wal','-shm'])rmSync(path+suffix,{force:true});}
});
