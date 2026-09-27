import { replayTailMs } from "@game/engine/replay-timing";
import { weaponSound } from "@/app/weaponSounds";
import type { WeaponId } from "@game/protocol";
import type { LabFrame } from "@game/protocol/v2-lab";
import type { SoundName } from "@/app/audio";
import { CARVE_AT_MS, HP_DRAIN_MS } from "@/game/hitFeedback";
import { WRECK_BLINK_MS } from "@/game/tankMotion";
export type SoundFrame = Pick<LabFrame, "matchId" | "turnId" | "phase"> & {
  readonly replay: null | Pick<NonNullable<LabFrame["replay"]>, "startsAt" | "endsAt" | "ticks"> & {
    readonly shooter?: { readonly weapon: WeaponId };
    readonly paths: readonly { readonly launchTick: number; readonly endTick?: number }[];
    readonly impacts: readonly { readonly tick: number; readonly damage: readonly { readonly amount: number; readonly playerId?: string }[] }[];
    readonly playersBefore?: readonly { readonly playerId: string; readonly hp: number; readonly eliminated: boolean }[];
  };
};

type SoundReplay = NonNullable<SoundFrame["replay"]>;

/** 演出に合わせた音の時刻（設計書 41.14）。最初の着弾で土の雨と焼ける音、最後の着弾の削る瞬間に止めの一撃、撃破の爆発に撃破の音 */
const sceneSounds = (replay: SoundReplay, crossed: (tick: number, offsetMs?: number) => boolean): SoundName[] => {
  const sounds: SoundName[] = [];
  if (replay.impacts.length === 0) return sounds;
  const first = Math.min(...replay.impacts.map(i => i.tick)), last = Math.max(...replay.impacts.map(i => i.tick));
  if (crossed(first)) sounds.push("debris", "sizzle");
  if (replay.paths.every(p => (p.endTick ?? 0) <= last) && crossed(last, CARVE_AT_MS)) sounds.push("impactStop");
  const hp = new Map((replay.playersBefore ?? []).map(p => [p.playerId, p.eliminated ? 0 : p.hp]));
  for (const impact of replay.impacts) for (const d of impact.damage) {
    if (!d.playerId) continue;
    const before = hp.get(d.playerId) ?? 0;
    hp.set(d.playerId, before - d.amount);
    if (before > 0 && before - d.amount <= 0 && crossed(impact.tick, CARVE_AT_MS + HP_DRAIN_MS + WRECK_BLINK_MS)) sounds.push("destroy");
  }
  return sounds;
};
/** Consume the presentation timeline even while muted; old events must never queue. */
export const createBattleSounds = () => {
  let previous: { frame: SoundFrame; now: number } | null = null;
  return (frame: SoundFrame, now: number): SoundName[] => {
    const before = previous;
    if (before?.frame.matchId === frame.matchId && now < before.now) return [];
    previous = { frame, now };
    if (!before || before.frame.matchId !== frame.matchId || now - before.now > 500 || now < before.now) return [];
    const sounds = new Set<SoundName>();
    if (frame.phase === "finished" && before.frame.phase !== "finished") sounds.add("finish");
    if (frame.phase === "acting" && frame.turnId !== before.frame.turnId) sounds.add("tick");
    const replay = frame.replay;
    if (frame.phase === "replaying" && replay) {
      const start = replay.startsAt;
      const duration = Math.max(1, replay.endsAt - replayTailMs(replay.impacts) - start);
      const fresh = before.frame.phase !== "replaying" || before.frame.turnId !== frame.turnId || before.frame.replay?.startsAt !== start;
      const from = fresh && now - start <= 500 ? Math.min(before.now, start - 0.001) : before.now;
      const crossed = (tick: number, offsetMs = 0) => {
        const at = start + tick / Math.max(1, replay.ticks) * duration + offsetMs;
        return at > from && at <= now;
      };
      if (replay.paths.some(path => crossed(path.launchTick))) sounds.add(weaponSound(replay.shooter?.weapon ?? "cannon", "fire"));
      if (replay.impacts.some(impact => crossed(impact.tick))) sounds.add(weaponSound(replay.shooter?.weapon ?? "cannon", "impact"));
      if (replay.impacts.some(impact => crossed(impact.tick) && impact.damage.some(damage => damage.amount > 0))) sounds.add("hit");
      for (const name of sceneSounds(replay, crossed)) sounds.add(name);
    }
    return [...sounds];
  };
};
