type Point = { readonly x: number; readonly y: number };
type Sample = Point & { readonly at: number };
/** 125msの受信buffer。落下は即時反映し、更新停止時に外挿しない。 */
export const createRemoteMotion = () => {
  let samples: Sample[] = [], sequence = -1;
  return {
    push(point: Point, at: number, eventSeq: number, discontinuous: boolean): void {
      if (eventSeq <= sequence) return;
      sequence = eventSeq;
      const sample = { ...point, at };
      samples = discontinuous ? [sample] : [...samples.slice(-7), sample];
    },
    at(now: number): Point | null {
      if (!samples.length) return null;
      const time = now - 125;
      const index = samples.findIndex(s => s.at >= time);
      if (index === -1) { const last = samples[samples.length - 1]!; return { x: last.x, y: last.y }; }
      const next = samples[index]!, previous = samples[Math.max(0, index - 1)]!;
      const t = next.at === previous.at ? 1 : Math.max(0, Math.min(1, (time - previous.at) / (next.at - previous.at)));
      return { x: previous.x + (next.x - previous.x) * t, y: previous.y + (next.y - previous.y) * t };
    },
  };
};
