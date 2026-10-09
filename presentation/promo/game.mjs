// ゲームの画面を進める操作。e2e（apps/e2e/world-tests）と同じ手順を、撮影の都合に合わせて書く。
import { ROOT as ROOT_PATH } from "./pw.mjs";

/** メニューの間は時計を流したままにし、撮る前に止める。止めるときは 1 秒先へ飛ぶ */
export const pause = async (page) => {
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
};

export const view = (page) => page.evaluate(() => {
  const v = window.__fortress?.getView();
  if (!v) return null;
  return {
    phase: v.phase, seat: v.currentSeat, mySeat: v.mySeat, control: v.control, wind: v.wind?.value,
    players: v.players?.map((p) => ({ x: p.x, y: p.y, hp: p.hp })), result: v.result ? true : false,
  };
});

export const isActing = () => window.__fortress?.getView().phase === 'acting';
/** 操作を受け付ける。手番の始まりの「あなたのターン」の間は武器のボタンが無効で、キーも捨てられる */
export const isReady = () => window.__fortress?.getView().phase === 'acting' && document.querySelector('.battle-weapons > button')?.disabled === false;
export const isOpeningDone = () => document.querySelector('[data-testid=camera-world]')?.getAttribute('data-opening') === 'false';

/** タイトルから自由練習の対戦を始め、戦場の読み込みまで待つ。stage は画面の表記（稜線、石橋、段丘、浮島） */
export const startFreePractice = async (page, { stage = '稜線', loadout = null } = {}) => {
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await page.getByRole('button', { name: 'プラクティス', exact: true }).click();
  await page.getByRole('button', { name: '自由練習', exact: true }).click();
  await page.getByRole('combobox', { name: 'ステージ' }).selectOption({ label: stage });
  if (loadout) {
    await page.getByRole('combobox', { name: '装備 1' }).selectOption({ label: loadout[0] });
    await page.getByRole('combobox', { name: '装備 2' }).selectOption({ label: loadout[1] });
  }
  await page.getByRole('button', { name: '自由練習をはじめる', exact: true }).click();
  await page.getByTestId('camera-world').and(page.locator('[data-loaded=true]')).waitFor({ timeout: 30000 });
};

/** 手番の機体から見て相手のいる向き。1 は右 */
export const towardOpponent = (v) => {
  const me = v.players[v.seat], opp = v.players[1 - v.seat];
  return opp.x > me.x ? 1 : -1;
};

/**
 * 今の手番で、facing の向きに撃って相手にダメージが入る照準を、sim の弾道計算で総当たりに探す。
 * 自分を巻き込む照準は除く。候補ごとに、相手へのダメージ、弾道の最高点（y が小さいほど高い）、飛ぶ tick 数を返す
 */
export const aimCandidates = (page, { facing, item = null } = {}) => page.evaluate(async ({ facing, item, root }) => {
  const sim = await import(`/@fs${root}/packages/sim/src/index.ts`);
  const protocol = await import(`/@fs${root}/packages/protocol/src/index.ts`);
  const v = window.__fortress.getView();
  const c = v.control, me = v.currentSeat, opp = 1 - me;
  const players = v.players.map((p) => ({ x: p.x, y: p.y, hp: p.hp }));
  const weapon = protocol.weaponOf(v.players[me].loadout, c.slot);
  const out = [];
  for (let elevation = 5; elevation <= 85; elevation += 1) {
    for (let power = 15; power <= 92; power += 1) {
      const input = { seat: me, weapon, x: c.x, y: c.y, facing, elevation, power, wind: v.wind.value, ...(item ? { item } : {}) };
      const r = sim.simulateShot(v.mask, players, input);
      const dealt = sim.damageDealtTo(r.result, opp), self = sim.damageDealtTo(r.result, me);
      if (dealt <= 0 || self > 0) continue;
      const pts = r.paths[0]?.points ?? [];
      const apex = pts.reduce((m, p) => Math.min(m, p.y), Infinity);
      out.push({ elevation, power, dealt, apex, ticks: pts.length });
    }
  }
  return out;
}, { facing, item, root: ROOT_PATH });
