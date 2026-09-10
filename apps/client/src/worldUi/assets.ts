import logo from "../../../../assets/runtime/world-v1/logo.webp";
import background from "../../../../assets/runtime/world-v1/background.webp";
import lobby from "../../../../assets/runtime/world-v1/lobby.webp";
import settings from "../../../../assets/runtime/world-v1/settings.webp";
import result from "../../../../assets/runtime/world-v1/result.webp";
import terrain from "../../../../assets/runtime/world-v1/terrain.webp";
import leaf from "../../../../assets/runtime/world-v1/leaf.webp";
export const worldArt = { background, lobby, settings, result, terrain, leaf, logo };
export const loadTerrainArt = async (): Promise<HTMLImageElement> => {
  const image = new Image(); image.src = terrain; await image.decode(); return image;
};
