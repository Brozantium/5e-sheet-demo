import React from "react";
import ReactDOM from "react-dom/client";
import AppRoot from "./application/AppRoot";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing application root element.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
);
