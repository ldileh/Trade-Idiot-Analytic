---
name: task
description: Manage the Markdown task board under tasks/ and run a task end-to-end. Use when the user wants to create a task/spec, start working a task, see the board, or drive a piece of work through spec → branch → implement → commit → push → merge to main. Triggers like "buat task", "kerjakan task", "lihat board", "task baru".
---

# Task board workflow (`/task`)

Drives a piece of work through the project's Markdown board at `tasks/`:
`backlog/ → in-progress/ → done/`. Each task is one `.md` file that moves between
those folders. The skill both manages the board/git flow AND implements the work.

Argument (free-form) decides the mode. If ambiguous, ask the user which they mean.

- **`new <judul>`** → create a spec.
- **`list`** / **`board`** → show the board.
- **`start <id|judul>`** / **`work <id>`** / **`kerjakan <id>`** → run a task end-to-end.

Always reply to the user in **Bahasa Indonesia**.

---

## Mode: `new` — buat task baru

1. Tentukan nomor urut berikutnya: lihat angka `NNN` tertinggi di seluruh
   `tasks/**/*.md`, tambah 1, pad 3 digit (`001`, `002`, …).
2. Buat slug kebab-case dari judul. File: `tasks/backlog/NNN-slug.md`.
3. Isi dari `tasks/_template.md`: set `id`, `title`, `branch: task/NNN-slug`,
   `status: backlog`, `created` = tanggal hari ini, dan tulis Tujuan + Spec
   (kriteria selesai sebagai checkbox) sebaik mungkin dari deskripsi user. Jika
   spec kurang jelas, tanyakan ke user sebelum menulis kriteria.
4. Laporkan path file + ringkasan spec. **Jangan** langsung dikerjakan kecuali
   user memintanya.

## Mode: `list` / `board` — tampilkan board

Baca semua `tasks/{backlog,in-progress,done}/*.md`, tampilkan per kolom:
`[NNN] judul` untuk tiap status. Sebutkan total per kolom.

## Mode: `start` / `work` / `kerjakan` — jalankan task end-to-end

Lakukan berurutan, berhenti & lapor jika ada langkah gagal:

### 1. Pra-syarat
- Pastikan working tree bersih (`git status --short`). Jika ada perubahan
  belum di-commit yang tak terkait, tanyakan user dulu — jangan ikut sertakan.
- Temukan file task (cari `NNN` atau judul di `tasks/backlog/` atau
  `tasks/in-progress/`). Baca spec & kriteria selesainya.

### 2. Mulai (board → in-progress + branch)
- Pindahkan file ke `tasks/in-progress/` (`git mv`), set `status: in-progress`
  di frontmatter.
- Buat & checkout branch dari `main` yang up-to-date:
  ```bash
  git checkout main
  git pull --ff-only        # lewati jika tidak ada remote
  git checkout -b task/NNN-slug
  ```
- Commit pemindahan board ini:
  `git commit -am "task(NNN): mulai — <judul>"`.

### 3. Kerjakan
- Implementasikan sesuai spec. Centang `- [x]` tiap kriteria di file task saat
  terpenuhi. Ikuti konvensi di [AGENTS.md](../../../AGENTS.md) (bahasa komentar
  Inggris, verifikasi nyata, dll).
- **Verifikasi** sesuai bagian "Verifikasi" task sebelum dianggap selesai
  (mis. jalankan backend lewat skill `run-backend`, uji endpoint/UI).

### 4. Commit pekerjaan
- `git add -A` lalu commit deskriptif:
  ```
  feat(NNN): <judul>

  <ringkasan perubahan>

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
- Boleh beberapa commit jika logis.

### 5. Push branch
- `git push -u origin task/NNN-slug`.
- Jika belum ada remote `origin`, **lewati push**, beri tahu user, lanjut merge lokal.

### 6. Merge ke main (lokal langsung — tanpa PR)
- Selesaikan board: pindah file ke `tasks/done/` (`git mv`), set
  `status: done`, commit di branch:
  `git commit -am "task(NNN): selesai — <judul>"`.
- Merge:
  ```bash
  git checkout main
  git merge --no-ff task/NNN-slug -m "merge task NNN: <judul>"
  git push           # lewati jika tidak ada remote
  ```
- Opsional (tanyakan user): hapus branch
  `git branch -d task/NNN-slug` (+ `git push origin --delete task/NNN-slug`).

### 7. Lapor
Ringkas: file task akhir di `tasks/done/`, branch, commit hash, status merge,
hasil verifikasi.

---

## Catatan
- Penomoran & nama branch: `NNN-slug`, branch `task/NNN-slug`.
- Jangan commit `backend/.venv`, `node_modules`, `src-tauri/target|bin` (gitignored).
- Jika `git pull`/`push` gagal karena tidak ada remote, itu wajar untuk repo lokal —
  lanjutkan merge lokal dan beri tahu user.
- Jika ada konflik merge, berhenti dan minta arahan user; jangan paksa.
