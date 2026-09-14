import { expect, it } from "vitest";
import { createDelay, finishDelay, actionCost } from "@game/protocol";
import { createRoster, nextTurn, eliminatePlayers } from "../src/multiplayer/rules";

it("accumulates each action and preserves older reservations on ties", async () => {
  const { nextDelayTurn } = await import("@game/protocol");
  let d = createDelay(["a","b"]);
  const actors: string[] = [];
  for (let i = 0; i < 10; i++) {
    const id = d.order[0]!; actors.push(id);
    d = nextDelayTurn(finishDelay(d, id, id === "a" ? 80 : 115));
  }
  expect(actors).toEqual(["a","b","a","b","a","b","a","a","b","a"]);
  expect(d.readyAt.a).toBe(480);
  expect(d.readyAt.b).toBe(460);
  let tie = nextDelayTurn(finishDelay(createDelay(["a","b"]),"a",80));
  tie = nextDelayTurn(finishDelay(tie,"b",80));
  expect(tie.order).toEqual(["a","b"]);
});
it("skips eliminated participants without losing accumulated clocks", () => {
  const base = createRoster([0,1,2].map(i => ({ playerId:String(i), teamId:String(i) })), 1);
  const [a,b,c] = base.turnRing as [string,string,string];
  const delay = finishDelay(createDelay(base.turnRing),a,115);
  const next = nextTurn(eliminatePlayers({...base,delay},[b]));
  expect(next.turnRing).toEqual([c,a]);
  expect(next.delay!.readyAt[a]).toBe(115);
});
it("adds a base cost and charges timeouts like the heaviest weapon", () => {
  expect(actionCost(10,"cannon")).toBe(90);
  expect(actionCost(10,"multiple")).toBe(125);
  expect(actionCost(0)).toBe(115);
});

it("commits authoritative movement and shot cost once, survives restore, and prices timeouts", async () => {
  const { TEST_ARENA } = await import("@game/maps");
  const { createBattle } = await import("../src/multiplayer/create");
  const { createBattleSession, moveInSession, fireInSession, tickSession } = await import("../src/multiplayer/session");
  const { serializeBattle, restoreBattle } = await import("../src/multiplayer/snapshot");
  const battle = createBattle([0,1,2].map(i=>({playerId:String(i),teamId:String(i)})),42,TEST_ARENA);
  let state = createBattleSession(battle,"delay-test",1000);
  const id = state.movement.playerId;
  state = moveInSession(state,id,{version:2,type:"move.command",matchId:state.matchId,turnId:1,commandId:"move",moveSeq:1,direction:1,steps:1},1000).state;
  const command = {version:2,type:"turn.fire",matchId:state.matchId,turnId:1,commandId:"fire",ackMoveSeq:state.movement.ackMoveSeq,slot:0,facing:1,elevation:80,power:10};
  const shot = fireInSession(state,id,command,1100).state;
  expect(shot.roster.delay!.costs[id]).toBe(actionCost(30-state.movement.stepsLeft,"cannon"));
  expect(fireInSession(shot,id,command,1200).state).toBe(shot);
  state = restoreBattle(JSON.parse(JSON.stringify(serializeBattle(shot))));
  expect(state.roster.delay).toEqual(shot.roster.delay);
  state = tickSession(state,state.replay!.endsAt);
  const second = state.movement.playerId;
  state = tickSession(state,state.movement.deadlineAt);
  expect(state.roster.delay!.previous[second]).toBe(115);
});

it("practice counts actual walking even when returning to the start, including on timeout", async () => {
  const { createEngine, handle, DEFAULT_ENGINE_TIMING } = await import("../src/index");
  const player = {nickname:"P",colors:{primary:"green",secondary:"green"},loadout:["cannon","digger"]} as const;
  let state = createEngine({...DEFAULT_ENGINE_TIMING,rng:()=>.1,delayEnabled:true},{roomCode:"SOLO00",mapName:"ridgeline",players:[player,player]});
  state = handle(state,{type:"loaded",seat:0},1000).state;
  state = handle(state,{type:"loaded",seat:1},1000).state;
  const first = state.match.currentSeat;
  state = handle(state,{type:"practiceMoveCost",steps:10},1100).state;
  state = handle(state,{type:"tick"},state.match.deadlineAt!+1000).state;
  expect(state.delay!.previous[String(first)]).toBe(125);
  const second = state.match.currentSeat;
  state = handle(state,{type:"tick"},state.match.deadlineAt!+1000).state;
  expect(state.delay!.round).toBe(3);
  expect(state.match.currentSeat).toBe(second);
  expect(state.delay!.costs).toEqual({});
});

it("reserves a round reveal before granting the full action time", async () => {
  const { TEST_ARENA } = await import("@game/maps");
  const { ROUND_REVEAL_MS } = await import("@game/protocol");
  const { createBattle } = await import("../src/multiplayer/create");
  const { createBattleSession, tickSession, fireInSession } = await import("../src/multiplayer/session");
  let state = createBattleSession(createBattle([0,1].map(i=>({playerId:String(i),teamId:String(i)})),1,TEST_ARENA),"intro",1000);
  const before = [...state.roster.turnRing];
  state = tickSession(state,state.movement.deadlineAt);
  const now = state.movement.deadlineAt;
  state = tickSession(state,now);
  expect(state.roster.delay!.previousOrder).toEqual([...before].reverse());
  expect(state.movement.startsAt).toBe(now + ROUND_REVEAL_MS);
  expect(state.movement.deadlineAt - state.movement.startsAt).toBe(20000);
  const command = {version:2,type:"turn.fire",matchId:"intro",turnId:state.roster.turnId,commandId:"early",ackMoveSeq:0,slot:0,facing:1,elevation:45,power:20};
  expect(fireInSession(state,state.movement.playerId,command,now+100).reason).toBe("outside-turn");
});

it("serves all eight players with bounded waits under changing costs", async () => {
  const { nextDelayTurn } = await import("@game/protocol");
  let d = createDelay(Array.from({length:8},(_,i)=>String(i)));
  const counts = Array(8).fill(0), last = Array(8).fill(-1);
  for (let turn=0; turn<8000; turn++) {
    const id=d.order[0]!, previousClock=d.clock;
    if(last[Number(id)]>=0) expect(turn-last[Number(id)]-1).toBeLessThanOrEqual(21);
    last[Number(id)]=turn; counts[Number(id)]++;
    d=nextDelayTurn(finishDelay(d,id,80+(turn*37%66)));
    expect(d.clock).toBeGreaterThanOrEqual(previousClock);
  }
  expect(Math.min(...counts)).toBeGreaterThan(500);
});
