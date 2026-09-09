import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, relative, isAbsolute, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { inspectPng } from './png.mjs';
import { exportChecks } from '../../tools/asset-lab/quality.mjs';
import { pixelChecks } from '../../tools/asset-lab/pixel-quality.mjs';

const RULES = {
  cabin: { anchors: ['ground', 'pilotSeat', 'weaponPivot', 'damageSmoke'], clips: ['idle', 'wreck'] },
  undercarriage: { anchors: ['ground', 'cabinMount', 'exhaust'], clips: ['idle', 'move', 'wreck'] },
  pilot: { anchors: ['pilotSeat', 'headAnchor', 'neckAnchor'], clips: ['idle', 'move', 'fire', 'hit', 'low-hp', 'fall', 'land', 'destroy', 'wreck'] },
  accessory: { anchors: ['attach'], clips: ['idle'] },
  weapon: { anchors: ['weaponPivot', 'muzzle'], clips: ['idle', 'fire', 'wreck'] },
  projectile: { anchors: ['origin'], clips: ['fly'] },
  effect: { anchors: ['origin'], clips: ['play'] },
  ui: { anchors: ['origin'], clips: ['idle'] },
  background: { anchors: ['origin'], clips: ['idle'] },
};
const ROLES = ['transparent', 'fixed', 'primary-light', 'primary-mid', 'primary-dark',
  'secondary-light', 'secondary-mid', 'secondary-dark', 'pilot', 'accessory', 'owner', 'smoke'];
const CHECKS = ['anatomy', 'fixedBody', 'sideView', 'readability', 'attachments', 'colors', 'timing', 'coverage'];
const LOOP = ['idle', 'move', 'low-hp', 'fall', 'wreck', 'fly'];
const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const positiveInt = value => Number.isSafeInteger(value) && value > 0;
function check(value, message) { if (!value) throw new Error(message); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function localFile(root, path) {
  check(typeof path === 'string' && path.length > 0 && !isAbsolute(path), 'relative file path required');
  const realRoot = realpathSync(root), file = realpathSync(resolve(realRoot, path));
  const rel = relative(realRoot, file);
  check(rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel), 'file escapes pack directory');
  check(statSync(file).isFile(), 'regular file required');
  return file;
}
function point(value, size) {
  return Array.isArray(value) && value.length === 2 && value.every((v, i) => Number.isInteger(v) && v >= 0 && v <= size[i]);
}
function clips(asset, count) {
  check(object(asset.clips), `${asset.id}: clips required`);
  for (const name of RULES[asset.kind].clips) check(asset.clips[name], `${asset.id}: missing ${name}`);
  for (const [name, clip] of Object.entries(asset.clips)) {
    check(idPattern.test(name) && object(clip), 'clip name/object');
    check(Array.isArray(clip.frames) && clip.frames.length > 0, 'clip frames required');
    check(clip.frames.every(n => Number.isInteger(n) && n >= 0 && n < count), 'frame index outside sheet');
    check(Array.isArray(clip.durationsMs) && clip.durationsMs.length === clip.frames.length, 'duration count');
    check(clip.durationsMs.every(n => positiveInt(n) && n <= 10000), 'duration must be 1..10000 ms');
    check(typeof clip.loop === 'boolean', 'explicit loop required');
    if (LOOP.includes(name)) check(clip.loop, `${name} must loop (held pose may repeat one frame)`);
    if (['fire', 'hit', 'land', 'destroy'].includes(name)) check(!clip.loop, `${name} must play once`);
  }
}
function anchors(asset, scale) {
  check(object(asset.anchors), 'anchors required');
  for (const name of RULES[asset.kind].anchors) check(asset.anchors[name], `${asset.id}: missing anchor ${name}`);
  for (const value of Object.values(asset.anchors)) check(point(value, asset.frameSize), 'anchor outside frame');
  if (asset.kind === 'cabin') {
    check(asset.id === 'cabin-standard', 'body is fixed: cabin-standard only');
    const [gx, gy] = asset.anchors.ground, [px, py] = asset.anchors.weaponPivot;
    check(gx === px && gy - py === 4 * scale, 'weapon pivot must be 4 cells above ground');
    const area = asset.faceSafeArea;
    check(Array.isArray(area) && area.length === 4 && area.every(Number.isInteger), 'faceSafeArea [x,y,w,h]');
    check(area[0] >= 0 && area[1] >= 0 && area[2] > 0 && area[3] > 0 &&
      area[0] + area[2] <= asset.frameSize[0] && area[1] + area[3] <= asset.frameSize[1], 'faceSafeArea bounds');
  }
  if (asset.kind === 'weapon') {
    const [px, py] = asset.anchors.weaponPivot, [mx, my] = asset.anchors.muzzle;
    check(mx - px === 4 * scale && my === py, 'right-facing resting muzzle must be 4 cells from pivot');
  }
}
function assetCheck(root, asset, scale) {
  check(object(asset) && typeof asset.id === 'string' && idPattern.test(asset.id), 'asset ID: lower-kebab-case');
  check(Object.hasOwn(RULES, asset.kind), `${asset.id}: unknown kind`);
  check(typeof asset.file === 'string' && extname(asset.file) === '.png', 'PNG file required');
  check(asset.alphaMode === undefined || asset.alphaMode === 'glass' && asset.kind === 'cabin', 'glass alpha mode is cabin-only');
  const png = inspectPng(readFileSync(localFile(root, asset.file)), { allowPartialAlpha: asset.alphaMode === 'glass' });
  check(typeof asset.source === 'string' && /\.(aseprite|ora)$/.test(asset.source), 'editable .aseprite or .ora source required');
  localFile(root, asset.source);
  check(Array.isArray(asset.frameSize) && asset.frameSize.length === 2 && asset.frameSize.every(positiveInt), 'frameSize [width,height]');
  check(png.width % asset.frameSize[0] === 0 && png.height % asset.frameSize[1] === 0, 'sheet must be an untrimmed regular grid');
  check(Array.isArray(asset.paletteRoles) && asset.paletteRoles.length === png.colors, 'palette roles must match PLTE');
  check(asset.paletteRoles[0] === 'transparent' && asset.paletteRoles.slice(1).every(r => ROLES.includes(r) && r !== 'transparent'), 'invalid palette roles');
  const count = png.width / asset.frameSize[0] * png.height / asset.frameSize[1];
  anchors(asset, scale);
  if (asset.frameAnchors !== undefined) {
    check(object(asset.frameAnchors), 'frameAnchors object required');
    for (const [frame, overrides] of Object.entries(asset.frameAnchors)) {
      check(/^(0|[1-9][0-9]*)$/.test(frame) && Number(frame) < count && object(overrides), 'frameAnchors index/object');
      check(Object.keys(overrides).every(key => Object.hasOwn(asset.anchors, key)), 'unknown anchor override');
      anchors({ ...asset, anchors: { ...asset.anchors, ...overrides } }, scale);
    }
  }
  clips(asset, count);
}
export function digestPack(root, pack = readJson(localFile(root, 'pack.json'))) {
  const hash = createHash('sha256');
  const paths = ['pack.json', ...pack.assets.flatMap(a => [a.file, a.source])];
  for (const path of [...new Set(paths)].sort()) {
    const bytes = readFileSync(localFile(root, path));
    hash.update(JSON.stringify([path, bytes.length]) + '\n'); hash.update(bytes);
  }
  return hash.digest('hex');
}
function releaseCheck(root, pack) {
  check(pack.metricsStatus === 'approved', 'release requires approved metrics');
  const review = readJson(localFile(root, 'review.json'));
  check(typeof review.reviewer === 'string' && review.reviewer.trim().length > 0, 'reviewer required');
  check(typeof review.reviewedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt), 'review date required');
  check(object(review.checks) && CHECKS.every(key => review.checks[key] === true), 'all visual checks required');
  check(review.digest === digestPack(root, pack), 'review digest mismatch: review exact files again');
}
function productionCheck(root,pack) {
  check(pack.qaProfile === 'modular-pilot-v2','unknown production QA profile');
  check(pack.generationModel === 'gpt-image-2.5-sunburst','production model mismatch');
  const images=new Map();
  for(const asset of pack.assets){
    if(asset.kind==='weapon')check(Array.isArray(asset.emissionPorts)&&[1,3].includes(asset.emissionPorts.length)&&
      asset.emissionPorts.every(p=>point(p,asset.frameSize)),'weapon emissionPorts required');
    for(const metric of asset.exportMetrics){
      check(idPattern.test(metric.sourceSheet),'source sheet ID');
      const bytes=readFileSync(localFile(root,'generated/'+metric.sourceSheet+'.png'));
      check(createHash('sha256').update(bytes).digest('hex')===metric.sourceHash,'source generation hash mismatch');
    }
    images.set(asset.id,inspectPng(readFileSync(localFile(root,asset.file)),{allowPartialAlpha:asset.alphaMode==='glass',pixels:true}));
  }
  for(const result of pixelChecks(pack,images))check(result.pass,result.name+': '+JSON.stringify(result.details??[]));
}
export function validatePack(root, { release = false } = {}) {
  const pack = readJson(localFile(root, 'pack.json'));
  check(pack.version === 1 && typeof pack.id === 'string' && idPattern.test(pack.id), 'pack version/id');
  check(['draft', 'approved'].includes(pack.metricsStatus), 'metricsStatus draft or approved');
  check(positiveInt(pack.artPixelsPerCell) && pack.artPixelsPerCell <= 16, 'artPixelsPerCell 1..16');
  check(Array.isArray(pack.assets) && pack.assets.length > 0, 'empty packs are not deliverables');
  check(new Set(pack.assets.map(a => a.id)).size === pack.assets.length, 'duplicate asset IDs');
  check(new Set(pack.assets.map(a => a.file)).size === pack.assets.length, 'one PNG per asset; split layers explicitly');
  for (const asset of pack.assets) assetCheck(root, asset, pack.artPixelsPerCell);
  for (const result of exportChecks(pack)) check(result.pass, result.name);
  if (pack.id === 'baseline-v2') check(pack.qaProfile === 'modular-pilot-v2','baseline-v2 QA profile required');
  if (pack.qaProfile !== undefined) productionCheck(root,pack);
  if (release) releaseCheck(root, pack);
  return { id: pack.id, assets: pack.assets.length, release };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [root, mode] = process.argv.slice(2);
    check(root && (!mode || ['--release', '--digest'].includes(mode)) && process.argv.length <= 4,
      'usage: node scripts/assets/validate.mjs <pack-directory> [--release|--digest]');
    const result = validatePack(root, { release: mode === '--release' });
    console.log(mode === '--digest' ? digestPack(root) : JSON.stringify(result));
  } catch (error) { console.error(`Asset validation failed: ${error.message}`); process.exitCode = 1; }
}
