import { expect, type Page } from "@playwright/test";

// 部屋画面の操作手順。チームと武器は表の行の「変更」から開くダイアログで選ぶ。

const TEAM_NAMES = ["青", "赤", "緑", "紫", "黄", "青緑", "桃", "銀"] as const;
export const teamLabel = (teamId: string): string => `${TEAM_NAMES[Number(teamId.slice(1))]}チーム`;

export const members = (page: Page) => page.locator(".room-player-table tbody tr");

/** タイトルからロビーを経て部屋一覧へ進む。名前を渡すとロビーで入力する。 */
export const enterRooms = async (page: Page, nickname?: string): Promise<void> => {
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  if (nickname !== undefined) await page.getByLabel("名前", { exact: true }).fill(nickname);
  await page.getByRole("button", { name: "出撃", exact: true }).click();
  await expect(page.getByRole("button", { name: "部屋を作る", exact: true })).toBeEnabled();
};

/** 招待リンクなどで部屋画面へ直接入る前に、ロビーで入力するはずの名前を保存しておく。 */
export const presetNickname = async (page: Page, nickname: string): Promise<void> => {
  await page.addInitScript(name => {
    const key = "fortress.profile.v1";
    const current = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>;
    localStorage.setItem(key, JSON.stringify({ ...current, nickname: name }));
  }, nickname);
};

/** 部屋を作り、部屋コードを返す。 */
export const createRoom = async (page: Page): Promise<string> => {
  await page.getByRole("button", { name: "部屋を作る", exact: true }).click();
  await page.getByRole("dialog", { name: "部屋を作る" }).getByRole("button", { name: "部屋を作る", exact: true }).click();
  const code = page.getByTestId("room-code");
  await expect(code).toHaveText(/^[A-F0-9]{6}$/);
  return (await code.textContent())!;
};

/** 「部屋を探す」で部屋コードを絞り込み、一覧から参加する。 */
export const joinByCode = async (page: Page, code: string): Promise<void> => {
  await page.getByRole("button", { name: "部屋を探す", exact: true }).click();
  const filters = page.getByRole("dialog", { name: "部屋を探す" });
  await filters.getByLabel("部屋コード", { exact: true }).fill(code);
  await filters.getByRole("button", { name: "閉じる", exact: true }).click();
  await joinListed(page, code);
};

/** 一覧に出ている部屋へ参加する。招待リンクで開いた画面は部屋コードで絞り込み済み。 */
export const joinListed = async (page: Page, code: string): Promise<void> => {
  await page.locator(".public-rooms li").filter({ hasText: code }).getByRole("button", { name: "部屋に参加", exact: true }).click();
  await expect(page.getByTestId("room-code")).toHaveText(code);
};

export const teamOf = (page: Page, index: number) => members(page).nth(index).locator(".room-team-current [role=img]");

/** index 番目の参加者のチームを変える。オーナーは全員を、ほかの参加者は自分だけを変えられる。 */
export const assignTeam = async (page: Page, index: number, teamId: string): Promise<void> => {
  await members(page).nth(index).locator(".room-team-current").getByRole("button", { name: "変更", exact: true }).click();
  await page.getByRole("dialog", { name: "チーム" }).getByRole("button", { name: teamLabel(teamId), exact: true }).click();
  await expect(teamOf(page, index)).toHaveAccessibleName(teamLabel(teamId));
};

/** 自分の装備の slot 番目（0 始まり）を武器の表示名で選ぶ。 */
export const chooseWeapon = async (page: Page, slot: 0 | 1, weapon: string): Promise<void> => {
  const own = members(page).filter({ hasText: "（あなた）" });
  await own.locator(".room-member-weapons").getByRole("button", { name: "変更", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "武器変更" });
  await dialog.getByRole("button", { name: new RegExp(`^装備 ${slot + 1} `) }).click();
  await dialog.locator(".room-weapon-options").getByRole("button", { name: new RegExp(`^${weapon}`) }).click();
  await expect(own.locator(".room-member-weapons [role=img]").nth(slot)).toHaveAccessibleName(weapon);
  await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
};

export const readyUp = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "準備完了", exact: true }).click();
  await expect(page.getByRole("button", { name: "準備完了済み", exact: true })).toBeVisible();
};

/** 対戦画面の読み込みと開始時のマップ紹介が終わり、手番の操作を受け付けるまで待つ。 */
export const waitForBattle = async (page: Page): Promise<void> => {
  const world = page.getByTestId("network-world");
  await expect(world).toHaveAttribute("data-loaded", "true");
  await expect(world).toHaveAttribute("data-opening", "false", { timeout: 15000 });
};
