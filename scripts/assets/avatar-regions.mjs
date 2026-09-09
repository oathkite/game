// Registered cloth silhouettes, in art-pixel coordinates, own the scarf palette.
export function insidePolygon(x,y,polygon){
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const [ax,ay]=polygon[i],[bx,by]=polygon[j];
  if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
 }
 return inside;
}
// Palette-only cleanup inside skin; preserve silhouettes, fixed colors and cloth.
export function cleanSkinRows(rows,width,height){
 const out=Buffer.from(rows),stride=width+1,skin=new Set([2,3,4]);
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  const at=y*stride+x+1;if(!skin.has(rows[at]))continue;
  const counts=new Map();let neighbors=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(!dx&&!dy)continue;const color=rows[at+dy*stride+dx];
   if(skin.has(color)){neighbors++;counts.set(color,(counts.get(color)??0)+1);}
  }
  if(neighbors<7)continue;
  for(const [color,count]of counts)if(count>=5)out[at]=color;
 }
 return out;
}
