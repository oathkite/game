import mossValley from "../../../../assets/runtime/maps/moss-valley-v3/terrain.webp";
import reedHills from "../../../../assets/runtime/maps/reed-hills-v3/terrain.webp";
import rockArch from "../../../../assets/runtime/maps/rock-arch-v2/terrain.webp";
import logo from "../../../../assets/runtime/world-v1/logo.webp";
import background from "../../../../assets/runtime/world-v1/background.webp";
import lobby from "../../../../assets/runtime/world-v1/lobby.webp";
import settings from "../../../../assets/runtime/world-v1/settings.webp";
import result from "../../../../assets/runtime/world-v1/result.webp";
import terrain from "../../../../assets/runtime/world-v1/terrain.webp";
import leaf from "../../../../assets/runtime/world-v1/leaf.webp";
export const worldArt = { background, lobby, settings, result, terrain, leaf, logo };
const terrainImages: Readonly<Record<string, string>> = { "rock-arch@2": rockArch, "reed-hills@3": reedHills, "reed-hills@4": reedHills, "moss-valley@3": mossValley };
export const imageTerrainSource = (map: { readonly id: string; readonly version: number }): string | undefined => terrainImages[`${map.id}@${map.version}`];
export const loadMapTerrainArt = async (map: { readonly id: string; readonly version: number }) => {
  const source = imageTerrainSource(map), image = new Image();
  image.src = source ?? terrain; await image.decode();
  return { image, authored: source !== undefined };
};

export const loadRockArchArt = async (): Promise<HTMLImageElement> => {
  const image = new Image(); image.src = rockArch; await image.decode(); return image;
};
