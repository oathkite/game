import { COLOR_HEX, MAP_LABELS, MAP_NAMES, type MapName, type RoomState, type Seat, type TankColors } from "@game/protocol";
import { useState } from "react";

// 部屋。設計書 09 の 9.5。参加者の一覧、観戦者数、マップ、入室コードと招待リンク、オーナーの操作。

type Props = {
  readonly room: RoomState;
  readonly mySeat: Seat | null;
  readonly myColors: TankColors;
  readonly onReady: (ready: boolean) => void;
  readonly onSetMap: (mapName: MapName) => void;
  readonly onKick: (seat: Seat) => void;
  readonly onStart: () => void;
  readonly onLeave: () => void;
  readonly onDissolve: () => void;
  readonly onTakeSeat: () => void;
  readonly onEditProfile: () => void;
  readonly error: string | null;
};

export const RoomScreen = ({ room, mySeat, onReady, onSetMap, onKick, onStart, onLeave, onDissolve, onTakeSeat, onEditProfile, error }: Props) => {
  const me = room.members.find((m) => m.seat === mySeat);
  const isOwner = me !== undefined && me.seat === room.ownerSeat;
  const isSpectator = mySeat === null;
  const inviteUrl = `${location.origin}${location.pathname}?room=${room.code}`;
  const [copied, setCopied] = useState(false);
  const canStart =
    room.phase === "open" &&
    room.members.length === room.maxPlayers &&
    room.members.every((m) => m.seat === room.ownerSeat || m.ready) &&
    room.members.every((m) => !m.colorConflict);

  const copy = (): void => {
    void navigator.clipboard?.writeText(inviteUrl).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="screen" data-testid="room">
      <div className="column">
        <div className="title">{room.title}</div>
        {error && <div className="box blink">{error}</div>}
        {room.phase === "result" && <div className="dim">リザルト表示中。全員が閉じると募集中に戻ります</div>}
        <div className="box row" style={{ justifyContent: "space-between" }}>
          <span>
            CODE <span data-testid="room-code">{room.code}</span>
          </span>
          <button type="button" onClick={copy}>
            {copied ? "コピーしました" : "招待リンクをコピー"}
          </button>
        </div>
        <div className="list">
          {room.members.map((m) => (
            <div key={m.seat} className="box row" style={{ justifyContent: "space-between" }} data-testid={`member-${m.seat}`}>
              <span>
                <span className="swatches">
                  <span className="swatch" style={{ background: COLOR_HEX[m.colors.primary] }} />
                  <span className="swatch" style={{ background: COLOR_HEX[m.colors.secondary] }} />
                </span>
                {m.nickname}
                {!m.connected && <span className="dim"> 切断中</span>}
                {m.colorConflict && <span className="blink"> 主色が重なっています</span>}
              </span>
              <span>
                {m.seat === room.ownerSeat ? "OWNER" : m.ready ? "READY" : <span className="dim">WAIT</span>}
                {isOwner && m.seat !== room.ownerSeat && room.phase === "open" && (
                  <button type="button" style={{ marginLeft: 8, padding: "2px 8px" }} onClick={() => onKick(m.seat)}>
                    退室させる
                  </button>
                )}
              </span>
            </div>
          ))}
          {room.members.length < room.maxPlayers && <div className="box dim">空席</div>}
        </div>
        <div className="dim">観戦 {room.spectators.length} 人</div>
        <div className="row">
          <span className="label">マップ</span>
          {isOwner && room.phase === "open" ? (
            <select value={room.mapName} aria-label="room map" onChange={(e) => onSetMap(e.target.value as MapName)}>
              {MAP_NAMES.map((m) => (
                <option key={m} value={m}>
                  {MAP_LABELS[m]}
                </option>
              ))}
            </select>
          ) : (
            <span>{MAP_LABELS[room.mapName]}</span>
          )}
        </div>
        {isOwner && (
          <button type="button" disabled={!canStart} onClick={onStart} data-testid="start">
            対戦を開始
          </button>
        )}
        {me && !isOwner && room.phase === "open" && (
          <button type="button" className={me.ready ? "active" : ""} disabled={me.colorConflict} onClick={() => onReady(!me.ready)} data-testid="ready">
            {me.ready ? "READY を解除" : "READY"}
          </button>
        )}
        {isSpectator && room.phase === "open" && room.members.length < room.maxPlayers && (
          <button type="button" onClick={onTakeSeat}>
            参加者として入る
          </button>
        )}
        {room.phase !== "inMatch" && (
          <button type="button" onClick={onEditProfile}>
            名前と色を変える
          </button>
        )}
        <div className="row">
          <button type="button" onClick={onLeave} data-testid="leave">
            退出
          </button>
          {isOwner && (
            <button type="button" onClick={onDissolve}>
              解散
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
