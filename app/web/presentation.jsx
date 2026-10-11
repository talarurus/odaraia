// SPDX-License-Identifier: MPL-2.0
import React,{createContext,useContext} from 'react';
import {defaultPreferences,formatAmount,percentageLabel} from './ui-model.mjs';
export const PresentationContext=createContext(defaultPreferences);
export const usePresentation=()=>useContext(PresentationContext);
export function useMoney(){const preferences=usePresentation();return (value,options)=>formatAmount(value,preferences,options);}
export function usePercentage(){const preferences=usePresentation();return (value,total,denominator)=>preferences.hidden?'••••':percentageLabel(value,total,denominator);}
export function Empty({title,note,onDemo}){return <div className="empty-state" role="status"><strong>{title}</strong><p>{note}</p>{onDemo&&<button onClick={onDemo}>Choose demo data</button>}</div>;}
export function HiddenChart(){return <Empty title="Financial amounts hidden" note="Charts are hidden too. Show amounts in Settings to view financial values."/>;}
export function FinanceTooltip({active,payload,label,denominator,total,history=false}){
 const money=useMoney(),percent=usePercentage(),preferences=usePresentation();
 if(preferences.hidden||!active||!payload?.length)return null;
 const row=payload[0].payload;
 const value=history?row.minor:row.value!==undefined&&row.chart!==undefined?row.value:Math.round(payload[0].value*100);
 return <div className="finance-tooltip" role="tooltip"><strong>{history?label:row.name||label||payload[0].name}</strong><div>{money(value)}</div>{denominator&&<small>{percent(value,total,denominator)}</small>}{history&&<><div>Daily change: {money(row.delta,{signed:true})}</div><small>{row.events?.length?row.events.join(' · '):'No posted transactions'}</small></>}</div>;
}
