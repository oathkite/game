import { loadImpactArt } from "@/worldUi/impactSprites";
import { loadProjectileArt } from "@/worldUi/projectileArt";
import { useLanguage } from "@/i18n/locale";
import { teamColor } from "@/worldUi/teamColors";
import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import { isRingOut, tiltOf } from "@game/sim";
import { weaponOf } from "@game/protocol";
import { createRenderer, type Renderer } from "@/game/renderer";
import { playReplay } from "@/game/replay";
import type { TankPose } from "@/game/tankView";
import type { Layout } from "@/game/scale";
import type { MatchStore } from "@/match/matchStore";
import type { MatchView } from "@/match/types";
import { playSound } from "@/app/audio";
import { WindLeaves } from "@/worldUi/WindLeaves";
import { loadTerrainArt, worldArt as artUrls } from "@/worldUi/assets";
import { viewportOf, worldToScreen } from "./camera";
import type { CameraRig } from "./cameraRig";
import { loadSpriteTanks, type SpriteTankFactory } from "./spriteTank";

export const actorPoint = (view: MatchView) => {
  const actor = view.control ?? view.players?.[view.currentSeat] ?? { x: 90, y: 130 };
  return { x: actor.x, y: actor.y - 6 };
};
const posesOf = (v: MatchView, elevations: readonly number[]): readonly TankPose[] => {
  if (!v.mask || !v.players) return [];
  return v.players.map((p, seat) => {
    const control = seat === v.mySeat ? v.control : null;
    const position = control ?? p;
    return { x: position.x, y: position.y, tilt: tiltOf(v.mask!, position), facing: position.facing, elevation: control?.elevation ?? elevations[seat] ?? 45,
      hp: p.hp, visible: !isRingOut(v.mask!, position), flash: false, aiming: control !== null && v.phase === "acting" };
  });
};

type Props = { readonly worldArt?: boolean; readonly store: MatchStore; readonly rig: CameraRig; readonly layout: Layout; readonly handlers: HTMLAttributes<HTMLDivElement>; readonly blocked: boolean; readonly followShot: boolean; readonly onReady: (ready: boolean) => void };
export const PrototypeCanvas = ({ store, rig, layout, handlers, blocked, followShot, onReady, worldArt }: Props) => {
  const hostRef = useRef<HTMLDivElement>(null), miniRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ layout, blocked, followShot });
  latest.current = { layout, blocked, followShot };
  const { t } = useLanguage();
  const [error, setError] = useState(false), [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false, renderer: Renderer | null = null, art: SpriteTankFactory | null = null;
    let stopFrames = () => {}, stopReplay = () => {};
    let replayId: number | null = null, lastTurn = -1, lastMask: MatchView["mask"] = null;
    let activeReplay = false, previousLayout = latest.current.layout;
    const elevations: [number, number] = [45, 45];
    let effects: Awaited<ReturnType<typeof loadImpactArt>> | null = null;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const start = async (): Promise<void> => {
      const view = store.getView();
      if (!view.mask || !view.players) return;
      art = await loadSpriteTanks();
      if (disposed) { art.destroy(); return; }
      const terrainArt = worldArt ? await loadTerrainArt() : undefined;
      if (disposed) { art.destroy(); return; }
      const projectileTextures = await loadProjectileArt();
      effects = await loadImpactArt();
      if (disposed) { effects.destroy(); return; }
      renderer = await createRenderer({ projectileTextures, impactTextures: effects.textures, host, layout: latest.current.layout, mask: view.mask, players: [{ ...view.players[0], nickname: view.players[0].nickname }, { ...view.players[1], nickname: view.players[1].nickname }], tankFactory: art.create, background: 0x20394a, terrainTint: worldArt ? 0xffffff : 0x637d71, backgroundAlpha: worldArt ? 0 : 1, ...(terrainArt ? { terrainArt } : {}) });
      if (disposed) { renderer.destroy(); art.destroy(); return; }
      const r = renderer, sprites = art;
      rig.resize(viewportOf(latest.current.layout), { left: 0, top: -100, right: view.mask.width, bottom: view.mask.height });
      rig.focus(actorPoint(view), "actor", true);
      setLoaded(true); onReady(true);
      stopFrames = r.onFrame((dt) => {
        const v = store.getView();
        const current = latest.current;
        if (current.blocked) rig.stop();
        if (previousLayout !== current.layout) { previousLayout = current.layout; r.setLayout(current.layout); rig.resize(viewportOf(current.layout), rig.get().bounds); }
        if (v.turnNumber !== lastTurn) { lastTurn = v.turnNumber; rig.focus(actorPoint(v), "actor", reduced.matches); }
        if (v.replay && replayId !== v.replay.id) {
          stopReplay(); replayId = v.replay.id; activeReplay = true;
          const job = v.replay;
          elevations[job.shot.input.seat] = job.shot.input.elevation;
          sprites.setWeapon(job.shot.input.seat, job.shot.input.weapon);
          if (current.followShot) rig.focus(job.shot.input, "shot", reduced.matches);
          const replayRenderer: Renderer = { ...r, projectile: (color, weapon) => {
            const projectile = r.projectile(color, weapon);
            return { ...projectile, setBullet: (index, x, y, angle) => { projectile.setBullet(index, x, y, angle); if (index === 0 && x !== null) rig.shot({ x, y }); } };
          } };
          stopReplay = playReplay(replayRenderer, job, elevations, v.mySeat, { sound: playSound, reduceMotion: reduced.matches, done: () => { activeReplay = false; store.completeReplay(job.id); } });
        }
        if (!v.replay && activeReplay) { stopReplay(); activeReplay = false; }
        if (!activeReplay) {
          if (v.mask && lastMask !== v.mask) { r.setTerrain(v.mask); lastMask = v.mask; }
          posesOf(v, elevations).forEach((pose, seat) => r.setTank(seat as 0 | 1, pose));
          if (v.control && v.mySeat !== null && v.players) sprites.setWeapon(v.mySeat, weaponOf(v.players[v.mySeat].loadout, v.control.slot));
          rig.actor(actorPoint(v));
        }
        const center = rig.tick(dt, performance.now(), reduced.matches), vp = rig.get().viewport;
        const offset = worldToScreen({ x: 0, y: 0 }, center, vp), dpr = window.devicePixelRatio || 1;
        r.setCameraOffset(Math.round(offset.x * dpr) / dpr, Math.round(offset.y * dpr) / dpr);
        host.dataset.cameraX = center.x.toFixed(3); host.dataset.cameraY = center.y.toFixed(3); host.dataset.mode = rig.get().mode;
        drawMinimap(miniRef.current, v, rig);
      });
    };
    void start().catch((e: unknown) => { console.error(e); if (!disposed) setError(true); });
    return () => { disposed = true; onReady(false); stopFrames(); stopReplay(); renderer?.destroy(); art?.destroy(); effects?.destroy(); };
  }, [store, rig, onReady, worldArt]);
  return <div className="kp-world" style={{ height: layout.mapHeight, ...(worldArt ? { backgroundImage: `url(${artUrls.background})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
    {worldArt && <WindLeaves wind={store.getView().wind.value} />}
    <div ref={hostRef} className="kp-canvas" tabIndex={0} aria-label={t("対戦フィールド")} data-testid="camera-world" data-scale={layout.cell} data-loaded={loaded} {...handlers} />
    {!loaded && <div className="kp-loading" role="status">{error ? t("素材を読み込めませんでした。ページを再読み込みしてください。") : t("マシンを準備しています…")}</div>}
    <span className="kp-world-help">{t("ドラッグ・ホイールで見回す / Cで手番へ")}</span>
    <button className="kp-minimap" aria-label={t("全体図からカメラを移動")} disabled={blocked} onPointerDown={(e) => {
      if (!e.isPrimary || e.button !== 0) return;
      const rect = e.currentTarget.getBoundingClientRect(), b = rig.get().bounds;
      rig.focus({ x: (e.clientX - rect.left) / rect.width * b.right, y: (e.clientY - rect.top) / rect.height * b.bottom }, "manual", true);
    }} onClick={(e) => { if (e.detail === 0) rig.focus({ x: 200, y: 112 }, "manual", true); }}>
      <canvas ref={miniRef} width={200} height={112} />
      <span>{t("フィールド全体")}</span>
    </button>
  </div>;
};

const drawMinimap = (canvas: HTMLCanvasElement | null, v: MatchView, rig: CameraRig): void => {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx || !v.mask) return;
  const sx = canvas.width / v.mask.width, sy = canvas.height / v.mask.height;
  ctx.fillStyle = "#101c2c"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#637d71";
  for (let x = 0; x < v.mask.width; x += 4) for (let y = 0; y < v.mask.height; y += 4) {
    if (v.mask.cells[y * v.mask.width + x]) ctx.fillRect(x * sx, y * sy, 4 * sx, 4 * sy);
  }
  v.players?.forEach((p, seat) => {
    const point = seat === v.mySeat && v.control ? v.control : p;
    ctx.fillStyle = teamColor(seat);
    ctx.fillRect(point.x * sx - 2, point.y * sy - 3, 4, 4);
  });
  const { center, viewport } = rig.get(), w = viewport.width / viewport.scale, h = viewport.height / viewport.scale;
  ctx.strokeStyle = "#f6f1df"; ctx.lineWidth = 1;
  ctx.strokeRect((center.x - w / 2) * sx, (center.y - h / 2) * sy, w * sx, h * sy);
};
