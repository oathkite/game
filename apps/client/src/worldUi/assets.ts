import logo from "../../../../assets/brand/keropod/logo-outlined.png";
import background from "../../../../assets/workbench/world-ui-v1/background-v2.png";
import lobby from "../../../../assets/workbench/world-ui-v1/lobby-v1.png";
import settings from "../../../../assets/workbench/world-ui-v1/settings-v1.png";
import result from "../../../../assets/workbench/world-ui-v1/result-v1.png";
import terrain from "../../../../assets/workbench/world-ui-v1/terrain-v1.png";
import leaf from "../../../../assets/workbench/world-ui-v1/leaf-v1.png";
export const worldArt = { background, lobby, settings, result, terrain, leaf, logo };
export const loadTerrainArt = async (): Promise<HTMLImageElement> => {
  const image = new Image(); image.src = terrain; await image.decode(); return image;
};
