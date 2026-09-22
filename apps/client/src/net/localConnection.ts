import type { CpuDecision } from "@game/protocol/cpu";
import type { EngineState } from "@game/engine";
import type { CpuLevel } from "@/practice/cpuLevel";
import { planCpuTurn, playCpuTurn, type CpuPose } from "@/practice/cpuTurn";
import { createEngine, createMatchHost, DEFAULT_ENGINE_TIMING, realClock, setupMessage, type MatchHost } from "@game/engine";
import { resolveMapChoice } from "@game/maps";
import type { ClientMessage, Loadout, MapChoice, ServerMessage, TankColors, WeaponId } from "@game/protocol";
import { createListeners, type Connection, type ConnectionStatus } from "./connection";

// solo モード。サーバーなしでエンジンをブラウザ内に置き、両席をひとりで操作する。
// 設計書 07 の開発順序 2「サーバーなしで 1 人で撃って、地形が削れる様子を見る」のための接続。

export type LocalMatchOptions = {
  readonly deferReady?: boolean;
  readonly cpu?: boolean;
  readonly cpuLevel?: CpuLevel;
  readonly decideCpu?: (state: EngineState, level: CpuLevel, signal: AbortSignal) => Promise<CpuDecision | null>;
  /** ランダムなら対戦を作るたび（再戦を含む）に抽選する */
  readonly mapName: MapChoice;
  readonly nickname: string;
  readonly colors: TankColors;
  readonly loadout: Loadout;
  readonly opponentColors: TankColors;
  readonly opponentLoadout: Loadout;
};

const otherColors = (colors: TankColors): TankColors => (colors.primary === "cyan" ? { primary: "orange", secondary: "yellow" } : { primary: "cyan", secondary: "blue" });

export const defaultOpponentColors = otherColors;

/** 相手の装備は自分と違うものにして、弾の違いを一人でも見られるようにする */
export const defaultOpponentLoadout = (loadout: Loadout): Loadout => {
  const pool: readonly WeaponId[] = ["triple", "drill", "laser", "multiple", "floater", "stinger"];
  const [a, b] = pool.filter((w) => !loadout.includes(w));
  return [a ?? "triple", b ?? "drill"];
};

export const createLocalConnection = (options: LocalMatchOptions): Connection & { readonly releaseReady: () => void } => {
  const messages = createListeners<ServerMessage>();
  const statuses = createListeners<ConnectionStatus>();
  let status: ConnectionStatus = "open";
  const cpuPoses = createListeners<CpuPose | null>();
  let cpuElevation = 45;
  let pendingCpu: AbortController | null = null;
  let stopCpu = () => {};
  let cpuTimer: ReturnType<typeof setTimeout> | null = null;
  const cancelCpu = () => { pendingCpu?.abort(); pendingCpu = null; if (cpuTimer !== null) clearTimeout(cpuTimer); cpuTimer = null; stopCpu(); cpuPoses.emit(null); };
  let host: MatchHost | null = null;
  let released = !options.deferReady, requested = false;
  const releaseReady = (): void => {
    released = true;
    if (!requested || !host) return;
    host.dispatch({ type: "loaded", seat: 0 });
    host.dispatch({ type: "loaded", seat: 1 });
  };

  const deliver = (message: ServerMessage): void => {
    // 呼び出し元の処理と分けるため、次のマイクロタスクで配る
    queueMicrotask(() => { if (status === "open") messages.emit(message); });
    if (message.type === "match.finished") cancelCpu();
    if (options.cpu && message.type === "turn.start") {
      cancelCpu();
      if (message.seat !== 1) return;
      cpuTimer = setTimeout(async () => {
        cpuTimer = null;
        if (!host || host.state().match.phase !== "acting" || host.state().match.currentSeat !== 1) return;
        const activeHost = host;
        const controller = new AbortController();
        pendingCpu = controller;
        let decision: CpuDecision | null = null;
        try { decision = await options.decideCpu?.(activeHost.state(), options.cpuLevel ?? "normal", controller.signal) ?? null; } catch { /* 通信障害時はローカルCPUで続行する。 */ }
        if (controller.signal.aborted || activeHost !== host || activeHost.state().match.currentSeat !== 1 || activeHost.state().match.phase !== "acting") return;
        const plan = planCpuTurn(activeHost.state(), options.cpuLevel ?? "normal", cpuElevation, Math.random, decision ?? undefined);
        stopCpu = playCpuTurn(plan, realClock, pose => { cpuElevation = pose.elevation; cpuPoses.emit(pose); }, () => {
          activeHost.dispatch({ type: "practiceMoveCost", steps: Math.abs(plan.fire.x - activeHost.state().match.players[1].x) });
          activeHost.dispatch({ type: "fire", seat: 1, fire: plan.fire });
          cpuPoses.emit(null);
        });
      }, Math.max(0, (message.delay?.revealUntil ?? Date.now()) - Date.now()));
    }
  };

  const startMatch = (): void => {
    cancelCpu();
    cpuElevation = 45;
    if (host) host.stop();
    const state = createEngine(
      { ...DEFAULT_ENGINE_TIMING, delayEnabled: true, rng: Math.random },
      {
        roomCode: "SOLO00",
        mapName: resolveMapChoice(options.mapName, Math.random),
        players: [
          { nickname: options.nickname || "P1", colors: options.colors, loadout: options.loadout },
          { nickname: options.cpu ? "CPU" : "P2", colors: options.opponentColors, loadout: options.opponentLoadout },
        ],
      },
    );
    host = createMatchHost(state, realClock, (effect) => deliver(effect.message));
    deliver(setupMessage(state));
  };

  const send = (message: ClientMessage): void => {
    if (!host) return;
    const seat = options.cpu ? 0 : host.state().match.currentSeat;
    switch (message.type) {
      case "match.ready":
        requested = true;
        if (released) releaseReady();
        return;
      case "turn.fire":
        host.dispatch({ type: "fire", seat, fire: message });
        return;
      case "turn.replayDone":
        host.dispatch({ type: "replayDone", seat: 0 });
        host.dispatch({ type: "replayDone", seat: 1 });
        return;
      case "match.surrender":
        // 開幕演出は操作を待たせるが、練習の終了は妨げない。
        if (!released) releaseReady();
        host.dispatch({ type: "surrender", seat: options.cpu ? 0 : host.state().match.currentSeat });
        return;
      case "result.close":
        startMatch();
        return;
      case "time.ping":
        deliver({ type: "time.pong", sentAt: message.sentAt, serverTime: Date.now() });
        return;
      default:
        return;
    }
  };

  startMatch();

  return {
    releaseReady,
    subscribeCpuPose: cpuPoses.add,
    reportMoveCost: steps => { host?.dispatch({ type: "practiceMoveCost", steps }); },
    reportMoveRingOut: x => { if (host) host.dispatch({ type:"moveRingOut", seat:host.state().match.currentSeat, x }); },
    send,
    subscribe: messages.add,
    onStatus: statuses.add,
    status: () => status,
    close: () => {
      status = "closed";
      cancelCpu();
      if (host) host.stop();
      host = null;
      statuses.emit(status);
    },
  };
};
