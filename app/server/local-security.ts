// SPDX-License-Identifier: MPL-2.0
import {timingSafeEqual} from 'node:crypto';

export const accessCookie='odaraia-local-access';
export function sameSecret(value:string|null|undefined,secret:string) {
 if(!value||value.length!==secret.length)return false;
 const left=Buffer.from(value),right=Buffer.from(secret);
 return left.length===right.length&&timingSafeEqual(left,right);
}
export function hasAccess(headers:Headers,secret:string) {
 const cookies=(headers.get('cookie')||'').split(';').map(v=>v.trim());
 return cookies.some(v=>v.startsWith(accessCookie+'=')&&sameSecret(v.slice(accessCookie.length+1),secret));
}
export function authorizedLocalRequest(request:Request,secret?:string) {
 if(request.headers.get('sec-fetch-site')==='cross-site')return false;
 if(!secret)return true; // In-process synthetic test handlers only; HTTP always supplies a secret.
 return hasAccess(request.headers,secret)||sameSecret(request.headers.get('x-odaraia-access'),secret)||
  (new URL(request.url).pathname==='/api/session'&&request.method==='GET'&&sameSecret(request.headers.get('x-odaraia-launch'),secret));
}
