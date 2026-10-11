// SPDX-License-Identifier: MPL-2.0
// Keep proportional nodes/links intact; reserve readable, evenly spaced destination labels.
export function flowLabelLayout(data){
 const center=data.nodes.findIndex(n=>n.kind==='center');
 const count=data.nodes.length-center-1,top=44,bottom=26;
 const height=Math.max(410,count*32+top+bottom);
 const slot=(height-top-bottom)/Math.max(count,1);
 return {height,top,bottom,center,labelY:index=>top+(index-center-1+.5)*slot};
}
