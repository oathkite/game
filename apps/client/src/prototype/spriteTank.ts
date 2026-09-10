import { createTankEffects } from "./tankEffects";
import { muzzlePose } from "@/game/muzzlePose";
import { createTankAnimation } from "./tankAnimation";
import { teamColor } from "@/worldUi/teamColors";
import { Assets, ColorMatrixFilter, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
import type { TankColors, WeaponId } from "@game/protocol";
import type { TankPose, TankView } from "@/game/tankView";

// 配信用コピーを原寸アンカーで配置する。元画像との一致はassets:checkで検証。
const urls = import.meta.glob<string>([
  "../../../../assets/runtime/tanks-v1/cabin-standard.png",
  "../../../../assets/runtime/tanks-v1/tracks-standard.png",
  "../../../../assets/runtime/tanks-v1/pilot-frog.png",
  "../../../../assets/runtime/tanks-v1/weapon-*.png",
  "../../../../assets/runtime/tanks-v1/effect-muzzle.png",
  "../../../../assets/runtime/tanks-v1/effect-smoke.png",
  "../../../../assets/runtime/tanks-v1/effect-dust.png",
  "../../../../assets/runtime/tanks-v1/effect-explosion.png",
  "../../../../assets/runtime/tanks-v1/effect-energy.png",
], { eager: true, query: "?url", import: "default" });

export type SpriteTankFactory = {
  readonly create: (colors: TankColors, nickname: string) => TankView;
  readonly setWeapon: (seat: number, weapon: WeaponId) => void;
  readonly destroy: () => void;
};

export const loadSpriteTanks = async (teamIndices?: readonly number[]): Promise<SpriteTankFactory> => {
  const sheets = new Map<string, Texture>();
  await Promise.all(Object.entries(urls).map(async ([path, url]) => {
    sheets.set(path.split("/").pop()!.replace(".png", ""), await Assets.load<Texture>(url));
  }));
  const frames = new Map<string, Texture>();
  const frame = (id: string, index = 0): Texture => {
    const key = `${id}/${index}`;
    const cached = frames.get(key);
    if (cached) return cached;
    const sheet = sheets.get(id)!;
    const columns = sheet.width / 192;
    const texture = new Texture({ source: sheet.source, frame: new Rectangle((index % columns) * 192, Math.floor(index / columns) * 160, 192, 160) });
    texture.source.scaleMode = "nearest";
    frames.set(key, texture);
    return texture;
  };
  const weapons: ((weapon: WeaponId) => void)[] = [];
  return {
    create: (_colors, nickname) => {
      const tank = makeTank(frame, nickname, teamColor(teamIndices?.[weapons.length] ?? weapons.length));
      weapons.push(tank.setWeapon);
      return tank;
    },
    setWeapon: (seat, weapon) => weapons[seat]?.(weapon),
    destroy: () => { for (const texture of frames.values()) texture.destroy(); },
  };
};

type Frame = (id: string, index?: number) => Texture;
const makeTank = (frame: Frame, nickname: string, color: string): TankView & { setWeapon: (weapon: WeaponId) => void } => {
  const world = new Container(), rig = new Container(), label = new Container();
  const art = (id: string, index = 0): Sprite => {
    const sprite = new Sprite(frame(id, index));
    sprite.scale.set(1 / 12);
    sprite.position.set(-8, -12);
    return sprite;
  };
  const tracks = art("tracks-standard"), pilot = art("pilot-frog");
  tracks.label = "tracks";
  const body = new Container({ label: "body" });
  body.addChild(art("cabin-standard", 0), pilot, art("cabin-standard", 1), art("cabin-standard", 2), art("cabin-standard", 3));
  rig.addChild(tracks, body);
  const gun = new Container({ label: "gun" }), weapon = new Sprite(frame("weapon-cannon"));
  weapon.scale.set(1 / 12);
  weapon.position.set(-8, -8);
  gun.position.set(0, -4);
  const aim = new Graphics();
  for (let i = 0; i < 5; i++) aim.rect(6 + i * 3, -0.12, 1.4, 0.24).fill(0xffc345);
  gun.addChild(weapon, aim);
  const flashes: Sprite[] = [];
  let weaponId: WeaponId = "cannon";
  body.addChild(gun);
  world.addChild(rig);
  const name = new Text({ text: nickname, style: { fontFamily: "sans-serif", fontSize: 13, fill: 0xf6f1df } });
  name.anchor.set(0.5, 1);
  const plate = new Graphics(), health = new Graphics();
  const labelWidth = Math.max(96, name.width + 16);
  plate.roundRect(-labelWidth / 2, -21, labelWidth, 30, 5).fill(0x101c2c);
  const team = new Graphics().roundRect(-labelWidth / 2, -21, 4, 30, 2).fill(color);
  label.addChild(plate, team, name, health);
  const animate = createTankAnimation(), effectsAt = createTankEffects();
  const effects: Sprite[] = [];
  const grayscale = new ColorMatrixFilter();
  grayscale.desaturate();
  let wasWreck = false;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  return {
    world, label,
    setWeapon: (id) => { weaponId = id; weapon.texture = frame(`weapon-${id}`); },
    setPose: (pose: TankPose, cell: number) => {
      const now = performance.now();
      const animation = animate(pose, now, reducedMotion.matches);
      effects.forEach(sprite => { sprite.visible = false; });
      effectsAt(pose, now, reducedMotion.matches).forEach((effect, i) => {
        const sprite = effects[i] ?? new Sprite();
        if (!effects[i]) { effects.push(sprite); rig.addChild(sprite); sprite.label = `tank-effect-${i}`; sprite.scale.set(1 / 12); }
        sprite.texture = frame(effect.id, effect.frame);
        sprite.position.set(effect.x, effect.y); sprite.alpha = effect.alpha; sprite.visible = true;
      });
      tracks.texture = frame("tracks-standard", animation.tracks);
      pilot.texture = frame("pilot-frog", animation.pilot);
      world.position.set(pose.x + 0.5, pose.y);
      world.visible = label.visible = pose.visible;
      rig.scale.x = pose.facing;
      rig.rotation = -pose.tilt * Math.PI / 180;
      rig.alpha = pose.flash ? 0.55 : 1;
      // Authored wreck pose: the body settles eight art pixels; tracks keep contact.
      const recoil = pose.hp <= 0 || reducedMotion.matches ? 0 : pose.recoil ?? 0;
      body.x = recoil ? -Math.round(recoil * 2 / 3) / 12 : 0;
      weapon.x = -8 - recoil / 12;
      const wreck = animation.pilot === 15;
      if (wreck !== wasWreck) { rig.filters = wreck ? [grayscale] : null; wasWreck = wreck; }
      body.y = wreck ? 8 / 12 : 0;
      gun.rotation = (wreck ? 18 : -pose.elevation) * Math.PI / 180;
      aim.visible = pose.hp > 0 && pose.aiming;
      flashes.forEach(sprite => { sprite.visible = false; });
      if (pose.hp > 0 && !reducedMotion.matches) (pose.shotFlashes ?? []).forEach((flash, i) => {
        const effect = muzzlePose(weaponId, flash, recoil);
        const sprite = flashes[i] ?? new Sprite();
        if (!flashes[i]) { flashes.push(sprite); gun.addChild(sprite); sprite.label = `muzzle-${i}`; sprite.scale.set(1 / 12); }
        sprite.texture = frame(effect.id, effect.frame);
        sprite.position.set(effect.x, effect.y); sprite.alpha = effect.alpha; sprite.visible = true;
      });
      label.position.set((pose.x + 0.5) * cell, (pose.y - 11.5) * cell);
      health.clear().rect(-38, 3, 76, 3).fill(0x435568).rect(-38, 3, 76 * Math.max(0, pose.hp) / 100, 3).fill(color);
    },
    destroy: () => { world.destroy({ children: true }); label.destroy({ children: true }); grayscale.destroy(); },
  };
};
