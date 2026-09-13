/** Presentation only: collision positions remain authoritative. Down is positive. */
export const createFallMotion = () => {
  const states = new Map<string, { y: number; origin: number; target: number; at: number }>();
  return {
    reset: () => states.clear(),
    sample(id: string, target: number, now: number, immediate = false): { y: number; falling: boolean } {
      let state = states.get(id);
      if (!state || immediate || target < state.y || (target - state.y <= 3 && state.target === state.y)) {
        state = { y: target, origin: target, target, at: now };
      } else if (target !== state.target) {
        state = { ...state, origin: state.y, target, at: now };
      }
      const seconds = Math.max(0, now - state.at) / 1000;
      const y = Math.min(target, state.origin + 180 * seconds * seconds);
      states.set(id, { ...state, y });
      return { y, falling: y < target };
    },
  };
};
