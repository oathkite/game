import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
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
  const Screen = import.meta.env.DEV && prototype === "camera"
    ? (await import("./prototype/CameraPrototype")).CameraPrototype
    : import.meta.env.DEV && prototype === "world"
    ? (await import("./worldUi/WorldScenes")).WorldScenes : App;
  createRoot(root).render(<StrictMode><Screen /></StrictMode>);
};
void mount();
