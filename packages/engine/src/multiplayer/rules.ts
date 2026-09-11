// v2のルール基盤。物理・通信から独立し、確定した脱落をまとめて適用する。
export type PlayerId = string;
export type TeamId = string;
export type RosterMember = { readonly playerId: PlayerId; readonly teamId: TeamId };
export type RosterState = {
  readonly members: readonly RosterMember[];
  readonly turnRing: readonly PlayerId[];
  readonly eliminated: readonly PlayerId[];
  readonly cursor: number;
  readonly round: number;
  readonly turnId: number;
};
export type TeamOutcome = { readonly type: "ongoing" } | { readonly type: "draw" } |
  { readonly type: "win"; readonly teamId: TeamId };

const compareIds = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const random = (seed: number): (() => number) => {
  let value = seed;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const shuffle = <T>(items: readonly T[], rng: () => number): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
};
const validateRoster = (members: readonly RosterMember[], seed: number): void => {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("seed must be uint32");
  if (members.length < 2 || members.length > 8) throw new Error("player count must be 2..8");
  if (members.some(p => !p.playerId.trim() || !p.teamId.trim())) throw new Error("IDs must not be blank");
  if (new Set(members.map(p => p.playerId)).size !== members.length) throw new Error("duplicate PlayerId");
  if (new Set(members.map(p => p.teamId)).size < 2) throw new Error("at least two teams required");
};

export const createRoster = (input: readonly RosterMember[], seed: number): RosterState => {
  validateRoster(input, seed);
  const members = input.map(p => ({ ...p })).sort((a, b) => compareIds(a.playerId, b.playerId));
  const rng = random(seed);
  const teams = shuffle([...new Set(members.map(p => p.teamId))].sort(compareIds), rng);
  const queues = teams.map(id => shuffle(members.filter(p => p.teamId === id), rng));
  const turnRing = Array.from({ length: Math.max(...queues.map(q => q.length)) }, (_, i) =>
    queues.flatMap(q => q[i] ? [q[i]!.playerId] : [])).flat();
  return { members, turnRing, eliminated: [], cursor: 0, round: 1, turnId: 1 };
};

// 全着弾・落下の確定後に呼ぶ。途中の暫定勝者を確定しない。
export const outcome = (state: RosterState): TeamOutcome => {
  const alive = new Set(state.members.filter(p => !state.eliminated.includes(p.playerId)).map(p => p.teamId));
  if (alive.size === 0) return { type: "draw" };
  if (alive.size === 1) return { type: "win", teamId: [...alive][0]! };
  return { type: "ongoing" };
};

export const eliminatePlayers = (state: RosterState, playerIds: readonly PlayerId[]): RosterState => {
  if (playerIds.some(id => !state.members.some(p => p.playerId === id))) throw new Error("unknown PlayerId");
  const eliminated = [...new Set([...state.eliminated, ...playerIds])].sort(compareIds);
  return { ...state, eliminated };
};

export const nextTurn = (state: RosterState): RosterState => {
  if (outcome(state).type !== "ongoing") return state;
  for (let offset = 1; offset <= state.turnRing.length; offset++) {
    const index = state.cursor + offset;
    const cursor = index % state.turnRing.length;
    if (!state.eliminated.includes(state.turnRing[cursor]!)) {
      return { ...state, cursor, round: state.round + Math.floor(index / state.turnRing.length), turnId: state.turnId + 1 };
    }
  }
  return state;
};

/** Next distinct participants; the current actor is not repeated in short matches. */
export const upcomingPlayers = (state: RosterState): readonly PlayerId[] => {
  if (outcome(state).type !== "ongoing") return [];
  return [...state.turnRing.slice(state.cursor + 1), ...state.turnRing.slice(0, state.cursor)]
    .filter(id => !state.eliminated.includes(id)).slice(0, 3);
};
