---
name: run-backend
description: Launch and smoke-test the Trade-Idiot-Analytic FastAPI backend (Python 3.12 venv). Use when asked to run, start, restart, or verify the backend, or to check that the prices/indicators/backtest endpoints work against live data.
---

# Run & smoke-test the backend

This project's backend is a FastAPI sidecar under `backend/`. It must run with the
**Python 3.12** virtualenv at `backend/.venv` (the numpy 1.26 / pandas 2.2 pins do
not support 3.13 — see [AGENTS.md](../../../AGENTS.md) §6). It binds `127.0.0.1`
only; port comes from `BACKEND_PORT` (default 8756).

## Steps

### 1. Ensure the venv has dependencies
If `backend/.venv` is missing, recreate it with Python 3.12 (installed at
`%LOCALAPPDATA%\Programs\Python\Python312\python.exe`):

```powershell
$py312 = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
& $py312 -m venv "d:\Project\Trade-Idiot-Analytic\backend\.venv"
& "d:\Project\Trade-Idiot-Analytic\backend\.venv\Scripts\python.exe" -m pip install -r "d:\Project\Trade-Idiot-Analytic\backend\requirements.txt"
```

### 2. (Re)start the server in the background
Kill any stale instance first, then launch and poll `/health`:

```powershell
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -like '*main.py*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 500
$venvpy = "d:\Project\Trade-Idiot-Analytic\backend\.venv\Scripts\python.exe"
$env:BACKEND_PORT = "8756"
Start-Process -FilePath $venvpy -ArgumentList "main.py" `
  -WorkingDirectory "d:\Project\Trade-Idiot-Analytic\backend" -WindowStyle Hidden `
  -RedirectStandardError "$env:TEMP\tia_backend.err.log" `
  -RedirectStandardOutput "$env:TEMP\tia_backend.out.log"
$ok = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Milliseconds 800
  try { if ((Invoke-RestMethod "http://127.0.0.1:8756/health" -TimeoutSec 3).status -eq "ok") { $ok = $true; break } } catch {}
}
Write-Output "Health OK: $ok"
```

### 3. Smoke-test the endpoints (live yfinance data)

```powershell
$base = "http://127.0.0.1:8756"
# prices
$p = Invoke-RestMethod "$base/prices?ticker=AAPL&interval=1d&range=6mo" -TimeoutSec 30
Write-Output "prices: $($p.candles.Count) candles"
# indicators
$body = @{ ticker="AAPL"; interval="1d"; range="6mo"; indicators=@(@{kind="ema";period=20},@{kind="rsi";period=14}) } | ConvertTo-Json -Depth 5
$ind = Invoke-RestMethod "$base/indicators" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 30
Write-Output "indicators: $($ind.series.Count) series"
# backtest
$bt = Invoke-RestMethod "$base/backtest" -Method Post -ContentType "application/json" -TimeoutSec 60 `
  -Body (@{ ticker="AAPL"; interval="1d"; range="2y"; strategy="sma_cross"; fast=10; slow=30 } | ConvertTo-Json)
Write-Output "backtest Return[%]: $($bt.stats.'Return [%]'), #Trades: $($bt.stats.'# Trades')"
```

### 4. On failure
- Read the traceback: `Get-Content "$env:TEMP\tia_backend.err.log" -Tail 30`.
- `JSONDecodeError` / empty data from yfinance → yfinance version too old; must be `1.4.1`.
- Import errors for numpy/pandas/ta → wrong interpreter; use `backend/.venv` (Python 3.12), not system python.

### 5. Stop the server when done

```powershell
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -like '*main.py*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
```

## Notes
- Interactive API docs: `http://127.0.0.1:8756/docs`.
- Do not commit `backend/.venv` (gitignored).
- Reply to the user in Bahasa Indonesia.
