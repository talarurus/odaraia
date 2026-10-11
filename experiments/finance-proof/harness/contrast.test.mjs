// SPDX-License-Identifier: MPL-2.0
// Token arithmetic only; rendered/opacity/tooltip contrast and WCAG audit need a browser.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const css=readFileSync('visual/style.css','utf8');
const parse=body=>Object.fromEntries([...body.matchAll(/(--[a-z-]+):(#(?:[a-f0-9]{6}|[a-f0-9]{3}))(?=;|\})/g)].map(x=>[x[1],x[2].length===4?'#'+x[2].slice(1).split('').map(c=>c+c).join(''):x[2]]));
const light=Object.assign({},...[...css.matchAll(/:root\{([^}]+)\}/g)].map(x=>parse(x[1]+'}'))),dark={...light,...parse(css.match(/:root\[data-theme=dark\]\{([^}]+)\}/)[1]+'}')};
const luminance=h=>{const rgb=h.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
for(const [name,tokens] of [['light',light],['dark',dark]])test(`${name} theme base text/accent/income and chart palette contrast`,()=>{
 for(const fg of ['--text','--muted','--accent','--income'])for(const bg of ['--surface','--canvas','--sidebar','--subtle','--peach'])assert(contrast(tokens[fg],tokens[bg])>=4.5,`${fg} on ${bg}: ${contrast(tokens[fg],tokens[bg])}`);
 assert(contrast(tokens['--on-accent'],tokens['--accent'])>=4.5);
 for(const key of Object.keys(tokens).filter(k=>k.startsWith('--color-')||k==='--income-chart'))assert(contrast(tokens[key],tokens['--surface'])>=3,`${key}: ${contrast(tokens[key],tokens['--surface'])}`);
});
