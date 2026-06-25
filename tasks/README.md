# Task Board

Board pekerjaan berbasis file Markdown. Setiap task = satu file `.md` yang
berpindah antar folder sesuai statusnya:

```
tasks/
├── backlog/        # task yang sudah dispesifikasikan, belum dikerjakan
├── in-progress/    # task yang sedang dikerjakan (ada branch-nya)
└── done/           # task selesai (sudah merge ke main)
```

Alur dikelola oleh skill **`/task`** (lihat `.claude/skills/task/SKILL.md`):
buat spec → pindah ke `in-progress` + buat branch → kerjakan → commit → push →
merge ke `main` → pindah file ke `done`.

Penamaan file: `NNN-slug-singkat.md` (mis. `001-frontend-chart-panel.md`).
Nomor urut menjaga urutan & jadi nama branch (`task/NNN-slug-singkat`).

Template task ada di `tasks/_template.md`.
