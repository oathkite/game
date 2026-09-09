import { createHash } from 'node:crypto';
export const sourceDigest = bytes => createHash('sha256').update(bytes).digest('hex');
export function opaqueBounds(raw,width,height,threshold=200) {
 let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(raw[(y*width+x)*4+3]>threshold){
  left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
 }
 if(right<0)throw new Error('empty source cell');
 return [left,top,right-left+1,bottom-top+1];
}
export function validateCrop(raw,width,height) {
 const bounds=opaqueBounds(raw,width,height),[x,y,w,h]=bounds;
 if(x===0||y===0||x+w===width||y+h===height)throw new Error('opaque pixel at source crop edge');
 return bounds;
}
export function placeLandmark(point,sourceOrigin,scale,target) {
 return point.map((v,i)=>Math.round(target[i]-(v-sourceOrigin[i])*scale));
}
// Clip the generated glass to the generated rim's row envelope; never synthesize a new outline.
export function rimMask(glass,rim,width,height) {
 const out=Buffer.from(glass);
 for(let y=0;y<height;y++){
  let left=width,right=-1;
  for(let x=0;x<width;x++)if(rim[(y*width+x)*4+3]>200){left=Math.min(left,x);right=x;}
  for(let x=0;x<width;x++)if(x<left||x>right)out[(y*width+x)*4+3]=0;
 }
 return out;
}
