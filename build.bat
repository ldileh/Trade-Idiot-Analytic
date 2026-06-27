@echo off
setlocal enabledelayedexpansion
rem One-click release build: backend sidecar (PyInstaller) + Tauri app (MSI/NSIS).
rem Loads the MSVC env first so cargo links with link.exe from MSVC (not Git's).

cd /d "%~dp0"
echo === Trade-Idiot-Analytic :: build rilis ===

rem --- 1. Load MSVC (vcvars64) so cargo can link --------------------------------
set "VCVARS="
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if exist "%VSWHERE%" (
  for /f "usebackq delims=" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do (
    if exist "%%i\VC\Auxiliary\Build\vcvars64.bat" set "VCVARS=%%i\VC\Auxiliary\Build\vcvars64.bat"
  )
)
if not defined VCVARS (
  rem Fallback to the known VS 2019 Community install on this machine.
  set "VCVARS=%ProgramFiles(x86)%\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat"
)
if not exist "!VCVARS!" (
  echo [ERROR] vcvars64.bat tidak ditemukan. Install "MSVC C++ Build Tools" / Visual Studio.
  goto :fail
)
echo Loading MSVC env: !VCVARS!
call "!VCVARS!" >nul

rem --- Make sure Rust is on PATH ------------------------------------------------
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
where cargo >nul 2>nul || (echo [ERROR] cargo/Rust tidak ditemukan di PATH. Install Rust ^(rustup, stable-msvc^). & goto :fail)

rem --- 2. Build the backend sidecar exe ----------------------------------------
set "VENVPY=%~dp0backend\.venv\Scripts\python.exe"
if not exist "%VENVPY%" (
  echo [ERROR] backend\.venv belum ada. Buat dulu:
  echo         python3.12 -m venv backend\.venv ^&^& backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
  goto :fail
)
echo.
echo === [1/2] Build sidecar exe (PyInstaller) ===
"%VENVPY%" "%~dp0backend\build_sidecar.py" || goto :fail

rem --- 3. Build the Tauri app (installers) --------------------------------------
echo.
echo === [2/2] Build app Tauri (tauri build) ===
call pnpm tauri build || goto :fail

echo.
echo === SELESAI ===
echo Installer ada di:
echo   src-tauri\target\release\bundle\nsis\
echo   src-tauri\target\release\bundle\msi\
echo Binary: src-tauri\target\release\trade-idiot-analytic.exe
goto :end

:fail
echo.
echo === GAGAL (lihat pesan error di atas) ===

:end
echo.
pause
endlocal
