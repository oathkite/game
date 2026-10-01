import { stageMusic } from "@/app/musicTracks";
import { resultTitle } from "@/worldUi/resultTitle";
import { YourTurn } from "@/worldUi/YourTurn";
import { TurnOrderList } from "@/worldUi/TurnOrderList";
import { BattleTouchControls } from "@/worldUi/BattleTouchControls";
import { useBrowserBackAction } from "@/worldUi/browserBack";
import { LeaveBattleDialog } from "@/worldUi/LeaveBattleDialog";
import { CountdownDial } from "@/ui/CountdownDial";
import { ResultPlayers } from "@/worldUi/ResultPlayers";
import { measureLatency } from "./latency";
import { roomOutputSchema } from "@game/protocol/v2-rooms";
import { useLanguage } from "@/i18n/locale";
import { matchDiagnostics } from "@/worldUi/diagnostics";
import { createBattleSounds } from "./battleSounds";
import { playSound, setMusic, unlockAudio } from "@/app/audio";
import { CLIENT_BUILD, compatibleMatch } from "@game/protocol/build";
import { BattleMenu } from "@/worldUi/BattleMenu";
import { applyOps, buildInitialTerrain, tiltOf } from "@game/sim";
import { BattleConsole, BattleOverlay } from "@/worldUi/BattleHud";
import { WindGauge } from "@/worldUi/WindGauge";
import { useTouchControls } from "@/worldUi/useTouchControls";
import { SceneLoading } from "@/worldUi/SceneLoading";
import { LAB_CONNECTED_STATUS, LAB_CONNECTING_STATUS, labLoadingSteps } from "@/worldUi/connectionSteps";
import { useBattleInput } from "@/worldUi/useBattleInput";
import { DEFAULT_LOADOUT, WEAPON_LABELS } from "@game/protocol";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { labOutputSchema, type LabFrame } from "@game/protocol/v2-lab";
import { NetworkField } from "@/worldUi/NetworkField";
import { battleClock, clockKey, sampleLive, type BattleClock, type LiveSample } from "./liveView";
import { createMovePredictor, type MovePredictor } from "./movePrediction";
import { createRemoteMotion } from "./remoteMotion";
import "./networkLab.css";

export type RoomConnection = { readonly spectator?: boolean; readonly socket: WebSocket; readonly playerId: string; readonly frame: LabFrame };
export const NetworkLab = ({ worldArt = false, onExit, connection }: { readonly worldArt?: boolean; readonly onExit?: () => void; readonly connection?: RoomConnection }) => {
  const { t } = useLanguage();
  const touch = useTouchControls();
  const spectator = connection?.spectator ?? false;
  const [settling, setSettling] = useState(false);
  const [keepView, setKeepView] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [menu, setMenu] = useState(false);
  const [status, setStatus] = useState(LAB_CONNECTING_STATUS), [playerId, setPlayerId] = useState("");
  const [latency, setLatency] = useState<number | null>(null);
  useEffect(() => { if (connection) return measureLatency(connection.socket, setLatency); setLatency(null); }, [connection]);
  const [reportStatus, setReportStatus] = useState("");
  const [slot, setSlot] = useState<0 | 1>(0);
  const [elevation, setElevation] = useState(45), [power, setPower] = useState(50);
  const [frame, setFrame] = useState<LabFrame | null>(null);
  useEffect(() => {
    if (!frame) return;
    setMusic(frame.phase === "finished" ? "result" : stageMusic(frame.map.id));
    if (frame?.phase === "finished") playSound("matchFinish");
  }, [frame?.phase === "finished", frame?.map.id, playerId, spectator]);
  // 毎フレーム変わる位置と再生は NetworkField が sample で読む。React は秒や操作の可否が変わったときだけ描き直す
  const [view, setView] = useState<{ readonly clock: BattleClock; readonly live: LiveSample } | null>(null);
  const sampler = useRef<(() => LiveSample) | null>(null);
  const sample = useCallback((): LiveSample => sampler.current!(), []);
  const clock = useRef({ time: 0, received: 0 });
  const socket = useRef<WebSocket | null>(null), latest = useRef<LabFrame | null>(null);
  const commandId = useRef(0), prediction = useRef<MovePredictor | null>(null);
  useEffect(() => {
    const ws = connection?.socket ?? new WebSocket(`ws://${location.hostname}:8794`);
    socket.current = ws;
    const sounds = createBattleSounds();
    const motion = new Map<string, ReturnType<typeof createRemoteMotion>>();
    // 自分の手番の移動は ack を待たずに予測で動かす（設計書 22.5）
    const predictor = createMovePredictor(); prediction.current = predictor;
    let ownId = connection?.playerId ?? "", active = true, versionMismatch = false, animation = 0, shownKey = "";
    const reduced = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
    sampler.current = () => {
      const at = performance.now(), own = predictor.pose();
      const positions = [...motion.entries()].flatMap(([id, buffer]) => { const p = id === ownId && own ? own : buffer.at(at); return p ? [{ playerId: id, x: p.x, y: p.y }] : []; });
      return sampleLive(latest.current!, clock.current.time + at - clock.current.received, positions, reduced?.matches ?? false, own);
    };
    // 開発用の SVG 画面（worldArt なし）は、位置を React で描くので毎フレーム描き直す
    const refresh = (): void => {
      if (!latest.current) return;
      const live = sampler.current!(), next = battleClock(latest.current, live, ownId);
      const key = worldArt ? clockKey(next) : String(live.serverNow);
      if (key !== shownKey) { shownKey = key; setView({ clock: next, live }); }
    };
    if (connection) { setPlayerId(ownId); setStatus(LAB_CONNECTED_STATUS); }
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
        ownId = message.playerId; setPlayerId(ownId); setStatus(LAB_CONNECTED_STATUS);
        sessionStorage.setItem("keropod.network-lab-token", message.token);
      } else if (message.type === "lab.error") setStatus(message.reason);
      else if (message.type === "lab.ack") {
        predictor.ack(message.reason, message.snapshot);
        setStatus(message.reason);
      } else {
        if (!compatibleMatch(message.build, message.map)) { versionMismatch = true; setStatus("ゲームの更新が必要です。再読み込みしてください。"); ws.close(); return; }
        if (latest.current && message.matchId === latest.current.matchId && message.eventSeq < latest.current.eventSeq) return;
        if (message.matchId !== latest.current?.matchId) { motion.clear(); setReportStatus(""); }
        clock.current = { time: message.serverTime, received: performance.now() };
        latest.current = message; setFrame(message);
        predictor.frame(message, ownId, performance.now());
        for (const p of message.players) {
          const buffer = motion.get(p.playerId) ?? createRemoteMotion();
          buffer.push(p, performance.now(), message.eventSeq, p.playerId === ownId || message.phase !== "acting" || p.eliminated || (p.playerId === message.actorId && message.movement.stoppedByFall));
          motion.set(p.playerId, buffer);
        }
        refresh();
      }
    };
    const closed = () => { if (active && !versionMismatch) { setStatus("切断：再読み込みで復帰"); setReportStatus(previous => previous === "送信中…" ? "通報を送信できませんでした。" : previous); } };
    const failed = () => { if (active) setStatus("接続に失敗しました"); };
    const message = (event: MessageEvent) => { try { receive(JSON.parse(String(event.data))); } catch { return; } };
    ws.addEventListener("message", message); ws.addEventListener("close", closed); ws.addEventListener("error", failed);
    if (connection) receive(connection.frame);
    const draw = (): void => {
      if (latest.current) {
        const events = sounds(latest.current, clock.current.time + performance.now() - clock.current.received);
        if (!document.hidden) events.forEach(playSound);
      }
      refresh();
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => { active = false; cancelAnimationFrame(animation); ws.removeEventListener("message", message); ws.removeEventListener("close", closed); ws.removeEventListener("error", failed); if (!connection) ws.close(); socket.current = null; };
  }, [connection, worldArt]);
  // 送る前に予測を進める。予測が送らない歩（壁、歩数切れ、送信の頻度の上限）はサーバーへも送らない
  const move = (direction: -1 | 1): void => {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const command = prediction.current?.move(direction, performance.now());
    if (command) ws.send(JSON.stringify({ version: 2, type: "move.command", ...command, commandId: `${playerId}-${++commandId.current}-${Date.now()}`, direction, steps: 1 }));
  };
  const fire = (shotPower = power): void => {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const shot = prediction.current?.fire();
    if (shot) ws.send(JSON.stringify({ version: 2, type: "turn.fire", ...shot, commandId: `fire-${playerId}-${++commandId.current}-${Date.now()}`, slot, elevation, power: shotPower }));
  };
  const action = (type: "lab.rematch" | "lab.surrender"): void => {
    if (frame && socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type, matchId: frame.matchId }));
  };
  const serverNow = view?.clock.serverNow ?? 0, revealed = view?.clock.revealed ?? false, terrain = view?.clock.terrain ?? 0;
  const presentation = view?.live.presentation ?? null, shownPlayers = view?.live.players ?? [];
  const loadout = frame?.players.find(p => p.playerId === playerId)?.loadout ?? DEFAULT_LOADOUT;
  const seconds = view?.clock.seconds ?? null;
  const phaseLabel = frame?.phase === "replaying" ? "射撃を再生中" : frame?.phase === "finished" ? "対戦終了" : "操作中";
  const observing = spectator || Boolean(frame?.players.find(p => p.playerId === playerId)?.eliminated);
  const opening = view?.clock.opening ?? false;
  const canControl = !opening && revealed && frame?.phase === "acting" && frame.actorId === playerId && socket.current?.readyState === WebSocket.OPEN;
  const canAct = canControl && !settling;
  const input = useBattleInput(Boolean(worldArt && canControl && !menu && !confirmLeave), move, delta => setElevation(v => Math.max(10, Math.min(90, v + delta))), fire, setSlot, settling);
  useBrowserBackAction(Boolean(worldArt && onExit), () => { input.cancel(); setMenu(false); setConfirmLeave(true); });
  const hudPlayers = frame?.players.map(p => ({ id: p.playerId, name: p.nickname ?? p.playerId, hp: p.hp, colors: p.colors, team: Number(p.teamId.slice(1)) })) ?? [];
  const own = view?.clock.own ?? null;
  const ownFacing = useRef<-1 | 1>(1), moving = view?.clock.move ?? null;
  if (moving) ownFacing.current = moving.facing; else if (frame?.actorId === playerId) ownFacing.current = frame.movement.facing;
  // 地形は削られたときだけ作り直す。自機が動くたびには作らない
  const shownTerrain = useMemo(() => frame ? applyOps(buildInitialTerrain(frame.map), frame.terrainOps.slice(0, terrain)) : null, [frame?.matchId, terrain]);
  const ground = own && shownTerrain ? tiltOf(shownTerrain, own) : 0;
  if (worldArt) return <main className="network-lab network-world" onPointerDown={() => unlockAudio()} onKeyDown={() => unlockAudio()}>
    <YourTurn turnKey={`${frame?.matchId}/${frame?.turnId}`} active={Boolean(!observing && canControl)} />
    <BattleOverlay clock={<CountdownDial seconds={seconds} />} onMenu={() => { input.cancel(); setMenu(true); }} />
    <span className="battle-sr" data-testid="identity">{playerId}</span><span className="battle-sr" data-testid="phase">{t(phaseLabel)}</span>
    {frame && view ? <NetworkField key={frame.matchId} sample={sample} charge={input.gauge.charging ? input.gauge.value / 100 : 0} onSettling={setSettling} blocked={menu || confirmLeave || input.gauge.charging || !revealed} frame={frame} elevation={elevation} ownId={playerId} followTurns={!observing || !keepView} {...(!observing ? { selectedWeapon: loadout[slot] } : {})} /> : <SceneLoading steps={labLoadingSteps(status, t)} />}
    {observing && frame?.delay && <TurnOrderList info={{ onOpen: input.cancel, serverNow, state: frame.delay, playerId, acting: false, players: frame.players.map(p => ({ id: p.playerId, name: p.nickname ?? p.playerId, colors: p.colors, eliminated: p.eliminated })) }} />}
    {observing ? <footer className="battle-console"><span role="status">{t("観戦中")}</span><label><input type="checkbox" checked={keepView} onChange={e => setKeepView(e.target.checked)} />{t("手動視点を維持")}</label>{frame && <WindGauge wind={frame.wind} />}</footer> : <BattleConsole delay={frame?.delay ? { onOpen: input.cancel, serverNow, state: frame.delay, playerId, acting: frame.actorId === playerId && frame.phase === "acting", players: frame.players.map(p => ({ id: p.playerId, name: p.nickname ?? p.playerId, colors: p.colors, eliminated: p.eliminated })) } : undefined} player={hudPlayers.find(p => p.id === playerId)} steps={moving ? moving.stepsLeft : frame?.actorId === playerId ? frame.movement.stepsLeft : 0} tilt={ground} elevation={elevation} facing={ownFacing.current} power={input.gauge.value} loadout={loadout} slot={slot} wind={frame ? frame.wind : null} disabled={!canAct || menu || confirmLeave || input.gauge.charging} selectSlot={setSlot}>
      {touch && <BattleTouchControls disabled={!canAct || confirmLeave || menu} button={input.button} steps />}
    </BattleConsole>}
    {latency !== null && latency > 300 && <span className="network-latency" role="status">{t("通信遅延")} {latency} ms</span>}
    {confirmLeave && onExit && <LeaveBattleDialog online playing={!observing && frame?.phase !== "finished"} close={() => setConfirmLeave(false)} leave={onExit} />}
    {menu && <BattleMenu seconds={seconds} activeTurn={frame?.phase === "acting" && frame.actorId === playerId && !observing} latency={latency} {...(connection && frame ? { report: { players: frame.players.filter(p => p.playerId !== playerId).map(p => ({ id: p.playerId, name: p.nickname ?? p.playerId })), status: reportStatus, send: (targetId: string, reason: "name" | "abuse" | "cheating") => {
      if (socket.current?.readyState !== WebSocket.OPEN) { setReportStatus("通報を送信できませんでした。"); return; }
      setReportStatus("送信中…"); socket.current.send(JSON.stringify({ type: "room.report", matchId: frame.matchId, targetId, reason }));
    } } } : {})} {...(frame ? { diagnostics: matchDiagnostics(frame) } : {})} spectator={observing} close={() => setMenu(false)} surrender={() => { action("lab.surrender"); setMenu(false); }} exit={onExit} finished={!frame || frame.phase === "finished"} />}
    {frame?.phase === "finished" && <section className="network-finished terminal-screen result-terminal"><header className="result-header"><h2>{t(resultTitle(frame.result, spectator ? undefined : frame.players.find(p => p.playerId === playerId)?.teamId))}</h2>{frame.returnStatus && <p className="result-return-timer" role="timer">{t("部屋へ戻るまで {seconds}秒", { seconds: view?.clock.returnSeconds ?? 0 })}</p>}</header><ResultPlayers players={frame.players} result={frame.result} {...(frame.stats ? { stats: frame.stats } : {})} /><div className="result-actions"><button onClick={onExit}>{t("退出する")}</button>{!spectator && connection && <button className="result-primary" disabled={Boolean(connection && frame.returnStatus?.readyIds.includes(playerId))} onClick={() => action("lab.rematch")}>{frame.returnStatus?.readyIds.includes(playerId) ? t("帰還待ち") : t("部屋に戻る")}</button>}</div></section>}
    {status === "invalid-session" && <div className="network-finished"><p>{t("接続の有効期限が切れました。")}</p><button onClick={() => { sessionStorage.removeItem("keropod.network-lab-token"); location.reload(); }}>{t("新しい接続で参加")}</button></div>}
    {!connection && status.startsWith("切断") && <p className="network-connection" role="status">{t("切断されました。再読み込みで復帰できます。")}</p>}
  </main>;
  return <main className="network-lab">
    <h1>TANK SHOOT 対戦同期テスト</h1>
    <p>あなた：<strong data-testid="identity">{playerId || "未割当"}</strong>　手番：<strong>{frame?.actorId ?? "—"}</strong>　{t(status)}</p>
    <p>固定8席の開発用画面です。別タブを開くと別の席で参加します。射撃終了または20秒の期限で手番が交代します。</p>
    <svg viewBox={`0 0 ${frame?.map.width ?? 500} ${frame?.map.height ?? 225}`} aria-label="移動同期フィールド">
      <defs><mask id="lab-terrain"><rect width={frame?.map.width ?? 500} height={frame?.map.height ?? 225} fill="white" />{presentation?.terrainOps.map((op, i) => <circle key={i} cx={op.cx} cy={op.cy} r={op.radius} fill="black" />)}</mask></defs>
      <rect width={frame?.map.width ?? 500} height={frame?.map.height ?? 225} fill="#d9e9ef" /><path d={frame ? (frame.map.solidColumns ? frame.map.solidColumns.flatMap((runs, x) => runs.map(([start, end]) => `M${x} ${start}h1v${end - start}h-1Z`)).join(" ") : `M0 ${frame.map.height} ${frame.map.surface.map((y, x) => `L${x} ${y}`).join(" ")} L${frame.map.width} ${frame.map.height}Z`) : ""} fill="#657d56" mask="url(#lab-terrain)" />
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
