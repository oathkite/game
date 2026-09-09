import { useEffect, useRef, useState } from "react";
import { labOutputSchema, type LabFrame } from "@game/protocol/v2-lab";
import { presentLabReplay } from "./labReplay";
import { createRemoteMotion } from "./remoteMotion";
import "./networkLab.css";

type Position = { readonly playerId: string; readonly x: number; readonly y: number };
export const NetworkLab = () => {
  const [status, setStatus] = useState("接続中"), [playerId, setPlayerId] = useState("");
  const [elevation, setElevation] = useState(45), [power, setPower] = useState(50);
  const [frame, setFrame] = useState<LabFrame | null>(null), [positions, setPositions] = useState<Position[]>([]);
  const [serverNow, setServerNow] = useState(0);
  const clock = useRef({ time: 0, received: 0 });
  const socket = useRef<WebSocket | null>(null), latest = useRef<LabFrame | null>(null);
  const sequence = useRef(0), commandId = useRef(0), pending = useRef(false);
  useEffect(() => {
    const ws = new WebSocket(`ws://${location.hostname}:8794`);
    socket.current = ws;
    const motion = new Map<string, ReturnType<typeof createRemoteMotion>>();
    let ownId = "", active = true, animation = 0;
    ws.onopen = () => {
      const token = sessionStorage.getItem("keropod.network-lab-token");
      ws.send(JSON.stringify({ type: "lab.join", ...(token ? { token } : {}) }));
    };
    ws.onmessage = event => {
      let raw: unknown;
      try { raw = JSON.parse(String(event.data)); } catch { return; }
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
        if (latest.current && message.matchId === latest.current.matchId && message.eventSeq < latest.current.eventSeq) return;
        if (message.matchId !== latest.current?.matchId) motion.clear();
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
    ws.onclose = () => { if (active) { setStatus("切断：再読み込みで復帰"); pending.current = false; } };
    ws.onerror = () => { if (active) setStatus("接続に失敗しました"); };
    const draw = (): void => {
      setServerNow(clock.current.time + performance.now() - clock.current.received);
      setPositions([...motion.entries()].flatMap(([id, buffer]) => { const p = buffer.at(performance.now()); return p ? [{ playerId: id, ...p }] : []; }));
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => { active = false; cancelAnimationFrame(animation); ws.close(); socket.current = null; };
  }, []);
  const move = (direction: -1 | 1): void => {
    const current = latest.current, ws = socket.current;
    if (!current || current.actorId !== playerId || !ws || ws.readyState !== WebSocket.OPEN || pending.current) return;
    pending.current = true;
    ws.send(JSON.stringify({ version: 2, type: "move.command", matchId: current.matchId, turnId: current.turnId,
      commandId: `${playerId}-${++commandId.current}-${Date.now()}`, moveSeq: sequence.current + 1, direction, steps: 1 }));
  };
  const fire = (): void => {
    const current = latest.current, ws = socket.current;
    if (!current || current.phase !== "acting" || current.actorId !== playerId || !ws || ws.readyState !== WebSocket.OPEN || pending.current) return;
    pending.current = true;
    ws.send(JSON.stringify({ version: 2, type: "turn.fire", matchId: current.matchId, turnId: current.turnId,
      commandId: `fire-${playerId}-${++commandId.current}-${Date.now()}`, ackMoveSeq: sequence.current,
      slot: 0, facing: current.movement.facing, elevation, power }));
  };
  const action = (type: "lab.rematch" | "lab.surrender"): void => {
    if (frame && socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type, matchId: frame.matchId }));
  };
  const presentation = frame ? presentLabReplay(frame, serverNow) : null;
  const shownPlayers = frame?.phase === "replaying" ? presentation!.players : positions.map(p => ({ ...frame!.players.find(player => player.playerId === p.playerId)!, ...p }));
  return <main className="network-lab">
    <h1>KEROPOD 対戦同期テスト</h1>
    <p>あなた：<strong data-testid="identity">{playerId || "未割当"}</strong>　手番：<strong>{frame?.actorId ?? "—"}</strong>　{status}</p>
    <p>固定8席の開発用画面です。別タブを開くと別の席で参加します。射撃終了または20秒の期限で手番が交代します。</p>
    <svg viewBox="0 0 500 225" aria-label="移動同期フィールド">
      <defs><mask id="lab-terrain"><rect width="500" height="225" fill="white" />{presentation?.terrainOps.map((op, i) => <circle key={i} cx={op.cx} cy={op.cy} r={op.radius} fill="black" />)}</mask></defs>
      <rect width="500" height="225" fill="#d9e9ef" /><path d="M0 150H500V225H0Z" fill="#657d56" mask="url(#lab-terrain)" />
      {presentation?.bullets.map((p, i) => <circle key={i} data-testid="lab-projectile" cx={p.x} cy={p.y} r="2" fill="#cf6b35" />)}
      {shownPlayers.map(p => <g key={p.playerId} data-testid={`tank-${p.playerId}`} opacity={p.eliminated ? .25 : 1} data-x={p.x.toFixed(3)} transform={`translate(${p.x},${p.y - 5})`}>
        <rect x="-5" y="-5" width="10" height="10" rx="2" fill={p.playerId === playerId ? "#cf6b35" : "#304659"} />
        <text y="-12" textAnchor="middle" fontSize="8">{p.playerId} {Math.max(0, p.hp)}{p.playerId === frame?.actorId ? " ▼" : ""}</text>
      </g>)}
    </svg>
    <div><button disabled={frame?.phase !== "acting" || frame?.actorId !== playerId || !playerId} onClick={() => move(-1)}>左へ1歩</button><button disabled={frame?.phase !== "acting" || frame?.actorId !== playerId || !playerId} onClick={() => move(1)}>右へ1歩</button></div>
    <div className="lab-fire-controls"><label>角度 {elevation}°<input aria-label="射撃角度" type="range" min="10" max="90" value={elevation} onChange={e => setElevation(Number(e.target.value))} /></label><label>パワー {power}<input aria-label="射撃パワー" type="range" min="0" max="100" value={power} onChange={e => setPower(Number(e.target.value))} /></label>
      <button disabled={frame?.phase !== "acting" || frame?.actorId !== playerId || !playerId} onClick={fire}>発射</button>
      <button disabled={!frame || frame.phase === "finished"} onClick={() => action("lab.surrender")}>降参</button></div>
    <p data-testid="phase">{frame?.phase === "replaying" ? "射撃を再生中" : frame?.phase === "finished" ? "対戦終了" : "操作中"}</p>
    {frame?.phase === "finished" && <section><h2>{frame.result.type === "win" ? `${frame.result.teamId} の勝利` : "引き分け"}</h2><button onClick={() => action("lab.rematch")}>再戦する</button></section>}
    <p>残り {frame?.movement.stepsLeft ?? 30} 歩 ／ 確定入力 {frame?.movement.ackMoveSeq ?? 0}</p>
    {status === "invalid-session" && <button onClick={() => { sessionStorage.removeItem("keropod.network-lab-token"); location.reload(); }}>新しい接続で参加</button>}
    <p>相手は125ms補間。固定8席の開発用対戦。ロビーと最終アートは未接続です。</p>
  </main>;
};
