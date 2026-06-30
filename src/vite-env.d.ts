/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected by Vite's `define` from package.json (see vite.config.ts).
declare const __APP_VERSION__: string;
