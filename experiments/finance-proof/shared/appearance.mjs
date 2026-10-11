// SPDX-License-Identifier: MPL-2.0
// Only this non-sensitive preference is persisted by the visual experiment.
export const appearanceKey='talarurus.appearance';
export const preferences=['light','dark','system'];
export const validPreference=value=>preferences.includes(value)?value:'system';
export function readPreference(storage){try{return validPreference(storage?.getItem(appearanceKey));}catch{return 'system';}}
export const resolveTheme=(preference,systemDark)=>validPreference(preference)==='system'?(systemDark?'dark':'light'):validPreference(preference);

// This exact function also runs in <head>, before styles or React, to avoid a wrong-theme flash.
export function bootstrapAppearance(){
 let preference='system';
 try{const saved=localStorage.getItem('talarurus.appearance');if(['light','dark','system'].includes(saved))preference=saved;}catch{}
 const dark=typeof matchMedia==='function'&&matchMedia('(prefers-color-scheme: dark)').matches;
 const theme=preference==='system'?(dark?'dark':'light'):preference;
 document.documentElement.dataset.theme=theme;
 document.documentElement.style.colorScheme=theme;
}
export const appearanceBootstrap=`(${bootstrapAppearance.toString()})();`;

export function observeAppearance({root,storage,media,onChange=()=>{}}){
 let preference=readPreference(storage),persistent=!!storage;
 try{storage?.getItem(appearanceKey);}catch{persistent=false;}
 function apply(){const theme=resolveTheme(preference,media.matches);root.dataset.theme=theme;root.style.colorScheme=theme;onChange({preference,theme,persistent});}
 const systemChanged=()=>{if(preference==='system')apply();};
 media.addEventListener('change',systemChanged);apply();
 return {
  setPreference(value){if(!preferences.includes(value))throw new Error('Invalid appearance preference');preference=value;try{storage.setItem(appearanceKey,value);persistent=true;}catch{persistent=false;}apply();},
  dispose(){media.removeEventListener('change',systemChanged);}
 };
}
