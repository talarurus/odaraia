// SPDX-License-Identifier: MPL-2.0
import React, {useRef, useState} from 'react';
import {budgetActual, parseDollars} from '../domain/finance.mjs';
import {Card, Stats, Icon} from './reports.jsx';
import {useMoney, usePresentation} from './presentation.jsx';
import {dollars} from './forms.tsx';
import {api} from './api.ts';

export {Accounts} from './accounts.tsx';

// Only the progress bar uses a bounded percentage; money remains exact integer cents.
export function budgetProgress(actual:string, planned:string) {
 const a=BigInt(actual),p=BigInt(planned);
 return p<=0n ? (a>0n?100:0) : Number((a<=0n?0n:a>=p?10000n:a*10000n/p))/100;
}
export function Budgets({state,month,onSaved,onDrill}:any) {
 const money=useMoney(),preferences=usePresentation(),categoryInput=useRef<HTMLInputElement>(null);
 const [category,setCategory]=useState('Groceries'),[target,setTarget]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const budgets=state.budgets.filter((b:any)=>b.month===month).map((b:any)=>({...b,...budgetActual(state.accounts,state.transactions,month,b.category,b.planned)}));
 const sum=(key:string)=>budgets.reduce((total:bigint,b:any)=>total+BigInt(b[key]),0n);
 async function save(e:any){e.preventDefault();setBusy(true);setError('');setMessage('');try{await api('/budgets','POST',{month,category,planned:parseDollars(target)});setTarget('');await onSaved();setMessage('Budget target saved.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 function edit(b:any){setCategory(b.category);setTarget(dollars(b.planned));setMessage('');categoryInput.current?.focus();}
 return <div className="budget-workspace">
  <Stats items={[{label:'Total targets',value:money(sum('planned')),note:`${budgets.length} categories · ${month}`},{label:'Actual spending',value:money(sum('actual')),note:'Budgeted categories · after refunds'},{label:'Remaining',value:money(sum('remaining')),note:'Targets minus actual spending'},{label:'Over target',value:budgets.filter((b:any)=>BigInt(b.remaining)<0n).length,note:'Categories that need attention'}]}/>
  <Card surface="canvas" title={'Spending targets · '+month} className="budget-planner"><div className="planner-intro"><span className="eyebrow">A PLAN WITH ROOM TO BREATHE</span><h3>Give every category a little intention.</h3></div><p className="compact-note">Posted spending after refunds. Pending entries, transfers and adjustments are excluded. Targets apply to this month without rollover.</p>
   {budgets.length===0 ? <div className="empty-state" role="status"><strong>Give your spending a target</strong><p>Add a category and monthly amount below to track your progress.</p></div> : <div className="budget-list" data-surface="dense">{budgets.map((b:any)=>{const over=BigInt(b.remaining)<0n;return <article className={'budget-item '+(over?'over-budget':'')} key={b.category}><div className="budget-heading"><button className="budget-category" onClick={()=>onDrill({category:b.category,classification:'expense'})}>{b.category}<Icon name="right" size={14}/></button><button className="text-button" disabled={preferences.hidden} onClick={()=>edit(b)}>Edit target<span className="sr-only"> for {b.category}</span></button></div><div className="budget-amounts"><span>Spent <strong>{money(b.actual)}</strong></span><span>Target <strong>{money(b.planned)}</strong></span></div>{!preferences.hidden&&<div className="budget-track" role="img" aria-label={`${b.category}: ${money(b.actual)} spent of ${money(b.planned)} target`}><span style={{width:budgetProgress(b.actual,b.planned)+'%'}}/></div>}<p className={'budget-remaining '+(over?'warning-text':'')}>{money(b.remaining)} remaining {over&&<span className="status-tag">Overspent</span>}</p></article>;})}</div>}
   <form data-surface="grouped" className="form-grid budget-form" onSubmit={save} aria-busy={busy}><div className="form-wide section-intro"><h3>Add or update a target</h3><p>Use the same category name as your transactions.</p></div><label>Budget category<input ref={categoryInput} aria-label="Budget category" required maxLength={200} value={category} disabled={busy} onChange={e=>setCategory(e.target.value)}/></label><label>Target (USD)<input aria-label="Budget target" required inputMode="decimal" value={target} disabled={busy} placeholder="0.00" onChange={e=>setTarget(e.target.value)}/></label>{error&&<p className="error-message form-wide" role="alert">{error}</p>}{message&&<p className="import-summary form-wide" role="status">{message}</p>}<div className="form-actions form-wide"><button type="submit" className="orange-button" disabled={busy||preferences.hidden}>{busy?'Saving…':'Save budget target'}</button></div></form>
  </Card>
 </div>;
}
