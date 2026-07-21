// Cek & pasang pembaruan aplikasi lewat tauri-plugin-updater. Installer diunduh
// dari GitHub Releases (latest.json), diverifikasi tanda tangannya, lalu app
// direstart. Hanya berjalan di dalam aplikasi desktop (Tauri) — di browser dev
// modul @tauri-apps tidak tersedia, jadi kita deteksi & lewati dengan sopan.
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask, message } from "@tauri-apps/plugin-dialog";

// Apakah kita berjalan di dalam shell Tauri (bukan browser biasa)?
function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Dipicu dari tombol "Cek pembaruan". Menampilkan dialog native untuk hasilnya
// (ada update / sudah terbaru / gagal), dan bila pengguna setuju, mengunduh +
// memasang + merestart. `silent` (dipakai saat startup) hanya bertindak bila
// ada update — tidak mengganggu dengan dialog "sudah terbaru".
export async function checkForUpdate(silent = false): Promise<void> {
  if (!inTauri()) {
    if (!silent) await message("Pembaruan otomatis hanya tersedia di aplikasi desktop.", { title: "Pembaruan" });
    return;
  }
  try {
    const update = await check();
    if (!update) {
      if (!silent) await message("Kamu sudah memakai versi terbaru. ✅", { title: "Pembaruan" });
      return;
    }
    const yes = await ask(
      `Versi ${update.version} tersedia (kamu di ${update.currentVersion}).\n\n${update.body ?? ""}\n\nUnduh & pasang sekarang? App akan restart setelah selesai.`,
      { title: "Pembaruan tersedia", kind: "info" },
    );
    if (!yes) return;
    await update.downloadAndInstall();
    await relaunch();
  } catch (e) {
    if (!silent) await message(`Gagal memeriksa pembaruan: ${e instanceof Error ? e.message : String(e)}`, { title: "Pembaruan", kind: "error" });
  }
}
