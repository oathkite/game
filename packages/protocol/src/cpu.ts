import { z } from "zod";
const tank = z.object({ x: z.number().int().min(0).max(399), y: z.number().int().min(0).max(225), hp: z.number().int().min(0).max(100) }).strict();
export const cpuSituationSchema = z.object({
  turn: z.number().int().min(1).max(1000), level: z.enum(["easy", "normal", "hard"]),
  self: tank, opponent: tank, wind: z.number().int().min(-10).max(10),
  leftSteps: z.number().int().min(0).max(18), rightSteps: z.number().int().min(0).max(18),
  lastHit: z.boolean().nullable(),
  terrain: z.array(z.number().int().min(0).max(225)).length(9),
}).strict();
export const cpuDecisionSchema = z.object({
  movement: z.enum(["hold", "approach", "retreat"]),
  weapon: z.enum(["cannon", "triple"]), trajectory: z.enum(["direct", "lob"]),
  pace: z.enum(["quick", "steady", "careful"]),
}).strict();
export type CpuSituation = z.infer<typeof cpuSituationSchema>;
export type CpuDecision = z.infer<typeof cpuDecisionSchema>;
