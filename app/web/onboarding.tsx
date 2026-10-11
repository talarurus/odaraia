// SPDX-License-Identifier: MPL-2.0
import React,{useEffect,useRef} from 'react';

export function guideDismissed(storage?:Storage){try{return storage?.getItem('odaraia.onboarding')==='dismissed-v1';}catch{return false;}}
export function dismissGuide(storage?:Storage){try{storage?.setItem('odaraia.onboarding','dismissed-v1');}catch{}}
export function GettingStarted({state,onCreate,onTransaction,onNavigate,onDismiss,onDemo,hidden}:any){
 const title=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{title.current?.focus({preventScroll:true});},[]);
 return <section className="getting-started" aria-labelledby="getting-started-title">
  <div className="guide-heading"><h2 id="getting-started-title" ref={title} tabIndex={-1}>Welcome to Odaraia</h2><button className="export-button" onClick={onDismiss}>Skip guide</button></div>
  <p>A clear view of your money. Track accounts, spending and cash flow on your device, with manual entry and CSV import.</p>
  <div className="welcome-actions"><button className="orange-button" disabled={hidden} onClick={onCreate}>Add account</button><button className="export-button" onClick={onDemo}>Explore demo</button></div>
  {state.accounts.length>0&&<p role="status">Your first account is ready. You can add transactions or import a statement.</p>}
  <details className="setup-guidance"><summary>How to get started</summary>
   <div><h3>Your opening balance</h3><p>Use the balance at the end of the day before your first transaction. Money owed on a credit card is negative.</p></div>
   <div><h3>Bring in transactions</h3><p>Review a CSV before saving, or enter transactions yourself. Outflows are negative; income and refunds are positive. Pending entries stay out of balances until posted.</p><div className="welcome-actions"><button className="export-button" disabled={!state.accounts.length||hidden} onClick={()=>onNavigate('import')}>Import a bank CSV</button><button className="export-button" disabled={!state.accounts.length||hidden} onClick={onTransaction}>Add a transaction</button></div></div>
   <div><h3>Understand your money</h3><p>Spending is expenses less refunds. Cash flow compares classified income and spending. Paired transfers never create income or spending. Net worth uses dated opening balances and posted entries. Missing history stays unavailable. Choose the month containing your records to review reports.</p><div className="welcome-actions">{[['spending','Spending'],['cashflow','Cash flow'],['budgets','Budgets'],['networth','Net worth']].map(([page,label])=><button key={page} className="export-button" onClick={()=>onNavigate(page)}>{label}</button>)}</div></div>
   <div><h3>Keep a backup</h3><p>The local database and JSON backups are not encrypted. Keep copies in a private location. Restore validates your backup and requires an empty database.</p><button className="export-button" onClick={()=>onNavigate('settings','recovery')}>Open data & recovery</button></div>
   <button className="export-button" onClick={onDismiss}>Finish guide</button>
  </details>
  {hidden&&<p>Show amounts in Settings to enter financial data.</p>}
  <small>You can revisit this guide in Settings → About Odaraia.</small>
 </section>;
}
