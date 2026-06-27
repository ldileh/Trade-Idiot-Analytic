# AGENTS.md — Trade-Idiot-Analytic

Panduan untuk agen AI (Claude Code, dll.) yang bekerja di repo ini. Berisi spesifikasi
project, keputusan arsitektur yang sudah final, status terkini, konvensi, dan
rekomendasi skill. **Baca file ini sebelum mulai bekerja.**

---

## 1. Apa ini

**Trade-Idiot-Analytic** adalah aplikasi **desktop** (greenfield) untuk **analisa saham
US** dengan fokus **analisa teknikal** dan **backtesting** strategi.

- Menampilkan candlestick chart saham US + overlay indikator teknikal.
- Menjalankan backtest strategi sederhana terhadap data historis.
- Data diambil dari sumber online gratis (yfinance).
- Chart memakai library resmi TradingView yang gratis & open-source
  (**lightweight-charts**) — **BUKAN** scraping `tradingview.com` (melanggar ToS).

**Bahasa komunikasi dengan user: Bahasa Indonesia.**

---

## 2. Arsitektur (sudah dikonfirmasi user — jangan diubah tanpa persetujuan)

```
┌─────────────────────────────────────────────┐
│  TAURI v2 (desktop shell — Rust, ringan)     │
│  ┌───────────────────────────────────────┐   │
│  │  Frontend: React + TypeScript + Vite  │   │
│  │  - lightweight-charts (candlestick)    │   │
│  │  - panel indikator, form & hasil       │   │
│  │    backtest (equity curve, metrik)     │   │
│  └───────────────────────────────────────┘   │
│                    ↕ HTTP (127.0.0.1)         │
│  ┌───────────────────────────────────────┐   │
│  │  Backend: Python + FastAPI (sidecar)  │   │
│  │  - yfinance → OHLCV saham US           │   │
│  │  - ta → indikator teknikal             │   │
│  │  - backtesting.py → backtest           │   │
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

| Komponen      | Pilihan                          | Catatan |
|---------------|----------------------------------|---------|
| Desktop shell | **Tauri v2**                     | Native Windows, ringan (vs Electron). |
| Frontend      | **React + TypeScript + Vite**    | — |
| Chart         | **lightweight-charts** (TradingView) | Gratis, OSS. |
| Backend       | **Python 3.12 + FastAPI**        | Di-bundle sebagai **Tauri sidecar** via PyInstaller. |
| Data          | **yfinance 1.4.1**               | OHLCV saham US gratis. |
| Indikator     | **`ta` 0.11.0**                  | Pure-Python (pandas-ta sudah dihapus dari PyPI/GitHub). |
| Backtesting   | **backtesting.py 0.3.3**         | Auto-generate metrik + equity curve. |

**Komunikasi**: Tauri men-spawn sidecar → FastAPI di `127.0.0.1:<port>` → frontend
`fetch` via HTTP. Backend bind ke `127.0.0.1` saja (tidak pernah terekspos jaringan).
Port dilewatkan via env `BACKEND_PORT` (default `8756`), host via `BACKEND_HOST`.

---

## 3. Struktur project (target)

```
Trade-Idiot-Analytic/
├── AGENTS.md                    # file ini
├── .gitignore
├── package.json                 # frontend + script tauri          [SELESAI ✅]
├── vite.config.ts / tsconfig.json / index.html                    [SELESAI ✅]
├── src/                         # FRONTEND React+TS                [SELESAI ✅]
│   ├── main.tsx / App.tsx
│   ├── api/client.ts            # wrapper fetch ke FastAPI sidecar
│   ├── components/
│   │   ├── ChartPanel.tsx       # candlestick + overlay indikator
│   │   ├── IndicatorControls.tsx
│   │   ├── TickerInput.tsx
│   │   └── BacktestPanel.tsx
│   └── types.ts
├── src-tauri/                   # SHELL TAURI (Rust)               [SELESAI ✅]
│   ├── Cargo.toml / tauri.conf.json / build.rs
│   ├── icons/                   # icon set (icon.ico dll.)
│   ├── bin/                     # output PyInstaller (gitignored)
│   └── src/{main.rs, lib.rs}    # spawn sidecar, cari port
└── backend/                     # BACKEND PYTHON                   [SELESAI ✅]
    ├── main.py                  # uvicorn entry
    ├── requirements.txt
    └── app/
        ├── __init__.py          # app factory, CORS, /health
        ├── models.py            # pydantic schemas
        ├── routers/             # prices, indicators, backtest
        └── services/            # data (yfinance+cache), indicators (ta), strategies
```

---

## 4. API backend (sudah jalan & terverifikasi)

| Method | Path          | Fungsi |
|--------|---------------|--------|
| GET    | `/health`     | Liveness check. |
| GET    | `/prices`     | OHLCV candles: `?ticker=AAPL&interval=1d&range=1y`. `time` = epoch detik. |
| POST   | `/indicators` | Hitung `sma`/`ema`/`rsi`/`macd`/`bbands`/`atr`. NaN warm-up → `null`. |
| POST   | `/backtest`   | Strategi `sma_cross` / `rsi_reversion`. Return stats + equity curve. |

Dokumen interaktif: `http://127.0.0.1:8756/docs`.

---

## 5. Setup & menjalankan

### Backend (Python 3.12 — WAJIB, bukan 3.13)

```bash
# venv sudah dibuat di backend/.venv (Python 3.12.10).
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt   # kalau perlu reinstall
backend/.venv/Scripts/python backend/main.py                              # jalankan (port 8756)
```

Selalu pakai interpreter `backend/.venv/Scripts/python.exe`, **jangan** python sistem.

### Frontend (dev di browser)

```bash
pnpm install
pnpm dev            # Vite di http://localhost:1420 (fallback ke backend 127.0.0.1:8756)
```

### Aplikasi desktop (Tauri — butuh Rust + MSVC)

```bash
backend/.venv/Scripts/python backend/build_sidecar.py   # build sidecar exe ke src-tauri/bin/
pnpm tauri dev                                           # dev shell (spawn sidecar)
pnpm tauri build                                         # installer MSI + NSIS
```

Build harus dijalankan dengan environment MSVC ter-load (panggil `vcvars64.bat` dulu, atau
pakai "x64 Native Tools Command Prompt") agar cargo me-link via linker MSVC, bukan `link.exe`
milik Git. Lihat [README.md](README.md) untuk detail.

---

## 6. Pitfall dependency (sudah memakan waktu debugging — JANGAN diulang)

- **Python 3.13 TIDAK kompatibel.** Pin `numpy 1.26.4` / `pandas 2.2.3` butuh Python ≤3.12.
  venv project = **Python 3.12.10** (di-install via `winget install Python.Python.3.12`).
- **pandas-ta sudah mati.** Rilis PyPI `0.3.14b0` di-yank DAN repo GitHub `twopirllc/pandas-ta`
  dihapus (404). Versi 0.4.x menarik numpy≥2 / pandas 3 / numba (berat untuk PyInstaller).
  → Diganti **`ta==0.11.0`** (pure-Python, tanpa numba). Catatan: `ta` tidak punya `__version__`.
- **yfinance 0.2.51 rusak** terhadap API Yahoo (respons kosong / `JSONDecodeError`).
  → Pakai **`yfinance==1.4.1`**. Dengan `auto_adjust=True`, 1.4.x tidak lagi mengembalikan kolom `Adj Close`.
- **backtesting 0.3.3** `Backtest.__init__` **tidak** menerima `finalize_trades=` (argumen versi lebih baru).

---

## 7. Status & langkah berikutnya

| Bagian | Status |
|--------|--------|
| Backend FastAPI (prices/indicators/backtest) | ✅ Selesai, terverifikasi end-to-end. |
| Frontend React + lightweight-charts | ✅ Selesai (task 001–004): chart, overlay indikator, panel backtest. |
| Tauri shell (`src-tauri/`) | ✅ Selesai (task 005): spawn sidecar, cari port bebas, kill process-tree saat close. |
| PyInstaller sidecar packaging + build rilis | ✅ Selesai (task 006): sidecar exe + `tauri build` → MSI & NSIS. |

**MVP desktop end-to-end sudah berfungsi & terverifikasi** (dev maupun rilis). Toolchain
yang dibutuhkan untuk build sudah terpasang di mesin dev: **Rust** (stable-msvc, di
`~/.cargo/bin`), **MSVC C++ Build Tools** (VS 2019), dan **Python 3.12**.

Catatan saat build: panggil `vcvars64.bat` sebelum `pnpm tauri build/dev` agar linker MSVC
yang dipakai. Sidecar exe (gitignored) harus di-rebuild via `backend/build_sidecar.py` pada
checkout baru. `externalBin` di `tauri.conf.json` me-resolve ke `bin/backend`.

Ide pengembangan lanjutan (opsional): caching/persistence, lebih banyak strategi backtest,
signing installer, auto-update.

---

## 8. Konvensi kerja

- **Bahasa**: balas user dalam Bahasa Indonesia.
- **Greenfield**: tidak ada kode lama untuk di-reuse; ikuti struktur di §3.
- **Verifikasi nyata**: setelah mengubah backend, jalankan server & uji endpoint dengan
  data live (mis. AAPL/MSFT) — jangan hanya cek import.
- **Komentar kode**: bahasa Inggris, jelaskan *kenapa* (bukan *apa*), padat. Ikuti gaya
  file sekitar.
- **Commit**: hanya saat diminta. Pesan commit deskriptif, akhiri dengan baris
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **`.venv`, `node_modules`, `src-tauri/target`, `src-tauri/bin`** sudah di-gitignore —
  jangan di-commit.
- **Jangan langgar ToS**: data hanya dari API resmi/legal (yfinance), chart hanya
  lightweight-charts. Tidak ada scraping `tradingview.com`.

---

## 9. Rekomendasi skill (Claude Code) untuk fase saat ini

Skill = slash-command yang dipanggil user. Untuk tahap project sekarang (MVP desktop
end-to-end selesai; fase berikutnya pemeliharaan & penyempurnaan), yang paling relevan:

| Skill | Kapan dipakai sekarang |
|-------|------------------------|
| **`/run`** | Menjalankan app/backend untuk melihat perubahan benar-benar bekerja. Setelah frontend ada, ini cara cepat membuktikan chart & backtest tampil. |
| **`/verify`** | Memverifikasi sebuah perubahan benar-benar berfungsi dengan menjalankan app & mengamati perilaku (mis. konfirmasi endpoint baru atau panel frontend bekerja). |
| **`/code-review`** | Review diff untuk bug & peluang penyederhanaan sebelum commit fitur besar (mis. setelah frontend chart selesai). `ultra` untuk review mendalam multi-agent di cloud. |
| **`/simplify`** | Bersihkan kode yang baru ditulis (reuse, efisiensi) — fokus kualitas, bukan cari bug. |
| **`/init`** | (Opsional) regenerate dokumentasi codebase kalau struktur berubah besar. AGENTS.md ini sudah meng-cover sebagian besar. |
| **`/security-review`** | Review keamanan sebelum rilis — relevan menjelang packaging (mis. memastikan sidecar bind 127.0.0.1, tidak ada kredensial ter-hardcode). |

Skill **tidak** relevan untuk fase ini (abaikan kecuali diminta): `update-config`,
`keybindings-help`, `fewer-permission-prompts`, `loop`, `schedule`, `claude-api`,
`review` (itu untuk PR GitHub; pakai `/code-review` untuk diff lokal).

> Catatan: jangan menebak nama skill. Hanya panggil skill saat user mengetik `/<nama>`
> atau saat instruksi tugas jelas memintanya.
