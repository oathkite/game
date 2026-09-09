import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./menu.css";

const root = document.getElementById("root");
if (!root) throw new Error("root がない");

if (import.meta.env.DEV && new URLSearchParams(location.search).get("prototype") === "network") {
  void import("./networkLab/NetworkLab").then(({ NetworkLab }) => createRoot(root).render(<NetworkLab />));
} else {
  createRoot(root).render(<StrictMode><App /></StrictMode>);
}
