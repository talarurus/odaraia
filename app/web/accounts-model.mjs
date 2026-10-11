// SPDX-License-Identifier: MPL-2.0
// Read-only Accounts presentation. The existing balanceSummary remains authoritative.
import {assertDate,balanceSummary} from '../domain/finance.mjs';
import {nextDate} from './ui-model.mjs';
const DAY=86400000;
export const accountTypes={checking:'Checking',savings:'Savings',credit:'Credit card',asset:'Manual asset',liability:'Manual liability'};
export const timeframes=[['1M',1],['3M',3],['6M',6],['1Y',12],['All',null]];
// Future groups are reserved in the information architecture, not advertised as working accounts.
export const accountGroups=[
 {id:'cash',name:'Cash',types:['checking','savings'],available:true},
 {id:'credit',name:'Credit',types:['credit'],available:true},
 {id:'assets',name:'Other assets',types:['asset'],available:true},
 {id:'liabilities',name:'Other liabilities',types:['liability'],available:true},
 {id:'investments',name:'Investments',types:[],available:false},
 {id:'real-estate',name:'Real estate',types:[],available:false},
];
const timestamp=date=>Date.parse(date+'T00:00:00Z');
const iso=ms=>new Date(ms).toISOString().slice(0,10);
export const dateAt=(start,index)=>iso(timestamp(start)+index*DAY);
export function trailingStart(date,months){
 assertDate(date);const [year,month,day]=date.split('-').map(Number);
 const total=Math.max(12,year*12+month-1-months),y=Math.floor(total/12),m=total%12+1;
 const prefix=String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0');
 // Date.parse avoids Date.UTC's special handling of years 0–99.
 const next=m===12?String(y+1).padStart(4,'0')+'-01-01':String(y).padStart(4,'0')+'-'+String(m+1).padStart(2,'0')+'-01';
 const lastDay=new Date(timestamp(next)-DAY).getUTCDate();
 return prefix+'-'+String(Math.min(day,lastDay)).padStart(2,'0');
}
export function accountOverview(state,timeframe='3M',asOf){
 assertDate(asOf);const option=timeframes.find(([id])=>id===timeframe);if(!option)throw new Error('Unknown account timeframe');
 const anchors=state.accounts.map(a=>a.anchor).sort();
 const start=option[1]===null?(anchors[0]&&anchors[0]<asOf?anchors[0]:asOf):trailingStart(asOf,option[1]);
 const end=nextDate(asOf),current=balanceSummary(state.accounts,state.transactions,{end});
 const accountMap=new Map(state.accounts.map(a=>[a.id,a]));
 const posted=state.transactions.filter(t=>{const a=accountMap.get(t.account);return a&&t.status==='posted'&&t.date>a.anchor&&t.date<=asOf;});
 const count=Math.round((timestamp(asOf)-timestamp(start))/DAY)+1;
 // Fixed ranges contain daily closes. All compresses unchanged dates to event observations;
 // stepping between them preserves every opening/posting change and full historical coverage.
 const dates=option[1]===null?[...new Set([start,asOf,...anchors.filter(d=>d>=start&&d<=asOf),...posted.filter(t=>t.date>=start).map(t=>t.date)])].sort():Array.from({length:count},(_,i)=>dateAt(start,i));
 const observations=state.accounts.length?dates.map(date=>({date,minor:balanceSummary(state.accounts,posted,{end:nextDate(date)}).netWorth})):[];
 const firstKnown=observations.find(d=>d.minor!==null),before=balanceSummary(state.accounts,posted,{end:start}).netWorth;
 const baseline=option[1]===null?firstKnown?.minor??null:before;
 const change=!state.accounts.length||baseline===null||current.netWorth===null?null:String(BigInt(current.netWorth)-BigInt(baseline));
 const rows=state.accounts.map(a=>{
  const dates=posted.filter(t=>t.account===a.id).map(t=>t.date).sort();
  return {...a,balance:current.balances[a.id]??null,lastPosted:dates.at(-1)||null,pending:state.transactions.filter(t=>t.account===a.id&&t.status==='pending').length};
 });
 const groups=accountGroups.filter(g=>g.available).map(g=>{
  const members=rows.filter(a=>g.types.includes(a.type));
  return {...g,accounts:members,total:members.some(a=>a.balance===null)?null:String(members.reduce((sum,a)=>sum+BigInt(a.balance),0n))};
 }).filter(g=>g.accounts.length);
 return {asOf,start,end,count,timeframe,current,observations,change,baselineDate:option[1]===null?firstKnown?.date??null:iso(timestamp(start)-DAY),firstKnown:firstKnown?.date??null,partial:observations.some(d=>d.minor===null),groups,rows};
}
export function historyObservation(model,index){
 const bounded=Math.max(0,Math.min(model.count-1,Math.round(index))),date=dateAt(model.start,bounded);
 let low=0,high=model.observations.length-1;
 while(low<high){const mid=Math.ceil((low+high)/2);if(model.observations[mid].date<=date)low=mid;else high=mid-1;}
 return {date,minor:model.observations[low]?.minor??null,index:bounded};
}
export function historyKey(index,key,count){
 const offsets={ArrowLeft:-1,ArrowRight:1,ArrowDown:-1,ArrowUp:1,PageDown:-7,PageUp:7};
 if(key==='Home')return 0;if(key==='End')return count-1;
 return key in offsets?Math.max(0,Math.min(count-1,index+offsets[key])):null;
}
export function pointerHistoryIndex(clientX,left,width,count,inset=16){
 const usable=Math.max(1,width-2*inset);
 return Math.round(Math.max(0,Math.min(1,(clientX-left-inset)/usable))*(count-1));
}
export function historyGeometry(model,width=960,height=300){
 const points=model.observations.filter(d=>d.minor!==null);if(!points.length)return null;
 const values=points.map(d=>BigInt(d.minor));let min=values[0],max=values[0];for(const v of values){if(v<min)min=v;if(v>max)max=v;}
 const span=max-min,proposed=span===0n?(min<0n?-min:min)/20n+100n:span/8n+1n;
 // At least a dollar of room on either side avoids magnifying a cent change.
 const padding=proposed<100n?100n:proposed,low=min-padding,high=max+padding;
 const x=date=>model.count===1?width/2:16+(timestamp(date)-timestamp(model.start))/DAY/Math.max(1,model.count-1)*(width-32);
 // Convert only bounded chart coordinates. No financial amount is converted to floating point.
 const y=minor=>26+Number((high-BigInt(minor))*1000000n/(high-low))/1000000*(height-52);
 let line='';for(const p of model.observations){if(p.minor===null){line='';continue;}line+=line?` H${x(p.date).toFixed(2)} V${y(p.minor).toFixed(2)}`:`M${x(p.date).toFixed(2)},${y(p.minor).toFixed(2)}`;}
 const area=line?line+` L${x(points.at(-1).date).toFixed(2)},${height-26} H${x(points[0].date).toFixed(2)} Z`:'';
 return {line,area,low:String(low),high:String(high),flat:span===0n,knownCount:points.length,x,y};
}
