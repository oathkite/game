import { describe, expect, it } from "vitest";
import { BLUE, createMsg, harness, joinMsg, last, RED, sequenceRng, T0, types } from "./helpers.js";

describe("部屋の作成と入室", () => {
  it("作成者がオーナーの席 0 になり、コードは O0I1 を含まない", () => {
    const h = harness();
    h.open("a");
    const out = h.send("a", createMsg("alice", RED));
    const joined = last(h.inbox("a"), "room.joined");
    expect(out.length).toBe(1);
    expect(joined?.seat).toBe(0);
    expect(joined?.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(joined?.room.ownerSeat).toBe(0);
    expect(joined?.room.phase).toBe("open");
  });

  it("表示名を省略すると「〈名前〉の部屋」になる", () => {
    const h = harness();
    h.open("a");
    h.send("a", createMsg("alice", RED, { title: "  " }));
    expect(last(h.inbox("a"), "room.joined")?.room.title).toBe("alice の部屋");
  });

  it("入室すると全員に room.state が配信され、全員の ready が解除される", () => {
    const h = harness();
    h.open("a");
    h.open("b");
    h.send("a", createMsg("alice", RED));
    const code = last(h.inbox("a"), "room.joined")?.code ?? "";
    h.send("b", joinMsg(code, "bob", BLUE));
    const stateA = last(h.inbox("a"), "room.state");
    expect(stateA?.room.members.map((m) => m.nickname)).toEqual(["alice", "bob"]);
    expect(stateA?.room.members.every((m) => !m.ready)).toBe(true);
  });

  it("ない部屋、満室、対戦中の部屋には入れない", () => {
    const h = harness();
    h.open("a");
    h.open("b");
    h.open("c");
    h.send("c", joinMsg("ABCDEF", "carol", RED));
    expect(last(h.inbox("c"), "room.error")?.reason).toBe("notFound");
    h.send("a", createMsg("alice", RED));
    const code = last(h.inbox("a"), "room.joined")?.code ?? "";
    h.send("b", joinMsg(code, "bob", BLUE));
    h.send("c", joinMsg(code, "carol", RED));
    expect(last(h.inbox("c"), "room.error")?.reason).toBe("full");
  });

  it("主色が重なっても入室でき、衝突している側は ready にできない", () => {
    const h = harness();
    h.open("a");
    h.open("b");
    h.send("a", createMsg("alice", RED));
    const code = last(h.inbox("a"), "room.joined")?.code ?? "";
    h.send("b", joinMsg(code, "bob", RED));
    const state = last(h.inbox("b"), "room.state");
    expect(state?.room.members.find((m) => m.seat === 1)?.colorConflict).toBe(true);
    expect(state?.room.members.find((m) => m.seat === 0)?.colorConflict).toBe(false);
    h.send("b", { type: "room.ready", ready: true });
    expect(last(h.inbox("b"), "room.error")?.reason).toBe("colorConflict");
    // 色を変えれば ready にできる
    h.send("b", { type: "room.profile", nickname: "bob", colors: BLUE });
    h.send("b", { type: "room.ready", ready: true });
    expect(last(h.inbox("a"), "room.state")?.room.members.find((m) => m.seat === 1)?.ready).toBe(true);
  });

  it("オーナーは ready を持たない", () => {
    const h = harness();
    h.open("a");
    h.send("a", createMsg("alice", RED));
    h.send("a", { type: "room.ready", ready: true });
    expect(last(h.inbox("a"), "room.error")?.reason).toBe("badRequest");
  });
});

describe("ready の解除と開始条件", () => {
  const setup = () => {
    const h = harness();
    h.open("a");
    h.open("b");
    h.send("a", createMsg("alice", RED));
    const code = last(h.inbox("a"), "room.joined")?.code ?? "";
    h.send("b", joinMsg(code, "bob", BLUE));
    h.send("b", { type: "room.ready", ready: true });
    return { h, code };
  };
  const readyOf = (h: ReturnType<typeof harness>, seat: 0 | 1) => last(h.inbox("a"), "room.state")?.room.members.find((m) => m.seat === seat)?.ready;

  it("マップ変更と主色の変更で ready が解除される", () => {
    const { h } = setup();
    expect(readyOf(h, 1)).toBe(true);
    h.send("a", { type: "room.setMap", mapName: "island" });
    expect(readyOf(h, 1)).toBe(false);
    h.send("b", { type: "room.ready", ready: true });
    h.send("b", { type: "room.profile", nickname: "bob", colors: { primary: "cyan", secondary: "blue" } });
    expect(readyOf(h, 1)).toBe(false);
  });

  it("副色の変更と観戦者の入退室では ready を解除しない", () => {
    const { h, code } = setup();
    h.send("b", { type: "room.profile", nickname: "bob", colors: { primary: "blue", secondary: "pink" } });
    expect(readyOf(h, 1)).toBe(true);
    h.open("s");
    h.send("s", { type: "room.spectate", code, playerId: "player-spec", nickname: "spec" });
    expect(readyOf(h, 1)).toBe(true);
    expect(last(h.inbox("a"), "room.state")?.room.spectators.length).toBe(1);
    h.send("s", { type: "room.leave" });
    expect(readyOf(h, 1)).toBe(true);
  });

  it("オーナー以外は開始できず、条件を満たさなければ開始できない", () => {
    const { h } = setup();
    h.send("b", { type: "room.start" });
    expect(last(h.inbox("b"), "room.error")?.reason).toBe("notOwner");
    h.send("b", { type: "room.ready", ready: false });
    h.send("a", { type: "room.start" });
    expect(last(h.inbox("a"), "room.error")?.reason).toBe("notReady");
  });

  it("条件を満たせば match.setup が全員に届き、部屋は inMatch になる", () => {
    const { h } = setup();
    h.send("a", { type: "room.start" });
    expect(last(h.inbox("a"), "match.setup")).toBeDefined();
    expect(last(h.inbox("b"), "match.setup")).toBeDefined();
    expect(last(h.inbox("b"), "room.state")?.room.phase).toBe("inMatch");
  });

  it("オーナー以外は setMap、kick、dissolve できない", () => {
    const { h } = setup();
    h.send("b", { type: "room.setMap", mapName: "island" });
    h.send("b", { type: "room.kick", seat: 0 });
    h.send("b", { type: "room.dissolve" });
    expect(h.inbox("b").filter((m) => m.type === "room.error" && m.reason === "notOwner").length).toBe(3);
  });
});

describe("退出、キック、オーナーの引き継ぎ、解散", () => {
  it("キックされた側には room.closed が届き、部屋から外れる", () => {
    const h = harness();
    h.open("a");
    h.open("b");
    h.send("a", createMsg("alice", RED));
    const code = last(h.inbox("a"), "room.joined")?.code ?? "";
    h.send("b", joinMsg(code, "bob", BLUE));
    h.send("a", { type: "room.kick", seat: 1 });
    expect(last(h.inbox("b"), "room.closed")?.reason).toBe("kicked");
    expect(last(h.inbox("a"), "room.state")?.room.members.length).toBe(1);
  });

  it("オーナーが退出すると、入室が最も早い参加者に移る", () => {
    const h = harness();
    h.open("a");
    h.open("b");
    h.send("a", createMsg("alice", RED));
    const code = last(h.inbox("a"), "room.joined")?.code ?? "";
    h.send("b", joinMsg(code, "bob", BLUE));
    h.send("a", { type: "room.leave" });
    const state = last(h.inbox("b"), "room.state");
    expect(state?.room.ownerSeat).toBe(1);
    expect(state?.room.members.length).toBe(1);
  });

  it("全員が退出すると部屋が消える", () => {
    const h = harness();
    h.open("a");
    h.send("a", createMsg("alice", RED));
    h.send("a", { type: "room.leave" });
    expect(h.state.rooms.size).toBe(0);
  });

  it("解散で全員に room.closed が届く", () => {
    const h = harness();
    h.open("a");
    h.open("b");
    h.send("a", createMsg("alice", RED));
    const code = last(h.inbox("a"), "room.joined")?.code ?? "";
    h.send("b", joinMsg(code, "bob", BLUE));
    h.send("a", { type: "room.dissolve" });
    expect(last(h.inbox("a"), "room.closed")?.reason).toBe("dissolved");
    expect(last(h.inbox("b"), "room.closed")?.reason).toBe("dissolved");
    expect(h.state.rooms.size).toBe(0);
  });

  it("募集中に接続が切れた参加者は部屋から外れる", () => {
    const h = harness();
    h.open("a");
    h.open("b");
    h.send("a", createMsg("alice", RED));
    const code = last(h.inbox("a"), "room.joined")?.code ?? "";
    h.send("b", joinMsg(code, "bob", BLUE));
    h.close("b");
    expect(last(h.inbox("a"), "room.state")?.room.members.length).toBe(1);
  });

  it("放置された募集中の部屋は 30 分で消える", () => {
    const h = harness();
    h.open("a");
    h.send("a", createMsg("alice", RED));
    h.at(T0 + 30 * 60_000 - 1);
    h.tick();
    expect(h.state.rooms.size).toBe(1);
    h.at(T0 + 30 * 60_000);
    h.tick();
    expect(h.state.rooms.size).toBe(0);
    expect(last(h.inbox("a"), "room.closed")?.reason).toBe("idle");
  });
});

describe("ロビー", () => {
  it("一覧は公開部屋だけを、募集中を先に新しい順で返し、検索は大文字小文字を区別しない", () => {
    const h = harness(sequenceRng());
    for (const [i, name] of ["Alpha", "beta", "Gamma"].entries()) {
      h.at(T0 + i * 1000);
      h.open(name);
      h.send(name, createMsg(name, RED, { title: `${name} Base`, isPublic: name !== "beta" }));
    }
    h.open("q");
    h.send("q", { type: "lobby.query", search: "", phase: "all", mapName: null, page: 0 });
    const page = last(h.inbox("q"), "lobby.page");
    expect(page?.rooms.map((r) => r.title)).toEqual(["Gamma Base", "Alpha Base"]);
    expect(page?.total).toBe(2);
    h.send("q", { type: "lobby.query", search: "alpha", phase: "all", mapName: null, page: 0 });
    expect(last(h.inbox("q"), "lobby.page")?.rooms.map((r) => r.title)).toEqual(["Alpha Base"]);
  });

  it("lobby.changed は購読者にだけ届き、3 秒に 1 回まで間引かれる", () => {
    const h = harness(sequenceRng());
    h.open("sub");
    h.open("nosub");
    h.send("sub", { type: "lobby.subscribe" });
    h.open("a");
    h.send("a", createMsg("alice", RED));
    expect(types(h.inbox("sub"))).toEqual(["lobby.changed"]);
    expect(types(h.inbox("nosub"))).toEqual([]);
    // 直後の変化は間引かれ、3 秒後の tick で届く
    h.at(T0 + 1000);
    h.open("b");
    h.send("b", createMsg("bob", BLUE));
    expect(types(h.inbox("sub"))).toEqual(["lobby.changed"]);
    expect(h.lastWakeAt()).toBe(T0 + 3000);
    h.at(T0 + 3000);
    h.tick();
    expect(types(h.inbox("sub"))).toEqual(["lobby.changed", "lobby.changed"]);
  });
});
