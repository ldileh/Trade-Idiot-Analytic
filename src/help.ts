// Central "bahasa bayi" copy: every bit of jargon the UI shows has a plain
// Indonesian explanation here, so a first-time trader never meets a raw term.
import type { IndicatorKind, Interval, Range, Strategy } from "./types";

export interface IndicatorInfo {
  label: string; // friendly name
  emoji: string;
  short: string; // one-liner shown on the card
  tip: string; // longer "what is this, simply" tooltip
  defaultPeriod: number;
  periodLabel: string; // what the "period" number means for this indicator
}

export const INDICATOR_INFO: Record<IndicatorKind, IndicatorInfo> = {
  sma: {
    label: "Garis Rata-rata (SMA)",
    emoji: "〰️",
    short: "Harga rata-rata beberapa hari terakhir, jadi satu garis halus.",
    tip: "SMA menghaluskan harga yang naik-turun jadi satu garis. Kalau harga di atas garis, suasananya cenderung naik; di bawah, cenderung turun.",
    defaultPeriod: 20,
    periodLabel: "Dihitung dari berapa batang terakhir?",
  },
  ema: {
    label: "Rata-rata Lincah (EMA)",
    emoji: "➰",
    short: "Mirip SMA, tapi lebih cepat bereaksi ke harga terbaru.",
    tip: "EMA juga garis rata-rata, tapi lebih memperhatikan harga yang baru. Cocok untuk melihat perubahan arah lebih awal.",
    defaultPeriod: 20,
    periodLabel: "Dihitung dari berapa batang terakhir?",
  },
  bbands: {
    label: "Pita Harga (Bollinger)",
    emoji: "🎈",
    short: "Pita atas–bawah. Harga biasanya memantul di dalamnya.",
    tip: "Dua garis yang membungkus harga seperti pagar. Saat harga menyentuh pagar atas/bawah, sering kali harga melambat atau berbalik.",
    defaultPeriod: 20,
    periodLabel: "Lebar pita dihitung dari berapa batang?",
  },
  rsi: {
    label: "Meteran Tenaga (RSI)",
    emoji: "🌡️",
    short: "Angka 0–100. Di atas 70 = kemahalan, di bawah 30 = kemurahan.",
    tip: "RSI seperti meteran 0–100. Lebih dari 70 artinya harga sudah naik banyak (mungkin kemahalan); kurang dari 30 artinya sudah turun banyak (mungkin kemurahan).",
    defaultPeriod: 14,
    periodLabel: "Diukur dari berapa batang terakhir?",
  },
  macd: {
    label: "Pendeteksi Momentum (MACD)",
    emoji: "🚦",
    short: "Menunjukkan kapan tenaga naik/turun mulai berganti.",
    tip: "MACD membantu melihat kapan dorongan harga berubah dari naik ke turun atau sebaliknya — seperti lampu lalu lintas untuk momentum.",
    defaultPeriod: 12,
    periodLabel: "Kecepatan hitung (default 12 sudah umum).",
  },
  atr: {
    label: "Pengukur Goyangan (ATR)",
    emoji: "📏",
    short: "Seberapa liar harga bergerak tiap hari (naik-turunnya).",
    tip: "ATR mengukur seberapa besar harga biasanya bergoyang dalam sehari. Makin besar, makin liar (berisiko) pergerakannya.",
    defaultPeriod: 14,
    periodLabel: "Rata-rata goyangan dari berapa batang?",
  },
};

// Human label for each candle interval ("1 batang = ...").
export const INTERVAL_LABEL: Record<Interval, string> = {
  "1m": "1 menit", "5m": "5 menit", "15m": "15 menit", "30m": "30 menit",
  "1h": "1 jam", "1d": "1 hari", "1wk": "1 minggu", "1mo": "1 bulan",
};

// Human label for each look-back range.
export const RANGE_LABEL: Record<Range, string> = {
  "1mo": "1 bulan terakhir", "3mo": "3 bulan terakhir", "6mo": "6 bulan terakhir",
  "1y": "1 tahun terakhir", "2y": "2 tahun terakhir", "5y": "5 tahun terakhir",
  "10y": "10 tahun terakhir", "ytd": "sejak awal tahun ini", "max": "sejak awal data",
};

export interface StrategyInfo {
  label: string;
  emoji: string;
  desc: string;
}

export const STRATEGY_INFO: Record<Strategy, StrategyInfo> = {
  sma_cross: {
    label: "Dua Garis Bersilang",
    emoji: "✂️",
    desc: "Beli saat garis cepat memotong garis lambat ke atas, jual saat memotong ke bawah. Ide klasik 'ikut arah tren'.",
  },
  rsi_reversion: {
    label: "Beli Murah, Jual Mahal",
    emoji: "🔄",
    desc: "Beli saat meteran RSI bilang 'kemurahan', jual saat bilang 'kemahalan'. Ide 'harga balik ke rata-rata'.",
  },
};

// Friendly label, plain explanation, and good/bad direction for each backtest
// stat the backend returns. `good`: +1 higher-is-better, -1 lower-is-better, 0 neutral.
export interface StatInfo { label: string; tip: string; good: 1 | -1 | 0; }

export const STAT_INFO: Record<string, StatInfo> = {
  "Return [%]": {
    label: "Untung/Rugi strategi",
    tip: "Total untung atau rugi kalau kamu mengikuti strategi ini sepanjang periode. Positif = untung.",
    good: 1,
  },
  "Buy & Hold Return [%]": {
    label: "Kalau cuma beli & diamkan",
    tip: "Pembanding: hasil kalau kamu beli di awal lalu diam saja sampai akhir, tanpa strategi. Bandingkan dengan untung strategi di atas.",
    good: 1,
  },
  "Return (Ann.) [%]": {
    label: "Untung per tahun",
    tip: "Perkiraan untung/rugi disetarakan jadi per tahun, biar mudah dibandingkan.",
    good: 1,
  },
  "Volatility (Ann.) [%]": {
    label: "Tingkat goyangan",
    tip: "Seberapa naik-turun hasilnya. Makin kecil makin tenang; makin besar makin deg-degan.",
    good: -1,
  },
  "Sharpe Ratio": {
    label: "Nilai untung vs risiko",
    tip: "Untung dibanding risikonya. Di atas 1 itu bagus, di atas 2 sangat bagus. Makin tinggi makin sepadan.",
    good: 1,
  },
  "Sortino Ratio": {
    label: "Untung vs risiko rugi",
    tip: "Mirip nilai di sebelah, tapi hanya menghitung goyangan yang merugikan. Makin tinggi makin baik.",
    good: 1,
  },
  "Max. Drawdown [%]": {
    label: "Jeblok terdalam",
    tip: "Penurunan terbesar dari puncak ke lembah. Ini 'rasa sakit' maksimal yang harus kamu tahan. Makin kecil (mendekati 0) makin enak.",
    good: -1,
  },
  "Win Rate [%]": {
    label: "Seberapa sering menang",
    tip: "Dari semua transaksi, berapa persen yang untung. 60% artinya 6 dari 10 transaksi menang.",
    good: 1,
  },
  "# Trades": {
    label: "Jumlah transaksi",
    tip: "Berapa kali strategi membeli lalu menjual selama periode ini.",
    good: 0,
  },
  "Profit Factor": {
    label: "Total untung ÷ total rugi",
    tip: "Lebih dari 1 artinya total untung melebihi total rugi. Makin besar makin sehat.",
    good: 1,
  },
  "Expectancy [%]": {
    label: "Rata-rata hasil per transaksi",
    tip: "Rata-rata untung/rugi tiap satu transaksi. Positif artinya rata-rata cuan.",
    good: 1,
  },
  Start: { label: "Mulai dari", tip: "Tanggal awal data yang diuji.", good: 0 },
  End: { label: "Sampai", tip: "Tanggal akhir data yang diuji.", good: 0 },
  Duration: { label: "Lama periode", tip: "Total rentang waktu yang diuji.", good: 0 },
};
