import { damageSummary } from "@/game/damageSummary";
import { useWindowEdgePan } from "@/prototype/useWindowEdgePan";
import { createTankView } from "@/game/tankView";
import { openingPose } from "./openingTour";
import { StartSignal } from "./StartSignal";
import { createFallMotion } from "./fallMotion";
import { useLanguage } from "@/i18n/locale";
import { teamColor } from "./teamColors";
import { loadCameraScale } from "./displayScale";
import { wheelPan } from "@/prototype/wheelPan";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { WeaponId } from "@game/protocol";
import type { LabFrame } from "@game/protocol/v2-lab";
import { applyOps, buildInitialTerrain, tiltOf } from "@game/sim";
import { createRenderer, type Renderer } from "@/game/renderer";
import type { Layout } from "@/game/scale";
import { createCameraRig } from "@/prototype/cameraRig";
import { loadCameraSettings } from "@/prototype/cameraSettings";
import { worldToScreen } from "@/prototype/camera";
import type { presentLabReplay } from "@/networkLab/labReplay";

type Props = { readonly serverNow: number; readonly onSettling?: (settling: boolean) => void; readonly followTurns?: boolean; readonly blocked?: boolean; readonly frame: LabFrame; readonly players: LabFrame["players"]; readonly presentation: ReturnType<typeof presentLabReplay>; readonly elevation: number; readonly ownId: string; readonly selectedWeapon?: WeaponId };
const baseTerrain = (frame: LabFrame) => buildInitialTerrain(frame.map);
export const NetworkField = (props: Props) => {
  const host = useRef<HTMLDivElement>(null), mini = useRef<HTMLCanvasElement>(null), latest = useRef(props); latest.current = props;
  const rig = useMemo(createCameraRig, []), drag = useRef<{ x: number; y: number; at: number } | null>(null);
  const { t } = useLanguage();
  const [signal, setSignal] = useState(false);
  const [loaded, setLoaded] = useState(false), [error, setError] = useState(false);
  const openingActive = () => Boolean(latest.current.frame.opening && latest.current.serverNow < latest.current.frame.opening.endsAt);
  const focus = (immediate = false) => { if (openingActive()) return; const p = latest.current.players.find(p => p.playerId === latest.current.frame.actorId) ?? latest.current.frame.players.find(p => p.playerId === latest.current.frame.actorId); if (p) rig.focus({ x: p.x, y: p.y - 6 }, "actor", immediate || matchMedia("(prefers-reduced-motion: reduce)").matches); };
  useEffect(() => {
    const element = host.current; if (!element) return;
    let disposed = false, renderer: Renderer | null = null, stop = () => {};
    const cell = loadCameraScale();
    const layout = (): Layout => ({ cell, mapWidth: element.clientWidth, mapHeight: element.clientHeight, panelWidth: 0, panelCell: 1 });
    const start = async () => {
      rig.configure(loadCameraSettings());
      let mask = baseTerrain(latest.current.frame), previousSize = "", terrainKey = "", turnKey = "", replayKey = -1;
      const falls = createFallMotion(); let settling = false, wasOpening = false, signalVisible = false, fallMatch = "";
      const facing = new Map<string, -1 | 1>();
      let tankIndex = 0;
      renderer = await createRenderer({ mapId: latest.current.frame.map.id, wind: () => latest.current.frame.wind, tankFactory: (colors, name) => createTankView(colors, name, teamColor(Number(latest.current.frame.players[tankIndex++]!.teamId.slice(1)))), host: element, layout: layout(), mask, background: 0x000000, backgroundAlpha:0,
        players: latest.current.frame.players.map(p => ({ nickname: p.nickname ?? p.playerId, colors: p.colors ?? { primary: p.teamId === "t0" ? "yellow" : "cyan", secondary: "blue" } })) });
      if (disposed) { renderer.destroy(); return; }
      const r = renderer; let bullet = r.projectile("yellow", "cannon");
      let previousMoveX: number | undefined;
      const damageEvents = new Set<string>();
      stop = r.onFrame(dt => {
        const { frame, players, presentation, elevation, ownId } = latest.current;
        const size = layout(), key = `${size.mapWidth}/${size.mapHeight}/${frame.map.width}/${frame.map.height}`;
        if (key !== previousSize) { previousSize = key; r.setLayout(size); rig.resize({ width: size.mapWidth, height: size.mapHeight, scale: size.cell }, { left: 0, top: -100, right: frame.map.width, bottom: frame.map.height }); }
        const nextTerrain = `${frame.matchId}/${presentation.terrainOps.length}`;
        if (nextTerrain !== terrainKey) { terrainKey = nextTerrain; mask = applyOps(baseTerrain(frame), presentation.terrainOps); r.setTerrain(mask, undefined, presentation.terrainOps); }
        const nextTurn = `${frame.matchId}/${frame.turnId}`;
        if (nextTurn !== turnKey && latest.current.serverNow >= (frame.delay?.revealUntil ?? 0) - 600) { if (latest.current.followTurns !== false) focus(turnKey === ""); turnKey = nextTurn; }
        const own = players.find(p => p.playerId === ownId);
        if (!openingActive() && latest.current.serverNow >= (frame.delay?.revealUntil ?? 0) && frame.phase === "acting" && frame.actorId === ownId && own && previousMoveX !== undefined && own.x !== previousMoveX) rig.moveActor({ x: own.x, y: own.y - 6 }, matchMedia("(prefers-reduced-motion: reduce)").matches);
        previousMoveX = own?.x;
        facing.set(frame.actorId, frame.movement.facing);
        const shot = frame.phase === "replaying" ? frame.replay?.shooter : null;
        if (shot) { facing.set(shot.playerId, shot.facing);  }
        if (fallMatch !== frame.matchId) { falls.reset(); fallMatch = frame.matchId; }
        const now = performance.now(), reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        let ownFalling = false;
        const shown = players.map(p => {
          const motion = falls.sample(p.playerId, p.y, now, reduced || frame.phase !== "acting");
          if (p.playerId === ownId) ownFalling = motion.falling;
          return { ...p, ...motion };
        });
        if (settling !== ownFalling) { settling = ownFalling; latest.current.onSettling?.(settling); }
        shown.forEach((p, i) => r.setTank(i, { x: p.x, y: p.y, tilt: tiltOf(mask, { x: Math.round(p.x), y: Math.round(p.y) }), facing: facing.get(p.playerId) ?? 1,
          elevation: p.playerId === shot?.playerId ? shot.elevation : p.playerId === ownId ? elevation : 45, hp: p.eliminated ? 0 : p.hp, visible: p.y < frame.map.height, falling: p.falling || presentation.fallingIds.includes(p.playerId), shotFlashes: p.playerId === shot?.playerId ? presentation.shotFlashes : [], recoil: p.playerId === shot?.playerId ? presentation.recoil : 0, aiming: frame.phase === "acting" && p.playerId === ownId && p.playerId === frame.actorId, flash: presentation.effects.some(effect => effect.hitIds.includes(p.playerId)) }));
        const actor = shown.find(p => p.playerId === frame.actorId); if (actor && frame.phase === "acting") rig.actor({ x: actor.x, y: actor.y - 6 });
        if (frame.replay && replayKey !== frame.replay.startsAt) { replayKey = frame.replay.startsAt; bullet = r.projectile("yellow", frame.replay.shooter.weapon);  const p = presentation.bullets[0]; if (p) rig.focus(p, "shot"); }
        const replay = frame.phase === "replaying" ? frame.replay : null;
        if (replay) {
          const hit = replay.impacts.some(i => i.damage.some(d => d.amount > 0));
          const flightMs = Math.max(1, replay.endsAt - replay.startsAt - 300 - (hit ? 1300 : 0));
          const elapsed = latest.current.serverNow - replay.startsAt;
          replay.impacts.forEach((impact, index) => {
            const event = `${replay.startsAt}/${index}`;
            if (elapsed < impact.tick / Math.max(1, replay.ticks) * flightMs || damageEvents.has(event)) return;
            damageEvents.add(event);
            impact.damage.forEach(d => {
              const seat = players.findIndex(p => p.playerId === d.playerId);
              if (seat >= 0 && d.amount > 0) r.showDamage(seat, String(d.amount), "green", d.amount >= 50);
            });
          });
          const event = `${replay.startsAt}/total`;
          if (elapsed >= flightMs + 300 && !damageEvents.has(event)) {
            damageEvents.add(event);
            players.forEach((p, seat) => {
              const summary = damageSummary(replay.impacts.map(i => i.damage.find(d => d.playerId === p.playerId)?.amount ?? 0));
              if (summary.hits > 1) r.showDamage(seat, String(summary.total), "green", summary.big, true);
            });
          }
        } else damageEvents.clear();
        bullet.clear();
        for (let i = 0; i < 9; i++) { const p = presentation.bullets[i]; bullet.setBullet(i, p?.x ?? null, p?.y ?? 0, p?.angle ?? 0); }
        presentation.effects.forEach((effect, index) => bullet.setBlast(String(index), effect.cx, effect.cy, effect.radius, true, false, matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : effect.frame));
        const first = presentation.bullets[0]; if (first) rig.shot(first);
        const opening = frame.opening && latest.current.serverNow < frame.opening.endsAt;
        if (opening) {
          const order = frame.opening!.playerIds.flatMap(id => players.filter(p => p.playerId === id));
          const tour = openingPose(latest.current.serverNow - frame.opening!.startsAt, order, frame.map,
            { width: size.mapWidth, height: size.mapHeight, scale: cell }, reduced);
          r.setLayout({ ...size, cell: tour.scale });
          rig.resize({ width: size.mapWidth, height: size.mapHeight, scale: tour.scale }, rig.get().bounds);
          rig.focus(tour.center, "actor", true);
          if (signalVisible !== tour.start) { signalVisible = tour.start; setSignal(tour.start); }
        } else if (wasOpening) {
          r.setLayout(size); rig.resize({ width: size.mapWidth, height: size.mapHeight, scale: cell }, rig.get().bounds);
          signalVisible = false; setSignal(false); focus();
        }
        wasOpening = Boolean(opening); element.dataset.opening = String(Boolean(opening));
        const center = rig.tick(dt, performance.now(), matchMedia("(prefers-reduced-motion: reduce)").matches);
        const offset = worldToScreen({ x: 0, y: 0 }, center, rig.get().viewport); r.setCameraOffset(Math.round(offset.x), Math.round(offset.y));
        drawOverview(mini.current, mask, players, rig.get());
        element.dataset.cameraX = center.x.toFixed(3); element.dataset.cameraY = center.y.toFixed(3); element.dataset.mode = rig.get().mode;
      });
      setLoaded(true);
    };
    void start().catch(e => { console.error(e); if (!disposed) setError(true); });
    return () => { disposed = true; stop(); renderer?.destroy();   };
  }, [rig]);
  useEffect(() => {
    let turn = "", selected = "";
    const down = (e: KeyboardEvent) => {
      const { frame, players, blocked } = latest.current;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || (blocked || Boolean(frame.opening && latest.current.serverNow < frame.opening.endsAt)) || innerHeight > innerWidth || (e.target instanceof HTMLElement && e.target.matches("input,select,textarea,[contenteditable]"))) return;
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
  useWindowEdgePan(host, rig, Boolean(props.blocked) || !loaded);
  const point = (e: PointerEvent<HTMLDivElement>) => { const box = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - box.left, y: e.clientY - box.top }; };
  return <div className="network-field">
    <StartSignal visible={signal} />
    <div ref={host} className="network-pixi" data-testid="network-world" data-loaded={loaded} data-positions={JSON.stringify(props.players)} tabIndex={0} aria-label={t("対戦フィールド。ドラッグ・ホイールで見回す、Cで手番へ")} onKeyDown={e => { if (e.key.toLowerCase() === "c") focus(); }}
      onWheel={e => { if (!openingActive() && !drag.current && !e.ctrlKey) wheelPan(rig, e.deltaX, e.deltaY, e.deltaMode); }}
      onPointerDown={e => { if (openingActive() || !e.isPrimary || e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { ...point(e), at: performance.now() }; rig.stop(); }}
      onPointerMove={e => { if (openingActive() || !e.isPrimary) return; const p = point(e), now = performance.now(); if (drag.current) { rig.pan({ x: p.x - drag.current.x, y: p.y - drag.current.y }, now - drag.current.at, now); drag.current = { ...p, at: now }; } else if (e.pointerType === "mouse") rig.edge(p, now); }}
      onPointerUp={e => { if (!drag.current) return; drag.current = null; rig.releasePan(performance.now()); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
      onPointerCancel={() => { drag.current = null; rig.stop(); }} onPointerLeave={() => { if (!drag.current) rig.stop(); }} onBlur={() => rig.stop()} />
    {!loaded && <p className="network-loading" role="status">{error ? t("素材を読み込めませんでした。再読み込みしてください。") : t("フィールドを準備しています…")}</p>}
    <button className="network-overview" disabled={openingActive()} aria-label={t("全体図からカメラを移動")} onClick={e => { const box = e.currentTarget.getBoundingClientRect(); rig.focus(e.detail === 0 ? { x: props.frame.map.width / 2, y: props.frame.map.height / 2 } : { x: (e.clientX - box.left) / box.width * props.frame.map.width, y: (e.clientY - box.top) / box.height * props.frame.map.height }, "manual", true); }}><canvas ref={mini} width="200" height="90" /></button>
  </div>;
};
const drawOverview = (canvas: HTMLCanvasElement | null, mask: ReturnType<typeof baseTerrain>, players: LabFrame["players"], camera: ReturnType<ReturnType<typeof createCameraRig>["get"]>) => {
  const ctx = canvas?.getContext("2d"); if (!canvas || !ctx) return;
  ctx.fillStyle = "#24344a"; ctx.fillRect(0, 0, 200, 90); ctx.fillStyle = "#8c995f";
  const sx = 200 / mask.width, sy = 90 / mask.height;
  for (let y = 0; y < mask.height; y += 5) for (let x = 0; x < mask.width; x += 5) if (mask.cells[y * mask.width + x]) ctx.fillRect(x * sx, y * sy, 5 * sx, 5 * sy);
  for (const p of players) if (!p.eliminated) { ctx.fillStyle = teamColor(Number(p.teamId.slice(1))); ctx.fillRect(p.x * sx - 1, p.y * sy - 3, 3, 3); }
  const w = camera.viewport.width / camera.viewport.scale, h = camera.viewport.height / camera.viewport.scale;
  ctx.strokeStyle = "#33ff66"; ctx.lineWidth = 2 * canvas.width / (canvas.clientWidth || canvas.width); ctx.strokeRect((camera.center.x - w / 2) * sx, (camera.center.y - h / 2) * sy, w * sx, h * sy);
};
