import "./terminalScreens.css";
import { CreateRoomDialog } from "./CreateRoomDialog";
import { RoomPasswordDialog } from "./RoomPasswordDialog";
import { RoomWaiting } from "./RoomWaiting";
import type { CreateRoomOptions } from "@game/protocol/v2-rooms";
import { useRegionSelection } from "./useRegionSelection";
import { PublicRooms } from "./PublicRooms";
import { useBrowserBackAction } from "./browserBack";
import { setMusic } from "@/app/audio";
import { useLanguage } from "@/i18n/locale";
import { CLIENT_BUILD, compatibleMatch } from "@game/protocol/build";
import { useEffect, useRef, useState } from "react";
import { roomOutputSchema, type RoomSnapshot } from "@game/protocol/v2-rooms";
import { loadProfile } from "@/app/profile";
import { NetworkLab, type RoomConnection } from "@/networkLab/NetworkLab";
import { PixelButton, PixelPanel } from "./PixelUi";
import "./rooms.css";
import "./lobbyTerminal.css";
import { inviteRoom } from "./roomInvite";
import { resolveRoomUrl, ROOM_UNREACHABLE_STATUS, roomFailureStatus } from "./roomTransport";
import { SceneLoading } from "./SceneLoading";
import { ROOM_CONNECTING_STATUS, roomLoadingSteps } from "./connectionSteps";
const serverBase = import.meta.env.VITE_ROOM_SERVER_URL || (import.meta.env.PROD ? location.origin : "");
const tokenKey = "keropod.room-token", roomKey = "keropod.room-id";
const errors: Record<string, string> = { "wrong-password": "パスワードが違います。", "password-rate-limit": "しばらく待ってから再試行してください。", "invalid-invite": "招待リンクが無効か期限切れです。新しいリンクを共有してもらってください。", "room-unrecoverable": "部屋のデータを復元できませんでした。この試合は無効です。ロビーへ戻ってください。", "version-mismatch": "ゲームの更新が必要です。再読み込みしてください。", "wrong-mode": "この部屋は別の対戦形式です。クイック参加から入り直してください。", "fixed-mode": "クイック対戦の編成は固定です。", "waiting-for-players": "人数が揃うまでお待ちください。", "spectators-full": "観戦席が満員です。", "read-only": "観戦中は対戦操作できません。", "not-found": "部屋が見つかりません。", full: "部屋が満員です。", locked: "対戦中の部屋には参加できません。", "invalid-session": "復帰期限が切れたか、別の画面で接続中です。", "stale-revision": "部屋が更新されました。内容を確認して再操作してください。", "not-ready": "全員の準備完了を待っています。", unassigned: "全員のチームを選んでください。", "not-enough-teams": "2チーム以上に分かれてください。", "not-enough-players": "2人以上で開始できます。", disconnected: "切断中の参加者がいます。", "not-owner": "オーナーだけが操作できます。", "not-owner-or-not-finished": "対戦終了後、オーナーが部屋へ戻せます。" };
export const RoomScreen = ({ onExit }: { readonly onExit: () => void; readonly onLab?: () => void }) => {
  const { t } = useLanguage();
  const [creating, setCreating] = useState(false);
  const [passwordJoin, setPasswordJoin] = useState<{ roomId: string; type: "room.join" | "room.spectate" } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [room, setRoom] = useState<RoomSnapshot | null>(null), [playerId, setPlayerId] = useState("");
  const [status, setStatus] = useState(() => new URL(location.href).searchParams.has("room") && !inviteRoom(location.href) ? "招待リンクの部屋コードが無効です。" : ""), [busy, setBusy] = useState(false);
  const { region, measuring, selectRegion } = useRegionSelection(serverBase, "1v1");
  const [waited, setWaited] = useState(false);
  const [spectator, setSpectator] = useState(false);
  const [battle, setBattle] = useState<RoomConnection | null>(null);
  useEffect(() => { if (!battle) setMusic(room ? "room" : "lobby"); }, [battle, room?.roomId]);
  const socket = useRef<WebSocket | null>(null), active = useRef(true), attempt = useRef(0);
  const connect = async (initial: { readonly options?: CreateRoomOptions; readonly password?: string; readonly type: string; readonly mode?: "1v1" | "2v2"; readonly region?: "asia" | "europe" | "americas"; readonly roomId?: string; readonly token?: string | null; readonly profile?: ReturnType<typeof profile> }) => {
    const { options: _options, ...handshake } = initial;
    const currentAttempt = ++attempt.current;
    socket.current?.close(); setBusy(true); setStatus(ROOM_CONNECTING_STATUS);
    socket.current = null;
    let url: string;
    try { url = serverBase
      ? await resolveRoomUrl(initial, serverBase, sessionStorage.getItem(roomKey))
      : `ws://${location.hostname}:8795`; }
    catch (error) { if (active.current && currentAttempt === attempt.current) { setBusy(false); setStatus(roomFailureStatus(error)); } return; }
    if (!active.current || currentAttempt !== attempt.current) return;
    const invitation = serverBase && ["room.join", "room.spectate"].includes(initial.type) && initial.roomId === inviteRoom(location.href)
      ? new URLSearchParams(new URL(location.href).hash.slice(1)).get("invite") : null;
    const ws = new WebSocket(url); socket.current = ws;
    let identity = "", watching = false, versionMismatch = false;
    ws.onopen = () => { if (active.current && socket.current === ws) ws.send(JSON.stringify({ ...handshake, ...(invitation !== null ? { invite: invitation } : {}), build: CLIENT_BUILD, ...(initial.type === "room.quick" ? { roomId: serverBase ? new URL(url).pathname.split("/").at(-1) : "000000" } : {}) })); };
    ws.onmessage = event => {
      if (!active.current || socket.current !== ws) return;
      let raw: unknown; try { raw = JSON.parse(String(event.data)); } catch { return; }
      const result = roomOutputSchema.safeParse(raw); if (!result.success) return;
      const message = result.data;
      if (message.type === "room.welcome") { setCreating(false); identity = message.playerId; watching = message.role === "spectator"; setSpectator(watching); setPlayerId(identity); sessionStorage.setItem(tokenKey, message.token); setBusy(false); setStatus(""); }
      if (message.type === "room.snapshot") { sessionStorage.setItem(roomKey, message.room.roomId); setRoom(message.room); if (message.room.phase === "waiting") setBattle(null); }
      if (message.type === "lab.frame" && !compatibleMatch(message.build, message.map)) { versionMismatch = true; setStatus("ゲームの更新が必要です。再読み込みしてください。"); ws.close(); return; }
      if (message.type === "lab.frame") setBattle(current => current?.socket === ws ? current : { socket: ws, playerId: identity, spectator: watching, frame: message });
      if (message.type === "room.error" && message.reason === "room-unrecoverable") {
        versionMismatch = true; setBusy(false); setStatus(errors["room-unrecoverable"]!);
        sessionStorage.removeItem(tokenKey); sessionStorage.removeItem(roomKey);
        socket.current = null; setBattle(null); setRoom(null); ws.close(); return;
      }
      if (message.type === "room.error" && message.reason === "invalid-invite") {
        versionMismatch = true; setBusy(false); setStatus(errors["invalid-invite"]!); socket.current = null; ws.close(); return;
      }
      if (message.type === "room.error") { versionMismatch = ["version-mismatch", "wrong-password", "password-rate-limit"].includes(message.reason); setBusy(false); setStatus(errors[message.reason] ?? "操作を受け付けられませんでした。部屋の状態を確認してください。");
        if (message.reason === "invalid-session") { sessionStorage.removeItem(tokenKey); sessionStorage.removeItem(roomKey); socket.current = null; setRoom(null); setBattle(null); ws.close(); } }
    };
    ws.onclose = () => { if (versionMismatch) return; if (active.current && socket.current === ws) { setBusy(false); setStatus("接続が切れました。再接続で復帰できます（60秒以内）。"); } };
    ws.onerror = () => { if (active.current && socket.current === ws) { setBusy(false); setStatus(ROOM_UNREACHABLE_STATUS); } };
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
  const returnToList = () => { send({ type: "room.leave" }); socket.current?.close(); socket.current = null; attempt.current++; sessionStorage.removeItem(tokenKey); sessionStorage.removeItem(roomKey); setRoom(null); setBattle(null); setStatus(""); setBusy(false); setSpectator(false); setPlayerId(""); };
  useBrowserBackAction(!battle, room ? returnToList : leave);
  const profile = () => { const p = loadProfile(); return { nickname: p.nickname.trim() || "プレイヤー", loadout: p.loadout, colors: p.colors }; };
  const connected = socket.current?.readyState === WebSocket.OPEN;
  const loadingSteps = roomLoadingSteps({ status, joined: Boolean(playerId), hasRoom: Boolean(room) }, t);
  const plainStatus = loadingSteps ? "" : status;
  if (battle) return <><NetworkLab connection={battle} worldArt onExit={leave} />{status && <div className="room-battle-status" role="status">{t(status)}{!connected && <PixelButton disabled={busy} onClick={() => connect({ type: "room.resume", token: sessionStorage.getItem(tokenKey) })}>{t("再接続")}</PixelButton>}</div>}</>;
  if (room) return <RoomWaiting key={room.roomId} room={room} playerId={playerId} spectator={spectator} connected={connected} busy={busy}
    status={plainStatus} loading={loadingSteps} waited={waited} base={serverBase} token={sessionStorage.getItem(tokenKey)}
    edit={edit} leave={returnToList} resume={() => connect({ type: "room.resume", token: sessionStorage.getItem(tokenKey) })} />;
  return <section key="entry" className="room-screen terminal-screen lobby-terminal">
    {creating && <CreateRoomDialog region={region} busy={busy} status={plainStatus} close={() => setCreating(false)} create={options => { void connect({ type: "room.create", options, password: options.password, profile: profile() }); }} />}
    {passwordJoin && <RoomPasswordDialog close={() => setPasswordJoin(null)} submit={password => { void connect({ ...passwordJoin, password, ...(passwordJoin.type === "room.join" ? { profile: profile() } : {}) }); setPasswordJoin(null); }} />}
    <header className="room-header">
      <PixelButton onClick={leave}>{t("出撃準備")}</PixelButton>
      <div className="room-header-actions">
        <select aria-label={t("クイック対戦地域")} value={region} onChange={e => selectRegion(e.target.value as "asia" | "europe" | "americas")}><option value="" disabled>{t(measuring ? "地域を測定中…" : "地域を選択してください")}</option><option value="asia">{t("アジア")}</option><option value="europe">{t("ヨーロッパ")}</option><option value="americas">{t("アメリカ")}</option></select>
        {serverBase && <PixelButton disabled={busy} aria-expanded={filtersOpen} aria-controls="room-filters" onClick={() => setFiltersOpen(value => !value)}>{t("部屋を探す")}</PixelButton>}
        <PixelButton className="room-create" disabled={busy} onClick={() => { setStatus(""); setCreating(true); }}>{t("部屋を作る")}</PixelButton>
      </div>
    </header>
    <div className="room-body"><PixelPanel>
      {serverBase && <PublicRooms initialCode={inviteRoom(location.href) ?? ""} base={serverBase} busy={busy} filtersOpen={filtersOpen} closeFilters={() => setFiltersOpen(false)} join={(roomId, type, locked) => { if (locked) { setPasswordJoin({ roomId, type }); return; } void connect({ type, roomId, ...(type === "room.join" ? { profile: profile() } : {}) }); }} />}
    </PixelPanel></div>
    <footer>{loadingSteps ? <SceneLoading className="scene-loading-inline" steps={loadingSteps} /> : status && !creating && <span role="status">{t(status)}</span>}{!connected && sessionStorage.getItem(tokenKey) && <PixelButton disabled={busy} onClick={() => connect({ type: "room.resume", token: sessionStorage.getItem(tokenKey) })}>{t("再接続")}</PixelButton>}</footer>
  </section>;
};
