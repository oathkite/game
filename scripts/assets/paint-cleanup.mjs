import {paintRoles,paintTone} from '../../tools/asset-lab/paint.mjs';
// Only isolated shading inside opaque primary paint: never cross material or atlas boundaries.
export function cleanPaint(indices,width,height,kind,frameWidth=width,frameHeight=height){
 const out=new Uint8Array(indices),roles=paintRoles(kind,32);
 if(!['cabin','weapon'].includes(kind))return out;
 const primary=i=>roles[i]?.startsWith('primary-');
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  if(x%frameWidth===0||x%frameWidth===frameWidth-1||y%frameHeight===0||y%frameHeight===frameHeight-1)continue;
  const at=y*width+x,current=indices[at];if(!primary(current))continue;
  const neighbours=[];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)neighbours.push(indices[at+dy*width+dx]);
  if(!neighbours.every(primary))continue;
  const frame=Math.floor(y/frameHeight)*(width/frameWidth)+Math.floor(x/frameWidth);
  const px=x%frameWidth,py=y%frameHeight;
  const panel=kind==='cabin'&&frame===1&&((px>=45&&px<=97&&py>=94&&py<=109)||(px>=106&&px<=123&&py>=100&&py<=113));
  if(panel&&paintTone(current)>=.15){out[at]=12;continue;}
  const similar=neighbours.filter(i=>Math.abs(paintTone(i)-paintTone(current))<.1).length;
  if(similar>0)continue;
  const counts=new Map();for(const i of neighbours)counts.set(i,(counts.get(i)??0)+1);
  const [replacement,count]=[...counts].sort((a,b)=>b[1]-a[1])[0];
  if(count>=5)out[at]=replacement;
 }
 return out;
}
