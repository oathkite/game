import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./menu.css";

const root = document.getElementById("root");
if (!root) throw new Error("root がない");

const mount = async (): Promise<void> => {
  const prototype = new URLSearchParams(location.search).get("prototype");
  if (import.meta.env.DEV && prototype === "network") {
    const { NetworkLab } = await import("./networkLab/NetworkLab");
    createRoot(root).render(<NetworkLab />); return;
  }
  // 演出を調整する FX ラボ（設計書 41.11）。開発時だけ
  if (import.meta.env.DEV && prototype === "fx") {
    const { FxLab } = await import("./dev/FxLab");
    createRoot(root).render(<FxLab />); return;
  }
  const Screen = import.meta.env.DEV && prototype === "camera"
    ? (await import("./prototype/CameraPrototype")).CameraPrototype
    : import.meta.env.DEV && prototype === "legacy"
    ? (await import("./App")).App : (await import("./worldUi/WorldScenes")).WorldScenes;
  createRoot(root).render(<StrictMode><Screen /></StrictMode>);
};
void mount();
