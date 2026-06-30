import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

// Tauri spawns the FastAPI sidecar on 127.0.0.1:8756; the browser dev flow
// talks to it directly via src/api/client.ts, so no proxy is needed here.
export default defineConfig({
  plugins: [react()],
  // Stamp the package.json version into the build so the app can display it.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // Tauri expects a fixed dev port; harmless for plain browser dev too.
  server: { port: 1420, strictPort: true },
});
