import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { WeaponId } from "@game/protocol";
import type { LabFrame } from "@game/protocol/v2-lab";
import { applyOps, maskFromHeights, tiltOf } from "@game/sim";
import { createRenderer, type Renderer } from "@/game/renderer";
import type { Layout } from "@/game/scale";
import { createCameraRig } from "@/prototype/cameraRig";
import { loadCameraSettings } from "@/prototype/cameraSettings";
import { worldToScreen } from "@/prototype/camera";
import { loadSpriteTanks, type SpriteTankFactory } from "@/prototype/spriteTank";
import type { presentLabReplay } from "@/networkLab/labReplay";
import { loadTerrainArt, worldArt } from "./assets";
import { WindLeaves } from "./WindLeaves";

type Props = { readonly frame: LabFrame; readonly players: LabFrame["players"]; readonly presentation: ReturnType<typeof presentLabReplay>; readonly elevation: number; readonly ownId: string; readonly selectedWeapon?: WeaponId };
const baseTerrain = () => maskFromHeights(Array.from({ length: 500 }, () => 150), 225);
export const NetworkField = (props: Props) => {
  const host = useRef<HTMLDivElement>(null), mini = useRef<HTMLCanvasElement>(null), latest = useRef(props); latest.current = props;
  const rig = useMemo(createCameraRig, []), drag = useRef<{ x: number; y: number; at: number } | null>(null);
  const [loaded, setLoaded] = useState(false), [error, setError] = useState(false);
  const focus = () => { const p = latest.current.players.find(p => p.playerId === latest.current.frame.actorId) ?? latest.current.frame.players.find(p => p.playerId === latest.current.frame.actorId); if (p) rig.focus({ x: p.x, y: p.y - 6 }, "actor", matchMedia("(prefers-reduced-motion: reduce)").matches); };
  useEffect(() => {
    const element = host.current; if (!element) return;
    let disposed = false, renderer: Renderer | null = null, art: SpriteTankFactory | null = null, stop = () => {};
    const layout = (): Layout => ({ cell: 9, mapWidth: element.clientWidth, mapHeight: element.clientHeight, panelWidth: 0, panelCell: 1 });
    const start = async () => {
      rig.configure(loadCameraSettings());
      art = await loadSpriteTanks(); const terrainArt = await loadTerrainArt();
      if (disposed) { art.destroy(); return; }
      let mask = baseTerrain(), previousSize = "", terrainKey = "", turnKey = "", replayKey = -1;
      const facing = new Map<string, -1 | 1>();
      renderer = await createRenderer({ host: element, layout: layout(), mask, terrainArt, backgroundAlpha: 0, tankFactory: art.create,
        players: latest.current.frame.players.map(p => ({ nickname: `${String.fromCharCode(65 + Number(p.teamId.slice(1)))} ${p.nickname ?? p.playerId}${p.playerId === latest.current.ownId ? " / YOU" : ""}`, colors: { primary: p.teamId === "t0" ? "yellow" : "cyan", secondary: "blue" } })) });
      if (disposed) { renderer.destroy(); art.destroy(); return; }
      const r = renderer; let bullet = r.projectile("yellow", "cannon");
      stop = r.onFrame(dt => {
        const { frame, players, presentation, elevation, ownId } = latest.current;
        const size = layout(), key = `${size.mapWidth}/${size.mapHeight}`;
        if (key !== previousSize) { previousSize = key; r.setLayout(size); rig.resize({ width: size.mapWidth, height: size.mapHeight, scale: size.cell }, { left: 0, top: -100, right: 500, bottom: 225 }); }
        const nextTerrain = `${frame.matchId}/${presentation.terrainOps.length}`;
        if (nextTerrain !== terrainKey) { terrainKey = nextTerrain; mask = applyOps(baseTerrain(), presentation.terrainOps); r.setTerrain(mask); }
        const nextTurn = `${frame.matchId}/${frame.turnId}`;
        if (nextTurn !== turnKey) { turnKey = nextTurn; focus(); }
        facing.set(frame.actorId, frame.movement.facing);
        if (frame.phase === "acting" && latest.current.selectedWeapon) art!.setWeapon(frame.players.findIndex(p => p.playerId === ownId), latest.current.selectedWeapon);
        const shot = frame.phase === "replaying" ? frame.replay?.shooter : null;
        if (shot) facing.set(shot.playerId, shot.facing);
        players.forEach((p, i) => r.setTank(i, { x: p.x, y: p.y, tilt: tiltOf(mask, { x: Math.round(p.x), y: Math.round(p.y) }), facing: facing.get(p.playerId) ?? 1,
          elevation: p.playerId === shot?.playerId ? shot.elevation : p.playerId === ownId ? elevation : 45, hp: p.eliminated ? 0 : p.hp, visible: !p.eliminated && p.y < 225, aiming: frame.phase === "acting" && p.playerId === ownId && p.playerId === frame.actorId, flash: false }));
        const actor = players.find(p => p.playerId === frame.actorId); if (actor && frame.phase === "acting") rig.actor({ x: actor.x, y: actor.y - 6 });
        if (frame.replay && replayKey !== frame.replay.startsAt) { replayKey = frame.replay.startsAt; bullet = r.projectile("yellow", frame.replay.shooter.weapon); art!.setWeapon(frame.players.findIndex(p => p.playerId === frame.replay!.shooter.playerId), frame.replay.shooter.weapon); const p = presentation.bullets[0]; if (p) rig.focus(p, "shot"); }
        for (let i = 0; i < 9; i++) { const p = presentation.bullets[i]; bullet.setBullet(i, p?.x ?? null, p?.y ?? 0, 0); }
        const first = presentation.bullets[0]; if (first) rig.shot(first);
        const center = rig.tick(dt, performance.now(), matchMedia("(prefers-reduced-motion: reduce)").matches);
        const offset = worldToScreen({ x: 0, y: 0 }, center, rig.get().viewport); r.setCameraOffset(Math.round(offset.x), Math.round(offset.y));
        drawOverview(mini.current, mask, players, rig.get());
        element.dataset.cameraX = center.x.toFixed(3); element.dataset.mode = rig.get().mode;
      });
      setLoaded(true);
    };
    void start().catch(e => { console.error(e); if (!disposed) setError(true); });
    return () => { disposed = true; stop(); renderer?.destroy(); art?.destroy(); };
  }, [rig]);
  const point = (e: PointerEvent<HTMLDivElement>) => { const box = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - box.left, y: e.clientY - box.top }; };
  return <div className="network-field" style={{ backgroundImage: `url(${worldArt.background})` }}>
    <WindLeaves wind={0} />
    <div ref={host} className="network-pixi" data-testid="network-world" data-loaded={loaded} data-positions={JSON.stringify(props.players)} tabIndex={0} aria-label="対戦フィールド。ドラッグで見回す、Cで手番へ" onKeyDown={e => { if (e.key.toLowerCase() === "c") focus(); }}
      onPointerDown={e => { if (!e.isPrimary || e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { ...point(e), at: performance.now() }; rig.stop(); }}
      onPointerMove={e => { if (!e.isPrimary) return; const p = point(e), now = performance.now(); if (drag.current) { rig.pan({ x: p.x - drag.current.x, y: p.y - drag.current.y }, now - drag.current.at, now); drag.current = { ...p, at: now }; } else if (e.pointerType === "mouse") rig.edge(p, now); }}
      onPointerUp={e => { if (!drag.current) return; drag.current = null; rig.releasePan(performance.now()); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
      onPointerCancel={() => { drag.current = null; rig.stop(); }} onPointerLeave={() => { if (!drag.current) rig.stop(); }} onBlur={() => rig.stop()} />
    {!loaded && <p className="network-loading" role="status">{error ? "素材を読み込めませんでした。再読み込みしてください。" : "フィールドを準備しています…"}</p>}
    <button className="network-focus" onClick={focus}>手番へ戻る</button>
    <button className="network-overview" aria-label="全体図からカメラを移動" onClick={e => { const box = e.currentTarget.getBoundingClientRect(); rig.focus(e.detail === 0 ? { x: 250, y: 130 } : { x: (e.clientX - box.left) / box.width * 500, y: (e.clientY - box.top) / box.height * 225 }, "manual", true); }}><canvas ref={mini} width="200" height="90" /></button>
  </div>;
};
const drawOverview = (canvas: HTMLCanvasElement | null, mask: ReturnType<typeof baseTerrain>, players: LabFrame["players"], camera: ReturnType<ReturnType<typeof createCameraRig>["get"]>) => {
  const ctx = canvas?.getContext("2d"); if (!canvas || !ctx) return;
  ctx.fillStyle = "#24344a"; ctx.fillRect(0, 0, 200, 90); ctx.fillStyle = "#8c995f";
  for (let y = 0; y < 225; y += 5) for (let x = 0; x < 500; x += 5) if (mask.cells[y * 500 + x]) ctx.fillRect(x * .4, y * .4, 2, 2);
  for (const p of players) if (!p.eliminated) { ctx.fillStyle = p.teamId === "t0" ? "#ffbd46" : "#77dbe0"; ctx.fillRect(p.x * .4 - 1, p.y * .4 - 3, 3, 3); }
  const w = camera.viewport.width / camera.viewport.scale, h = camera.viewport.height / camera.viewport.scale;
  ctx.strokeStyle = "#fff1d5"; ctx.strokeRect((camera.center.x - w / 2) * .4, (camera.center.y - h / 2) * .4, w * .4, h * .4);
};
