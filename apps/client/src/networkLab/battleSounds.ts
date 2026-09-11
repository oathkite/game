import type { LabFrame } from "@game/protocol/v2-lab";
import type { SoundName } from "@/app/audio";
export type SoundFrame = Pick<LabFrame, "matchId" | "turnId" | "phase"> & {
  readonly replay: null | Pick<NonNullable<LabFrame["replay"]>, "startsAt" | "endsAt" | "ticks"> & {
    readonly paths: readonly { readonly launchTick: number }[];
    readonly impacts: readonly { readonly tick: number; readonly damage: readonly { readonly amount: number }[] }[];
  };
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
      const duration = Math.max(1, replay.endsAt - 300 - start);
      const fresh = before.frame.phase !== "replaying" || before.frame.turnId !== frame.turnId || before.frame.replay?.startsAt !== start;
      const from = fresh && now - start <= 500 ? Math.min(before.now, start - 0.001) : before.now;
      const crossed = (tick: number) => {
        const at = start + tick / Math.max(1, replay.ticks) * duration;
        return at > from && at <= now;
      };
      if (replay.paths.some(path => crossed(path.launchTick))) sounds.add("fire");
      if (replay.impacts.some(impact => crossed(impact.tick))) sounds.add("explosion");
      if (replay.impacts.some(impact => crossed(impact.tick) && impact.damage.some(damage => damage.amount > 0))) sounds.add("hit");
    }
    return [...sounds];
  };
};
