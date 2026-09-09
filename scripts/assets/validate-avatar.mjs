import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {inspectPng} from './png.mjs';
import {portraitChecks} from '../../tools/asset-lab/avatar-checks.mjs';
import {sourceDigest} from './production.mjs';
export function validateAvatar(){
 const root=resolve('assets/workbench/avatar-kita-v1'),manifest=JSON.parse(readFileSync(root+'/avatar.json'));
 if(manifest.avatarPortraitVersion!==1||manifest.model!=='gpt-image-2.5-sunburst')throw new Error('Portrait format/model mismatch');
 const images=new Map();
 for(const layer of manifest.layers){
  const image=inspectPng(readFileSync(root+'/'+layer.file),{pixels:true});
  if(image.width!==manifest.frameSize[0]*3||image.height!==manifest.frameSize[1])throw new Error('Atlas dimensions');
  images.set(layer.id,image);
  if(readFileSync(root+'/'+layer.source).subarray(0,2).toString()!=='PK')throw new Error('ORA missing');
  const sheet=layer.id==='body'?'poses':layer.id,hash=sourceDigest(readFileSync(root+'/generated/'+sheet+'.png'));
  if(manifest.metrics[layer.id].some(m=>m.sourceHash!==hash))throw new Error('Source provenance mismatch');
 }
 const checks=portraitChecks(manifest,images),failed=checks.filter(c=>!c.pass);
 return {checks,failed,humanReview:'pending'};
}
if(process.argv[1]?.endsWith('/validate-avatar.mjs')){
 const report=validateAvatar();console.log(JSON.stringify(report,null,2));if(report.failed.length)process.exitCode=1;
}
