// SPDX-License-Identifier: MPL-2.0
import React, {useEffect, useId, useMemo, useRef, useState} from 'react';
import {Icon} from './reports.jsx';
import {HiddenChart} from './presentation.jsx';
import {Button,SegmentedControl,FinancialAmount,GroupSurface,AccountGlyph,Surface} from './design-system.tsx';
import {useMoney, usePresentation} from './presentation.jsx';
import {today} from './forms.tsx';
import {accountOverview, accountTypes, timeframes, historyObservation, historyKey, pointerHistoryIndex, historyGeometry} from './accounts-model.mjs';
import type {FinancialState, Account} from '../domain/types.ts';

const dateLabel=(date:string,full=false)=>new Date(date+'T00:00:00Z').toLocaleDateString('en-US',{month:full?'long':'short',day:'numeric',...(full?{year:'numeric' as const}:{}),timeZone:'UTC'});
type Props={state:FinancialState;onEdit?:(account:Account)=>void;onSelect?:(account:Account)=>void;onCreate:()=>void;onTransfer:()=>void;asOf?:string};

export function Accounts({state,onEdit,onSelect,onCreate,onTransfer,asOf=today()}:Props) {
 const [timeframe,setTimeframe]=useState('All');
 const model=useMemo(()=>accountOverview(state,timeframe,asOf),[state,timeframe,asOf]);
 const money=useMoney(),preferences=usePresentation();
 const summary=(className='')=><div className={'accounts-summary '+className} aria-label="Balance overview"><div><span><span className="accounts-summary-dot"/>Total assets</span><FinancialAmount>{money(model.current.assets)}</FinancialAmount></div><div><span><span className="accounts-summary-dot is-debt"/>Total liabilities</span><FinancialAmount>{money(model.current.liabilities)}</FinancialAmount></div></div>;
 return <div className="accounts-overview accounts-workspace">
  <Surface surface="canvas" className="accounts-hero" aria-labelledby="accounts-worth-title">
   <div className="accounts-hero-top"><div className="accounts-headline">
    <h2 id="accounts-worth-title">Total net worth</h2>
    <FinancialAmount className="accounts-worth" data-testid="accounts-total">{state.accounts.length?money(model.current.netWorth):'No accounts yet'}</FinancialAmount>
    <p className={'accounts-change '+(model.change===null?'is-unavailable':BigInt(model.change)===0n?'is-flat':BigInt(model.change)<0n?'decrease':'')}>{model.change!==null&&BigInt(model.change)!==0n&&<span className="accounts-change-direction" aria-hidden="true">{BigInt(model.change)<0n?'↘':'↗'}</span>}<strong data-testid="accounts-period-change">{state.accounts.length?money(model.change,{signed:true}):'Start with an account'}</strong><span>{model.change===null?'Period change unavailable':timeframe==='All'?`since ${dateLabel(model.baselineDate)}`:`vs ${dateLabel(model.baselineDate)} close`}</span></p>
    <p className="accounts-asof">Posted balances · {dateLabel(asOf,true)}</p>
   </div>
   {state.accounts.length>0&&summary()}
   </div>
   {state.accounts.length===0?<div className="accounts-empty" role="status"><AccountGlyph type="checking"/><h3>A clearer view of your finances</h3><p>Create an account, then import a CSV or add a transaction. Your balance history will appear here.</p><Button variant="primary" onClick={onCreate} disabled={preferences.hidden}>Create your first account</Button></div>:preferences.hidden?<HiddenChart/>:<AccountHistory model={model}/>}
   {state.accounts.length>0&&<div className="accounts-period-wrap"><SegmentedControl options={timeframes} value={timeframe} onChange={setTimeframe} label="Account history timeframe" className="accounts-periods"/><p>{dateLabel(model.start,true)} – {dateLabel(asOf,true)}</p></div>}
   {state.accounts.length>0&&summary('accounts-summary-mobile')}
   {state.accounts.length>0&&(model.partial||model.current.netWorth===null)&&<p className="accounts-coverage" role="status">{model.current.netWorth===null?'Some opening balances are after today. Total net worth is unavailable.':`Complete net worth is available ${model.firstKnown?'from '+dateLabel(model.firstKnown,true):'after every account has an opening balance'}. Earlier dates are unavailable; they are not zero.`}{model.change===null&&model.current.netWorth!==null?' This period starts before complete opening history, so its change is unavailable.':''}</p>}
  </Surface>
  <div className="accounts-collection">
   <header className="accounts-collection-heading"><div><h2>Your accounts <span>{state.accounts.length}</span></h2></div><Button variant="secondary" className="accounts-create" disabled={preferences.hidden} onClick={onCreate}><Icon name="plus"/> Create account</Button></header>
   {model.groups.length>0&&<div className="accounts-groups">{model.groups.map(group=>{
    // Positive member balances / total positive assets. Signed groups and debt never get an asset share.
    const share=!preferences.hidden&&['cash','assets'].includes(group.id)&&group.accounts.every(a=>a.balance!==null&&BigInt(a.balance)>=0n)&&model.current.netWorth!==null&&model.current.assets!==null&&BigInt(model.current.assets)>0n?Number(BigInt(group.total)*1000n/BigInt(model.current.assets))/10:null;
    return <GroupSurface surface="dense" className={'accounts-group accounts-group-'+group.id} key={group.id} aria-labelledby={'accounts-group-'+group.id}><header><div><h3 id={'accounts-group-'+group.id}>{group.name}</h3><p>{group.accounts.length} {group.accounts.length===1?'account':'accounts'}{share!==null?` · ${share}% of assets`:''}</p></div><FinancialAmount>{money(group.total)}</FinancialAmount></header><div className="accounts-group-rows">{group.accounts.map(account=><button type="button" key={account.id} className="accounts-row" onClick={()=>onSelect?onSelect(account):onEdit?.(account)} aria-label={`Open ${account.name}, ${accountTypes[account.type]}, balance ${money(account.balance)}`}><span className={'accounts-row-icon is-'+account.type}><AccountGlyph type={account.type}/></span><span className="accounts-row-name"><strong>{account.name}</strong><span>{accountTypes[account.type]} · USD{account.pending>0?` · ${account.pending} pending`:''}</span><small>{account.lastPosted?'Last posted entry · '+dateLabel(account.lastPosted,true):'Opening balance · '+dateLabel(account.anchor,true)}</small></span><span className="accounts-row-balance"><FinancialAmount>{money(account.balance)}</FinancialAmount><small>{account.balance===null?'History unavailable':BigInt(account.balance)<0n?'Owed':'Posted balance'}</small></span><Icon name="right" size={16}/></button>)}</div></GroupSurface>;
   })}</div>}
   {state.accounts.length>0&&<div className="accounts-actions"><p>Saved locally from manual entries and CSV imports.</p><Button variant="quiet" disabled={preferences.hidden||state.accounts.length<2} onClick={onTransfer}><Icon name="flow"/> Record transfer between accounts</Button></div>}
  </div>
  <details className="accounts-explanation"><summary>About these balances</summary><p>Balances exclude pending, voided, and future entries. Opening balances are end-of-day anchors. Before all accounts have opening coverage, total net worth is unavailable. Paired transfers cancel in net worth. Charts show daily closing values, not intraday prices.</p><p>Cash and credit groups show signed balances. Manual assets and liabilities have their own groups. Record dated valuations as Adjustment transactions; live valuations and banking are not connected.</p></details>
 </div>;
}

export function AccountHistory({model,seriesColor='var(--tf-chart)',fillColor=seriesColor}:any) {
 const money=useMoney(),id=useId(),plot=useRef<HTMLDivElement>(null);
 const [size,setSize]=useState({width:960,height:380});
 const [inspection,setInspection]=useState<{model:any;index:number|null}>({model,index:null});
 const selection=inspection.model===model?inspection.index:null;
 const setSelection=(index:number|null)=>setInspection(previous=>previous.model===model&&previous.index===index?previous:{model,index});
 useEffect(()=>{const element=plot.current;if(!element)return;const observer=new ResizeObserver(([entry])=>{if(entry.contentRect.width>0&&entry.contentRect.height>0)setSize({width:entry.contentRect.width,height:entry.contentRect.height});});observer.observe(element);return()=>observer.disconnect();},[Boolean(model.firstKnown)]);
 const observation=historyObservation(model,selection??model.count-1);
 const geometry=useMemo(()=>historyGeometry(model,size.width,size.height),[model,size.width,size.height]);
 const selected=selection!==null;
 function point(e:React.PointerEvent<SVGSVGElement>){const rect=e.currentTarget.getBoundingClientRect();setSelection(pointerHistoryIndex(e.clientX,rect.left,rect.width,model.count));}
 if(!geometry)return <div className="accounts-empty" role="status"><h3>History isn’t available yet</h3><p>The opening date of one or more accounts is after this period. Choose another timeframe or review the account’s opening balance.</p></div>;
 const selectedX=geometry.x(observation.date),selectedY=observation.minor===null?null:geometry.y(observation.minor);
 const axisWhole=BigInt(geometry.high)%100n===0n&&BigInt(geometry.low)%100n===0n;
 const currentDate=model.today||today();
 const flatNote=geometry.knownCount===1?'One recorded balance in this period.':geometry.flat?'No change in recorded daily balances.':null;
 return <figure className="accounts-history" style={{'--history-color':seriesColor} as React.CSSProperties}><span className="sr-only" id={id+'-accessible-instructions'}>Daily closing net worth. Today reflects posted entries recorded so far. Use arrow keys for a day, Page Up or Down for a week, Home or End for first or latest, Escape to reset. Missing balances are unavailable. Scale follows the visible values.</span>
  <div className={'accounts-inspection '+(selected?'is-selected':'')}><div><span>{selected?(observation.date===currentDate?'Selected balance · today':'Selected daily close'):(observation.date===currentDate?'As of today':'Latest daily close')}</span><strong data-testid="accounts-inspection-value">{dateLabel(observation.date,true)} · {money(observation.minor)}</strong></div><Button variant="quiet" className="accounts-inspection-reset" disabled={!selected} onClick={()=>setSelection(null)}>Return to latest</Button></div>
  <div className="accounts-chart" ref={plot}>
   <span className="accounts-axis accounts-axis-high" aria-hidden="true">{money(geometry.high,{whole:axisWhole})}</span><span className="accounts-axis accounts-axis-low" aria-hidden="true">{money(geometry.low,{whole:axisWhole})}</span>
   <svg viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" role="slider" tabIndex={0} aria-orientation="horizontal" aria-label="Net worth history" aria-describedby={id+'-accessible-instructions'} aria-valuemin={0} aria-valuemax={model.count-1} aria-valuenow={observation.index} aria-valuetext={`${dateLabel(observation.date,true)}: ${money(observation.minor)}`} onKeyDown={e=>{if(e.key==='Escape'){setSelection(null);return;}const next=historyKey(observation.index,e.key,model.count);if(next!==null){e.preventDefault();setSelection(next);}}} onPointerCancel={()=>setSelection(null)} onPointerDown={e=>{point(e);e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(e.pointerType==='mouse'||e.currentTarget.hasPointerCapture(e.pointerId))point(e);}} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}>
    <title>{`Daily closing net worth from ${model.start} to ${model.asOf}. Missing coverage remains unavailable.`}</title>
    <defs><linearGradient id={id+'-fill'} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={fillColor} stopOpacity=".14"/><stop offset="100%" stopColor={fillColor} stopOpacity="0"/></linearGradient></defs>
    {[size.height-26].map(y=><line key={y} className="accounts-gridline" x1="16" x2={size.width-16} y1={y} y2={y}/>)}
    {model.partial&&model.firstKnown&&<rect className="accounts-history-gap" x="16" y="26" width={Math.max(0,geometry.x(model.firstKnown)-16)} height={size.height-52}/>}
    <path d={geometry.area} fill={`url(#${id}-fill)`}/><path className="accounts-chart-underlay" d={geometry.line} aria-hidden="true"/><path className="accounts-chart-line" d={geometry.line}/>
    {selected&&<line className="accounts-cursor" x1={selectedX} x2={selectedX} y1="26" y2={size.height-26}/>}
    {selectedY!==null&&<><circle className="accounts-point-halo" cx={selectedX} cy={selectedY} r="9"/><circle className="accounts-point" cx={selectedX} cy={selectedY} r="4"/></>}
   </svg>
  </div>
  <div className="accounts-chart-dates" aria-hidden="true"><span>{dateLabel(model.start,model.start.slice(0,4)!==model.asOf.slice(0,4))}</span>{model.count>2&&<span className="accounts-chart-midpoint">{dateLabel(historyObservation(model,Math.floor((model.count-1)/2)).date)}</span>}<span>{dateLabel(model.asOf,model.start.slice(0,4)!==model.asOf.slice(0,4))}</span></div>
  <figcaption><span>{flatNote||'Posted daily balances · Hover or drag to explore'}</span><details><summary>Chart guide</summary><p id={id+'-instructions'}>Use arrow keys for a day, Page Up/Down for a week, Home/End for the first/latest close, and Escape to return to latest. The vertical scale follows visible values. Balances change on their recorded dates; the line preserves those steps. Today reflects posted entries recorded so far. No projections are shown.</p></details></figcaption>
  {model.partial&&<p className="compact-note history-coverage" role="status">{model.firstKnown?`Complete net worth is available from ${dateLabel(model.firstKnown,true)}. `:''}Earlier dates are unavailable, not zero. The chart does not join missing history.</p>}
 </figure>;
}

export function AccountDetails({state,account,onEdit,onTransactions,asOf=today()}:any) {
 const money=useMoney(),preferences=usePresentation();
 const detail=accountOverview(state,'All',asOf).rows.find(a=>a.id===account.id);
 if(!detail)return <p role="status">This account is no longer available. Close this view and refresh.</p>;
 return <div className="accounts-detail"><span className="accounts-detail-type">{accountTypes[detail.type]} · USD</span><h3>{detail.name}</h3><p className="accounts-detail-amount">{money(detail.balance)}</p><p className="accounts-detail-asof">Posted balance as of {dateLabel(asOf,true)}</p><dl><dt>Opening balance</dt><dd>{money(detail.opening)}</dd><dt>Opening date</dt><dd>{dateLabel(detail.anchor,true)}</dd><dt>Last posted entry</dt><dd>{detail.lastPosted?dateLabel(detail.lastPosted,true):'No posted transactions'}</dd><dt>Pending entries</dt><dd>{detail.pending} · Excluded from balance</dd></dl><p>Saved locally from manual entries and CSV imports. No live banking or price updates.</p><div className="accounts-detail-actions"><button className="orange-button" onClick={()=>onTransactions(detail)}>View transactions</button><button className="export-button" disabled={preferences.hidden} onClick={()=>onEdit(detail)}>Edit account</button></div></div>;
}
