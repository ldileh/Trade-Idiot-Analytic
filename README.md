# Trade-Idiot-Analytic

Aplikasi **desktop** untuk **analisa teknikal** dan **backtesting** saham US. Menampilkan
candlestick chart + overlay indikator, dan menjalankan backtest strategi sederhana terhadap
data historis. Data diambil dari sumber gratis (yfinance); chart memakai library resmi
TradingView yang open-source (**lightweight-charts**) — bukan scraping `tradingview.com`.

> Backend (FastAPI) berjalan sebagai **sidecar** yang di-spawn oleh shell Tauri dan hanya
> bind ke `127.0.0.1` — tidak pernah terekspos ke jaringan.

---

## Fitur

- 📈 Candlestick chart saham US (interval & range bisa dipilih).
- 🧮 Overlay indikator teknikal: `sma`, `ema`, `rsi`, `macd`, `bbands`, `atr`.
- 🔁 Backtest strategi `sma_cross` & `rsi_reversion` → metrik + equity curve.
- 🖥️ Dikemas jadi aplikasi desktop Windows (Tauri v2) dengan backend Python ter-bundle
  (PyInstaller) — pengguna akhir tidak perlu meng-install Python.

---

## Arsitektur

```
┌─────────────────────────────────────────────┐
│  TAURI v2 (desktop shell — Rust, ringan)     │
│  ┌───────────────────────────────────────┐   │
│  │  Frontend: React + TypeScript + Vite  │   │
│  │  - lightweight-charts (candlestick)    │   │
│  │  - panel indikator + hasil backtest    │   │
│  └───────────────────────────────────────┘   │
│                    ↕ HTTP (127.0.0.1:<port>)  │
│  ┌───────────────────────────────────────┐   │
│  │  Backend: Python + FastAPI (sidecar)  │   │
│  │  - yfinance → OHLCV  · ta → indikator  │   │
│  │  - backtesting.py → backtest           │   │
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

Saat aplikasi start, shell Tauri mencari port bebas, men-spawn sidecar dengan env
`BACKEND_PORT`/`BACKEND_HOST`, lalu memberikan port itu ke frontend (command `backend_port`).
Saat window ditutup, seluruh process-tree sidecar dimatikan (`taskkill /T`) sehingga tidak
ada proses backend yang tertinggal.

### Stack

| Komponen      | Pilihan                              | Catatan |
|---------------|--------------------------------------|---------|
| Desktop shell | **Tauri v2** (Rust)                  | Native Windows, ringan (vs Electron). |
| Frontend      | **React + TypeScript + Vite**        | Package manager: **pnpm**. |
| Chart         | **lightweight-charts** (TradingView) | Gratis, OSS. |
| Backend       | **Python 3.12 + FastAPI**            | Di-bundle sebagai Tauri sidecar via PyInstaller. |
| Data          | **yfinance 1.4.1**                   | OHLCV saham US gratis. |
| Indikator     | **`ta` 0.11.0**                      | Pure-Python (tanpa numba). |
| Backtesting   | **backtesting.py 0.3.3**             | Metrik + equity curve. |

---

## Struktur project

```
Trade-Idiot-Analytic/
├── src/                    # Frontend React + TypeScript
│   ├── App.tsx · main.tsx
│   ├── api/client.ts       # wrapper fetch ke sidecar (ambil port via Tauri)
│   ├── components/         # ChartPanel, IndicatorControls, BacktestPanel, ...
│   └── indicators.ts · types.ts
├── src-tauri/              # Shell Tauri (Rust)
│   ├── src/{main.rs, lib.rs}   # spawn sidecar + cari port + kill on close
│   ├── tauri.conf.json     # externalBin: ["bin/backend"], window 1280x800
│   ├── icons/              # icon set (icon.ico dll.)
│   └── bin/                # output sidecar PyInstaller (gitignored)
├── backend/               # Backend Python + FastAPI  (lihat backend/README.md)
│   ├── main.py · requirements.txt
│   ├── sidecar.spec · build_sidecar.py   # packaging PyInstaller
│   └── app/{models.py, routers/, services/}
├── tasks/                  # task board (backlog / in-progress / done)
├── AGENTS.md               # panduan & keputusan arsitektur (untuk agen AI)
└── package.json · vite.config.ts · tsconfig.json
```

---

## Prasyarat

| Untuk                | Butuh |
|----------------------|-------|
| Backend saja         | **Python 3.12** (numpy 1.26 / pandas 2.2 tidak mendukung 3.13). |
| Frontend (browser)   | **Node.js** + **pnpm**. |
| Build desktop (Tauri)| Tambah **Rust** (stable-msvc) + **MSVC C++ Build Tools** (Visual Studio Build Tools). |

---

## Setup & menjalankan

### 1. Backend (FastAPI)

```bash
cd backend
python3.12 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
.venv/Scripts/python main.py                              # jalan di 127.0.0.1:8756
```

Buka `http://127.0.0.1:8756/docs` untuk API interaktif. Override binding via env
`BACKEND_PORT` (default `8756`) dan `BACKEND_HOST` (default `127.0.0.1`).

### 2. Frontend (dev di browser)

```bash
pnpm install
pnpm dev            # Vite di http://localhost:1420
```

Di luar Tauri, `src/api/client.ts` fallback ke `127.0.0.1:8756`, jadi jalankan backend
(langkah 1) berbarengan.

### 3. Aplikasi desktop penuh (dev)

Perlu Rust + MSVC. Build harus dijalankan dengan environment MSVC ter-load (mis. dari
"x64 Native Tools Command Prompt", atau panggil `vcvars64.bat` lebih dulu) agar cargo
me-link dengan linker MSVC.

```bash
# 1) Build sidecar exe dari backend (sekali, atau tiap backend berubah):
backend/.venv/Scripts/python backend/build_sidecar.py
#    -> src-tauri/bin/backend-x86_64-pc-windows-msvc.exe

# 2) Jalankan shell desktop (spawn sidecar otomatis):
pnpm tauri dev
```

### 4. Build rilis (installer)

```bash
backend/.venv/Scripts/python backend/build_sidecar.py   # pastikan sidecar terbaru ada
pnpm tauri build
```

Output di `src-tauri/target/release/bundle/`:
- `msi/Trade-Idiot-Analytic_<versi>_x64_en-US.msi`
- `nsis/Trade-Idiot-Analytic_<versi>_x64-setup.exe`

Sidecar `backend.exe` ikut ter-bundle, sehingga aplikasi rilis berjalan tanpa Python
terpasang di mesin pengguna.

> Detail lengkap konvensi, keputusan arsitektur, dan pitfall dependency ada di
> [AGENTS.md](AGENTS.md). Catatan: yang membuat backend memilih `ta` (bukan pandas-ta),
> `yfinance 1.4.1`, dan Python 3.12 dijelaskan di sana.

---

## API backend

| Method | Path          | Fungsi |
|--------|---------------|--------|
| GET    | `/health`     | Liveness check. |
| GET    | `/prices`     | OHLCV candles — `?ticker=AAPL&interval=1d&range=1y` (`time` = epoch detik). |
| POST   | `/indicators` | Hitung `sma`/`ema`/`rsi`/`macd`/`bbands`/`atr` (NaN warm-up → `null`). |
| POST   | `/backtest`   | Strategi `sma_cross` / `rsi_reversion` → stats + equity curve. |

Lihat juga [backend/README.md](backend/README.md).
