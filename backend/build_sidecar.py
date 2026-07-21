"""Build the backend into a Tauri sidecar exe.

Runs PyInstaller against sidecar.spec, then copies the result into
src-tauri/bin/ renamed to backend-<target-triple>.exe — the name Tauri's
`externalBin: ["bin/backend"]` resolves to on this host.

Usage (from repo root, with the 3.12 venv):
    backend/.venv/Scripts/python backend/build_sidecar.py
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
ROOT = BACKEND.parent


def target_triple() -> str:
    # Tauri names sidecars by the Rust host triple; ask rustc for it.
    out = subprocess.run(["rustc", "-vV"], capture_output=True, text=True, check=True).stdout
    for line in out.splitlines():
        if line.startswith("host:"):
            return line.split()[1]
    raise RuntimeError("could not determine target triple from rustc -vV")


def main() -> None:
    subprocess.run(
        [sys.executable, "-m", "PyInstaller", "sidecar.spec", "--noconfirm",
         "--distpath", "dist", "--workpath", "build"],
        cwd=BACKEND, check=True,
    )
    # PyInstaller adds .exe only on Windows; on macOS/Linux the binary has no suffix.
    suffix = ".exe" if sys.platform == "win32" else ""
    exe = BACKEND / "dist" / f"backend{suffix}"
    if not exe.exists():
        raise SystemExit(f"PyInstaller did not produce dist/backend{suffix}")

    bin_dir = ROOT / "src-tauri" / "bin"
    bin_dir.mkdir(parents=True, exist_ok=True)
    dest = bin_dir / f"backend-{target_triple()}{suffix}"
    shutil.copy2(exe, dest)
    print(f"sidecar ready: {dest}")


if __name__ == "__main__":
    main()
