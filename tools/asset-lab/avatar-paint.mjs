import {recolor} from './paint.mjs';
export const defaultSkinColor='#e4be61';
export const defaultScarfColor='#c47746';
// Exact ownership in the exported 16-color palette; never guess hue at runtime.
const skin=[['228,190,97',0],['199,151,54',-.22],['137,107,54',-.48]];
const scarf=[['237,153,91',.25],['196,119,70',0],['118,76,56',-.4]];
export function paintAvatar(source,skinColor=defaultSkinColor,scarfColor=defaultScarfColor){
 const result=new Uint8ClampedArray(source),changes=new Map();
 for(const [color,original,shades]of [[skinColor,defaultSkinColor,skin],[scarfColor,defaultScarfColor,scarf]]){
  if(color===original)continue;
  for(const [rgb,tone]of shades)changes.set(rgb,recolor(color,tone));
 }
 for(let i=0;i<result.length;i+=4){
  if(result[i+3]!==255)continue;
  const color=changes.get([source[i],source[i+1],source[i+2]].join(','));
  if(color)result.set(color,i);
 }
 return result;
}
