// Menyimpan teks ke file yang dipilih pengguna.
//
// Trik unduh ala browser (<a download> + blob URL) TIDAK menghasilkan file apa
// pun di dalam webview Tauri, dan tidak melempar error — itu sebabnya ekspor
// portofolio dulu terlihat "tidak ada output". Di dalam Tauri kita pakai dialog
// simpan bawaan lalu menulis lewat command `write_text_file`; di browser (mode
// dev `pnpm dev`) jalur blob lama tetap dipakai supaya ekspor bisa diuji tanpa
// menjalankan shell Tauri.

function inTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

/** Simpan `contents` sebagai file. Mengembalikan false bila pengguna membatalkan. */
export async function saveTextFile(
  contents: string,
  defaultName: string,
  filter: { name: string; extensions: string[] },
): Promise<boolean> {
  if (inTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({ defaultPath: defaultName, filters: [filter] });
    if (!path) return false; // pengguna menekan Batal
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("write_text_file", { path, contents });
    return true;
  }

  // Browser/dev fallback.
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}
