---
id: 001
title: Scaffold frontend React + TypeScript + Vite
branch: task/001-frontend-scaffold
status: backlog
created: 2026-06-25
---

# 001 — Scaffold frontend React + TypeScript + Vite

## Tujuan
Menyiapkan kerangka frontend (React + TypeScript + Vite) sebagai dasar UI desktop,
sehingga task UI berikutnya bisa langsung membangun di atasnya. Belum perlu Tauri.

## Spec / kriteria selesai
- [ ] `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html` ada di root.
- [ ] Struktur `src/` sesuai AGENTS.md §3: `main.tsx`, `App.tsx`, `api/`, `components/`, `types.ts`.
- [ ] Dependency inti terpasang: `react`, `react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`, `lightweight-charts`.
- [ ] `npm run dev` (atau pnpm) jalan tanpa error dan menampilkan halaman kosong/placeholder.
- [ ] `src/api/client.ts`: wrapper `fetch` ke backend (`BACKEND_BASE` default `http://127.0.0.1:8756`).
- [ ] `src/types.ts`: tipe TS yang mirror schema backend (Candle, IndicatorSeries, BacktestResponse, dll).

## Catatan teknis
- Node v25 / pnpm 11 sudah ada (lihat AGENTS.md). Pakai pnpm jika memungkinkan.
- Belum perlu Tauri/Rust — ini murni web dev, bisa diverifikasi di browser.
- `node_modules/` & `dist/` sudah di-gitignore.

## Verifikasi
- Jalankan dev server, buka di browser, pastikan tanpa error console.
- `tsc --noEmit` lulus (tidak ada error tipe).
