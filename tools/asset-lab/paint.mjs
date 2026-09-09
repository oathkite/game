// Explicit material ownership for the baseline-v2 indexed palette. No runtime hue guessing.
const primary=new Set([5,6,7,8,9,10,11,12,13,26,27,28,29]);
const secondary=new Set([22,23,24,25]);
const tones={5:.35,6:.65,7:.85,8:.35,9:0,10:-.3,11:-.55,12:.55,13:-.15,
 22:.35,23:0,24:-.3,25:-.55,26:.2,27:-.12,28:.65,29:-.25};
export const paintTone=index=>tones[index]??0;
export function paintRoles(kind,count){
 return Array.from({length:count},(_,i)=>{
  if(i===0)return 'transparent';
  const owner=['cabin','weapon'].includes(kind)&&primary.has(i)?'primary':
   ['cabin','weapon','undercarriage'].includes(kind)&&secondary.has(i)?'secondary':null;
  return owner?owner+'-'+(paintTone(i)>0?'light':paintTone(i)<0?'dark':'mid'):'fixed';
 });
}
export function recolor(hex,tone){
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 return rgb.map(c=>Math.round(tone>=0?c+(255-c)*tone:c*(1+tone)));
}
export function validPaint(asset){
 const expected=paintRoles(asset.kind,32);
 return asset.paletteRoles?.length===32&&asset.paletteRoles.every((role,i)=>role===expected[i])&&
  asset.paletteTones?.length===32&&asset.paletteTones.every(t=>Number.isFinite(t)&&t>=-1&&t<=1);
}
