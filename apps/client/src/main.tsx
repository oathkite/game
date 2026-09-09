import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./menu.css";

const root = document.getElementById("root");
if (!root) throw new Error("root がない");

const mount = async (): Promise<void> => {
  // 工程Aの実アセット試作。製品buildには入口も本人用素材も含めない。
  const Screen = import.meta.env.DEV && new URLSearchParams(location.search).get("prototype") === "camera"
    ? (await import("./prototype/CameraPrototype")).CameraPrototype
    : App;
  createRoot(root).render(<StrictMode><Screen /></StrictMode>);
};
void mount();
