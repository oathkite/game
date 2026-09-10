import { MULTIPLAYER_MAPS, MULTIPLAYER_MAP_LABELS } from "@game/maps";
import { useEffect, useRef, useState } from "react";
import { WEAPON_IDS, WEAPON_LABELS } from "@game/protocol";
import { roomOutputSchema, type RoomSnapshot } from "@game/protocol/v2-rooms";
import { loadProfile } from "@/app/profile";
import { NetworkLab, type RoomConnection } from "@/networkLab/NetworkLab";
import { PixelButton, PixelPanel } from "./PixelUi";
import "./rooms.css";
const tokenKey = "keropod.room-token";
const errors: Record<string, string> = { "not-found": "部屋が見つかりません。", full: "部屋が満員です。", locked: "対戦中の部屋には参加できません。", "invalid-session": "復帰期限が切れたか、別の画面で接続中です。", "stale-revision": "部屋が更新されました。内容を確認して再操作してください。", "not-ready": "全員の準備完了を待っています。", unassigned: "全員のチームを選んでください。", "not-enough-teams": "2チーム以上に分かれてください。", "not-enough-players": "2人以上で開始できます。", disconnected: "切断中の参加者がいます。", "not-owner": "オーナーだけが操作できます。", "not-owner-or-not-finished": "対戦終了後、オーナーが部屋へ戻せます。" };
export const RoomScreen = ({ onExit, onLab }: { readonly onExit: () => void; readonly onLab: () => void }) => {
  const [room, setRoom] = useState<RoomSnapshot | null>(null), [playerId, setPlayerId] = useState("");
  const [code, setCode] = useState(""), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  const [battle, setBattle] = useState<RoomConnection | null>(null);
  const socket = useRef<WebSocket | null>(null), active = useRef(true);
  const connect = (initial: unknown) => {
    socket.current?.close(); setBusy(true); setStatus("接続しています…");
    const ws = new WebSocket(`ws://${location.hostname}:8795`); socket.current = ws;
    let identity = "";
    ws.onopen = () => { if (active.current && socket.current === ws) ws.send(JSON.stringify(initial)); };
    ws.onmessage = event => {
      if (!active.current || socket.current !== ws) return;
      let raw: unknown; try { raw = JSON.parse(String(event.data)); } catch { return; }
      const result = roomOutputSchema.safeParse(raw); if (!result.success) return;
      const message = result.data;
      if (message.type === "room.welcome") { identity = message.playerId; setPlayerId(identity); sessionStorage.setItem(tokenKey, message.token); setBusy(false); setStatus(""); }
      if (message.type === "room.snapshot") { setRoom(message.room); if (message.room.phase === "waiting") setBattle(null); }
      if (message.type === "lab.frame") setBattle(current => current ?? { socket: ws, playerId: identity, frame: message });
      if (message.type === "room.error") { setBusy(false); setStatus(errors[message.reason] ?? "操作を受け付けられませんでした。部屋の状態を確認してください。");
        if (message.reason === "invalid-session") { sessionStorage.removeItem(tokenKey); socket.current = null; setRoom(null); setBattle(null); ws.close(); } }
    };
    ws.onclose = () => { if (active.current && socket.current === ws) { setBusy(false); setStatus("接続が切れました。再接続で復帰できます（60秒以内）。"); } };
    ws.onerror = () => { if (active.current && socket.current === ws) { setBusy(false); setStatus("対戦サーバーに接続できません。"); } };
  };
  useEffect(() => { active.current = true; const token = sessionStorage.getItem(tokenKey); if (token) connect({ type: "room.resume", token });
    return () => { active.current = false; socket.current?.close(); }; }, []);
  const send = (message: unknown) => { if (socket.current?.readyState === WebSocket.OPEN) { setStatus(""); socket.current.send(JSON.stringify(message)); } };
  const edit = (type: string, fields: object = {}) => { if (room) send({ type, version: 2, roomId: room.roomId, revision: room.revision, ...fields }); };
  const leave = () => { send({ type: "room.leave" }); sessionStorage.removeItem(tokenKey); onExit(); };
  const profile = () => { const p = loadProfile(); return { nickname: p.nickname.trim() || "ケロポッド", loadout: p.loadout }; };
  const me = room?.members.find(p => p.playerId === playerId), owner = room?.ownerId === playerId;
  const canStart = owner && room!.members.length >= 2 && room!.members.every(p => p.ready && p.connected && p.teamId) && new Set(room!.members.map(p => p.teamId)).size >= 2;
  const connected = socket.current?.readyState === WebSocket.OPEN;
  if (battle) return <><NetworkLab connection={battle} worldArt onExit={leave} />{status && <div className="room-battle-status" role="status">{status}{!connected && <PixelButton onClick={() => { setBattle(null); connect({ type: "room.resume", token: sessionStorage.getItem(tokenKey) }); }}>再接続</PixelButton>}</div>}</>;
  return <section className="room-screen">
    <header><h1>{room ? <>部屋 <span data-testid="room-code">{room.roomId}</span></> : "対戦ルーム"}</h1><PixelButton onClick={leave}>ロビーに戻る</PixelButton></header>
    <div className="room-body"><PixelPanel>
      {!room ? <div className="room-entry"><h2>仲間と出発しよう</h2><p>部屋コードを共有して、2〜8人で遊べます。</p>
        <PixelButton disabled={busy} onClick={() => connect({ type: "room.create", profile: profile() })}>部屋を作る</PixelButton>
        <label>部屋コード<input aria-label="部屋コード" maxLength={6} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, ""))} /></label>
        <PixelButton disabled={busy || code.length !== 6} onClick={() => connect({ type: "room.join", roomId: code, profile: profile() })}>部屋に参加</PixelButton>
        <button className="room-lab-link" onClick={onLab}>固定8席試験</button></div> : <>
        <p>チームを選び、準備完了にしてください。人数差のある編成でも開始できます。</p>
        <ul className="room-members">{room.members.map((p, i) => <li key={p.playerId}>
          <strong>{i + 1}. {p.nickname}{p.playerId === playerId ? "（あなた）" : ""}{p.playerId === room.ownerId ? " / OWNER" : ""}</strong>
          <select aria-label={`参加者${i + 1}のチーム`} value={p.teamId ?? ""} disabled={!connected || (!owner && p.playerId !== playerId)} onChange={e => edit("room.assignTeam", { playerId: p.playerId, teamId: e.target.value || null })}><option value="">未配置</option>{Array.from({ length: 8 }, (_, team) => <option key={team} value={`t${team}`}>チーム {String.fromCharCode(65 + team)}</option>)}</select>
          <span>{!p.connected ? "切断中" : p.ready ? "準備完了" : "準備中"}</span>
        </li>)}</ul>
        {me && <div className="room-equipment">{([0, 1] as const).map(slot => <label key={slot}>装備 {slot + 1}<select aria-label={`部屋の装備${slot + 1}`} disabled={!connected} value={me.loadout[slot]} onChange={e => edit("room.loadout", { loadout: slot === 0 ? [e.target.value, me.loadout[1]] : [me.loadout[0], e.target.value] })}>{WEAPON_IDS.map(id => <option value={id} key={id} disabled={id === me.loadout[slot === 0 ? 1 : 0]}>{WEAPON_LABELS[id]}</option>)}</select></label>)}</div>}
        <label>マップ<select aria-label="マップ" value={room.map.id} disabled={!connected || !owner} onChange={e => edit("room.map", { mapId: e.target.value })}>{MULTIPLAYER_MAPS.map(map => <option key={map.id} value={map.id}>{MULTIPLAYER_MAP_LABELS[map.id]}</option>)}</select></label>
        <p className="room-note">マップ・装備・編成が変わると全員の準備が解除されます。</p>
      </>}
    </PixelPanel></div>
    <footer>{status && <span role="status">{status}</span>}{!connected && sessionStorage.getItem(tokenKey) && <PixelButton onClick={() => connect({ type: "room.resume", token: sessionStorage.getItem(tokenKey) })}>再接続</PixelButton>}
      {room && <><PixelButton disabled={!connected} onClick={() => edit("room.ready", { ready: !me?.ready })}>{me?.ready ? "準備を解除" : "準備完了"}</PixelButton>{owner && <PixelButton disabled={!connected || !canStart} onClick={() => edit("room.start")}>対戦開始</PixelButton>}</>}
    </footer>
  </section>;
};
