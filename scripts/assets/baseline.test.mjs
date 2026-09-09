import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validatePack } from './validate.mjs';
const root=fileURLToPath(new URL('../../assets/workbench/baseline-v1/',import.meta.url));
test('delivered baseline follows format and remains explicitly unapproved',()=>{
  assert.equal(validatePack(root).assets,25);
  assert.throws(()=>validatePack(root,{release:true}),/approved metrics/);
});
test('baseline includes all weapons and pilot reactions as independently editable assets',()=>{
  const pack=JSON.parse(readFileSync(new URL('../../assets/workbench/baseline-v1/pack.json',import.meta.url),'utf8'));
  for(const id of ['cannon','triple','multiple','drill','laser','digger','floater','stinger']){
    assert.ok(pack.assets.find(a=>a.id==='weapon-'+id));
    assert.ok(pack.assets.find(a=>a.id==='projectile-'+id));
  }
  assert.equal(Object.keys(pack.assets.find(a=>a.id==='pilot-frog').clips).length,9);
  assert.ok(pack.assets.find(a=>a.id==='glasses-blue'));
  assert.ok(pack.assets.find(a=>a.id==='scarf-orange'));
});
