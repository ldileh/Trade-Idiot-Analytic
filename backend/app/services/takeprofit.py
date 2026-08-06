"""Target Take Profit — di mana sebaiknya untung diamankan.

Empat metode yang berdiri sendiri, dihitung dari OHLCV harian yang sama dengan
panel lain (cache SQLite, tanpa request tambahan). Semuanya melaporkan HARGA,
bukan sinyal beli/jual — user yang memutuskan.

Kenapa empat, bukan satu angka "terbaik": tiap metode menjawab pertanyaan yang
berbeda, dan riset di baliknya juga berbeda.

1. ATR / volatility target (Wilder 1978, "New Concepts in Technical Trading
   Systems"). Target sebagai kelipatan Average True Range membuat jaraknya
   proporsional dengan pergerakan wajar saham itu sendiri. Saham yang biasa
   bergerak 1%/hari dan yang bergerak 5%/hari tidak boleh dipatok target
   persentase yang sama.

2. Risk/Reward (R-multiple) — kerangka Van Tharp ("Trade Your Way to Financial
   Freedom"): tentukan dulu jarak risiko R (entry → stop), lalu target = entry +
   n×R. Ekspektasi positif bisa tercapai dengan win-rate rendah asal n cukup
   besar; ini yang membuat R-multiple dipakai luas di manajemen risiko.

3. Resistance / puncak 52 minggu (George & Hwang 2004, Journal of Finance
   59(5):2145-2176). Puncak 52 minggu berfungsi sebagai "jangkar" psikologis —
   harga sering tertahan di sana. Dipakai sebagai target struktural, bukan
   rumus.

4. Chandelier Exit (Chuck Le Beau) — trailing stop = highest_high(22) − 3×ATR22.
   Bukan target tetap: ia ikut naik mengikuti harga sehingga winner dibiarkan
   berjalan. Relevan karena momentum meluruh perlahan, bukan mendadak
   (Jegadeesh & Titman 1993) — memotong terlalu cepat membuang sisa tren.

Scaling out (jual bertahap) memakai pembagian 1/3 klasik: sebagian di target
konservatif, sebagian di target utama, sisanya di-trailing. Ini konvensi
manajemen posisi, bukan hasil satu paper tunggal — dilabeli demikian di UI.

Karena keempat metode di atas tidak sama-sama cocok di semua kondisi, modul ini
juga MENDIAGNOSA kondisi emiten (arah tren via EMA20/50, posisi terhadap puncak
52 minggu, dan tingkat volatilitas) lalu merekomendasikan metode yang paling
sesuai — beserta strategi stop loss-nya. Aturan pemetaannya:

- Tren kuat & harga di wilayah puncak → trailing (Chandelier). Momentum meluruh
  perlahan (Jegadeesh & Titman 1993), jadi target tetap memotong sisa tren.
- Tren naik tapi resistance masih di atas → target resistance + ATR. Puncak lama
  adalah jangkar harga (George & Hwang 2004).
- Sideways / tren tidak jelas → target ATR atau R tetap. Tidak ada tren untuk
  di-trailing; yang realistis adalah memanen ayunan harga.
- Tren turun → fokus batasi rugi, bukan pasang target untung.

Stop loss memakai ATR-multiple (Wilder 1978) sebagai basis, dengan lebar yang
menyesuaikan volatilitas: saham bergejolak butuh stop lebih lebar agar tidak
tercekik noise harian, dan konsekuensinya ukuran posisi harus lebih kecil —
prinsip position sizing berbasis volatilitas yang sama dengan R-multiple Tharp.
"""
from __future__ import annotations

import pandas as pd
from ta.volatility import AverageTrueRange

# Kelipatan ATR untuk target. 1.5× = target konservatif (sering kena), 3× =
# agresif. 2× dipakai sebagai "utama" karena sebanding dengan stop 1×ATR pada
# rasio R/R 2:1 yang jadi acuan umum.
_ATR_MULTIPLES = (1.5, 2.0, 3.0)
_ATR_PERIOD = 14

# Chandelier Exit: parameter asli Le Beau (22 hari ≈ 1 bulan bursa, 3×ATR).
_CHANDELIER_PERIOD = 22
_CHANDELIER_MULT = 3.0

# Stop default untuk hitungan R-multiple bila user tidak punya stop sendiri:
# 1×ATR di bawah harga sekarang (Wilder). Target = n×R di atas entry.
_R_MULTIPLES = (1.0, 2.0, 3.0)


def _atr(df: pd.DataFrame, period: int) -> float | None:
    """ATR terakhir, atau None kalau riwayat terlalu pendek."""
    if len(df) <= period or not {"High", "Low", "Close"} <= set(df.columns):
        return None
    series = AverageTrueRange(
        df["High"].astype(float), df["Low"].astype(float), df["Close"].astype(float), window=period
    ).average_true_range()
    val = float(series.iloc[-1])
    return val if val > 0 else None


def _resistance(df: pd.DataFrame, now: float) -> list[dict]:
    """Level struktural di ATAS harga sekarang: puncak 52 minggu & 3 bulan.

    Hanya level yang belum ditembus yang berguna sebagai target; kalau harga
    sudah di atas puncak 52 minggu, level itu berubah jadi support dan kita
    lewati (dengan catatan di UI lewat `note`).
    """
    if "High" not in df:
        return []
    high = df["High"].astype(float)
    out: list[dict] = []
    for label, window, why in (
        (
            "Puncak 3 bulan",
            63,
            "Puncak terdekat yang masih diingat pasar — sering jadi tempat harga tertahan pertama kali.",
        ),
        (
            "Puncak 52 minggu",
            252,
            "Riset George & Hwang (2004) menemukan puncak 52 minggu dipakai investor sebagai 'jangkar' "
            "harga, sehingga sering menahan laju kenaikan. Kalau tembus dengan volume, justru sering lanjut naik.",
        ),
    ):
        if len(high) < window // 2:  # riwayat terlalu pendek untuk window ini
            continue
        level = float(high.iloc[-min(len(high), window):].max())
        if level <= now:
            continue  # sudah ditembus — bukan target lagi
        # Saat puncak 3 bulan JUGA puncak 52 minggu (harga baru saja mencetak
        # tertinggi), keduanya menunjuk level sama — tampilkan sekali saja,
        # dengan label jangka terpanjang yang berlaku.
        if out and abs(out[-1]["price"] - level) < 1e-9:
            out[-1] = {"label": label, "price": level, "why": why}
            continue
        out.append({"label": label, "price": level, "why": why})
    return out


def _pct(target: float, base: float) -> float:
    return round((target / base - 1.0) * 100, 2)


# --- Diagnosa kondisi emiten ------------------------------------------------
# Volatilitas dinilai dari ATR% (ATR ÷ harga). Ambang ini kalibrasi praktis untuk
# saham likuid: <1.5%/hari tenang, >3.5%/hari bergejolak.
_VOL_CALM = 1.5
_VOL_WILD = 3.5


def _condition(df: pd.DataFrame, now: float, atr: float | None) -> dict:
    """Baca kondisi emiten: arah tren, posisi terhadap puncak, volatilitas.

    Tren dinilai dari susunan EMA20/EMA50 dan posisi harga terhadapnya — cara
    baca tren yang sama dipakai panel Pola, jadi diagnosanya konsisten dengan
    apa yang user lihat di grafik.
    """
    close = df["Close"].astype(float)
    n = len(close)

    ema20 = float(close.ewm(span=20, adjust=False).mean().iloc[-1]) if n >= 20 else None
    ema50 = float(close.ewm(span=50, adjust=False).mean().iloc[-1]) if n >= 50 else None

    if ema20 is None or ema50 is None:
        trend = "unknown"
    elif now > ema20 > ema50:
        trend = "uptrend"          # susunan penuh: harga > cepat > lambat
    elif now < ema20 < ema50:
        trend = "downtrend"
    elif now > ema50:
        trend = "sideways_up"      # di atas tren panjang tapi susunan belum rapi
    else:
        trend = "sideways_down"

    # Posisi terhadap puncak 52 minggu (dipakai untuk memilih trailing vs target).
    near_high = False
    at_new_high = False
    if "High" in df and n >= 126:
        high = df["High"].astype(float)
        hi52 = float(high.iloc[-min(n, 252):].max())
        if hi52 > 0:
            near_high = now / hi52 >= 0.95
            at_new_high = now >= hi52 * 0.999

    atr_pct = (atr / now * 100) if atr else None
    if atr_pct is None:
        vol = "unknown"
    elif atr_pct < _VOL_CALM:
        vol = "calm"
    elif atr_pct > _VOL_WILD:
        vol = "wild"
    else:
        vol = "normal"

    return {
        "trend": trend,
        "near_high": near_high,
        "at_new_high": at_new_high,
        "vol": vol,
        "atr_pct": round(atr_pct, 2) if atr_pct else None,
    }


# Label kondisi untuk UI (satu kalimat, bahasa awam).
_TREND_TEXT = {
    "uptrend": "Tren naik — harga di atas EMA20 dan EMA20 di atas EMA50 (susunan tren naik yang rapi).",
    "downtrend": "Tren turun — harga di bawah EMA20 dan EMA20 di bawah EMA50.",
    "sideways_up": "Menyamping condong naik — masih di atas tren jangka menengah, tapi arah pendeknya belum rapi.",
    "sideways_down": "Menyamping condong turun — harga di bawah tren jangka menengah.",
    "unknown": "Arah tren belum bisa dinilai (riwayat harga terlalu pendek).",
}

_VOL_TEXT = {
    "calm": "Volatilitas rendah — pergerakan harian kecil, target & stop bisa lebih rapat.",
    "normal": "Volatilitas sedang.",
    "wild": "Volatilitas tinggi — harga sering berayun lebar; stop yang terlalu rapat akan mudah tersentuh oleh noise.",
    "unknown": "Volatilitas belum bisa dinilai.",
}


def _pick_method(cond: dict, has_resistance: bool, trailing_ok: bool) -> dict:
    """Pilih metode take profit yang paling cocok untuk kondisi ini.

    Mengembalikan key metode yang disarankan + alasannya. Bukan satu-satunya
    jawaban benar — UI menampilkannya sebagai 'paling cocok', metode lain tetap
    terlihat agar user bisa memilih sendiri.
    """
    trend, vol = cond["trend"], cond["vol"]

    if trend == "downtrend":
        return {
            "key": "stop",
            "label": "Fokus batasi rugi, bukan pasang target",
            "why": (
                "Tren sedang turun. Memasang target untung di tren turun berarti berharap harga "
                "melawan arahnya sendiri. Yang relevan sekarang adalah menentukan batas rugi dan "
                "menaatinya — target bisa dipasang lagi setelah tren berbalik."
            ),
            "reference": "Jegadeesh & Titman (1993) — harga cenderung melanjutkan arah, termasuk arah turun",
        }

    if trend == "uptrend" and (cond["at_new_high"] or not has_resistance) and trailing_ok:
        return {
            "key": "trailing",
            "label": "Trailing stop (Chandelier Exit)",
            "why": (
                "Harga sedang di wilayah puncaknya sendiri dalam tren naik — tidak ada resistance di "
                "atas yang bisa dijadikan target. Memasang angka tetap di sini justru memotong tren "
                "yang masih berjalan; momentum meluruh perlahan, bukan berhenti mendadak "
                "(Jegadeesh & Titman 1993). Biarkan naik, dan keluar saat harga mundur lebih jauh "
                "dari gejolak normalnya."
            ),
            "reference": "Le Beau — Chandelier Exit; Jegadeesh & Titman (1993), Journal of Finance 48(1)",
        }

    if trend in ("uptrend", "sideways_up") and has_resistance:
        return {
            "key": "resistance",
            "label": "Target resistance (dikombinasi ATR)",
            "why": (
                "Tren masih condong naik dan masih ada puncak lama di atas yang belum tertembus. "
                "Puncak itu bukan sekadar garis: George & Hwang (2004) menunjukkan investor "
                "memakainya sebagai titik acuan, sehingga harga sering tertahan di sana. Pakai level "
                "itu sebagai target utama, dan target ATR sebagai target antara."
            ),
            "reference": "George & Hwang (2004), Journal of Finance 59(5):2145-2176",
        }

    if vol == "wild":
        return {
            "key": "atr",
            "label": "Target volatilitas (ATR)",
            "why": (
                "Sahamnya bergejolak lebar, jadi target berbasis persentase bulat akan meleset — "
                "terlalu dekat sampai kena karena noise, atau terlalu jauh sampai tak pernah "
                "tersentuh. ATR menyesuaikan jarak target dengan ayunan wajar saham ini sendiri."
            ),
            "reference": "Wilder, J.W. (1978), New Concepts in Technical Trading Systems",
        }

    return {
        "key": "rr",
        "label": "Target Risk/Reward tetap (R-multiple)",
        "why": (
            "Arah tren belum tegas, jadi tidak ada tren kuat untuk di-trailing maupun struktur "
            "harga yang meyakinkan. Di kondisi seperti ini yang paling bisa dikendalikan adalah "
            "rasio: pastikan target minimal 2× jarak risikomu, sehingga hasil jangka panjang tetap "
            "positif walau tidak selalu benar."
        ),
        "reference": "Tharp, V.K. (1998), Trade Your Way to Financial Freedom",
    }


# Kelipatan ATR untuk stop loss menurut volatilitas. Saham tenang boleh stop
# lebih rapat; saham bergejolak butuh ruang agar tidak tercekik ayunan harian.
_STOP_MULT = {"calm": 1.5, "normal": 2.0, "wild": 2.5, "unknown": 2.0}


def _stop_advice(cond: dict, now: float, entry: float, atr: float | None,
                 trailing: dict, has_position: bool) -> dict:
    """Saran stop loss yang menyesuaikan kondisi & volatilitas emiten."""
    if atr is None:
        return {
            "enough_data": False, "price": None, "pct_from_now": None, "pct_from_entry": None,
            "method": "", "summary": "Belum cukup data harga untuk menyusun batas rugi.",
            "why": "", "reference": "", "risk_note": "",
        }

    mult = _STOP_MULT[cond["vol"]]

    # Di tren naik yang sehat, trailing stop adalah stop yang lebih baik daripada
    # angka tetap: ia mengunci sebagian untung saat harga naik. Pakai yang lebih
    # TINGGI antara Chandelier dan stop ATR, selama masih di bawah harga.
    use_trailing = (
        cond["trend"] == "uptrend"
        and trailing.get("enough_data")
        and not trailing.get("triggered")
        and trailing.get("price") is not None
    )
    atr_stop = now - mult * atr
    if use_trailing and trailing["price"] > atr_stop:
        price = float(trailing["price"])
        method = "Chandelier Exit (trailing stop)"
        summary = (
            f"Pasang batas rugi di {round(price, 4)} dan NAIKKAN mengikuti harga — jangan pernah "
            "diturunkan. Di tren naik, stop yang ikut bergerak mengunci sebagian untung tanpa "
            "memaksa kamu menebak puncaknya."
        )
        why = (
            "Stop tetap di tren naik punya cacat: kalau dipasang dekat, kena oleh koreksi biasa; "
            "kalau jauh, untung yang sudah ada ikut hilang saat berbalik. Trailing stop menyelesaikan "
            "keduanya — ia hanya bergerak satu arah, mengikuti puncak tertinggi dikurangi 3× ATR."
        )
        reference = "Le Beau, C. — Chandelier Exit"
    else:
        price = atr_stop
        method = f"{mult:g}× ATR di bawah harga"
        summary = (
            f"Pasang batas rugi di {round(price, 4)} — yaitu {mult:g}× pergerakan harian wajar "
            f"({cond['atr_pct']}%/hari) di bawah harga sekarang."
        )
        why = (
            "Wilder (1978) merancang ATR justru untuk ini: jarak stop harus diukur dari gejolak "
            "asli saham, bukan dari angka bulat atau dari seberapa besar kamu sanggup rugi. Stop "
            f"yang lebih rapat dari {mult:g}× ATR pada saham dengan volatilitas seperti ini akan "
            "tersentuh oleh pergerakan acak, bukan oleh perubahan tren yang sebenarnya."
        )
        reference = "Wilder, J.W. (1978), New Concepts in Technical Trading Systems"

    # Position sizing: konsekuensi langsung dari lebar stop. Ini bagian yang
    # paling sering dilewatkan pemula — stop lebar TANPA memperkecil lot berarti
    # menambah risiko, bukan mengurangi.
    risk_per_share = max(now - price, 0.0)
    risk_pct = round(risk_per_share / now * 100, 2) if now else None
    risk_note = (
        f"Dengan stop ini kamu mempertaruhkan sekitar {risk_pct}% per lembar. Aturan umum manajemen "
        "risiko: satu posisi tidak menanggung lebih dari 1–2% total modal. Jadi kalau stop-nya lebar, "
        "yang dikecilkan adalah JUMLAH LOT — bukan stop-nya yang dirapatkan."
    )

    # Peringatan khusus posisi yang sudah rugi: stop di bawah harga sekarang bisa
    # jadi masih di atas/di bawah harga beli — user perlu tahu artinya.
    if has_position and entry > 0 and price >= entry:
        risk_note += (
            f" Kabar baik: batas rugi ini ({round(price, 4)}) sudah DI ATAS harga belimu "
            f"({round(entry, 4)}) — kalau tersentuh, kamu keluar tetap untung."
        )

    return {
        "enough_data": True,
        "price": round(price, 4),
        "pct_from_now": _pct(price, now),
        "pct_from_entry": _pct(price, entry) if has_position else None,
        "method": method,
        "summary": summary,
        "why": why,
        "reference": reference,
        "risk_note": risk_note,
    }


def compute(df: pd.DataFrame, buy_price: float | None = None, stop_price: float | None = None) -> dict:
    """Susun semua target take profit dari OHLCV harian.

    `buy_price` = harga beli rata-rata user (dari portofolio). Kalau ada, semua
    target juga dilaporkan sebagai % terhadap modal, dan R-multiple dihitung
    dari entry itu — bukan dari harga sekarang. `stop_price` = batas rugi milik
    user; kalau kosong, dipakai stop 1×ATR di bawah entry (Wilder).
    """
    close = df["Close"].astype(float)
    now = float(close.iloc[-1])
    atr = _atr(df, _ATR_PERIOD)
    # Basis perhitungan: harga beli user kalau punya posisi, selain itu harga
    # sekarang (calon entry). Ini yang membuat target relevan untuk dua kasus:
    # "saya sudah pegang" dan "kalau saya masuk sekarang".
    entry = buy_price if buy_price and buy_price > 0 else now

    # Posisi rugi dalam: memproyeksikan target dari harga beli akan menghasilkan
    # angka jauh di atas harga sekarang (mis. beli 9000, kini 6425 → target
    # 9300). Itu bukan rencana take profit, itu "menunggu balik modal" — bias
    # disposition effect (Shefrin & Statman 1985) yang justru memperbesar rugi.
    # Di kondisi ini target dihitung dari harga SEKARANG, dan UI diberi tahu.
    underwater = bool(buy_price and atr and (entry - now) > 2 * atr)
    if underwater:
        entry = now

    # Kebalikannya: posisi yang sudah untung besar. Kalau harga sudah jauh di
    # atas harga beli, "entry + 2×ATR" jatuh DI BAWAH harga sekarang — angka itu
    # bukan target, itu sejarah (mis. NVDA beli 80, kini 219 → 'target' 95).
    # Target take profit selalu soal ke mana harga akan pergi, jadi dihitung dari
    # harga sekarang. Untung yang sudah ada tetap dilaporkan lewat pnl & entry.
    ahead = bool(buy_price and atr and (now - entry) > 2 * atr)
    if ahead:
        entry = now

    # Harga beli asli tetap dipakai untuk melaporkan "berapa % dari modalmu",
    # meski basis perhitungan target sudah dipindah ke harga sekarang.
    cost = buy_price if buy_price and buy_price > 0 else None

    methods: list[dict] = []

    # --- 1. Target berbasis ATR -------------------------------------------
    if atr is not None:
        atr_pct = round(atr / now * 100, 2)
        targets = [
            {
                "label": f"{m:g}× ATR",
                "price": round(entry + m * atr, 4),
                "pct_from_now": _pct(entry + m * atr, now),
                "pct_from_entry": _pct(entry + m * atr, cost) if cost else None,
                "emphasis": m == 2.0,  # 2×ATR = target utama (R/R 2:1 vs stop 1×ATR)
            }
            for m in _ATR_MULTIPLES
        ]
        methods.append({
            "key": "atr",
            "label": "Target Volatilitas (ATR)",
            "summary": (
                f"Saham ini rata-rata bergerak {atr_pct}% per hari (ATR-{_ATR_PERIOD}). "
                f"Target dipatok sebagai kelipatan pergerakan wajar itu, bukan angka bulat."
            ),
            "why": (
                "Wilder (1978) memperkenalkan ATR agar jarak target/stop menyesuaikan volatilitas "
                "asli tiap saham. Target 10% masuk akal untuk saham bergejolak, tapi terlalu jauh "
                "untuk saham tenang — ATR membuat jaraknya sebanding."
            ),
            "reference": "Wilder, J.W. (1978), New Concepts in Technical Trading Systems",
            "targets": targets,
            "enough_data": True,
        })
    else:
        methods.append({
            "key": "atr", "label": "Target Volatilitas (ATR)",
            "summary": "Belum cukup data harga untuk menghitung ATR.",
            "why": "", "reference": "", "targets": [], "enough_data": False,
        })

    # --- 2. Risk/Reward (R-multiple) --------------------------------------
    # R = jarak entry → stop. Stop user kalau ada; selain itu 1×ATR di bawah entry.
    stop = stop_price if stop_price and 0 < stop_price < entry else (entry - atr if atr else None)
    if stop is not None and stop < entry:
        risk = entry - stop
        targets = [
            {
                "label": f"{m:g}R",
                "price": round(entry + m * risk, 4),
                "pct_from_now": _pct(entry + m * risk, now),
                "pct_from_entry": _pct(entry + m * risk, cost) if cost else None,
                "emphasis": m == 2.0,
            }
            for m in _R_MULTIPLES
        ]
        methods.append({
            "key": "rr",
            "label": "Target Risk/Reward (R)",
            "summary": (
                f"Batas rugi ada di {round(stop, 4)}, jadi 1R = {round(risk, 4)} per lembar. "
                f"Target 2R berarti untung dua kali lipat dari yang kamu pertaruhkan."
            ),
            "why": (
                "Kerangka R-multiple (Van Tharp): tentukan dulu berapa yang siap kamu rugikan, "
                "baru target. Dengan target 2R kamu tetap untung meski hanya benar 40% dari waktu — "
                "itulah kenapa rasio ini lebih menentukan hasil jangka panjang daripada win-rate."
            ),
            "reference": "Tharp, V.K. (1998), Trade Your Way to Financial Freedom",
            "targets": targets,
            "enough_data": True,
        })
    else:
        methods.append({
            "key": "rr", "label": "Target Risk/Reward (R)",
            "summary": "Belum bisa dihitung — butuh ATR atau batas rugi (stop) yang lebih rendah dari harga beli.",
            "why": "", "reference": "", "targets": [], "enough_data": False,
        })

    # --- 3. Resistance / puncak 52 minggu ---------------------------------
    levels = _resistance(df, now)
    if levels:
        methods.append({
            "key": "resistance",
            "label": "Target Struktur Harga (Resistance)",
            "summary": "Harga puncak sebelumnya yang belum tertembus — tempat penjual biasanya menunggu.",
            "why": (
                "Berbeda dari dua metode di atas yang berbasis rumus, ini memakai jejak harga nyata. "
                "George & Hwang (2004, Journal of Finance) menunjukkan puncak 52 minggu bukan sekadar "
                "garis di grafik: investor menjadikannya titik acuan, sehingga perilaku harga di "
                "sekitarnya berubah."
            ),
            "reference": "George & Hwang (2004), The 52-Week High and Momentum Investing, Journal of Finance 59(5)",
            "targets": [
                {
                    "label": lv["label"],
                    "price": round(lv["price"], 4),
                    "pct_from_now": _pct(lv["price"], now),
                    "pct_from_entry": _pct(lv["price"], cost) if cost else None,
                    "emphasis": lv["label"] == "Puncak 52 minggu",
                    "note": lv["why"],
                }
                for lv in levels
            ],
            "enough_data": True,
        })
    else:
        methods.append({
            "key": "resistance", "label": "Target Struktur Harga (Resistance)",
            "summary": (
                "Harga sedang berada di atas semua puncak sebelumnya — tidak ada resistance tersisa "
                "sebagai target. Di kondisi ini trailing stop lebih cocok daripada target tetap."
            ),
            "why": "", "reference": "", "targets": [], "enough_data": False,
        })

    # --- 4. Chandelier Exit (trailing) ------------------------------------
    ch_atr = _atr(df, _CHANDELIER_PERIOD)
    trailing = None
    if ch_atr is not None and "High" in df and len(df) >= _CHANDELIER_PERIOD:
        hh = float(df["High"].astype(float).iloc[-_CHANDELIER_PERIOD:].max())
        level = hh - _CHANDELIER_MULT * ch_atr
        # Saat harga sudah mundur lebih dari 3×ATR dari puncak 22 hari, level
        # Chandelier jatuh DI ATAS harga sekarang — artinya trailing stop sudah
        # tersentuh, bukan target yang menunggu di bawah. Menampilkannya apa
        # adanya akan terbaca sebagai "jual di harga lebih tinggi dari sekarang".
        triggered = level >= now
        trailing = {
            "enough_data": True,
            "triggered": triggered,
            "price": round(level, 4),
            "highest_high": round(hh, 4),
            "atr": round(ch_atr, 4),
            "pct_from_now": _pct(level, now),
            "label": "Chandelier Exit (trailing)",
            "summary": (
                (
                    f"⚠️ Trailing stop sudah TERLEWATI: harga sekarang ({round(now, 4)}) berada di bawah "
                    f"level {round(level, 4)}, yaitu {_CHANDELIER_MULT:g}× ATR di bawah puncak "
                    f"{_CHANDELIER_PERIOD} hari ({round(hh, 4)}). Menurut metode ini tren naiknya sudah "
                    "patah — yang relevan sekarang membatasi rugi, bukan memasang target untung."
                )
                if triggered
                else (
                    f"Jual kalau harga turun ke {round(level, 4)} — yaitu {_CHANDELIER_MULT:g}× ATR di bawah "
                    f"puncak {_CHANDELIER_PERIOD} hari terakhir ({round(hh, 4)}). Angka ini IKUT NAIK saat harga "
                    "membuat puncak baru, dan tidak pernah turun."
                )
            ),
            "why": (
                "Bukan target tetap, tapi cara membiarkan untung berjalan. Momentum meluruh perlahan, "
                "bukan berhenti mendadak (Jegadeesh & Titman 1993), jadi menjual di target tetap sering "
                "memotong sisa tren. Chandelier Exit (Chuck Le Beau) menahan posisi selama tren utuh dan "
                "baru keluar saat harga mundur lebih jauh dari gejolak normalnya."
            ),
            "reference": "Le Beau, C. — Chandelier Exit; Jegadeesh & Titman (1993), Journal of Finance 48(1)",
        }
    else:
        trailing = {
            "enough_data": False, "triggered": False, "price": None, "highest_high": None, "atr": None,
            "pct_from_now": None, "label": "Chandelier Exit (trailing)",
            "summary": "Belum cukup data harga untuk menghitung trailing stop.",
            "why": "", "reference": "",
        }

    # --- Rencana jual bertahap (scaling out) ------------------------------
    # Gabungkan target konservatif + utama dari ATR dengan trailing untuk sisanya.
    plan: list[dict] = []
    atr_targets = next((m["targets"] for m in methods if m["key"] == "atr" and m["enough_data"]), [])
    if atr_targets:
        plan = [
            {
                "portion": "1/3 pertama",
                "price": atr_targets[0]["price"],
                "pct_from_now": atr_targets[0]["pct_from_now"],
                "note": "Amankan modal lebih dulu di target terdekat (1.5× ATR). Sisa posisi jadi 'gratis' secara psikologis.",
            },
            {
                "portion": "1/3 kedua",
                "price": atr_targets[1]["price"],
                "pct_from_now": atr_targets[1]["pct_from_now"],
                "note": "Target utama (2× ATR) — setara rasio untung:rugi 2:1 terhadap stop 1× ATR.",
            },
            {
                "portion": "1/3 sisa",
                "price": trailing["price"] if trailing["enough_data"] and not trailing["triggered"] else None,
                "pct_from_now": trailing["pct_from_now"] if trailing["enough_data"] and not trailing["triggered"] else None,
                "note": (
                    "Trailing stop sudah terlewati — tren naik yang mau 'dibiarkan berjalan' tidak ada "
                    "lagi. Tinjau ulang posisinya, jangan tambah target."
                    if trailing["enough_data"] and trailing["triggered"]
                    else "Jangan dipatok target — pakai trailing stop (Chandelier) agar ikut naik selama tren masih hidup."
                ),
            },
        ]

    # Headline: satu kalimat yang menjawab "jadi saya jual di berapa?".
    main = next((t for m in methods if m["enough_data"] for t in m["targets"] if t.get("emphasis")), None)
    if main is None:
        headline = "Belum cukup data harga untuk menyusun target take profit."
    elif underwater:
        headline = (
            f"Posisimu sedang rugi cukup dalam (beli {round(buy_price, 4)}, kini {round(now, 4)}). "
            f"Target dihitung dari harga SEKARANG, bukan dari harga belimu: {main['price']} "
            f"({main['pct_from_now']:+.2f}%). Menahan hanya demi 'balik modal' adalah keputusan "
            "yang perlu alasan tersendiri."
        )
    elif ahead:
        gain_now = _pct(now, cost) if cost else 0.0
        headline = (
            f"Posisimu sudah untung besar ({gain_now:+.2f}% dari harga beli {round(cost, 4)}). "
            f"Target berikutnya dihitung dari harga sekarang: {main['price']} "
            f"({main['pct_from_now']:+.2f}%). Yang lebih mendesak di posisi seperti ini adalah "
            "menaikkan batas rugi agar untung yang sudah ada tidak balik lagi."
        )
    elif buy_price:
        gain = _pct(main["price"], cost or entry)
        headline = (
            f"Target utama di {main['price']} — sekitar {gain:+.2f}% dari harga belimu, "
            f"{main['pct_from_now']:+.2f}% dari harga sekarang."
        )
    else:
        headline = (
            f"Kalau masuk di harga sekarang, target utama ada di {main['price']} "
            f"({main['pct_from_now']:+.2f}%)."
        )

    # --- Diagnosa kondisi → metode yang cocok + saran stop loss -----------
    cond = _condition(df, now, atr)
    has_res = any(m["key"] == "resistance" and m["enough_data"] for m in methods)
    recommended = _pick_method(cond, has_res, bool(trailing["enough_data"] and not trailing["triggered"]))
    condition = {
        "trend": cond["trend"],
        "trend_text": _TREND_TEXT[cond["trend"]],
        "vol": cond["vol"],
        "vol_text": _VOL_TEXT[cond["vol"]],
        "near_high": cond["near_high"],
        "at_new_high": cond["at_new_high"],
        "recommended": recommended["key"],
        "recommended_label": recommended["label"],
        "recommended_why": recommended["why"],
        "recommended_reference": recommended["reference"],
    }
    # Pakai harga beli ASLI (bukan `entry` yang mungkin sudah dipindah ke harga
    # sekarang): pesan "stop-mu sudah di atas modal, keluar tetap untung" hanya
    # bermakna kalau dibandingkan dengan modal sebenarnya.
    stop_advice = _stop_advice(cond, now, cost or now, atr, trailing, bool(buy_price))

    return {
        "price": round(now, 4),
        "entry": round(entry, 4),
        "has_position": bool(buy_price),
        "underwater": underwater,
        "ahead": ahead,
        "cost": round(cost, 4) if cost else None,
        "condition": condition,
        "stop_advice": stop_advice,
        "atr": round(atr, 4) if atr else None,
        "atr_pct": round(atr / now * 100, 2) if atr else None,
        "stop": round(stop, 4) if stop else None,
        "methods": methods,
        "trailing": trailing,
        "plan": plan,
        "headline": headline,
        "disclaimer": (
            "Target ini hitungan matematis dari data harga, BUKAN ramalan dan BUKAN ajakan jual/beli. "
            "Tidak ada metode yang benar terus — gunanya adalah membuatmu memutuskan titik keluar "
            "SEBELUM emosi ikut bermain."
        ),
    }


# --- Penyaringan portofolio: siapa yang perlu take profit? ------------------
# Urgensi dinilai dari gabungan sinyal, bukan satu angka. Bobotnya disusun agar
# yang naik ke atas adalah posisi yang SUDAH untung DAN mulai kehilangan alasan
# untuk ditahan — bukan sekadar yang untungnya paling besar.
def screen(rows: list[dict]) -> list[dict]:
    """Peringkat kandidat take profit dari beberapa hasil `compute()`.

    `rows` = daftar {"sym", "result" (hasil compute), "pnl_pct" (untung/rugi %)}.
    Mengembalikan daftar terurut dari yang paling perlu ditinjau.
    """
    out: list[dict] = []
    for row in rows:
        r, sym = row["result"], row["sym"]
        pnl = row.get("pnl_pct")
        cond, tr = r["condition"], r["trailing"]
        score = 0.0
        reasons: list[str] = []

        # Sudah untung: syarat dasar — tanpa untung, ini bukan take profit.
        if pnl is not None and pnl > 0:
            score += min(pnl / 10.0, 3.0)  # dibatasi agar untung besar tak mendominasi
            reasons.append(f"sudah untung {pnl:+.1f}%")

        # Trailing stop tersentuh = tren naik patah. Sinyal terkuat.
        if tr.get("enough_data") and tr.get("triggered"):
            score += 3.0
            reasons.append("trailing stop sudah terlewati (tren naik patah)")

        # Tren berbalik turun sementara posisi untung → alasan kuat mengamankan.
        if cond["trend"] == "downtrend":
            score += 2.5
            reasons.append("tren berbalik turun")
        elif cond["trend"] in ("sideways_down",):
            score += 1.0
            reasons.append("tren melemah")

        # Harga sudah menyentuh/melewati target utama → tujuan tercapai.
        main = next((t for m in r["methods"] if m["enough_data"] for t in m["targets"] if t.get("emphasis")), None)
        if main is not None and r["price"] >= main["price"]:
            score += 2.0
            reasons.append(f"harga sudah mencapai target utama ({main['label']})")
        elif main is not None and main["pct_from_now"] <= 2.0:
            score += 1.0
            reasons.append("harga sudah dekat target utama")

        # Volatilitas tinggi + untung besar: untung mudah menguap.
        if cond["vol"] == "wild" and pnl is not None and pnl > 15:
            score += 0.5
            reasons.append("volatilitas tinggi — untung mudah menguap")

        # Dekat puncak 52 minggu dalam tren naik = justru alasan MENAHAN
        # (George & Hwang 2004), bukan menjual. Kurangi urgensinya.
        if cond["trend"] == "uptrend" and cond["near_high"] and not (tr.get("triggered")):
            score -= 1.5
            reasons.append("tapi masih tren naik di dekat puncak — riset mendukung menahan")

        if pnl is not None and pnl < 0:
            # Posisi rugi bukan kandidat take profit; ini urusan stop loss.
            score = min(score, 0.0)

        if score >= 3.0:
            urgency, label = "high", "🔴 Pertimbangkan amankan untung"
        elif score >= 1.5:
            urgency, label = "medium", "🟠 Layak ditinjau"
        else:
            urgency, label = "low", "🟢 Belum perlu"

        out.append({
            "sym": sym,
            "score": round(score, 2),
            "urgency": urgency,
            "label": label,
            "pnl_pct": round(pnl, 2) if pnl is not None else None,
            "price": r["price"],
            "reasons": reasons,
            "recommended": cond["recommended"],
            "recommended_label": cond["recommended_label"],
            "target": main["price"] if main else None,
            "target_label": main["label"] if main else None,
            "stop": r["stop_advice"]["price"],
            "trend": cond["trend"],
        })

    out.sort(key=lambda x: (-x["score"], x["sym"]))
    return out


def demo() -> None:
    """Self-check di tren naik sintetis dengan volatilitas yang diketahui."""
    import numpy as np

    idx = pd.date_range("2024-01-01", periods=300, freq="D", tz="UTC")
    close = pd.Series(np.linspace(100, 200, 300), index=idx)
    df = pd.DataFrame(
        {
            "Open": close * 0.99,
            "High": close * 1.02,
            "Low": close * 0.98,
            "Close": close,
            "Volume": np.full(300, 1000.0),
        },
        index=idx,
    )

    out = compute(df)
    assert out["atr"] is not None and out["atr"] > 0, out["atr"]
    atr_m = next(m for m in out["methods"] if m["key"] == "atr")
    assert atr_m["enough_data"] and len(atr_m["targets"]) == 3, atr_m
    # Target harus menaik seiring kelipatan ATR.
    prices = [t["price"] for t in atr_m["targets"]]
    assert prices == sorted(prices), prices
    # Tanpa posisi, semua target di atas harga sekarang.
    assert all(t["pct_from_now"] > 0 for t in atr_m["targets"]), atr_m["targets"]

    # Tren naik mulus: High (=Close×1.02) masih di atas close terakhir, jadi
    # resistance memang tersisa — tapi kedua window menunjuk level yang SAMA,
    # dan itu harus dilaporkan sebagai satu baris, bukan dua yang identik.
    res = next(m for m in out["methods"] if m["key"] == "resistance")
    assert res["enough_data"] and len(res["targets"]) == 1, res["targets"]
    assert res["targets"][0]["label"] == "Puncak 52 minggu", res["targets"]

    # Trailing stop harus di BAWAH harga sekarang, dan di bawah puncak 22 hari.
    tr = out["trailing"]
    assert tr["enough_data"] and tr["price"] < out["price"] < tr["highest_high"] * 1.001, tr

    # Dengan harga beli yang masih dekat harga sekarang (untung wajar, < 2×ATR),
    # target dihitung dari entry itu — bukan dari harga sekarang.
    held = compute(df, buy_price=199.0)
    atr_held = next(m for m in held["methods"] if m["key"] == "atr")
    assert held["ahead"] is False and held["entry"] == 199.0, held["entry"]
    assert all(t["price"] > 199.0 for t in atr_held["targets"]), atr_held["targets"]
    assert all(t["pct_from_entry"] is not None for t in atr_held["targets"]), atr_held["targets"]

    # Stop milik user menggantikan stop 1×ATR pada hitungan R.
    with_stop = compute(df, buy_price=199.0, stop_price=189.0)
    rr = next(m for m in with_stop["methods"] if m["key"] == "rr")
    assert with_stop["stop"] == 189.0, with_stop["stop"]
    assert rr["targets"][0]["price"] == 209.0, rr["targets"]  # 1R = 10 → 199+10
    assert rr["targets"][1]["price"] == 219.0, rr["targets"]  # 2R

    # Rencana bertahap terisi 3 tahap.
    assert len(with_stop["plan"]) == 3, with_stop["plan"]

    # Harga menembus semua puncak (High = Close) → tidak ada resistance tersisa,
    # dan UI harus diarahkan ke trailing stop, bukan target tetap.
    flat_high = df.assign(High=df["Close"], Low=df["Close"] * 0.98)
    res_none = next(m for m in compute(flat_high)["methods"] if m["key"] == "resistance")
    assert res_none["enough_data"] is False and not res_none["targets"], res_none

    # Harga yang sedang koreksi dari puncak → resistance tersisa jadi target.
    pull = df.copy()
    pull.iloc[-30:, pull.columns.get_loc("Close")] = np.linspace(200, 170, 30)
    pull.iloc[-30:, pull.columns.get_loc("High")] = np.linspace(202, 172, 30)
    res2 = next(m for m in compute(pull)["methods"] if m["key"] == "resistance")
    assert res2["enough_data"] and res2["targets"], res2

    # Trailing stop tidak pernah dilaporkan sebagai target di ATAS harga: saat
    # harga jatuh jauh dari puncak 22 hari, level Chandelier ada di atas harga
    # dan harus ditandai `triggered` (regresi nyata: AAPL 311 vs level 317.76).
    crash = df.copy()
    crash.iloc[-12:, crash.columns.get_loc("Close")] = np.linspace(200, 150, 12)
    crash.iloc[-12:, crash.columns.get_loc("High")] = np.linspace(202, 152, 12)
    crash.iloc[-12:, crash.columns.get_loc("Low")] = np.linspace(198, 148, 12)
    tr_c = compute(crash)["trailing"]
    assert tr_c["enough_data"] and tr_c["triggered"] is True, tr_c
    assert tr_c["price"] > compute(crash)["price"], tr_c
    # Tahap ketiga rencana tidak boleh menyarankan trailing yang sudah terlewati.
    assert compute(crash)["plan"][2]["price"] is None, compute(crash)["plan"]
    # Sebaliknya, tren sehat: trailing di bawah harga & tidak triggered.
    assert out["trailing"]["triggered"] is False, out["trailing"]

    # Posisi rugi dalam (>2×ATR): target TIDAK boleh diproyeksikan dari harga
    # beli — kalau tidak, hasilnya "tunggu balik modal" (regresi nyata: BBCA
    # beli 9000, harga 6425 → target 9328 / +45% dari harga sekarang).
    deep = compute(df, buy_price=400.0)  # harga terakhir 200 → rugi sangat dalam
    assert deep["underwater"] is True, deep
    assert deep["entry"] == deep["price"], (deep["entry"], deep["price"])
    atr_deep = next(m for m in deep["methods"] if m["key"] == "atr")
    # Semua target harus dekat harga sekarang, bukan melompat ke sekitar 400.
    assert all(t["price"] < 250.0 for t in atr_deep["targets"]), atr_deep["targets"]
    assert "balik modal" in deep["headline"], deep["headline"]
    # Rugi wajar (< 2×ATR) tetap memakai harga beli sebagai basis.
    mild = compute(df, buy_price=203.0)
    assert mild["underwater"] is False and mild["entry"] == 203.0, mild

    # Untung besar (>2×ATR): target TIDAK boleh jatuh di bawah harga sekarang —
    # itu sejarah, bukan target (regresi nyata: NVDA beli 80, kini 219, 'target'
    # 2×ATR keluar 95). Target harus dihitung ulang dari harga sekarang.
    won = compute(df, buy_price=100.0)  # harga terakhir 200 → untung ~100%
    assert won["ahead"] is True and won["cost"] == 100.0, won
    assert won["entry"] == won["price"], (won["entry"], won["price"])
    atr_won = next(m for m in won["methods"] if m["key"] == "atr")
    assert all(t["price"] > won["price"] for t in atr_won["targets"]), atr_won["targets"]
    # % dari modal tetap diukur dari harga beli asli, bukan dari harga sekarang.
    assert atr_won["targets"][0]["pct_from_entry"] > 100.0, atr_won["targets"][0]
    assert "untung besar" in won["headline"], won["headline"]

    # --- Diagnosa kondisi & saran stop ------------------------------------
    # Tren naik dengan resistance masih tersisa (High = Close×1.02, jadi close
    # terakhir belum menembus high tertinggi) → sarankan target resistance.
    assert out["condition"]["trend"] == "uptrend", out["condition"]
    assert out["condition"]["near_high"] is True, out["condition"]
    assert out["condition"]["at_new_high"] is False, out["condition"]
    assert out["condition"]["recommended"] == "resistance", out["condition"]

    # Harga benar-benar mencetak tertinggi baru (High = Close) → tidak ada
    # resistance tersisa, jadi trailing yang disarankan, bukan target tetap.
    nh = compute(flat_high)["condition"]
    assert nh["at_new_high"] is True, nh
    assert nh["recommended"] == "trailing", nh
    # Stop di tren naik memakai trailing dan wajib di bawah harga sekarang.
    sa = out["stop_advice"]
    assert sa["enough_data"] and sa["price"] < out["price"], sa
    assert "Chandelier" in sa["method"], sa["method"]
    assert "1–2%" in sa["risk_note"], sa["risk_note"]

    # Tren turun → jangan sarankan target untung, arahkan ke batas rugi.
    down_df = pd.DataFrame(
        {
            "Open": pd.Series(np.linspace(200, 100, 300), index=idx) * 1.01,
            "High": pd.Series(np.linspace(200, 100, 300), index=idx) * 1.02,
            "Low": pd.Series(np.linspace(200, 100, 300), index=idx) * 0.98,
            "Close": pd.Series(np.linspace(200, 100, 300), index=idx),
            "Volume": np.full(300, 1000.0),
        },
        index=idx,
    )
    dn = compute(down_df)
    assert dn["condition"]["trend"] == "downtrend", dn["condition"]
    assert dn["condition"]["recommended"] == "stop", dn["condition"]
    # Stop tren turun memakai ATR tetap, bukan trailing.
    assert "ATR" in dn["stop_advice"]["method"], dn["stop_advice"]["method"]

    # Koreksi dari puncak (resistance tersisa, tren belum patah) → metode
    # resistance yang disarankan, bukan trailing.
    rec_pull = compute(pull)["condition"]["recommended"]
    assert rec_pull in ("resistance", "rr", "stop"), rec_pull

    # Volatilitas menentukan lebar stop: saham bergejolak dapat stop lebih lebar
    # (kelipatan ATR lebih besar), bukan lebih rapat.
    wild = df.assign(High=df["Close"] * 1.06, Low=df["Close"] * 0.94)
    w_cond = compute(wild)["condition"]
    assert w_cond["vol"] == "wild", w_cond
    assert "tinggi" in w_cond["vol_text"], w_cond["vol_text"]

    # Stop di atas harga beli harus diberi tahu sebagai "keluar tetap untung".
    profit_pos = compute(df, buy_price=120.0)  # harga kini 200, stop jauh di atas 120
    assert "tetap untung" in profit_pos["stop_advice"]["risk_note"], profit_pos["stop_advice"]["risk_note"]

    # Riwayat pendek tidak boleh memalsukan target.
    short = df.iloc[:10]
    out_short = compute(short)
    assert out_short["atr"] is None, out_short["atr"]
    assert out_short["trailing"]["enough_data"] is False, out_short["trailing"]

    # --- Screening portofolio ---------------------------------------------
    # Posisi untung dengan tren patah (trailing terlewati) harus naik ke atas,
    # mengalahkan posisi untung yang trennya masih naik sehat.
    ranked = screen([
        {"sym": "SEHAT", "result": out, "pnl_pct": 12.0},
        {"sym": "PATAH", "result": compute(crash), "pnl_pct": 12.0},
        {"sym": "RUGI", "result": compute(down_df), "pnl_pct": -20.0},
    ])
    by_sym = {c["sym"]: c for c in ranked}
    assert ranked[0]["sym"] == "PATAH", [c["sym"] for c in ranked]
    assert by_sym["PATAH"]["urgency"] == "high", by_sym["PATAH"]
    # Posisi rugi bukan kandidat take profit — itu urusan stop loss.
    assert by_sym["RUGI"]["urgency"] == "low", by_sym["RUGI"]
    assert by_sym["RUGI"]["score"] <= 0, by_sym["RUGI"]
    # Tren naik dekat puncak justru diberi alasan MENAHAN (George & Hwang).
    assert any("menahan" in r for r in by_sym["SEHAT"]["reasons"]), by_sym["SEHAT"]["reasons"]
    # Setiap kandidat membawa metode & level yang bisa ditindaklanjuti.
    assert all(c["recommended_label"] and c["stop"] is not None for c in ranked), ranked

    print("takeprofit.demo OK:", out["headline"])
    print("  screen:", [(c["sym"], c["urgency"], c["score"]) for c in ranked])


if __name__ == "__main__":
    demo()
