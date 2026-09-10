import { useLanguage } from "@/i18n/locale";
import { teamColor } from "./teamColors";
import { loadDisplayScale } from "./displayScale";
import { wheelPan } from "@/prototype/wheelPan";
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

type Props = { readonly followTurns?: boolean; readonly blocked?: boolean; readonly frame: LabFrame; readonly players: LabFrame["players"]; readonly presentation: ReturnType<typeof presentLabReplay>; readonly elevation: number; readonly ownId: string; readonly selectedWeapon?: WeaponId };
const baseTerrain = (frame: LabFrame) => maskFromHeights(frame.map.surface, frame.map.height);
export const NetworkField = (props: Props) => {
  const host = useRef<HTMLDivElement>(null), mini = useRef<HTMLCanvasElement>(null), latest = useRef(props); latest.current = props;
  const rig = useMemo(createCameraRig, []), drag = useRef<{ x: number; y: number; at: number } | null>(null);
  const { t } = useLanguage();
  const [loaded, setLoaded] = useState(false), [error, setError] = useState(false);
  const focus = () => { const p = latest.current.players.find(p => p.playerId === latest.current.frame.actorId) ?? latest.current.frame.players.find(p => p.playerId === latest.current.frame.actorId); if (p) rig.focus({ x: p.x, y: p.y - 6 }, "actor", matchMedia("(prefers-reduced-motion: reduce)").matches); };
  useEffect(() => {
    const element = host.current; if (!element) return;
    let disposed = false, renderer: Renderer | null = null, art: SpriteTankFactory | null = null, stop = () => {};
    const cell = loadDisplayScale();
    const layout = (): Layout => ({ cell, mapWidth: element.clientWidth, mapHeight: element.clientHeight, panelWidth: 0, panelCell: 1 });
    const start = async () => {
      rig.configure(loadCameraSettings());
      art = await loadSpriteTanks(latest.current.frame.players.map(p => Number(p.teamId.slice(1)))); const terrainArt = await loadTerrainArt();
      if (disposed) { art.destroy(); return; }
      let mask = baseTerrain(latest.current.frame), previousSize = "", terrainKey = "", turnKey = "", replayKey = -1;
      const facing = new Map<string, -1 | 1>();
      renderer = await createRenderer({ host: element, layout: layout(), mask, terrainArt, backgroundAlpha: 0, tankFactory: art.create,
        players: latest.current.frame.players.map(p => ({ nickname: p.nickname ?? p.playerId, colors: { primary: p.teamId === "t0" ? "yellow" : "cyan", secondary: "blue" } })) });
      if (disposed) { renderer.destroy(); art.destroy(); return; }
      const r = renderer; let bullet = r.projectile("yellow", "cannon");
      stop = r.onFrame(dt => {
        const { frame, players, presentation, elevation, ownId } = latest.current;
        const size = layout(), key = `${size.mapWidth}/${size.mapHeight}/${frame.map.width}/${frame.map.height}`;
        if (key !== previousSize) { previousSize = key; r.setLayout(size); rig.resize({ width: size.mapWidth, height: size.mapHeight, scale: size.cell }, { left: 0, top: -100, right: frame.map.width, bottom: frame.map.height }); }
        const nextTerrain = `${frame.matchId}/${presentation.terrainOps.length}`;
        if (nextTerrain !== terrainKey) { terrainKey = nextTerrain; mask = applyOps(baseTerrain(frame), presentation.terrainOps); r.setTerrain(mask); }
        const nextTurn = `${frame.matchId}/${frame.turnId}`;
        if (nextTurn !== turnKey) { turnKey = nextTurn; if (latest.current.followTurns !== false) focus(); }
        facing.set(frame.actorId, frame.movement.facing);
        if (frame.phase === "acting" && latest.current.selectedWeapon) art!.setWeapon(frame.players.findIndex(p => p.playerId === ownId), latest.current.selectedWeapon);
        const shot = frame.phase === "replaying" ? frame.replay?.shooter : null;
        if (shot) facing.set(shot.playerId, shot.facing);
        players.forEach((p, i) => r.setTank(i, { x: p.x, y: p.y, tilt: tiltOf(mask, { x: Math.round(p.x), y: Math.round(p.y) }), facing: facing.get(p.playerId) ?? 1,
          elevation: p.playerId === shot?.playerId ? shot.elevation : p.playerId === ownId ? elevation : 45, hp: p.eliminated ? 0 : p.hp, visible: !p.eliminated && p.y < frame.map.height, aiming: frame.phase === "acting" && p.playerId === ownId && p.playerId === frame.actorId, flash: false }));
        const actor = players.find(p => p.playerId === frame.actorId); if (actor && frame.phase === "acting") rig.actor({ x: actor.x, y: actor.y - 6 });
        if (frame.replay && replayKey !== frame.replay.startsAt) { replayKey = frame.replay.startsAt; bullet = r.projectile("yellow", frame.replay.shooter.weapon); art!.setWeapon(frame.players.findIndex(p => p.playerId === frame.replay!.shooter.playerId), frame.replay.shooter.weapon); const p = presentation.bullets[0]; if (p) rig.focus(p, "shot"); }
        for (let i = 0; i < 9; i++) { const p = presentation.bullets[i]; bullet.setBullet(i, p?.x ?? null, p?.y ?? 0, 0); }
        const first = presentation.bullets[0]; if (first) rig.shot(first);
        const center = rig.tick(dt, performance.now(), matchMedia("(prefers-reduced-motion: reduce)").matches);
        const offset = worldToScreen({ x: 0, y: 0 }, center, rig.get().viewport); r.setCameraOffset(Math.round(offset.x), Math.round(offset.y));
        drawOverview(mini.current, mask, players, rig.get());
        element.dataset.cameraX = center.x.toFixed(3); element.dataset.cameraY = center.y.toFixed(3); element.dataset.mode = rig.get().mode;
      });
      setLoaded(true);
    };
    void start().catch(e => { console.error(e); if (!disposed) setError(true); });
    return () => { disposed = true; stop(); renderer?.destroy(); art?.destroy(); };
  }, [rig]);
  useEffect(() => {
    let turn = "", selected = "";
    const down = (e: KeyboardEvent) => {
      const { frame, players, blocked } = latest.current;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || blocked || innerHeight > innerWidth || (e.target instanceof HTMLElement && e.target.matches("input,select,textarea,[contenteditable]"))) return;
      if (e.code !== "Tab" || frame.phase === "finished") return;
      e.preventDefault();
      if (drag.current) return;
      const candidates = players.filter(p => !p.eliminated && p.hp > 0 && p.y < frame.map.height);
      if (!candidates.length) return;
      const key = frame.matchId + "/" + frame.turnId;
      if (turn !== key) { turn = key; selected = frame.actorId; }
      const next = candidates[(candidates.findIndex(p => p.playerId === selected) + 1) % candidates.length]!;
      selected = next.playerId;
      rig.focus({ x: next.x, y: next.y - 6 }, "manual", matchMedia("(prefers-reduced-motion: reduce)").matches);
      if (host.current) host.current.dataset.focusPlayer = selected;
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [rig]);
  const point = (e: PointerEvent<HTMLDivElement>) => { const box = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - box.left, y: e.clientY - box.top }; };
  return <div className="network-field" style={{ backgroundImage: `url(${worldArt.background})` }}>
    <WindLeaves wind={props.frame.wind} />
    <div ref={host} className="network-pixi" data-testid="network-world" data-loaded={loaded} data-positions={JSON.stringify(props.players)} tabIndex={0} aria-label={t("対戦フィールド。ドラッグ・ホイールで見回す、Cで手番へ")} onKeyDown={e => { if (e.key.toLowerCase() === "c") focus(); }}
      onWheel={e => { if (!drag.current && !e.ctrlKey) wheelPan(rig, e.deltaX, e.deltaY, e.deltaMode); }}
      onPointerDown={e => { if (!e.isPrimary || e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { ...point(e), at: performance.now() }; rig.stop(); }}
      onPointerMove={e => { if (!e.isPrimary) return; const p = point(e), now = performance.now(); if (drag.current) { rig.pan({ x: p.x - drag.current.x, y: p.y - drag.current.y }, now - drag.current.at, now); drag.current = { ...p, at: now }; } else if (e.pointerType === "mouse") rig.edge(p, now); }}
      onPointerUp={e => { if (!drag.current) return; drag.current = null; rig.releasePan(performance.now()); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
      onPointerCancel={() => { drag.current = null; rig.stop(); }} onPointerLeave={() => { if (!drag.current) rig.stop(); }} onBlur={() => rig.stop()} />
    {!loaded && <p className="network-loading" role="status">{error ? t("素材を読み込めませんでした。再読み込みしてください。") : t("フィールドを準備しています…")}</p>}
    <button className="network-focus" onClick={focus} aria-label={t("手番へ戻る")}>◎</button>
    <button className="network-overview" aria-label={t("全体図からカメラを移動")} onClick={e => { const box = e.currentTarget.getBoundingClientRect(); rig.focus(e.detail === 0 ? { x: props.frame.map.width / 2, y: props.frame.map.height / 2 } : { x: (e.clientX - box.left) / box.width * props.frame.map.width, y: (e.clientY - box.top) / box.height * props.frame.map.height }, "manual", true); }}><canvas ref={mini} width="200" height="90" /></button>
  </div>;
};
const drawOverview = (canvas: HTMLCanvasElement | null, mask: ReturnType<typeof baseTerrain>, players: LabFrame["players"], camera: ReturnType<ReturnType<typeof createCameraRig>["get"]>) => {
  const ctx = canvas?.getContext("2d"); if (!canvas || !ctx) return;
  ctx.fillStyle = "#24344a"; ctx.fillRect(0, 0, 200, 90); ctx.fillStyle = "#8c995f";
  const sx = 200 / mask.width, sy = 90 / mask.height;
  for (let y = 0; y < mask.height; y += 5) for (let x = 0; x < mask.width; x += 5) if (mask.cells[y * mask.width + x]) ctx.fillRect(x * sx, y * sy, 5 * sx, 5 * sy);
  for (const p of players) if (!p.eliminated) { ctx.fillStyle = teamColor(Number(p.teamId.slice(1))); ctx.fillRect(p.x * sx - 1, p.y * sy - 3, 3, 3); }
  const w = camera.viewport.width / camera.viewport.scale, h = camera.viewport.height / camera.viewport.scale;
  ctx.strokeStyle = "#fff1d5"; ctx.strokeRect((camera.center.x - w / 2) * sx, (camera.center.y - h / 2) * sy, w * sx, h * sy);
};
