import { MAP_LABELS, MAP_NAMES, ROOM_TITLE_MAX, type LobbyPhaseFilter, type MapName, type ServerMessageOf } from "@game/protocol";
import { useState } from "react";

// ロビー。設計書 09 の 9.3 と 9.4。検索と絞り込み、公開部屋の一覧、部屋を作る、コードで入る。

export type LobbyQueryState = {
  readonly search: string;
  readonly phase: LobbyPhaseFilter;
  readonly mapName: MapName | null;
  readonly page: number;
};

type Props = {
  readonly page: ServerMessageOf<"lobby.page"> | null;
  readonly query: LobbyQueryState;
  readonly onQuery: (query: LobbyQueryState) => void;
  readonly onCreate: (title: string, isPublic: boolean, mapName: MapName) => void;
  readonly onJoin: (code: string) => void;
  readonly onSpectate: (code: string) => void;
  readonly onBack: () => void;
  readonly error: string | null;
  readonly connected: boolean;
};

export const LobbyScreen = ({ page, query, onQuery, onCreate, onJoin, onSpectate, onBack, error, connected }: Props) => {
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [mapName, setMapName] = useState<MapName>("valley");
  const [code, setCode] = useState("");
  const totalPages = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;

  return (
    <div className="screen" data-testid="lobby">
      <div className="column">
        <div className="row">
          <div className="title">LOBBY</div>
          <span className={connected ? "" : "dim blink"} style={{ textAlign: "right" }}>
            {connected ? "接続中" : "再接続しています"}
          </span>
        </div>
        {error && <div className="box blink">{error}</div>}
        <div className="box column">
          <div className="label">部屋を作る</div>
          <input value={title} maxLength={ROOM_TITLE_MAX} placeholder="表示名（省略可）" aria-label="room title" onChange={(e) => setTitle(e.target.value)} />
          <div className="row">
            <select value={mapName} aria-label="map" onChange={(e) => setMapName(e.target.value as MapName)}>
              {MAP_NAMES.map((m) => (
                <option key={m} value={m}>
                  {MAP_LABELS[m]}
                </option>
              ))}
            </select>
            <button type="button" className={isPublic ? "active" : ""} onClick={() => setIsPublic(true)}>
              公開
            </button>
            <button type="button" className={!isPublic ? "active" : ""} onClick={() => setIsPublic(false)}>
              非公開
            </button>
          </div>
          <button type="button" data-testid="create-room" onClick={() => onCreate(title, isPublic, mapName)}>
            作る
          </button>
        </div>
        <div className="box row">
          <input
            value={code}
            maxLength={6}
            placeholder="コードで入る"
            aria-label="room code"
            style={{ textTransform: "uppercase" }}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button type="button" data-testid="join-code" disabled={code.length !== 6} onClick={() => onJoin(code)}>
            入る
          </button>
        </div>
        <div className="row">
          <input value={query.search} maxLength={ROOM_TITLE_MAX} placeholder="検索" aria-label="search" onChange={(e) => onQuery({ ...query, search: e.target.value, page: 0 })} />
          <select value={query.phase} aria-label="phase filter" onChange={(e) => onQuery({ ...query, phase: e.target.value as LobbyPhaseFilter, page: 0 })}>
            <option value="all">すべて</option>
            <option value="open">募集中</option>
            <option value="inMatch">対戦中</option>
          </select>
          <select value={query.mapName ?? ""} aria-label="map filter" onChange={(e) => onQuery({ ...query, mapName: (e.target.value || null) as MapName | null, page: 0 })}>
            <option value="">全マップ</option>
            {MAP_NAMES.map((m) => (
              <option key={m} value={m}>
                {MAP_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="list" data-testid="room-list">
          {page && page.rooms.length === 0 && <div className="dim">部屋がありません</div>}
          {page?.rooms.map((r) => (
            <div key={r.code} className={`list-row${r.phase === "open" ? "" : " dim"}`}>
              <span>{r.title}</span>
              <span>{MAP_LABELS[r.mapName]}</span>
              <span>
                {r.players} / {r.maxPlayers}
              </span>
              <span>観戦 {r.spectators}</span>
              <span>{r.phase === "open" ? "募集中" : r.phase === "inMatch" ? "対戦中" : "リザルト"}</span>
              {r.phase === "open" ? (
                <button type="button" onClick={() => onJoin(r.code)}>
                  入る
                </button>
              ) : (
                <button type="button" onClick={() => onSpectate(r.code)}>
                  観戦
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="row">
          <button type="button" disabled={query.page <= 0} onClick={() => onQuery({ ...query, page: query.page - 1 })}>
            前へ
          </button>
          <span style={{ textAlign: "center" }}>
            {query.page + 1} / {totalPages}
          </span>
          <button type="button" disabled={query.page + 1 >= totalPages} onClick={() => onQuery({ ...query, page: query.page + 1 })}>
            次へ
          </button>
        </div>
        <button type="button" onClick={onBack}>
          設定へ戻る
        </button>
      </div>
    </div>
  );
};
