// SPDX-License-Identifier: MPL-2.0
// Narrow native bridge. No file paths, commands, or authentication secrets enter React.
export const windowAppearanceKey='talarurus.windowAppearance';
export const validWindowAppearance=value=>value==='translucent'?'translucent':'solid';
export function readWindowAppearance(storage){try{return validWindowAppearance(storage?.getItem(windowAppearanceKey));}catch{return 'solid';}}
export function saveWindowAppearance(storage,value){if(!['solid','translucent'].includes(value))throw new Error('Invalid window appearance');try{storage?.setItem(windowAppearanceKey,value);return Boolean(storage);}catch{return false;}}
export const effectiveWindowAppearance=(requested,native,reduceTransparency)=>native&&!reduceTransparency?validWindowAppearance(requested):'solid';
export function nativeMessage(type,value){globalThis.window?.webkit?.messageHandlers?.odaraia?.postMessage({type,value});}

export const materialKey='talarurus.material';
export const defaultMaterial=Object.freeze({version:2,glass:0.55});
export function normalizeMaterial(value){
 const glass=typeof value?.glass==='number'&&Number.isFinite(value.glass)?Math.min(1,Math.max(0,value.glass)):({low:0.1,medium:0.55,high:0.9}[value?.intensity]??defaultMaterial.glass);
 return {version:2,glass};
}
export function readMaterial(storage){try{return normalizeMaterial(JSON.parse(storage?.getItem(materialKey)||'null'));}catch{return {...defaultMaterial};}}
export function saveMaterial(storage,value){try{storage?.setItem(materialKey,JSON.stringify(normalizeMaterial(value)));return Boolean(storage);}catch{return false;}}
export function applyMaterialPresentation({requested='solid',material=defaultMaterial,native=Boolean(globalThis.window?.__ODARAIA_NATIVE__),available=globalThis.window?.__ODARAIA_NATIVE__?.translucencyAvailable===true,reduceTransparency=false}={}){
 if(!globalThis.document)return;
 const root=document.documentElement,clean=normalizeMaterial(material),style=effectiveWindowAppearance(requested,native&&available,reduceTransparency);
 const host=globalThis.window?.__ODARAIA_NATIVE__;const effective=host?.effectiveWindowAppearance??style;root.dataset.windowStyle=effective;root.dataset.compositingMode=effective==='translucent'?'native-desktop-glass':'solid';
 root.style.setProperty('--glass-intensity',String(clean.glass));
 // Surface roles are owned by CSS. Only the native backdrop varies with intensity.
}
