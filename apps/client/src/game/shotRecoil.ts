/** baseline-v2: three art pixels of barrel recoil, shared by simultaneous launches. */
export const shotRecoil = (now: number, launches: readonly number[]): number =>
  Math.max(0, ...launches.map(at => {
    const age = now - at;
    return age >= 0 && age < 180 ? Math.round(3 * Math.sin(age / 180 * Math.PI)) : 0;
  }));
