---
id: 017
title: Layar pengaturan Sumber Data (BYOK) + toggle Hemat Data/Real-time
branch: task/017-settings-sumber-data-byok
status: in-progress
created: 2026-07-16
---

# 017 — Layar pengaturan "Sumber Data" (BYOK)

## Tujuan
Memberi user kontrol sumber data per fitur: Default (gratis, delayed) atau Custom
(API key milik user sendiri — BYOK), plus toggle "Hemat Data" vs "Real-time". Sumber
berbayar jadi opsi, bukan dependency wajib.

## Spec / kriteria selesai
- [x] Modul `src/settings.ts`: simpan/muat pengaturan di localStorage (pola
      `src/portfolio.ts`) — pilihan provider per fitur + API key user + toggle
      Hemat Data/Real-time.
- [x] UI "Sumber Data" (SettingsPanel, primitif `ui.tsx`): per fitur (harga,
      fundamental, kepemilikan) pilih Default atau Custom + isi key; toggle
      "Hemat Data" / "Real-time".
- [x] Frontend meneruskan pilihan provider/key ke backend per request (header
      `X-Key-<prov>`, `X-Provider-<feat>`, `X-Realtime`); prices router memilih
      provider dgn key itu, fallback default bila kosong.
- [x] Key tidak pernah ditulis ke log/error (diuji: FAKEKEY tidak muncul di log;
      dikirim via header bukan query). Hanya tersimpan lokal di mesin user.
- [x] Tanpa pengaturan apa pun, perilaku app identik (header kosong → jalur default).

## Catatan teknis
- Bergantung pada task 012 (interface `DataProvider` — pemilihan provider per request).
- localStorage cukup (konsisten dengan `portfolio`/`favorites`) — tidak perlu Tauri store.
- Provider eksternal baru (FMP/Sectors/Twelve Data) menyusul di task 018; task ini cukup
  mendukung pilihan Yahoo default + slot key Finnhub yang selama ini hanya via `.env`.
- Acuan: [PLAN.md](../../PLAN.md) §1.

## Verifikasi
- Set key Finnhub lewat UI (tanpa `.env`) → harga US realtime aktif; hapus key → kembali
  delayed. Restart app → pengaturan bertahan.
- Request backend tanpa parameter provider → perilaku default tak berubah.
- Cek log backend: key tidak muncul di log.
