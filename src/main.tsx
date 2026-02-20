import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AgencyProvider } from "./contexts/AgencyContext";

createRoot(document.getElementById("root")!).render(
  <AgencyProvider>
    <App />
  </AgencyProvider>
);

// PWA: registra service worker (ignora em dev e no modo HTML local)
if ("serviceWorker" in navigator && import.meta.env.PROD && import.meta.env.MODE !== "html") {
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .catch((err) => console.error("SW registration failed", err));
}
