import { expect, it } from "vitest";
import { markTutorialSeen, shouldOfferTutorial, TUTORIAL_KEY } from "../src/practice/tutorialSeen";
import { PROGRESS_KEY } from "../src/practice/progress";
import { PROFILE_KEY } from "../src/app/profile";

const memory = (entries: Readonly<Record<string, string>> = {}): Storage => {
  const values = new Map(Object.entries(entries));
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
};
const broken = (): Storage => { throw new Error("SecurityError"); };

it("何も保存されていない初回だけチュートリアルへ案内する", () => {
  expect(shouldOfferTutorial(() => memory())).toBe(true);
  expect(shouldOfferTutorial(() => memory({ [TUTORIAL_KEY]: "1" }))).toBe(false);
});

it("名前を入れたプロフィールかチャレンジの記録があれば、今までに遊んだ人として案内しない", () => {
  expect(shouldOfferTutorial(() => memory({ [PROFILE_KEY]: JSON.stringify({ nickname: "Kita" }) }))).toBe(false);
  expect(shouldOfferTutorial(() => memory({ [PROGRESS_KEY]: "{}" }))).toBe(false);
  expect(shouldOfferTutorial(() => memory({ "fortress.language": "en" }))).toBe(true);
});

it("起動時に保存される名前の空のプロフィールでは、初回のままとする", () => {
  // タイトルで離れた人が次に来たときも案内する
  for (const raw of [JSON.stringify({ nickname: "" }), JSON.stringify({ nickname: "  " }), "{}", "null", "[]", "{broken"]) {
    expect(shouldOfferTutorial(() => memory({ [PROFILE_KEY]: raw }))).toBe(true);
  }
});

it("済みの印を保存し、次からは案内しない", () => {
  const storage = memory();
  expect(markTutorialSeen(() => storage)).toBe(true);
  expect(storage.getItem(TUTORIAL_KEY)).toBe("1");
  expect(shouldOfferTutorial(() => storage)).toBe(false);
});

it("保存できない環境では毎回初めての人として扱い、印の保存に失敗したことを返す", () => {
  expect(shouldOfferTutorial(broken)).toBe(true);
  expect(markTutorialSeen(broken)).toBe(false);
  const full = { ...memory(), getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } } as Storage;
  expect(markTutorialSeen(() => full)).toBe(false);
});
