import { afterEach, expect, it, vi } from "vitest";
import { createLocalConnection } from "../src/net/localConnection";
import { createMatchStore } from "../src/match/matchStore";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const setup = () => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.25);
  const connection = createLocalConnection({ cpu: true, mapName: "ridgeline", nickname: "Player", colors: { primary: "red", secondary: "yellow" }, loadout: ["cannon", "triple"], opponentColors: { primary: "cyan", secondary: "blue" }, opponentLoadout: ["cannon", "triple"] });
  const store = createMatchStore(connection, { followCurrentSeat: false, mySeat: 0, spectator: false });
  return { connection, store };
};
it("CPUが自動射撃し、同じ射撃を再現でき、人間はCPUを操作できない", async () => {
  const { connection, store } = setup();
  await vi.advanceTimersByTimeAsync(0);
  expect(store.getView().currentSeat).toBe(1);
  expect(store.getView().control).toBeNull();
  store.fire(100);
  expect(store.getView().replay).toBeNull();
  await vi.advanceTimersByTimeAsync(5000);
  expect(store.getView().replay?.shot.input.seat).toBe(1);
  expect(store.getView().mismatches).toBe(0);
  store.dispose(); connection.close();
});
it("CPUの手番で降参しても人間の敗北となり、CPUの予約射撃を止める", async () => {
  const { connection, store } = setup();
  await vi.advanceTimersByTimeAsync(0);
  store.surrender();
  await vi.advanceTimersByTimeAsync(5000);
  expect(store.getView().result?.winner).toBe(1);
  expect(store.getView().replay).toBeNull();
  store.dispose(); connection.close();
});
it("退出でCPUの予約を解除する", async () => {
  const { connection, store } = setup();
  await vi.advanceTimersByTimeAsync(0);
  const listener = vi.fn();
  connection.subscribe(listener);
  connection.close();
  await vi.advanceTimersByTimeAsync(5000);
  expect(listener).not.toHaveBeenCalled();
  store.dispose();
});

it("CPUの再生が終わると人間に操作が戻る", async () => {
  const { connection, store } = setup();
  await vi.advanceTimersByTimeAsync(1000);
  const replay = store.getView().replay;
  expect(replay).not.toBeNull();
  store.completeReplay(replay!.id);
  await vi.advanceTimersByTimeAsync(5000);
  expect(store.getView().currentSeat).toBe(0);
  expect(store.getView().control).not.toBeNull();
  expect(store.getView().mismatches).toBe(0);
  store.dispose(); connection.close();
});

it("射撃と手番を繰り返して通常の決着まで進められる", async () => {
  const { connection, store } = setup();
  for (let step = 0; step < 150 && store.getView().phase !== "finished"; step++) {
    await vi.advanceTimersByTimeAsync(5000);
    const view = store.getView();
    if (view.replay) store.completeReplay(view.replay.id);
    else if (view.phase === "acting") store.fire(50);
  }
  expect(store.getView().phase).toBe("finished");
  expect(store.getView().mismatches).toBe(0);
  store.dispose(); connection.close();
});
