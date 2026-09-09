import { validPaint } from './paint.mjs';
// Shared by the browser inspector and the export gate; no DOM or image-generation dependency.
export function exportChecks(pack) {
  const assets = pack.assets.filter(a => a.exportMetrics !== undefined || pack.productionMethod === 'imagegen' || pack.id === 'baseline-v1');
  const proportional = assets.every(a => {
    const count = Math.max(...Object.values(a.clips).flatMap(c => c.frames)) + 1;
    return a.exportMetrics?.length === count && a.exportMetrics.every(m =>
      Number.isFinite(m.scale) && m.scale > 0 &&
      ['sourceSize', 'outputSize', 'outputOrigin'].every(k => Array.isArray(m[k]) && m[k].length === 2) &&
      m.sourceSize.every(n => Number.isInteger(n) && n > 0) &&
      m.outputSize.every((n, i) => n === Math.max(1, Math.round(m.sourceSize[i] * m.scale))) &&
      m.outputOrigin.every((n, i) => Number.isInteger(n) && n >= 0 && n + m.outputSize[i] <= a.frameSize[i]));
  });
  const shared = assets.every(a => !['pilot', 'undercarriage', 'effect'].includes(a.kind) ||
    (a.exportMetrics?.length > 0 && a.exportMetrics.every(m => m.scale === a.exportMetrics[0].scale)));
  const attachments = assets.filter(a => a.kind === 'pilot').every(a =>
    Object.values(a.clips).flatMap(c => c.frames).every(f => a.frameFaceAreas?.[f]?.length === 4 &&
      a.frameFaceAreas[f].every(Number.isInteger) && a.frameFaceAreas[f][2] > 0 && a.frameFaceAreas[f][3] > 0 &&
      [0,1].every(i => a.frameFaceAreas[f][i] >= 0 && a.frameFaceAreas[f][i]+a.frameFaceAreas[f][i+2] <= a.frameSize[i]) &&
      ['headAnchor', 'neckAnchor'].every(k =>
      a.frameAnchors?.[f]?.[k]?.length === 2 && a.frameAnchors[f][k].every((n, i) =>
        Number.isInteger(n) && n >= 0 && n < a.frameSize[i]))));
  return [
    ...(pack.qaProfile==='modular-pilot-v2'?[{name:'塗装：黄色・ベージュの全階調と固定色を定義',pass:pack.assets.every(validPaint)}]:[]),
    { name: '書き出し：全コマの縦横比と配置を保持', pass: proportional },
    { name: '書き出し：ポーズ・履帯・連続効果は共通倍率', pass: shared },
    { name: '書き出し：全ポーズの頭・首の接続点を指定', pass: attachments },
  ];
}
