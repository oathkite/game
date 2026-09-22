import type { EngineState } from "@game/engine";
import { stepOutcome, surfaceY } from "@game/sim";
import { cpuDecisionSchema, type CpuDecision, type CpuSituation } from "@game/protocol/cpu";
import type { CpuLevel } from "./cpuLevel";

const safeSteps = (state: EngineState, dir: -1 | 1): number => {
  let position = state.match.players[1];
  for (let steps = 0; steps < 18; steps++) {
    const next = stepOutcome(state.mask, position, dir);
    if (next.kind !== "moved" || next.y >= state.mask.height || Math.abs(position.x + dir - state.match.players[0].x) < 18) return steps;
    position = { ...position, x: position.x + dir, y: next.y };
  }
  return 18;
};
export const cpuSituation = (state: EngineState, level: CpuLevel): CpuSituation => {
  const tank = ({ x, y, hp }: EngineState["match"]["players"][number]) => ({ x, y, hp });
  const previous = state.lastResult?.shot;
  return { turn: state.match.turnNumber, level, self: tank(state.match.players[1]), opponent: tank(state.match.players[0]), wind: state.match.wind.value,
    leftSteps: safeSteps(state, -1), rightSteps: safeSteps(state, 1),
    terrain: Array.from({ length: 9 }, (_, i) => surfaceY(state.mask, Math.round(state.match.players[1].x + (state.match.players[0].x - state.match.players[1].x) * i / 8))),
    lastHit: previous?.input.seat === 1 ? previous.impacts.some(impact => impact.damage[0] > 0) : null };
};

export const requestCpuDecision = async (state: EngineState, level: CpuLevel, signal: AbortSignal, endpoint: string, fetcher: typeof fetch = fetch): Promise<CpuDecision | null> => {
  if (!endpoint || signal.aborted) return null;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 3000);
  try {
    const response = await fetcher(`${endpoint.replace(/\/$/, "")}/decision`, { method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(cpuSituation(state, level)) });
    if (!response.ok || controller.signal.aborted) return null;
    const parsed = cpuDecisionSchema.safeParse(await response.json());
    return parsed.success && !controller.signal.aborted ? parsed.data : null;
  } catch { return null; }
  finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
};
