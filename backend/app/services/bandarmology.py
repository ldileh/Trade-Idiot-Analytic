"""Bandarmology PROKSI — jejak akumulasi/distribusi dari data harga-volume.

PENTING soal penamaan: bandarmology "asli" membaca **Broker Summary** IDX —
broker mana yang membeli/menjual paling banyak. Data itu tidak tersedia sebagai
API publik; distribusi terstrukturnya lewat IDX Data Services berbayar dan
berlisensi. Modul ini TIDAK melihat data broker sama sekali.

Yang dihitung di sini adalah proksi kuantitatif dari konsep yang sama, memakai
data yang sudah kita punya (OHLCV + KSEI):

  1. Chaikin Money Flow (Marc Chaikin) — makin dekat harga tutup ke tertinggi
     hari itu, makin besar indikasi akumulasi; dekat terendah = distribusi.
     Ini formalisasi kuantitatif dari prinsip akumulasi/distribusi Wyckoff yang
     jadi inti bandarmology.
  2. Lonjakan volume (volume spike) — metode bandarmology paling umum: volume
     jauh di atas normal menandai ada pemain besar yang bergerak.
  3. Tren kepemilikan asing dari KSEI — proksi *foreign flow* yang sah, karena
     KSEI memang melaporkan porsi lokal vs asing per bulan.

Semua output diberi label jujur sebagai perkiraan. Sinyal di sini TIDAK
mengetahui identitas bandar, dan tidak boleh dibaca sebagai ajakan beli.
"""
from __future__ import annotations

import pandas as pd

# CMF di atas +0.05 lazim dibaca sebagai tekanan beli, di bawah -0.05 tekanan
# jual (ambang konvensional Chaikin); di antaranya dianggap netral.
_CMF_WINDOW = 20
_CMF_BUY = 0.05
_CMF_SELL = -0.05

# Volume disebut "lonjakan" bila >= 2x rata-rata 20 hari — cukup jarang untuk
# bermakna, cukup sering untuk muncul beberapa kali dalam setahun.
_VOL_WINDOW = 20
_VOL_SPIKE = 2.0


def _chaikin_money_flow(df: pd.DataFrame, window: int = _CMF_WINDOW) -> float | None:
    """CMF terakhir, atau None bila data kurang / rentang harga datar."""
    if len(df) < window:
        return None
    high = df["High"].astype(float)
    low = df["Low"].astype(float)
    close = df["Close"].astype(float)
    vol = df["Volume"].astype(float)

    span = (high - low).replace(0, pd.NA)  # hari tanpa rentang -> tidak terdefinisi
    mfm = ((close - low) - (high - close)) / span
    mfv = (mfm * vol).fillna(0.0)

    vol_sum = float(vol.iloc[-window:].sum())
    if vol_sum <= 0:
        return None
    return float(mfv.iloc[-window:].sum() / vol_sum)


def _volume_spike(df: pd.DataFrame, window: int = _VOL_WINDOW) -> dict:
    """Seberapa ramai transaksi terakhir dibanding kebiasaannya."""
    vol = df["Volume"].astype(float)
    if len(vol) < window + 1:
        return {"ratio": None, "spike": False}
    baseline = float(vol.iloc[-window - 1 : -1].mean())
    latest = float(vol.iloc[-1])
    if baseline <= 0:
        return {"ratio": None, "spike": False}
    ratio = latest / baseline
    return {"ratio": round(ratio, 2), "spike": ratio >= _VOL_SPIKE}


def _foreign_trend(series: list[dict] | None) -> dict:
    """Arah porsi kepemilikan asing (KSEI) dari snapshot bulanan."""
    if not series or len(series) < 2:
        return {"direction": None, "change_pp": None, "text": "Data KSEI belum cukup untuk menilai arus asing."}
    first = float(series[0].get("pct_foreign") or 0.0)
    last = float(series[-1].get("pct_foreign") or 0.0)
    change = last - first
    # 0,5 poin persen dipakai sebagai ambang derau: pergerakan di bawah itu
    # terlalu kecil untuk disebut arah.
    if change >= 0.5:
        direction, text = "masuk", f"Porsi asing NAIK {change:.1f} poin persen (dari {first:.1f}% ke {last:.1f}%) — dana asing cenderung masuk."
    elif change <= -0.5:
        direction, text = "keluar", f"Porsi asing TURUN {abs(change):.1f} poin persen (dari {first:.1f}% ke {last:.1f}%) — dana asing cenderung keluar."
    else:
        direction, text = "datar", f"Porsi asing relatif tetap di sekitar {last:.1f}% — tidak ada arus asing yang menonjol."
    return {"direction": direction, "change_pp": round(change, 2), "text": text}


def compute(df: pd.DataFrame, ownership_series: list[dict] | None = None) -> dict:
    """Bangun ringkasan proksi bandarmology dari OHLCV (+ KSEI bila ada)."""
    cmf = _chaikin_money_flow(df)
    vol = _volume_spike(df)
    foreign = _foreign_trend(ownership_series)

    if cmf is None:
        flow, flow_text = None, "Belum cukup data untuk menilai aliran dana."
    elif cmf >= _CMF_BUY:
        flow = "akumulasi"
        flow_text = (
            f"Aliran dana masuk (CMF {cmf:+.2f}). Harga sering ditutup dekat level tertinggi harian — "
            "pola yang biasa dibaca sebagai AKUMULASI."
        )
    elif cmf <= _CMF_SELL:
        flow = "distribusi"
        flow_text = (
            f"Aliran dana keluar (CMF {cmf:+.2f}). Harga sering ditutup dekat level terendah harian — "
            "pola yang biasa dibaca sebagai DISTRIBUSI."
        )
    else:
        flow = "netral"
        flow_text = f"Aliran dana seimbang (CMF {cmf:+.2f}) — belum terlihat akumulasi maupun distribusi yang jelas."

    if vol["ratio"] is None:
        vol_text = "Belum cukup data volume untuk dibandingkan."
    elif vol["spike"]:
        vol_text = f"Volume terakhir {vol['ratio']}× rata-rata 20 hari — ADA LONJAKAN, tanda pemain besar sedang bergerak."
    elif vol["ratio"] >= 1.2:
        vol_text = f"Volume terakhir {vol['ratio']}× rata-rata — sedikit lebih ramai dari biasanya."
    else:
        vol_text = f"Volume terakhir {vol['ratio']}× rata-rata — transaksi normal, tidak ada keramaian khusus."

    # Kesimpulan gabungan. Lonjakan volume memperkuat arah CMF: akumulasi yang
    # disertai volume besar lebih meyakinkan daripada yang sepi.
    if flow == "akumulasi" and vol["spike"]:
        headline = "🟢 Terindikasi AKUMULASI dengan volume besar — jejak paling kuat dari pola ini."
    elif flow == "akumulasi":
        headline = "🟢 Terindikasi akumulasi, tapi volumenya biasa saja."
    elif flow == "distribusi" and vol["spike"]:
        headline = "🔴 Terindikasi DISTRIBUSI dengan volume besar — hati-hati, barang sedang dilepas."
    elif flow == "distribusi":
        headline = "🔴 Terindikasi distribusi, dengan volume biasa."
    elif flow is None:
        headline = "⚪ Data belum cukup untuk membaca jejak akumulasi/distribusi."
    else:
        headline = "⚪ Belum ada jejak akumulasi/distribusi yang jelas."

    return {
        "cmf": round(cmf, 4) if cmf is not None else None,
        "flow": flow,
        "flow_text": flow_text,
        "volume_ratio": vol["ratio"],
        "volume_spike": vol["spike"],
        "volume_text": vol_text,
        "foreign_direction": foreign["direction"],
        "foreign_change_pp": foreign["change_pp"],
        "foreign_text": foreign["text"],
        "headline": headline,
        "disclaimer": (
            "PROKSI, bukan Broker Summary. Data broker (siapa yang beli/jual) hanya tersedia "
            "lewat layanan berbayar IDX, jadi angka di sini diperkirakan dari pola harga, "
            "volume, dan kepemilikan asing KSEI. Bahan bantu belajar, BUKAN ajakan beli."
        ),
    }


def demo() -> None:
    """Self-check dengan data sintetis (tanpa jaringan)."""
    import numpy as np

    idx = pd.date_range("2024-01-01", periods=60, freq="D", tz="UTC")

    # Akumulasi: tiap hari ditutup di dekat tertinggi -> CMF positif kuat.
    low = np.linspace(100, 140, 60)
    high = low + 10
    close = high - 0.5  # tutup menempel di atas
    acc = pd.DataFrame(
        {"High": high, "Low": low, "Close": close, "Open": low, "Volume": np.full(60, 1000.0)}, index=idx
    )
    out = compute(acc)
    assert out["flow"] == "akumulasi", out
    assert out["cmf"] > 0.5, out["cmf"]

    # Distribusi: tutup menempel di bawah.
    dist = acc.copy()
    dist["Close"] = dist["Low"] + 0.5
    out = compute(dist)
    assert out["flow"] == "distribusi", out

    # Lonjakan volume terdeteksi pada bar terakhir.
    spiked = acc.copy()
    spiked.iloc[-1, spiked.columns.get_loc("Volume")] = 5000.0
    out = compute(spiked)
    assert out["volume_spike"] is True, out
    assert out["volume_ratio"] == 5.0, out["volume_ratio"]
    assert "AKUMULASI" in out["headline"], out["headline"]

    # Volume normal -> bukan lonjakan.
    assert compute(acc)["volume_spike"] is False

    # Hari tanpa rentang (high == low) tidak boleh bikin pembagian nol / NaN.
    flat = pd.DataFrame(
        {"High": np.full(60, 100.0), "Low": np.full(60, 100.0), "Close": np.full(60, 100.0),
         "Open": np.full(60, 100.0), "Volume": np.full(60, 1000.0)}, index=idx
    )
    out = compute(flat)
    assert out["cmf"] == 0.0, out["cmf"]

    # Data terlalu pendek -> gagal lembut, bukan error.
    short = acc.iloc[:5]
    out = compute(short)
    assert out["cmf"] is None and out["flow"] is None, out

    # Tren asing dari KSEI.
    up = [{"pct_foreign": 30.0}, {"pct_foreign": 34.0}]
    assert _foreign_trend(up)["direction"] == "masuk"
    down = [{"pct_foreign": 34.0}, {"pct_foreign": 30.0}]
    assert _foreign_trend(down)["direction"] == "keluar"
    assert _foreign_trend([{"pct_foreign": 30.0}, {"pct_foreign": 30.2}])["direction"] == "datar"
    assert _foreign_trend(None)["direction"] is None

    print("bandarmology.demo OK:", compute(spiked)["headline"])


if __name__ == "__main__":
    demo()
