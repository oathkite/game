import { useBrowserBackAction } from "./browserBack";
import { setMusic } from "@/app/audio";
import { teamColor, teamColorName } from "./teamColors";
import { useLanguage } from "@/i18n/locale";
import { CLIENT_BUILD, compatibleMatch } from "@game/protocol/build";
import { MULTIPLAYER_MAPS, MULTIPLAYER_MAP_LABELS } from "@game/maps";
import { useEffect, useRef, useState } from "react";
import { WEAPON_IDS, WEAPON_LABELS } from "@game/protocol";
import { roomOutputSchema, type RoomSnapshot } from "@game/protocol/v2-rooms";
import { loadProfile, saveProfile } from "@/app/profile";
import { NetworkLab, type RoomConnection } from "@/networkLab/NetworkLab";
import { PixelButton, PixelPanel } from "./PixelUi";
import "./rooms.css";
import { inviteRoom, roomInviteUrl } from "./roomInvite";
import { resolveRoomUrl } from "./roomTransport";
const serverBase = import.meta.env.VITE_ROOM_SERVER_URL || (import.meta.env.PROD ? location.origin : "");
const tokenKey = "keropod.room-token", roomKey = "keropod.room-id";
const errors: Record<string, string> = { "version-mismatch": "ゲームの更新が必要です。再読み込みしてください。", "wrong-mode": "この部屋は別の対戦形式です。クイック参加から入り直してください。", "fixed-mode": "クイック対戦の編成は固定です。", "waiting-for-players": "人数が揃うまでお待ちください。", "spectators-full": "観戦席が満員です。", "read-only": "観戦中は対戦操作できません。", "not-found": "部屋が見つかりません。", full: "部屋が満員です。", locked: "対戦中の部屋には参加できません。", "invalid-session": "復帰期限が切れたか、別の画面で接続中です。", "stale-revision": "部屋が更新されました。内容を確認して再操作してください。", "not-ready": "全員の準備完了を待っています。", unassigned: "全員のチームを選んでください。", "not-enough-teams": "2チーム以上に分かれてください。", "not-enough-players": "2人以上で開始できます。", disconnected: "切断中の参加者がいます。", "not-owner": "オーナーだけが操作できます。", "not-owner-or-not-finished": "対戦終了後、オーナーが部屋へ戻せます。" };
export const RoomScreen = ({ onExit, onLab }: { readonly onExit: () => void; readonly onLab?: () => void }) => {
  const { t } = useLanguage();
  const [room, setRoom] = useState<RoomSnapshot | null>(null), [playerId, setPlayerId] = useState("");
  const [code, setCode] = useState(() => inviteRoom(location.href) ?? ""), [status, setStatus] = useState(() => new URL(location.href).searchParams.has("room") && !inviteRoom(location.href) ? "招待リンクの部屋コードが無効です。" : ""), [busy, setBusy] = useState(false);
  const [quickMode, setQuickMode] = useState<"1v1" | "2v2">("1v1"), [region, setRegion] = useState<"asia" | "europe" | "americas">("asia");
  const [waited, setWaited] = useState(false);
  const [nickname, setNickname] = useState(() => loadProfile().nickname || "ケロポッド");
  const [sharing, setSharing] = useState(false), [spectator, setSpectator] = useState(false);
  const [battle, setBattle] = useState<RoomConnection | null>(null);
  useEffect(() => { if (!battle) setMusic("lobby"); }, [battle]);
  const socket = useRef<WebSocket | null>(null), active = useRef(true), attempt = useRef(0);
  const connect = async (initial: { readonly type: string; readonly mode?: "1v1" | "2v2"; readonly region?: "asia" | "europe" | "americas"; readonly roomId?: string; readonly token?: string | null; readonly profile?: ReturnType<typeof profile> }) => {
    const currentAttempt = ++attempt.current;
    socket.current?.close(); setBusy(true); setStatus("接続しています…");
    socket.current = null;
    let url: string;
    try { url = serverBase
      ? await resolveRoomUrl(initial, serverBase, sessionStorage.getItem(roomKey))
      : `ws://${location.hostname}:8795`; }
    catch { if (active.current && currentAttempt === attempt.current) { setBusy(false); setStatus("対戦サーバーに接続できません。"); } return; }
    if (!active.current || currentAttempt !== attempt.current) return;
    const ws = new WebSocket(url); socket.current = ws;
    let identity = "", watching = false, versionMismatch = false;
    ws.onopen = () => { if (active.current && socket.current === ws) ws.send(JSON.stringify({ ...initial, build: CLIENT_BUILD, ...(initial.type === "room.quick" ? { roomId: serverBase ? new URL(url).pathname.split("/").at(-1) : "000000" } : {}) })); };
    ws.onmessage = event => {
      if (!active.current || socket.current !== ws) return;
      let raw: unknown; try { raw = JSON.parse(String(event.data)); } catch { return; }
      const result = roomOutputSchema.safeParse(raw); if (!result.success) return;
      const message = result.data;
      if (message.type === "room.welcome") { identity = message.playerId; watching = message.role === "spectator"; setSpectator(watching); setPlayerId(identity); sessionStorage.setItem(tokenKey, message.token); setBusy(false); setStatus(""); }
      if (message.type === "room.snapshot") { sessionStorage.setItem(roomKey, message.room.roomId); setRoom(message.room); if (message.room.phase === "waiting") setBattle(null); }
      if (message.type === "lab.frame" && !compatibleMatch(message.build, message.map)) { versionMismatch = true; setStatus("ゲームの更新が必要です。再読み込みしてください。"); ws.close(); return; }
      if (message.type === "lab.frame") setBattle(current => current?.socket === ws ? current : { socket: ws, playerId: identity, spectator: watching, frame: message });
      if (message.type === "room.error") { versionMismatch = message.reason === "version-mismatch"; setBusy(false); setStatus(errors[message.reason] ?? "操作を受け付けられませんでした。部屋の状態を確認してください。");
        if (message.reason === "invalid-session") { sessionStorage.removeItem(tokenKey); sessionStorage.removeItem(roomKey); socket.current = null; setRoom(null); setBattle(null); ws.close(); } }
    };
    ws.onclose = () => { if (versionMismatch) return; if (active.current && socket.current === ws) { setBusy(false); setStatus("接続が切れました。再接続で復帰できます（60秒以内）。"); } };
    ws.onerror = () => { if (active.current && socket.current === ws) { setBusy(false); setStatus("対戦サーバーに接続できません。"); } };
  };
  useEffect(() => { active.current = true; const token = sessionStorage.getItem(tokenKey); if (token && (!inviteRoom(location.href) || sessionStorage.getItem(roomKey) === inviteRoom(location.href))) connect({ type: "room.resume", token });
    return () => { active.current = false; attempt.current++; socket.current?.close(); }; }, []);
  useEffect(() => {
    setWaited(false);
    if (!room || room.mode === "custom" || room.phase !== "waiting") return;
    const timer = setTimeout(() => setWaited(true), 30000);
    return () => clearTimeout(timer);
  }, [room?.roomId, room?.phase]);
  const send = (message: unknown) => { if (socket.current?.readyState === WebSocket.OPEN) { setStatus(""); socket.current.send(JSON.stringify(message)); } };
  const edit = (type: string, fields: object = {}) => { if (room) send({ type, version: 2, roomId: room.roomId, revision: room.revision, ...fields }); };
  const leave = () => { send({ type: "room.leave" }); sessionStorage.removeItem(tokenKey); sessionStorage.removeItem(roomKey); onExit(); };
  useBrowserBackAction(!battle, leave);
  const cancelQuick = () => { send({ type: "room.leave" }); socket.current?.close(); socket.current = null; attempt.current++; sessionStorage.removeItem(tokenKey); sessionStorage.removeItem(roomKey); setRoom(null); setBattle(null); setStatus(""); };
  const profile = () => { const p = loadProfile(), name = nickname.trim() || "ケロポッド"; saveProfile({ ...p, nickname: name }); return { nickname: name, loadout: p.loadout }; };
  const me = room?.members.find(p => p.playerId === playerId), owner = room?.ownerId === playerId;
  const canStart = owner && room!.members.length >= 2 && room!.members.every(p => p.ready && p.connected && p.teamId) && new Set(room!.members.map(p => p.teamId)).size >= 2;
  const connected = socket.current?.readyState === WebSocket.OPEN;
  if (battle) return <><NetworkLab connection={battle} worldArt onExit={leave} />{status && <div className="room-battle-status" role="status">{t(status)}{!connected && <PixelButton disabled={busy} onClick={() => connect({ type: "room.resume", token: sessionStorage.getItem(tokenKey) })}>{t("再接続")}</PixelButton>}</div>}</>;
  return <section key={room?.roomId ?? "entry"} className="room-screen">
    <header><h1>{room ? <>{t("部屋")} <span data-testid="room-code">{room.roomId}</span></> : t("対戦ルーム")}</h1><PixelButton onClick={leave}>{t("ロビーに戻る")}</PixelButton></header>
    <div className="room-body"><PixelPanel>
      {!room ? <div className="room-entry"><h2>{t("仲間と出発しよう")}</h2><p>{t("部屋コードを共有して、2〜8人で遊べます。")}</p>
        <label>{t("名前")}<input aria-label={t("対戦で使う名前")} maxLength={12} value={nickname} onChange={e => setNickname(e.target.value)} /></label>
        <div className="room-quick"><label>{t("対戦形式")}<select aria-label={t("クイック対戦形式")} value={quickMode} onChange={e => setQuickMode(e.target.value as "1v1" | "2v2")}><option value="1v1">1 vs 1</option><option value="2v2">2 vs 2</option></select></label>
          <label>{t("地域")}<select aria-label={t("クイック対戦地域")} value={region} onChange={e => setRegion(e.target.value as typeof region)}><option value="asia">{t("アジア")}</option><option value="europe">{t("ヨーロッパ")}</option><option value="americas">{t("アメリカ")}</option></select></label>
          <PixelButton disabled={busy} onClick={() => connect({ type: "room.quick", roomId: "000000", mode: quickMode, region, profile: profile() })}>{t("クイック参加")}</PixelButton></div>
        <PixelButton disabled={busy} onClick={() => connect({ type: "room.create", profile: profile() })}>{t("部屋を作る")}</PixelButton>
        <label>{t("部屋コード")}<input aria-label={t("部屋コード")} maxLength={6} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, ""))} /></label>
        <PixelButton disabled={busy || code.length !== 6} onClick={() => connect({ type: "room.join", roomId: code, profile: profile() })}>{t("部屋に参加")}</PixelButton>
        <PixelButton disabled={busy || code.length !== 6} onClick={() => connect({ type: "room.spectate", roomId: code })}>{t("観戦する")}</PixelButton>
        {onLab && <button className="room-lab-link" onClick={onLab}>{t("固定8席試験")}</button>}</div> : <>
        {spectator && <p role="status">{t("観戦中")}</p>}
        {room.mode !== "custom" && <div><strong>{room.mode === "1v1" ? "1 vs 1" : "2 vs 2"}　{room.members.length} / {room.mode === "1v1" ? 2 : 4}</strong><PixelButton onClick={cancelQuick}>{t("待機をキャンセル")}</PixelButton>{waited && <p role="status">{t("対戦相手を待っています。キャンセルして地域を変更するか、ロビーから練習できます。")}</p>}</div>}
        <PixelButton onClick={() => setSharing(v => !v)}>{t("招待リンク")}</PixelButton>
        {sharing && <label>{t("招待リンク")}<input aria-label={t("招待リンク")} readOnly value={roomInviteUrl(location.href, room.roomId)} onFocus={e => e.currentTarget.select()} /><PixelButton onClick={() => { void (navigator.clipboard?.writeText(roomInviteUrl(location.href, room.roomId)) ?? Promise.reject()).then(() => setStatus("招待リンクをコピーしました。"), () => setStatus("リンクを選択してコピーしてください。")); }}>{t("コピー")}</PixelButton></label>}
        <p>{t("チームを選び、準備完了にしてください。人数差のある編成でも開始できます。")}</p>
        <ul className="room-members">{room.members.map((p, i) => <li key={p.playerId}>
          <strong>{i + 1}. {p.nickname}{p.playerId === playerId ? t("（あなた）") : ""}{p.playerId === room.ownerId ? " / OWNER" : ""}</strong>
          <select aria-label={t("参加者{n}のチーム", { n: i + 1 })} value={p.teamId ?? ""} style={{ borderLeft: `6px solid ${p.teamId ? teamColor(Number(p.teamId.slice(1))) : "transparent"}` }} disabled={room.mode !== "custom" || !connected || (!owner && p.playerId !== playerId)} onChange={e => edit("room.assignTeam", { playerId: p.playerId, teamId: e.target.value || null })}><option value="">{t("未配置")}</option>{Array.from({ length: 8 }, (_, team) => <option key={team} value={`t${team}`}>{t("{color}チーム", { color: t(teamColorName(team)) })}</option>)}</select>
          <span>{!p.connected ? t("切断中") : p.ready ? t("準備完了") : t("準備中")}</span>
        </li>)}</ul>
        {me && <div className="room-equipment">{([0, 1] as const).map(slot => <label key={slot}>{t("装備")} {slot + 1}<select aria-label={t("部屋の装備{n}", { n: slot + 1 })} disabled={!connected} value={me.loadout[slot]} onChange={e => edit("room.loadout", { loadout: slot === 0 ? [e.target.value, me.loadout[1]] : [me.loadout[0], e.target.value] })}>{WEAPON_IDS.map(id => <option value={id} key={id} disabled={id === me.loadout[slot === 0 ? 1 : 0]}>{t(WEAPON_LABELS[id])}</option>)}</select></label>)}</div>}
        <label>{t("マップ")}<select aria-label={t("マップ")} value={room.map.id} disabled={room.mode !== "custom" || !connected || !owner} onChange={e => edit("room.map", { mapId: e.target.value })}>{MULTIPLAYER_MAPS.map(map => <option key={map.id} value={map.id}>{t(MULTIPLAYER_MAP_LABELS[map.id] ?? map.id)}</option>)}</select></label>
        <p className="room-note">{t("マップ・装備・編成が変わると全員の準備が解除されます。")}</p>
      </>}
    </PixelPanel></div>
    <footer>{status && <span role="status">{t(status)}</span>}{!connected && sessionStorage.getItem(tokenKey) && <PixelButton disabled={busy} onClick={() => connect({ type: "room.resume", token: sessionStorage.getItem(tokenKey) })}>{t("再接続")}</PixelButton>}
      {room && me && <><PixelButton disabled={!connected} onClick={() => edit("room.ready", { ready: !me?.ready })}>{me?.ready ? t("準備を解除") : t("準備完了")}</PixelButton>{owner && room.mode === "custom" && <PixelButton disabled={!connected || !canStart} onClick={() => edit("room.start")}>{t("対戦開始")}</PixelButton>}</>}
    </footer>
  </section>;
};
