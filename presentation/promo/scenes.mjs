// 紹介動画の場面。どれも、今のゲームを偽の時計で 1/60 秒ずつ進めて撮る。
// 撮った場面は out/scenes/<名前>.mp4 になり、edit.mjs が小節に合わせて切り出してつなぐ。
import { BEAT, DEFAULT_PROFILE, FPS, LAB_LOOKS, openGame, record, skip, skipUntil } from './lib.mjs';
import { aimCandidates, isActing, isOpeningDone, isReady, pause, startFreePractice, towardOpponent, view } from './game.mjs';

const profileWith = (colors, loadout = DEFAULT_PROFILE.loadout) => ({ ...DEFAULT_PROFILE, colors: { ...DEFAULT_PROFILE.colors, ...colors }, loadout });

/** 1 コマに 1 度ずつ角度を変える。向きが違えば先に向きを変える */
const aimAt = async (rec, page, { facing, elevation }) => {
  let v = await view(page);
  if (v.control.facing !== facing) {
    await page.keyboard.press(facing === 1 ? 'ArrowRight' : 'ArrowLeft');
    await rec.frames(6);
    v = await view(page);
  }
  const diff = elevation - v.control.elevation;
  const key = diff > 0 ? 'ArrowUp' : 'ArrowDown';
  for (let i = 0; i < Math.abs(diff); i += 1) {
    await page.keyboard.press(key);
    await rec.frames(1);
  }
};

/** パワー power で撃つ。押している時間でパワーが決まる（apps/e2e の tutorial.spec.ts と同じ 15 ms で 1） */
const fire = (rec, power) => rec.hold('Space', power * 15 + 3);

/** 再生が終わって次の手番が来るまで撮り、その後 after コマ撮る */
const recordUntilNextTurn = async (rec, page, after = 0, limit = 900) => {
  const seat = (await view(page)).seat;
  await rec.frames(30);
  for (let i = 0; i < limit; i += 1) {
    const v = await view(page);
    if (v.result || (v.phase === 'acting' && v.seat !== seat)) break;
    await rec.frames(1);
  }
  await rec.frames(after);
};

/** 格納庫の機体を、拍ごとに入れ替える見た目。[拍, カラー1（砲塔）, カラー2（車体）, 砲塔, 足回り]。最後が対戦で使う機体 */
const HANGAR_LOOKS = [
  [0, 'white', 'blue', 'dome', 'tracks'], [2, 'yellow', 'green', 'box', 'wheels'], [4, 'pink', 'purple', 'onion', 'hover'], [6, 'orange', 'cyan', 'wide', 'bigTracks'],
  [8, 'mint', 'red', 'pot', 'walker'], [9, 'blue', 'yellow', 'flat', 'stoneWheels'], [10, 'red', 'white', 'wedge', 'ball'], [11, 'green', 'orange', 'fin', 'reverseJoint'],
  [12, 'cyan', 'pink', 'onion', 'tracks'], [12.5, 'yellow', 'blue', 'box', 'hover'], [13, 'white', 'green', 'pot', 'bigTracks'], [13.5, 'purple', 'mint', 'flat', 'walker'],
  [14, 'orange', 'red', 'dome', 'wheels'], [14.5, 'pink', 'cyan', 'wide', 'stoneWheels'], [15, 'blue', 'orange', 'wedge', 'ball'], [15.5, 'yellow', 'red', 'fin', 'reverseJoint'],
];
const TURRETS = ['dome', 'wide', 'box', 'wedge', 'fin', 'pot', 'onion', 'flat'];
const FRAMES = ['tracks', 'bigTracks', 'wheels', 'walker', 'hover', 'stoneWheels', 'reverseJoint', 'ball'];

/**
 * 開いたままのカスタマイズのモーダル（透明にしてある）で、色とスキンを選ぶ。
 * 選択のたびに機体の状態が変わるので、1 つ押すごとにタスクを 1 つ譲って描き直しを待つ（続けて押すと前の選択が上書きされる）
 */
const applyLook = async (page, [, secondary, primary, turret, frame]) => {
  const picks = [['カラー1', `[aria-label="${secondary}"]`], ['カラー2', `[aria-label="${primary}"]`],
    ['砲塔', `[role=radio]:nth-child(${TURRETS.indexOf(turret) + 1})`], ['足回り', `[role=radio]:nth-child(${FRAMES.indexOf(frame) + 1})`]];
  for (const [label, selector] of picks) {
    await page.evaluate(async ({ label, selector }) => {
      document.querySelector(`.tank-look-dialog [role=radiogroup][aria-label="${label}"] ${selector}`).click();
      await new Promise((resolve) => { const c = new MessageChannel(); c.port1.onmessage = resolve; c.port2.postMessage(0); });
    }, { label, selector });
  }
};

/** 条件が立つまで撮る */
const recordUntil = async (rec, page, predicate, limit = 600) => {
  for (let i = 0; i < limit && !(await page.evaluate(predicate)); i += 1) await rec.frames(1);
};

const pick = (candidates, score) => candidates.reduce((best, c) => (best === null || score(c) > score(best) ? c : best), null);

/** 自由練習を始めて、最初の手番まで撮らずに進める */
const freePractice = async ({ seed = 5, look = LAB_LOOKS[0], loadout = ['cannon', 'digger'], stage = '稜線', cinema = false, mobile = false, viewport } = {}) => {
  const game = await openGame({ seed, profile: profileWith(look, loadout), cinema, mobile, viewport });
  await startFreePractice(game.page, { stage });
  await pause(game.page);
  await skipUntil(game.page, isOpeningDone);
  await skipUntil(game.page, isReady);
  return game;
};

/** 撮らずに 1 手番を撃って終える。相手を狙うときは score で照準を選ぶ。狙わないときは角度とパワーを決め打ちする */
const skipShot = async (page, { score = null, elevation = 60, power = 30, away = false } = {}) => {
  await skipUntil(page, isReady);
  const v = await view(page);
  const facing = away ? -towardOpponent(v) : towardOpponent(v);
  const shot = score ? pick(await aimCandidates(page, { facing }), score) : { elevation, power };
  let c = v.control;
  if (c.facing !== facing) { await page.keyboard.press(facing === 1 ? 'ArrowRight' : 'ArrowLeft'); await skip(page, 100); }
  c = (await view(page)).control;
  for (let i = 0; i < Math.abs(shot.elevation - c.elevation); i += 1) await page.keyboard.press(shot.elevation > c.elevation ? 'ArrowUp' : 'ArrowDown');
  await page.keyboard.down('Space');
  await skip(page, shot.power * 15 + 3);
  await page.keyboard.up('Space');
  const seat = v.seat;
  await skipUntil(page, (s) => { const w = window.__fortress.getView(); return w.result !== null || (w.phase === 'acting' && w.currentSeat !== s); }, seat, 60000);
};

const BEST_HIT = (c) => c.dealt * 1000 - c.apex / 1e4;

export const SCENES = {
  // 格納庫の機体の砲塔と足回りと色が、拍ごとに入れ替わる（小節 0–3）。パネルとモーダルは透明にして機体だけを映す
  hangar: async (name) => {
    const hideCss = `.world-lobby header, .world-loadout > :not(.tank-look), .tank-look-summary, .tank-look-open, .tank-look-dialog { opacity: 0 !important; }
      .world-loadout { visibility: hidden !important; } .tank-look-dialog { visibility: visible !important; }
      .tank-look-dialog::backdrop { background: transparent !important; }`;
    const { browser, page } = await openGame({ seed: 1, hideCss });
    await page.getByRole('button', { name: 'はじめる', exact: true }).click();
    // パネルは隠してあるので、カスタマイズのボタンは DOM から押す
    await page.locator('.tank-look-open').evaluate((b) => b.click());
    await page.locator('.tank-look-dialog [role=radiogroup]').first().waitFor();
    await applyLook(page, HANGAR_LOOKS[0]);
    await skip(page, 3000);
    await pause(page);
    const rec = await record(page, name);
    const end = Math.round(16 * BEAT * FPS) + 60;
    let next = 1;
    await rec.frames(end, async (i) => {
      if (next < HANGAR_LOOKS.length && i >= Math.round(HANGAR_LOOKS[next][0] * BEAT * FPS)) { await applyLook(page, HANGAR_LOOKS[next]); next += 1; }
    });
    await rec.stop();
    await browser.close();
  },

  // タイトル。ボタンと言語の選択は隠す（小節 4）
  title: async (name) => {
    const hideCss = '.world-ui button, .world-ui select { opacity: 0 !important; }';
    const { browser, page } = await openGame({ hideCss });
    await pause(page);
    const rec = await record(page, name);
    await rec.frames(Math.round(3 * FPS));
    await rec.stop();
    await browser.close();
  },

  // 締め。タイトルの「はじめる」の位置に、公開の URL を 1 文字ずつ打つ（小節 24 から）
  endcard: async (name) => {
    const url = 'fortress-9hj.pages.dev';
    const { browser, page } = await openGame({ hideCss: '.world-ui select { opacity: 0 !important; }' });
    await pause(page);
    const button = page.getByRole('button', { name: 'はじめる', exact: true });
    await button.evaluate((b) => { b.dataset.promo = '1'; b.style.minWidth = '22ch'; b.style.fontSize = '28px'; b.style.padding = '10px 24px'; b.textContent = ''; });
    const rec = await record(page, name);
    await rec.frames(Math.round(4 * FPS), async (i) => {
      const typed = Math.min(url.length, Math.max(0, Math.floor((i - 12) / 2)));
      const cursor = Math.floor(i / 20) % 2 === 0 ? '█' : ' ';
      await page.evaluate((text) => { document.querySelector('[data-promo]').textContent = text; }, url.slice(0, typed) + cursor);
    });
    await rec.stop();
    await browser.close();
  },

  // 掘削弾で山の斜面をえぐる（小節 9）。HUD は隠す
  dig: async (name) => {
    const { browser, page } = await freePractice({ cinema: true });
    const rec = await record(page, name);
    await page.keyboard.press('KeyE');
    await rec.frames(10);
    const v = await view(page);
    await aimAt(rec, page, { facing: towardOpponent(v), elevation: 22 });
    await rec.mark('fire');
    await fire(rec, 62);
    await recordUntilNextTurn(rec, page, 20);
    await rec.stop();
    await browser.close();
  },

  // 足回りごとの移動（小節 10–11）。4 つの機体を、それぞれ相手のほうへ歩かせる
  ...Object.fromEntries([
    ['move-reverseJoint', { primary: 'red', secondary: 'yellow', turret: 'fin', frame: 'reverseJoint' }],
    ['move-hover', { primary: 'purple', secondary: 'pink', turret: 'onion', frame: 'hover' }],
    ['move-walker', { primary: 'mint', secondary: 'purple', turret: 'flat', frame: 'walker' }],
    ['move-ball', { primary: 'orange', secondary: 'blue', turret: 'wedge', frame: 'ball' }],
  ].map(([scene, look]) => [scene, async (name) => {
    const { browser, page } = await freePractice({ look, cinema: true });
    const rec = await record(page, name);
    await rec.frames(20);
    const key = towardOpponent(await view(page)) === 1 ? 'ArrowRight' : 'ArrowLeft';
    await rec.mark('walk');
    await page.keyboard.down(key);
    await rec.frames(240);
    await page.keyboard.up(key);
    await rec.frames(30);
    await rec.stop();
    await browser.close();
  }])),

  // FX ラボで 8 種の武器を順に撃つ（小節 12–13）。武器ごとに場面を分け、削った瞬間に carve の目印をつける
  weapons: async () => {
    const { browser, page } = await openGame({ url: '/?prototype=fx&still=1', hideCss: '[data-testid=fx-panel] { display: none !important; }' });
    await skipUntil(page, () => Boolean(window.__fxLab));
    await page.evaluate(() => { const lab = window.__fxLab; lab.setLoop(false); lab.resume(); });
    await pause(page);
    for (const weapon of ['cannon', 'triple', 'multiple', 'drill', 'laser', 'digger', 'floater', 'stinger']) {
      const rec = await record(page, `weapon-${weapon}`);
      await page.evaluate((w) => { window.__fxLab.resetStats(); window.__fxLab.fire(w); }, weapon);
      await rec.mark('fire');
      for (let i = 0; i < 600; i += 1) {
        if (await page.evaluate(() => window.__fxLab.stats().carves > 0)) break;
        await rec.frames(1);
      }
      await rec.mark('carve');
      await rec.frames(90);
      await rec.stop();
    }
    await browser.close();
  },

  // FX ラボで、的を撃破する着弾を 1/8 の速さで（小節 16–18）
  slowmo: async (name) => {
    const { browser, page } = await openGame({ url: '/?prototype=fx&still=1', hideCss: '[data-testid=fx-panel] { display: none !important; }' });
    await skipUntil(page, () => Boolean(window.__fxLab));
    await pause(page);
    // 先に等倍で撃って削る瞬間までの時間を測り、同じ射撃を撃ち直して直前で 1/8 に落とす
    const carveAt = await page.evaluate(() => {
      const lab = window.__fxLab;
      lab.setLoop(false); lab.setTargetHp(10); lab.resetStats(); lab.fire('cannon');
      let t = 0;
      while (lab.stats().carves === 0 && t < 8000) { lab.step(16); t += 16; }
      return t;
    });
    await page.evaluate((ms) => { const lab = window.__fxLab; lab.setTargetHp(10); lab.fire('cannon'); lab.step(ms); lab.setSpeed(0.125); lab.resume(); }, carveAt - 400);
    const rec = await record(page, name);
    for (let i = 0; i < Math.round(7 * FPS); i += 1) {
      if (!('carve' in rec.marks) && await page.evaluate(() => window.__fxLab.stats().carves > 0)) rec.mark('carve');
      await rec.frames(1);
    }
    await rec.stop();
    await browser.close();
  },

  // アイテム（小節 14–15）。P1 がダブルシュートで撃ち、P2 がテレポートで移る
  items: async (name) => {
    const { browser, page } = await freePractice();
    await skipUntil(page, () => !document.querySelector('.battle-items [data-item=double]').disabled);
    const item = (label) => page.locator('.battle-items').getByRole('button', { name: new RegExp(`^${label}`) });
    const rec = await record(page, name);
    await rec.frames(10);
    await item('ダブルシュート').click();
    await rec.frames(12);
    let v = await view(page);
    let facing = towardOpponent(v);
    const shot = pick(await aimCandidates(page, { facing, item: 'double' }), BEST_HIT);
    await aimAt(rec, page, { facing, elevation: shot.elevation });
    await rec.mark('double');
    await fire(rec, shot.power);
    await recordUntilNextTurn(rec, page, 0);
    await recordUntil(rec, page, () => !document.querySelector('.battle-items [data-item=teleport]').disabled);
    await rec.frames(10);
    await item('テレポート').click();
    await rec.frames(12);
    v = await view(page);
    facing = towardOpponent(v);
    await aimAt(rec, page, { facing, elevation: 55 });
    await rec.mark('teleport');
    await fire(rec, 48);
    await recordUntilNextTurn(rec, page, 10);
    await rec.stop();
    await browser.close();
  },

  // 決着（小節 20–21）。撮らずに P1 が当て続け、P2 の HP が残り 1 発になったら最後の 1 発を撮る
  finale: async (name) => {
    const { browser, page } = await freePractice({ cinema: true });
    for (let turn = 0; turn < 20; turn += 1) {
      const v = await view(page);
      if (v.seat === 0 && v.players[1].hp <= 35) break;
      if (v.seat === 0) await skipShot(page, { score: BEST_HIT });
      else await skipShot(page, { away: true, elevation: 70, power: 20 });
    }
    await skipUntil(page, isReady);
    const rec = await record(page, name);
    await rec.frames(20);
    const v = await view(page);
    const facing = towardOpponent(v);
    const shot = pick(await aimCandidates(page, { facing }), BEST_HIT);
    await aimAt(rec, page, { facing, elevation: shot.elevation });
    await rec.mark('fire');
    await fire(rec, shot.power);
    for (let i = 0; i < 600; i += 1) {
      if ((await view(page)).players[1].hp <= 0) break;
      await rec.frames(1);
    }
    await rec.mark('down');
    await rec.frames(Math.round(4 * FPS));
    await rec.stop();
    await browser.close();
  },

  // マップの開幕の見回し（小節 22–23）
  ...Object.fromEntries([['map-ridge', '稜線'], ['map-bridge', '石橋'], ['map-terraces', '段丘'], ['map-islands', '浮島']].map(([scene, stage]) => [scene, async (name) => {
    const { browser, page } = await openGame({ seed: 5, profile: profileWith(LAB_LOOKS[0]), cinema: true });
    await startFreePractice(page, { stage });
    await pause(page);
    const rec = await record(page, name);
    for (let i = 0; i < 600 && !(await page.evaluate(isOpeningDone)); i += 1) await rec.frames(1);
    await rec.mark('opened');
    await rec.frames(60);
    await rec.stop();
    await browser.close();
  }])),

  // スマートフォンの縦持ちと横持ち（小節 19）。発射のボタンを押して溜めて撃つ
  ...Object.fromEntries([['phone-portrait', { width: 390, height: 844 }], ['phone-landscape', { width: 844, height: 390 }]].map(([scene, viewport]) => [scene, async (name) => {
    const { browser, page } = await freePractice({ mobile: true, viewport });
    const rec = await record(page, name);
    await rec.frames(15);
    const v = await view(page);
    const facing = towardOpponent(v);
    const shot = pick(await aimCandidates(page, { facing }), BEST_HIT);
    // キーを使うとタッチの操作盤が引っ込むので、十字キーと発射のボタンを押す
    const tap = async (selector) => {
      const b = await page.locator(selector).boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down(); await page.mouse.up();
    };
    if (v.control.facing !== facing) { await tap(facing === 1 ? '.dpad-right' : '.dpad-left'); await rec.frames(6); }
    const from = (await view(page)).control.elevation;
    for (let i = 0; i < Math.abs(shot.elevation - from); i += 1) { await tap(shot.elevation > from ? '.dpad-up' : '.dpad-down'); await rec.frames(1); }
    const box = await page.locator('.battle-touch-fire').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await rec.mark('fire');
    await rec.holdWith(async () => { await page.mouse.move(x, y); await page.mouse.down(); }, () => page.mouse.up(), shot.power * 15 + 3);
    await recordUntilNextTurn(rec, page, 10);
    await rec.stop();
    await browser.close();
  }])),

  // 開幕のパンから、角度を決めて溜め、山越しに当てて地形が削れるまで（小節 5–8）
  core: async (name) => {
    const profile = profileWith({ primary: 'red', secondary: 'yellow', turret: 'fin', frame: 'reverseJoint' }, ['cannon', 'digger']);
    const { browser, page } = await openGame({ seed: 5, profile });
    await startFreePractice(page, { stage: '稜線' });
    await pause(page);
    const rec = await record(page, name);
    for (let i = 0; i < 600 && !(await page.evaluate(isOpeningDone)); i += 1) await rec.frames(1);
    await rec.mark('opened');
    for (let i = 0; i < 600 && !(await page.evaluate(isActing)); i += 1) await rec.frames(1);
    await rec.frames(20);
    const v = await view(page);
    const facing = towardOpponent(v);
    const shot = pick(await aimCandidates(page, { facing }), (c) => c.dealt * 1000 - c.apex / 1e4);
    console.log('core aim', JSON.stringify(shot));
    await aimAt(rec, page, { facing, elevation: shot.elevation });
    await rec.frames(10);
    await rec.mark('fire');
    await fire(rec, shot.power);
    await recordUntilNextTurn(rec, page, 30);
    await rec.stop();
    await browser.close();
  },
};
