import { z } from "zod";
export const LEGACY_CLIENT_BUILD = { protocol: 2, sim: "keropod-sim-v2.1", assets: "keropod-world-v1", rules: "keropod-v2.1" } as const;
export const CLIENT_BUILD = { ...LEGACY_CLIENT_BUILD } as const;
export const clientBuildSchema = z.object({ protocol: z.number().int(), sim: z.string(), assets: z.string(), rules: z.string() }).strict();
export type ClientBuild = z.infer<typeof clientBuildSchema>;
export const matchBuildSchema = clientBuildSchema.extend({ map: z.object({ id: z.string(), version: z.number().int().positive() }).strict() });
export type MatchBuild = z.infer<typeof matchBuildSchema>;
export const compatibleBuild = (raw: unknown): boolean => {
  const parsed = clientBuildSchema.safeParse(raw);
  return parsed.success && (Object.keys(CLIENT_BUILD) as (keyof ClientBuild)[]).every(key => parsed.data[key] === CLIENT_BUILD[key]);
};
export const matchBuild = (map: { readonly id: string; readonly version: number }): MatchBuild => ({ ...CLIENT_BUILD, map: { id: map.id, version: map.version } });
export const compatibleMatch = (build: MatchBuild, map: { readonly id: string; readonly version: number }): boolean => {
  const { map: identity, ...client } = build;
  return compatibleBuild(client) && identity.id === map.id && identity.version === map.version;
};
