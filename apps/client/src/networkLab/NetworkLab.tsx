import { useBrowserBackAction } from "@/worldUi/browserBack";
import { LeaveBattleDialog } from "@/worldUi/LeaveBattleDialog";
import { CountdownDial } from "@/ui/CountdownDial";
import { ResultPlayers } from "@/worldUi/ResultPlayers";
import { ResultStats } from "@/worldUi/ResultStats";
import { measureLatency } from "./latency";
import { roomOutputSchema } from "@game/protocol/v2-rooms";
import { teamColorName } from "@/worldUi/teamColors";
import { useLanguage } from "@/i18n/locale";
import { matchDiagnostics } from "@/worldUi/diagnostics";
import { createBattleSounds } from "./battleSounds";
import { playSound, setMusic, unlockAudio } from "@/app/audio";
import { CLIENT_BUILD, compatibleMatch } from "@game/protocol/build";
import { BattleMenu } from "@/worldUi/BattleMenu";
import { applyOps, maskFromHeights, tiltOf } from "@game/sim";
import { BattleConsole, BattleRoster } from "@/worldUi/BattleHud";
import { useTouchControls } from "@/worldUi/useTouchControls";
import { useBattleInput } from "@/worldUi/useBattleInput";
import { DEFAULT_LOADOUT, WEAPON_LABELS } from "@game/protocol";
import { useEffect, useMemo, useRef, useState } from "react";
import { labOutputSchema, type LabFrame } from "@game/protocol/v2-lab";
import { NetworkField } from "@/worldUi/NetworkField";
import { presentLabReplay } from "./labReplay";
import { createRemoteMotion } from "./remoteMotion";
import "./networkLab.css";

type Position = { readonly playerId: string; readonly x: number; readonly y: number };
export type RoomConnection = { readonly spectator?: boolean; readonly socket: WebSocket; readonly playerId: string; readonly frame: LabFrame };
export const NetworkLab = ({ worldArt = false, onExit, connection }: { readonly worldArt?: boolean; readonly onExit?: () => void; readonly connection?: RoomConnection }) => {
  const { t } = useLanguage();
  const touch = useTouchControls();
  const spectator = connection?.spectator ?? false;
  const [keepView, setKeepView] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [menu, setMenu] = useState(false);
  const [status, setStatus] = useState("接続中"), [playerId, setPlayerId] = useState("");
  const [latency, setLatency] = useState<number | null>(null);
  useEffect(() => { if (connection) return measureLatency(connection.socket, setLatency); setLatency(null); }, [connection]);
  const [reportStatus, setReportStatus] = useState("");
  const [slot, setSlot] = useState<0 | 1>(0);
  const [elevation, setElevation] = useState(45), [power, setPower] = useState(50);
  const [frame, setFrame] = useState<LabFrame | null>(null), [positions, setPositions] = useState<Position[]>([]);
  useEffect(() => {
    setMusic(frame?.phase === "finished" ? "result" : "battle");
    if (frame?.phase === "finished") playSound("matchFinish");
  }, [frame?.phase === "finished"]);
  const [serverNow, setServerNow] = useState(0);
  const clock = useRef({ time: 0, received: 0 });
  const socket = useRef<WebSocket | null>(null), latest = useRef<LabFrame | null>(null);
  const sequence = useRef(0), commandId = useRef(0), pending = useRef(false);
  useEffect(() => {
    const ws = connection?.socket ?? new WebSocket(`ws://${location.hostname}:8794`);
    socket.current = ws;
    const sounds = createBattleSounds();
    const motion = new Map<string, ReturnType<typeof createRemoteMotion>>();
    let ownId = connection?.playerId ?? "", active = true, versionMismatch = false, animation = 0;
    if (connection) { setPlayerId(ownId); setStatus("接続済み"); }
    if (!connection) ws.onopen = () => {
      if (!active) return;
      const token = sessionStorage.getItem("keropod.network-lab-token");
      ws.send(JSON.stringify({ type: "lab.join", build: CLIENT_BUILD, ...(token ? { token } : {}) }));
    };
    const receive = (raw: unknown) => {
      if (!active) return;
      const roomMessage = roomOutputSchema.safeParse(raw);
      if (roomMessage.success && roomMessage.data.type === "room.reported") { setReportStatus(roomMessage.data.status === "saved" ? "通報を受け付けました。" : "このプレイヤーへの通報は受付済みです。"); return; }
      if (roomMessage.success && roomMessage.data.type === "room.error" && ["report-capacity", "invalid-report-target", "wrong-turn"].includes(roomMessage.data.reason)) setReportStatus("通報を送信できませんでした。");
      const result = labOutputSchema.safeParse(raw); if (!result.success) return;
      const message = result.data;
      if (message.type === "lab.welcome") {
        ownId = message.playerId; setPlayerId(ownId); setStatus("接続済み");
        sessionStorage.setItem("keropod.network-lab-token", message.token);
      } else if (message.type === "lab.error") setStatus(message.reason);
      else if (message.type === "lab.ack") {
        pending.current = false;
        if (message.snapshot) sequence.current = message.snapshot.ackMoveSeq;
        setStatus(message.reason);
      } else {
        if (!compatibleMatch(message.build, message.map)) { versionMismatch = true; setStatus("ゲームの更新が必要です。再読み込みしてください。"); ws.close(); return; }
        if (latest.current && message.matchId === latest.current.matchId && message.eventSeq < latest.current.eventSeq) return;
        if (message.matchId !== latest.current?.matchId) { motion.clear(); setReportStatus(""); }
        if (message.matchId !== latest.current?.matchId || message.turnId !== latest.current?.turnId) { pending.current = false; sequence.current = message.movement.ackMoveSeq; }
        if (!pending.current) sequence.current = message.movement.ackMoveSeq;
        clock.current = { time: message.serverTime, received: performance.now() };
        latest.current = message; setFrame(message);
        for (const p of message.players) {
          const buffer = motion.get(p.playerId) ?? createRemoteMotion();
          buffer.push(p, performance.now(), message.eventSeq, p.playerId === ownId || message.phase !== "acting" || p.eliminated || (p.playerId === message.actorId && message.movement.stoppedByFall));
          motion.set(p.playerId, buffer);
        }
      }
    };
    const closed = () => { if (active && !versionMismatch) { setStatus("切断：再読み込みで復帰"); setReportStatus(previous => previous === "送信中…" ? "通報を送信できませんでした。" : previous); pending.current = false; } };
    const failed = () => { if (active) setStatus("接続に失敗しました"); };
    const message = (event: MessageEvent) => { try { receive(JSON.parse(String(event.data))); } catch { return; } };
    ws.addEventListener("message", message); ws.addEventListener("close", closed); ws.addEventListener("error", failed);
    if (connection) receive(connection.frame);
    const draw = (): void => {
      const now = clock.current.time + performance.now() - clock.current.received;
      setServerNow(now);
      if (latest.current) {
        const events = sounds(latest.current, now);
        if (!document.hidden) events.forEach(playSound);
      }
      setPositions([...motion.entries()].flatMap(([id, buffer]) => { const p = buffer.at(performance.now()); return p ? [{ playerId: id, ...p }] : []; }));
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => { active = false; cancelAnimationFrame(animation); ws.removeEventListener("message", message); ws.removeEventListener("close", closed); ws.removeEventListener("error", failed); if (!connection) ws.close(); socket.current = null; };
  }, [connection]);
  const move = (direction: -1 | 1): void => {
    const current = latest.current, ws = socket.current;
    if (!current || current.actorId !== playerId || !ws || ws.readyState !== WebSocket.OPEN || pending.current) return;
    pending.current = true;
    ws.send(JSON.stringify({ version: 2, type: "move.command", matchId: current.matchId, turnId: current.turnId,
      commandId: `${playerId}-${++commandId.current}-${Date.now()}`, moveSeq: sequence.current + 1, direction, steps: 1 }));
  };
  const fire = (shotPower = power): void => {
    const current = latest.current, ws = socket.current;
    if (!current || current.phase !== "acting" || current.actorId !== playerId || !ws || ws.readyState !== WebSocket.OPEN || pending.current) return;
    pending.current = true;
    ws.send(JSON.stringify({ version: 2, type: "turn.fire", matchId: current.matchId, turnId: current.turnId,
      commandId: `fire-${playerId}-${++commandId.current}-${Date.now()}`, ackMoveSeq: sequence.current,
      slot, facing: current.movement.facing, elevation, power: shotPower }));
  };
  const action = (type: "lab.rematch" | "lab.surrender"): void => {
    if (frame && socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type, matchId: frame.matchId }));
  };
  const presentation = frame ? presentLabReplay(frame, serverNow) : null;
  const shownPlayers = frame?.phase === "replaying" ? presentation!.players : positions.map(p => ({ ...frame!.players.find(player => player.playerId === p.playerId)!, ...p }));
  const loadout = frame?.players.find(p => p.playerId === playerId)?.loadout ?? DEFAULT_LOADOUT;
  const phaseLabel = frame?.phase === "replaying" ? "射撃を再生中" : frame?.phase === "finished" ? "対戦終了" : "操作中";
  const observing = spectator || Boolean(frame?.players.find(p => p.playerId === playerId)?.eliminated);
  const canAct = (!worldArt || innerWidth > innerHeight) && frame?.phase === "acting" && frame.actorId === playerId && socket.current?.readyState === WebSocket.OPEN;
  const input = useBattleInput(Boolean(worldArt && canAct && !menu && !confirmLeave), move, delta => setElevation(v => Math.max(10, Math.min(90, v + delta))), fire, setSlot);
  useBrowserBackAction(Boolean(worldArt && onExit), () => { input.cancel(); setMenu(false); setConfirmLeave(true); });
  const hudPlayers = frame?.players.map(p => ({ id: p.playerId, name: p.nickname ?? p.playerId, hp: p.hp, team: Number(p.teamId.slice(1)) })) ?? [];
  const own = shownPlayers.find(p => p.playerId === playerId);
  const ownFacing = useRef<-1 | 1>(1);
  if (frame?.actorId === playerId) ownFacing.current = frame.movement.facing;
  const ground = useMemo(() => own && presentation && frame ? tiltOf(applyOps(maskFromHeights(frame.map.surface, frame.map.height), presentation.terrainOps), own) : 0, [own?.x, own?.y, frame?.eventSeq, frame?.matchId]);
  if (worldArt) return <main className="network-lab network-world" onPointerDown={() => unlockAudio()} onKeyDown={() => unlockAudio()}>
    <BattleRoster upcomingPlayerIds={frame?.upcomingPlayerIds ?? []} players={hudPlayers} actorId={frame?.actorId ?? ""} wind={frame?.wind ?? 0} clock={<CountdownDial seconds={frame?.phase === "acting" ? Math.max(0, Math.ceil((frame.deadlineAt - serverNow) / 1000)) : null} />} onMenu={() => { input.cancel(); setMenu(true); }} />
    <span className="battle-sr" data-testid="identity">{playerId}</span><span className="battle-sr" data-testid="phase">{t(phaseLabel)}</span>
    {frame && presentation ? <NetworkField blocked={menu || confirmLeave || input.gauge.charging} frame={frame} players={shownPlayers} presentation={presentation} elevation={elevation} ownId={playerId} followTurns={!observing || !keepView} {...(!observing ? { selectedWeapon: loadout[slot] } : {})} /> : <p role="status">{t(status)}</p>}
    {observing ? <footer className="battle-console"><span role="status">{t("観戦中")}</span><label><input type="checkbox" checked={keepView} onChange={e => setKeepView(e.target.checked)} />{t("手動視点を維持")}</label></footer> : <BattleConsole player={hudPlayers.find(p => p.id === playerId)} steps={frame?.actorId === playerId ? frame.movement.stepsLeft : 0} tilt={ground} elevation={elevation} facing={ownFacing.current} power={input.gauge.value} loadout={loadout} slot={slot} disabled={!canAct || menu || confirmLeave || input.gauge.charging} selectSlot={setSlot}>
      {touch && <><div><button disabled={!canAct || confirmLeave || menu} aria-label={t("左へ1歩")} {...input.button("left")}>←</button><button disabled={!canAct || confirmLeave || menu} aria-label={t("右へ1歩")} {...input.button("right")}>→</button></div><div><button disabled={!canAct || confirmLeave || menu} aria-label={t("角度を下げる")} {...input.button("down")}>−</button><button disabled={!canAct || confirmLeave || menu} aria-label={t("角度を上げる")} {...input.button("up")}>＋</button></div><button disabled={!canAct || confirmLeave || menu} aria-label={t("発射")} {...input.button("fire")}>{t("発射")}</button></>}
    </BattleConsole>}
    {latency !== null && latency > 300 && <span className="network-latency" role="status">{t("通信遅延")} {latency} ms</span>}
    {confirmLeave && onExit && <LeaveBattleDialog online playing={!observing && frame?.phase !== "finished"} close={() => setConfirmLeave(false)} leave={onExit} />}
    {menu && <BattleMenu activeTurn={frame?.phase === "acting" && frame.actorId === playerId && !observing} latency={latency} {...(connection && frame ? { report: { players: frame.players.filter(p => p.playerId !== playerId).map(p => ({ id: p.playerId, name: p.nickname ?? p.playerId })), status: reportStatus, send: (targetId: string, reason: "name" | "abuse" | "cheating") => {
      if (socket.current?.readyState !== WebSocket.OPEN) { setReportStatus("通報を送信できませんでした。"); return; }
      setReportStatus("送信中…"); socket.current.send(JSON.stringify({ type: "room.report", matchId: frame.matchId, targetId, reason }));
    } } } : {})} {...(frame ? { diagnostics: matchDiagnostics(frame) } : {})} spectator={observing} close={() => setMenu(false)} surrender={() => { action("lab.surrender"); setMenu(false); }} exit={onExit} finished={!frame || frame.phase === "finished"} />}
    {frame?.phase === "finished" && <section className="network-finished"><h2>{frame.result.type === "win" ? t("{team}チームの勝利", { team: t(teamColorName(Number(frame.result.teamId.slice(1)))) }) : t("引き分け")}</h2><ResultPlayers players={frame.players} result={frame.result} /><ResultStats players={frame.players} {...(frame.stats ? { stats: frame.stats } : {})} />{frame.returnStatus && <p>{t("部屋へ戻るまで {seconds}秒", { seconds: Math.max(0, Math.ceil((frame.returnStatus.deadlineAt - serverNow) / 1000)) })}</p>}{!spectator && <button disabled={Boolean(connection && frame.returnStatus?.readyIds.includes(playerId))} onClick={() => action("lab.rematch")}>{connection ? frame.returnStatus?.readyIds.includes(playerId) ? t("帰還待ち") : t("部屋へ戻る") : t("再戦する")}</button>}<button onClick={onExit}>{t("ロビーに戻る")}</button></section>}
    {status === "invalid-session" && <div className="network-finished"><p>{t("接続の有効期限が切れました。")}</p><button onClick={() => { sessionStorage.removeItem("keropod.network-lab-token"); location.reload(); }}>{t("新しい接続で参加")}</button></div>}
    <div className="network-portrait"><h2>{t("横向きでプレイしよう")}</h2><p>{t("端末を回転するとフィールドと操作が見やすくなります。")}</p><button onClick={onExit}>{t("ロビーに戻る")}</button></div>
    {!connection && status.startsWith("切断") && <p className="network-connection" role="status">{t("切断されました。再読み込みで復帰できます。")}</p>}
  </main>;
  return <main className="network-lab">
    <h1>KEROPOD 対戦同期テスト</h1>
    <p>あなた：<strong data-testid="identity">{playerId || "未割当"}</strong>　手番：<strong>{frame?.actorId ?? "—"}</strong>　{t(status)}</p>
    <p>固定8席の開発用画面です。別タブを開くと別の席で参加します。射撃終了または20秒の期限で手番が交代します。</p>
    <svg viewBox={`0 0 ${frame?.map.width ?? 500} ${frame?.map.height ?? 225}`} aria-label="移動同期フィールド">
      <defs><mask id="lab-terrain"><rect width={frame?.map.width ?? 500} height={frame?.map.height ?? 225} fill="white" />{presentation?.terrainOps.map((op, i) => <circle key={i} cx={op.cx} cy={op.cy} r={op.radius} fill="black" />)}</mask></defs>
      <rect width={frame?.map.width ?? 500} height={frame?.map.height ?? 225} fill="#d9e9ef" /><path d={frame ? `M0 ${frame.map.height} ${frame.map.surface.map((y, x) => `L${x} ${y}`).join(" ")} L${frame.map.width} ${frame.map.height}Z` : ""} fill="#657d56" mask="url(#lab-terrain)" />
      {presentation?.bullets.map((p, i) => <circle key={i} data-testid="lab-projectile" cx={p.x} cy={p.y} r="2" fill="#cf6b35" />)}
      {shownPlayers.map(p => <g key={p.playerId} data-testid={`tank-${p.playerId}`} opacity={p.eliminated ? .25 : 1} data-x={p.x.toFixed(3)} transform={`translate(${p.x},${p.y - 5})`}>
        <rect x="-5" y="-5" width="10" height="10" rx="2" fill={p.playerId === playerId ? "#cf6b35" : "#304659"} />
        <text y="-12" textAnchor="middle" fontSize="8">{p.playerId} {Math.max(0, p.hp)}{p.playerId === frame?.actorId ? " ▼" : ""}</text>
      </g>)}
    </svg>
    <div><button disabled={frame?.phase !== "acting" || frame?.actorId !== playerId || !playerId} onClick={() => move(-1)}>{t("左へ1歩")}</button><button disabled={frame?.phase !== "acting" || frame?.actorId !== playerId || !playerId} onClick={() => move(1)}>{t("右へ1歩")}</button></div>
    <div className="lab-fire-controls"><label>角度 {elevation}°<input aria-label="射撃角度" type="range" min="10" max="90" value={elevation} onChange={e => setElevation(Number(e.target.value))} /></label><label>パワー {power}<input aria-label="射撃パワー" type="range" min="0" max="100" value={power} onChange={e => setPower(Number(e.target.value))} /></label>
      <button disabled={frame?.phase !== "acting" || frame?.actorId !== playerId || !playerId} onClick={() => fire()}>{t("発射")}</button>
      <button disabled={!frame || frame.phase === "finished"} onClick={() => action("lab.surrender")}>{t("降参")}</button></div>
    <p data-testid="phase">{frame?.phase === "replaying" ? "射撃を再生中" : frame?.phase === "finished" ? "対戦終了" : "操作中"}</p>
    {frame?.phase === "finished" && <section><h2>{frame.result.type === "win" ? `${frame.result.teamId} の勝利` : t("引き分け")}</h2>{!spectator && <button onClick={() => action("lab.rematch")}>{connection ? t("部屋へ戻る（オーナー）") : t("再戦する")}</button>}</section>}
    <p>残り {frame?.movement.stepsLeft ?? 30} 歩 ／ 確定入力 {frame?.movement.ackMoveSeq ?? 0}</p>
    {status === "invalid-session" && <button onClick={() => { sessionStorage.removeItem("keropod.network-lab-token"); location.reload(); }}>{t("新しい接続で参加")}</button>}
    <p>相手は125ms補間。固定8席の開発用対戦。ロビーと最終アートは未接続です。</p>
  </main>;
};
