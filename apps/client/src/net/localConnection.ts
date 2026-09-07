import { createEngine, createMatchHost, DEFAULT_ENGINE_TIMING, realClock, setupMessage, type MatchHost } from "@game/engine";
import type { ClientMessage, Loadout, MapName, ServerMessage, TankColors, WeaponId } from "@game/protocol";
import { createListeners, type Connection, type ConnectionStatus } from "./connection";

// solo モード。サーバーなしでエンジンをブラウザ内に置き、両席をひとりで操作する。
// 設計書 07 の開発順序 2「サーバーなしで 1 人で撃って、地形が削れる様子を見る」のための接続。

export type LocalMatchOptions = {
  readonly mapName: MapName;
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

export const createLocalConnection = (options: LocalMatchOptions): Connection => {
  const messages = createListeners<ServerMessage>();
  const statuses = createListeners<ConnectionStatus>();
  let status: ConnectionStatus = "open";
  let host: MatchHost | null = null;

  const deliver = (message: ServerMessage): void => {
    // 呼び出し元の処理と分けるため、次のマイクロタスクで配る
    queueMicrotask(() => messages.emit(message));
  };

  const startMatch = (): void => {
    if (host) host.stop();
    const state = createEngine(
      { ...DEFAULT_ENGINE_TIMING, rng: Math.random },
      {
        roomCode: "SOLO00",
        mapName: options.mapName,
        players: [
          { nickname: options.nickname || "P1", colors: options.colors, loadout: options.loadout },
          { nickname: "P2", colors: options.opponentColors, loadout: options.opponentLoadout },
        ],
      },
    );
    host = createMatchHost(state, realClock, (effect) => deliver(effect.message));
    deliver(setupMessage(state));
  };

  const send = (message: ClientMessage): void => {
    if (!host) return;
    const seat = host.state().match.currentSeat;
    switch (message.type) {
      case "match.ready":
        host.dispatch({ type: "loaded", seat: 0 });
        host.dispatch({ type: "loaded", seat: 1 });
        return;
      case "turn.fire":
        host.dispatch({ type: "fire", seat, fire: message });
        return;
      case "turn.replayDone":
        host.dispatch({ type: "replayDone", seat: 0 });
        host.dispatch({ type: "replayDone", seat: 1 });
        return;
      case "match.surrender":
        host.dispatch({ type: "surrender", seat });
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
    send,
    subscribe: messages.add,
    onStatus: statuses.add,
    status: () => status,
    close: () => {
      status = "closed";
      if (host) host.stop();
      host = null;
      statuses.emit(status);
    },
  };
};
