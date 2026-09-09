export const STATES = Object.freeze({
  idle: { label: '待機', duration: 1200, note: '呼吸とまばたき' },
  move: { label: '移動', duration: 800, note: '履帯と搭乗者の揺れ' },
  fire: { label: '発射', duration: 1400, note: '反動・発射光・砲弾' },
  hit: { label: '被弾', duration: 500, note: '驚きから復帰' },
  'low-hp': { label: '低 HP', duration: 1600, note: '不安な表情と損傷煙' },
  fall: { label: '落下', duration: 1250, note: '下降・接地・着地から復帰' },
  land: { label: '着地', duration: 450, note: '沈み込みと土煙' },
  destroy: { label: '大破', duration: 1000, note: '一度だけ再生して残骸へ' },
  wreck: { label: '残骸', duration: 1600, note: '落胆した姿勢を保持' },
});
export const WEAPONS = Object.freeze({ cannon: '標準砲', triple: 'トリプル弾', multiple: 'マルチ弾',
  drill: '貫通弾', laser: 'レーザー弾', digger: '掘削弾', floater: '浮遊弾', stinger: '針弾' });
export function clipFrame(clip, time) {
  if (!clip?.frames?.length || clip.frames.length !== clip.durationsMs.length) throw new Error('Invalid clip');
  const total = clip.durationsMs.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error('Invalid clip duration');
  let at = clip.loop ? Math.max(0, time) % total : Math.min(Math.max(0, time), total - 1);
  for (let i = 0; i < clip.frames.length; i++) {
    if (at < clip.durationsMs[i]) return clip.frames[i];
    at -= clip.durationsMs[i];
  }
  return clip.frames.at(-1);
}
export function poseAt(requested, time, hp = 100) {
  const t = Math.max(0, time), resting = hp > 25 ? 'idle' : 'low-hp';
  let state = STATES[requested] ? requested : 'idle', clipTime = t;
  if (state === 'fall' && t >= 800) {
    state = t < 1250 ? 'land' : resting;
    clipTime = t - (t < 1250 ? 800 : 1250);
  } else if (state === 'destroy' && t >= 600) { state = 'wreck'; clipTime = t - 600; }
  else if (['fire', 'hit', 'land'].includes(state) && t >= STATES[state].duration) {
    clipTime = t - STATES[state].duration; state = resting;
  }
  if (state === 'idle' && hp > 0 && hp <= 25) state = 'low-hp';
  if (hp <= 0 && !['destroy', 'wreck'].includes(state)) state = 'wreck';
  const phase = clipTime / STATES[state].duration * Math.PI * 2;
  const bodyY = state === 'wreck' ? 8 : state === 'idle' ? Math.round(Math.sin(phase)) : state === 'move' ? Math.round(Math.sin(phase * 4)) :
    state === 'land' ? Math.round(3 * Math.sin(Math.min(1, clipTime / 450) * Math.PI)) : 0;
  return { state, time: t, clipTime, bodyY,
    recoil: state === 'fire' ? Math.round(3 * Math.sin(Math.min(1, clipTime / 180) * Math.PI)) : 0,
    smoke: state === 'low-hp' || state === 'wreck' || (hp > 0 && hp <= 25),
    explosion: state === 'destroy' ? Math.min(3, Math.floor(clipTime / 150)) : -1,
    flash: state === 'hit' && clipTime < 190 && Math.floor(clipTime / 60) % 2 === 0,
    airborne: state === 'fall' ? -Math.round(12 * (1 - Math.min(1, clipTime / 800))) : 0 };
}
export function runChecks(pack) {
  const results = [], pilot = pack.assets.find(a => a.id === 'pilot-frog');
  for (const [state, info] of Object.entries(STATES)) {
    const clip = pilot?.clips[state];
    let pass = Boolean(clip?.frames.length);
    if (pass) {
      let elapsed = 0;
      for (let i = 0; i < clip.frames.length; i++) {
        pass &&= clipFrame(clip, elapsed) === clip.frames[i];
        elapsed += clip.durationsMs[i];
      }
    }
    results.push({ name: `${info.label}：フレーム境界`, pass });
  }
  results.push({ name: '大破は残骸に遷移し、爆発を繰り返さない', pass: poseAt('destroy', 600, 0).state === 'wreck' && poseAt('destroy', 10000, 0).explosion === -1 });
  results.push({ name: '低 HP 中の被弾後は不安状態に戻る', pass: poseAt('hit', 501, 20).state === 'low-hp' });
  results.push({ name: '低 HP 中の発射でも煙を維持', pass: poseAt('fire', 80, 20).smoke });
  results.push({ name: 'HP 0 では通常待機に戻らない', pass: poseAt('idle', 500, 0).state === 'wreck' });
  results.push({ name: '落下は下降して着地し、待機へ戻る', pass: poseAt('fall', 0).airborne < poseAt('fall', 700).airborne && poseAt('fall', 800).state === 'land' && poseAt('fall', 1250).state === 'idle' });
  results.push({ name: '遷移先のアニメーションを先頭から再生', pass: poseAt('hit', 500, 20).clipTime === 0 && poseAt('destroy', 600).clipTime === 0 && poseAt('fall', 800).clipTime === 0 });
  results.push({ name: '全状態・時刻の変位に不正な数値がない', pass: Object.keys(STATES).every(s =>
    [0, 70, 190, 590, 600, 1600, 10000].every(t => Object.values(poseAt(s, t)).every(v => typeof v !== 'number' || Number.isFinite(v)))) });
  return results;
}

export function firingMotion(weapon,pose) {
  const launches=weapon==='multiple'?9:weapon==='triple'?3:1;
  const times=Array.from({length:launches},(_,i)=>pose.clipTime-Math.floor(i/3)*180-(i%3)*50);
  const recoil=pose.state==='fire'?Math.max(0,...times.map(t=>t>=0&&t<180?Math.round(3*Math.sin(t/180*Math.PI)):0)):0;
  return {times,recoil,bodyX:recoil?-Math.round(recoil*2/3):0};
}
