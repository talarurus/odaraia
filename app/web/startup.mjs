// SPDX-License-Identifier: MPL-2.0
// Stage identifiers only: never serialize errors, URLs, records or credentials.
export const startupStages=Object.freeze(['REACT_RENDER_REQUESTED','REACT_ROOT_MOUNTED','SESSION_REQUESTED','SESSION_ESTABLISHED','SESSION_FAILED','STATE_FETCH_STARTED','STATE_FETCHED','STATE_FETCH_FAILED','WORKSPACE_RENDERED','WORKSPACE_GEOMETRY_INVALID','REACT_RENDER_FAILED']);
const safeCodes=new Set(['SESSION_HTTP','SESSION_NETWORK','SESSION_RESPONSE','STATE_HTTP','STATE_NETWORK','STATE_RESPONSE','REACT_BOUNDARY']);
export function startupStage(stage,code=''){
 if(!startupStages.includes(stage))return;
 const bridge=globalThis.window?.webkit?.messageHandlers?.odaraia;
 if(!bridge)return;
 try{bridge.postMessage({type:'startup',stage,...(safeCodes.has(code)?{code}:{})});}catch{}
}
