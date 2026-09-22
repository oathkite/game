import type { ChallengeStore } from "@/practice/store";
import { useWindowEdgePan } from "./useWindowEdgePan";
import { createTankView } from "@/game/tankView";
import { openingPose } from "@/worldUi/openingTour";
import { StartSignal } from "@/worldUi/StartSignal";
import { createFallMotion } from "@/worldUi/fallMotion";
import { useLanguage } from "@/i18n/locale";
import { teamColor } from "@/worldUi/teamColors";
import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import { isRingOut, tiltOf } from "@game/sim";
import { createRenderer, type Renderer } from "@/game/renderer";
import { playReplay } from "@/game/replay";
import type { TankPose } from "@/game/tankView";
import type { Layout } from "@/game/scale";
import type { MatchStore } from "@/match/matchStore";
import type { MatchView } from "@/match/types";
import { playSound } from "@/app/audio";
import { viewportOf, worldToScreen } from "./camera";
import type { CameraRig } from "./cameraRig";

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

type Props = { readonly onOpeningComplete: () => void; readonly worldArt?: boolean; readonly store: Pick<MatchStore, "getView" | "completeReplay">; readonly practice?: Pick<ChallengeStore, "getTargets" | "showImpact">; readonly rig: CameraRig; readonly layout: Layout; readonly handlers: HTMLAttributes<HTMLDivElement>; readonly blocked: boolean; readonly followShot: boolean; readonly onReady: (ready: boolean) => void };
export const PrototypeCanvas = ({ store, rig, layout, handlers, blocked, followShot, onReady, onOpeningComplete, worldArt, practice }: Props) => {
  const hostRef = useRef<HTMLDivElement>(null), miniRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ layout, blocked, followShot });
  latest.current = { layout, blocked, followShot };
  const { t } = useLanguage();
  const [signal, setSignal] = useState(false);
  const [error, setError] = useState(false), [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false, renderer: Renderer | null = null;
    let stopFrames = () => {}, stopReplay = () => {};
    let replayId: number | null = null, lastTurn = -1, lastMask: MatchView["mask"] = null;
    let activeReplay = false, previousLayout = latest.current.layout;
    const falls = createFallMotion();
    let available = true;
    const elevations: [number, number] = [45, 45];
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const start = async (): Promise<void> => {
      const view = store.getView();
      if (!view.mask || !view.players) return;
      let tankIndex = 0;
      renderer = await createRenderer({ mapId: view.mapId, wind: () => store.getView().wind.value, tankFactory: (colors, name) => createTankView(colors, name, practice ? undefined : teamColor(tankIndex++), !practice), host, layout: latest.current.layout, mask: view.mask, players: view.players, background: 0x000000, backgroundAlpha:0, terrainTint: 0xffffff });
      if (disposed) { renderer.destroy(); return; }
      const r = renderer;
      rig.resize(viewportOf(latest.current.layout), { left: 0, top: -100, right: view.mask.width, bottom: view.mask.height });
      rig.focus(actorPoint(view), "actor", true);
      const openingAt = performance.now();
      let opening = Boolean(worldArt && view.phase === "loading"), signalVisible = false;
      const order = [view.players[view.currentSeat], view.players[view.currentSeat === 0 ? 1 : 0]];
      setLoaded(true); onReady(!opening);
      let previousMoveX: number | undefined;
      stopFrames = r.onFrame((dt) => {
        const v = store.getView();
        const current = latest.current;
        if (practice) r.setTargets(practice.getTargets());
        const moveX = v.control?.x;
        if (!opening && Date.now() >= (v.delay?.revealUntil ?? 0) && v.phase === "acting" && moveX !== undefined && previousMoveX !== undefined && moveX !== previousMoveX) rig.moveActor(actorPoint(v), reduced.matches);
        previousMoveX = moveX;
        if (current.blocked) rig.stop();
        if (previousLayout !== current.layout) { previousLayout = current.layout; r.setLayout(current.layout); rig.resize(viewportOf(current.layout), rig.get().bounds); }
        if (v.turnNumber !== lastTurn && Date.now() >= (v.delay?.revealUntil ?? 0) - 600) { lastTurn = v.turnNumber; rig.focus(actorPoint(v), "actor", reduced.matches); }
        if (v.replay && replayId !== v.replay.id) {
          stopReplay(); replayId = v.replay.id; activeReplay = true; falls.reset();
          const job = v.replay;
          elevations[job.shot.input.seat] = job.shot.input.elevation;
          if (current.followShot) rig.focus(job.shot.input, "shot", reduced.matches);
          const replayRenderer: Renderer = { ...r, projectile: (color, weapon) => {
            const projectile = r.projectile(color, weapon);
            return { ...projectile, setBullet: (index, x, y, angle) => { projectile.setBullet(index, x, y, angle); if (index === 0 && x !== null) rig.shot({ x, y }); } };
          } };
          stopReplay = playReplay(replayRenderer, job, elevations, v.mySeat, { sound: playSound, reduceMotion: reduced.matches, roundEnd: Boolean(v.delay), onImpact: (mask, impact) => practice?.showImpact(mask, impact), done: () => { activeReplay = false; store.completeReplay(job.id); } });
        }
        if (!v.replay && activeReplay) { stopReplay(); activeReplay = false; }
        if (!activeReplay) {
          if (v.mask && lastMask !== v.mask) { r.setTerrain(v.mask); lastMask = v.mask; }
          let falling = false;
          const poses = posesOf(v, elevations).map((pose, seat) => {
            const motion = falls.sample(String(seat), pose.y, performance.now(), reduced.matches);
            falling ||= motion.falling;
            r.setTank(seat, { ...pose, ...motion, visible: motion.falling || pose.visible });
            return { ...pose, ...motion };
          });
          host.dataset.falling = String(falling);
          if (!opening && available === falling) { available = !falling; onReady(available); }
          const shown = poses[v.currentSeat];
          if (shown) rig.actor({ x: shown.x, y: shown.y - 6 });
        }
        if (opening) {
          const tour = openingPose(performance.now() - openingAt, order, view.mask!, viewportOf(current.layout), reduced.matches);
          r.setLayout({ ...current.layout, cell: tour.scale });
          rig.resize({ ...viewportOf(current.layout), scale: tour.scale }, rig.get().bounds);
          rig.focus(tour.center, "actor", true);
          if (signalVisible !== tour.start) { signalVisible = tour.start; setSignal(tour.start); }
          if (tour.done) { opening = false; available = true; onOpeningComplete(); onReady(true); }
        }
        host.dataset.opening = String(opening);
        const center = rig.tick(dt, performance.now(), reduced.matches), vp = rig.get().viewport;
        const offset = worldToScreen({ x: 0, y: 0 }, center, vp), dpr = window.devicePixelRatio || 1;
        r.setCameraOffset(Math.round(offset.x * dpr) / dpr, Math.round(offset.y * dpr) / dpr);
        host.dataset.cameraX = center.x.toFixed(3); host.dataset.cameraY = center.y.toFixed(3); host.dataset.mode = rig.get().mode;
        drawMinimap(miniRef.current, v, rig, practice);
      });
    };
    void start().catch((e: unknown) => { console.error(e); if (!disposed) setError(true); });
    return () => { disposed = true; onReady(false); stopFrames(); stopReplay(); renderer?.destroy(); };
  }, [store, rig, onReady, onOpeningComplete, worldArt, practice]);
  useWindowEdgePan(hostRef, rig, blocked || !loaded);
  return <div className="kp-world" style={{ height: layout.mapHeight }}>
    <StartSignal visible={signal} />
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

const drawMinimap = (canvas: HTMLCanvasElement | null, v: MatchView, rig: CameraRig, practice?: Pick<ChallengeStore, "getTargets">): void => {
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
  ctx.fillStyle = "#ffcc66";
  practice?.getTargets().filter(t => !t.destroyed).forEach(t => ctx.fillRect(t.x * sx - 2, (t.y - 8) * sy - 2, 4, 4));
  const { center, viewport } = rig.get(), w = viewport.width / viewport.scale, h = viewport.height / viewport.scale;
  ctx.strokeStyle = "#33ff66"; ctx.lineWidth = 2 * canvas.width / (canvas.clientWidth || canvas.width);
  ctx.strokeRect((center.x - w / 2) * sx, (center.y - h / 2) * sy, w * sx, h * sy);
};
