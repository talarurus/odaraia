// SPDX-License-Identifier: MPL-2.0
import React from 'react';

/** Original web primitives. No Apple kit code, font files, or symbol artwork. */
export function Button({variant='secondary',className='',...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'quiet';}) {
 return <button type="button" className={`tf-button tf-button-${variant} ${className}`} {...props}/>;
}
export function SegmentedControl({options,value,onChange,label,className=''}:{options:readonly (readonly [string,any])[];value:string;onChange:(value:string)=>void;label:string;className?:string}) {
 return <div className={`tf-segments ${className}`} role="group" aria-label={label}>{options.map(([id])=><button type="button" key={id} aria-pressed={value===id} className={value===id?'selected':''} onClick={()=>onChange(id)}>{id}</button>)}</div>;
}
export function FinancialAmount({children,className='',...props}:React.HTMLAttributes<HTMLSpanElement>) {
 return <span className={`tf-amount ${className}`} {...props}>{children}</span>;
}
export type SurfaceKind='canvas'|'grouped'|'elevated'|'dense';
export function Surface({surface='canvas',className='',...props}:React.HTMLAttributes<HTMLElement>&{surface?:SurfaceKind}) {
 return <section className={`workspace-surface ${className}`} data-surface={surface} {...props}/>;
}
export function GroupSurface({className='',surface='grouped',...props}:React.HTMLAttributes<HTMLElement>&{surface?:SurfaceKind}) {
 return <Surface surface={surface} className={`tf-group ${className}`} {...props}/>;
}
export function AccountGlyph({type}:{type:string}) {
 const paths:Record<string,React.ReactNode>={
  checking:<><rect x="3" y="5" width="18" height="15" rx="4"/><path d="M3 10h18M7 15h3"/></>,
  savings:<><path d="M5 9h14v10H5zM3 9l9-6 9 6M9 12v4m6-4v4M3 21h18"/></>,
  credit:<><rect x="3" y="5" width="18" height="14" rx="4"/><path d="M3 10h18M15 15h2"/></>,
  asset:<><path d="m12 3 8 5v8l-8 5-8-5V8zM4 8l8 5 8-5M12 13v8"/></>,
  liability:<><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
 };
 return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]||paths.asset}</svg>;
}
