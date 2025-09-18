// src/main.tsx
import React from "react";
import "./index.css";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  HashRouter,
} from "react-router-dom";
import App from "./App";

import "./index.css";

// En GitHub Pages (build de producción) SIEMPRE usar HashRouter
const Router =
  import.meta.env.PROD ? HashRouter : BrowserRouter;

const root = document.getElementById("root");
createRoot(root!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);
