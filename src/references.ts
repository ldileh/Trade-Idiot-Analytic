// Katalog metode yang BENAR-BENAR dipakai app ini, beserta dasar ilmiahnya.
// Sumber tunggal untuk modal "Dasar Ilmiah" — kalau sebuah metode ditambahkan
// ke backend, entri di sini yang membuatnya muncul di UI.
//
// `evidence` sengaja dibedakan supaya user tahu bobot dukungan tiap metode —
// menyamakan paper Journal of Finance dengan konvensi praktisi akan menyesatkan:
//   peer_reviewed = ada paper akademik yang di-review sejawat
//   established   = standar industri/buku rujukan, tapi bukan paper ber-review
//   heuristic     = aturan praktis app ini sendiri; transparan, tanpa klaim riset
//   mixed         = pernah diteliti, hasilnya TIDAK mendukung penggunaan naif

export type Evidence = "peer_reviewed" | "established" | "heuristic" | "mixed";

export interface EvidenceMeta {
  label: string;
  emoji: string;
  blurb: string;
}

export const EVIDENCE_META: Record<Evidence, EvidenceMeta> = {
  peer_reviewed: {
    label: "Jurnal ilmiah",
    emoji: "🎓",
    blurb: "Ada paper akademik yang direview sejawat (peer-reviewed) dan diuji pada data pasar nyata.",
  },
  established: {
    label: "Standar industri",
    emoji: "📘",
    blurb:
      "Berasal dari buku rujukan / standar yang dipakai luas di industri, tapi bukan paper ber-review. " +
      "Diterima secara praktik, bukan dibuktikan lewat uji akademik.",
  },
  heuristic: {
    label: "Aturan praktis app ini",
    emoji: "🔧",
    blurb:
      "Aturan sederhana buatan app ini sendiri, bukan hasil riset. Ditulis terbuka supaya kamu bisa " +
      "menilai sendiri — jangan diperlakukan seperti temuan ilmiah.",
  },
  mixed: {
    label: "Bukti campuran",
    emoji: "⚠️",
    blurb:
      "Sudah diteliti, dan hasilnya JUSTRU melemahkan penggunaan naif metode ini. Ditampilkan " +
      "lengkap dengan peringatannya, bukan disembunyikan.",
  },
};

export interface Citation {
  text: string; // sitasi lengkap
  url?: string;
}

export interface MethodRef {
  id: string;
  emoji: string;
  title: string; // nama di UI aplikasi
  technical: string; // nama teknis aslinya
  where: string; // di panel mana user menemukannya
  what: string; // apa yang dihitung, bahasa awam
  evidence: Evidence;
  finding: string; // temuan riset / dasar metode — inti "kenapa dipercaya"
  caveat?: string; // batasan yang harus user tahu
  citations: Citation[];
}

export interface RefGroup {
  id: string;
  title: string;
  emoji: string;
  intro: string;
  methods: MethodRef[];
}

export const REFERENCE_GROUPS: RefGroup[] = [
  {
    id: "exit",
    title: "Target Jual & Batas Rugi",
    emoji: "🎯",
    intro:
      "Menentukan titik keluar sebelum harga bergerak. Ini bagian yang paling bisa kamu kendalikan — " +
      "kamu tidak bisa mengatur ke mana harga pergi, tapi bisa mengatur kapan kamu keluar.",
    methods: [
      {
        id: "atr",
        emoji: "📏",
        title: "Target Volatilitas",
        technical: "Average True Range (ATR) multiple",
        where: "🎯 Take Profit",
        what:
          "Mengukur seberapa jauh saham ini biasanya bergerak dalam sehari, lalu menaruh target " +
          "sebagai kelipatan dari pergerakan wajar itu.",
        evidence: "established",
        finding:
          "Wilder memperkenalkan ATR agar jarak target dan batas rugi menyesuaikan gejolak asli tiap " +
          "saham. Target 10% masuk akal untuk saham bergejolak, tapi terlalu jauh untuk saham tenang — " +
          "ATR membuat jaraknya sebanding, bukan seragam.",
        caveat:
          "ATR mengukur besar pergerakan, BUKAN arahnya. Ia tidak tahu harga akan naik atau turun.",
        citations: [
          { text: "Wilder, J.W. (1978). New Concepts in Technical Trading Systems. Trend Research." },
          { text: "Ringkasan terbuka — Average True Range", url: "https://en.wikipedia.org/wiki/Average_true_range" },
        ],
      },
      {
        id: "rr",
        emoji: "⚖️",
        title: "Target Risk/Reward",
        technical: "R-multiple",
        where: "🎯 Take Profit",
        what:
          "Mengukur dulu jarak risikomu (harga beli → batas rugi) sebagai '1R', lalu memasang target " +
          "sebagai kelipatan jarak itu.",
        evidence: "established",
        finding:
          "Dengan target 2R kamu tetap untung dalam jangka panjang meskipun hanya benar sekitar 40% " +
          "dari waktu. Inilah alasan rasio untung:rugi lebih menentukan hasil akhir daripada seberapa " +
          "sering kamu benar — sesuatu yang sangat berlawanan dengan intuisi pemula.",
        caveat:
          "Rasio bagus di atas kertas tidak berguna kalau batas ruginya tidak ditaati saat harga benar-benar turun.",
        citations: [
          { text: "Tharp, V.K. (1998). Trade Your Way to Financial Freedom. McGraw-Hill." },
        ],
      },
      {
        id: "chandelier",
        emoji: "🪝",
        title: "Trailing Stop",
        technical: "Chandelier Exit — highest_high(22) − 3×ATR(22)",
        where: "🎯 Take Profit",
        what:
          "Batas jual yang ikut naik mengikuti puncak harga dan tidak pernah turun, supaya untung " +
          "terkunci bertahap tanpa kamu harus menebak puncaknya.",
        evidence: "established",
        finding:
          "Menjawab kelemahan target tetap di tren yang masih kuat: dipasang dekat akan kena koreksi " +
          "biasa, dipasang jauh membuat untung yang sudah ada ikut hilang. Trailing stop hanya bergerak " +
          "satu arah, jadi menyelesaikan keduanya sekaligus.",
        caveat:
          "Di pasar menyamping, trailing stop sering tersentuh oleh goyangan biasa — bukan karena tren berubah.",
        citations: [
          { text: "Le Beau, C. — Chandelier Exit (dipopulerkan lewat Technical Traders' Bulletin)" },
          {
            text: "StockCharts ChartSchool — Chandelier Exit",
            url: "https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/chandelier-exit",
          },
        ],
      },
      {
        id: "disposition",
        emoji: "🧠",
        title: "Penjagaan bias 'balik modal'",
        technical: "Disposition effect",
        where: "🎯 Take Profit",
        what:
          "Saat posisimu rugi dalam, app menolak menghitung target dari harga belimu dan memakai harga " +
          "sekarang — plus mengatakannya terang-terangan.",
        evidence: "peer_reviewed",
        finding:
          "Investor terbukti cenderung menjual saham yang untung terlalu cepat dan menahan yang rugi " +
          "terlalu lama, karena enggan mengakui kerugian. Memproyeksikan target dari harga beli yang " +
          "sudah jauh di atas harga pasar akan memberi makan bias ini — angkanya terlihat seperti " +
          "rencana, padahal isinya cuma harapan balik modal.",
        citations: [
          {
            text:
              "Shefrin, H. & Statman, M. (1985). The Disposition to Sell Winners Too Early and Ride " +
              "Losers Too Long. Journal of Finance, 40(3), 777–790.",
            url: "https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.1985.tb05002.x",
          },
          {
            text: "Odean, T. (1998). Are Investors Reluctant to Realize Their Losses? Journal of Finance, 53(5).",
            url: "https://onlinelibrary.wiley.com/doi/10.1111/0022-1082.00072",
          },
        ],
      },
      {
        id: "sizing",
        emoji: "🧮",
        title: "Aturan ukuran posisi",
        technical: "Position sizing 1–2% risiko per posisi",
        where: "🎯 Take Profit → Batas Rugi",
        what:
          "Mengingatkan bahwa kalau batas rugimu lebar, yang dikecilkan adalah jumlah lot — bukan " +
          "batas ruginya yang dirapatkan.",
        evidence: "established",
        finding:
          "Membatasi kerugian satu posisi pada 1–2% total modal membuat rentetan kekalahan tetap bisa " +
          "dipulihkan. Ini pelengkap wajib bagi stop berbasis ATR: stop lebar tanpa memperkecil lot " +
          "artinya menambah risiko, bukan menguranginya.",
        citations: [{ text: "Tharp, V.K. (1998). Trade Your Way to Financial Freedom — bab position sizing." }],
      },
      {
        id: "screen",
        emoji: "📋",
        title: "Peringkat kandidat take profit",
        technical: "Skoring gabungan multi-sinyal",
        where: "🎯 Take Profit → tab Portofolio",
        what:
          "Mengurutkan posisimu dari yang paling perlu ditinjau, menggabungkan besar untung, arah tren, " +
          "trailing stop yang terlewati, dan target yang sudah tercapai.",
        evidence: "heuristic",
        finding:
          "Bobot tiap sinyal ditentukan app ini, bukan hasil riset. Yang berdasar riset adalah arah " +
          "penyesuaiannya: posisi yang masih tren naik di dekat puncak justru DITURUNKAN urgensinya, " +
          "mengikuti temuan George & Hwang (2004) di bawah.",
        caveat:
          "Skornya alat penyaring perhatian, bukan peringkat kualitas. Angkanya tidak punya makna absolut.",
        citations: [{ text: "Aturan internal app — lihat backend/app/services/takeprofit.py, fungsi screen()." }],
      },
    ],
  },
  {
    id: "momentum",
    title: "Momentum & Kekuatan Tren",
    emoji: "📈",
    intro: "Mengukur apakah tren sedang berjalan, baru mulai, atau sudah kehabisan tenaga.",
    methods: [
      {
        id: "jt",
        emoji: "🏃",
        title: "Kekuatan Tren 1 / 3 / 6 Bulan",
        technical: "Cross-sectional momentum (periode formasi)",
        where: "🔍 Pola → Kekuatan Tren",
        what:
          "Menampilkan return 1, 3, dan 6 bulan sebagai tiga angka terpisah, bukan satu angka gabungan.",
        evidence: "peer_reviewed",
        finding:
          "Saham yang berkinerja baik dalam 3–12 bulan terakhir cenderung melanjutkan kinerjanya pada " +
          "3–12 bulan berikutnya. Temuan ini bertahan puluhan tahun dan direplikasi di banyak pasar — " +
          "salah satu anomali paling kokoh dalam literatur keuangan. Dipisah tiga agar terlihat apakah " +
          "trennya baru mulai atau sudah lama berjalan.",
        caveat:
          "Momentum bisa berbalik tajam saat pasar berputar arah (momentum crash), justru ketika " +
          "kerugiannya paling besar.",
        citations: [
          {
            text:
              "Jegadeesh, N. & Titman, S. (1993). Returns to Buying Winners and Selling Losers. " +
              "Journal of Finance, 48(1), 65–91.",
            url: "https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.1993.tb04702.x",
          },
          {
            text: "Daniel, K. & Moskowitz, T. (2016). Momentum Crashes. Journal of Financial Economics, 122(2).",
            url: "https://www.sciencedirect.com/science/article/pii/S0304405X16301490",
          },
        ],
      },
      {
        id: "gh52",
        emoji: "🎯",
        title: "Posisi 52 Minggu",
        technical: "52-week high proximity",
        where: "🔍 Pola → Posisi 52 Minggu · 🎯 Take Profit",
        what: "Menunjukkan posisi harga sekarang di antara titik terendah dan tertinggi setahun terakhir.",
        evidence: "peer_reviewed",
        finding:
          "Kedekatan harga ke puncak 52 minggu memprediksi return masa depan LEBIH BAIK daripada return " +
          "masa lalu itu sendiri. Penjelasannya perilaku: investor menjadikan puncak lama sebagai " +
          "'jangkar' dan telat bereaksi terhadap kabar baik. Efeknya terreplikasi di sebagian besar " +
          "pasar internasional.",
        caveat:
          "Dekat puncak juga berarti harga sudah naik banyak. Saham bisa bertahan di dekat puncaknya " +
          "sepanjang perjalanan berbalik arah.",
        citations: [
          {
            text:
              "George, T.J. & Hwang, C.-Y. (2004). The 52-Week High and Momentum Investing. " +
              "Journal of Finance, 59(5), 2145–2176.",
            url: "https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.2004.00695.x",
          },
        ],
      },
      {
        id: "obv",
        emoji: "🔊",
        title: "Minat Beli",
        technical: "On-Balance Volume (OBV) slope",
        where: "🔍 Pola → Kekuatan Tren",
        what: "Memeriksa apakah kenaikan harga didukung volume transaksi yang ikut naik.",
        evidence: "established",
        finding:
          "OBV menjumlahkan volume pada hari naik dan menguranginya pada hari turun. Gagasannya: " +
          "kenaikan harga yang disertai volume meningkat lebih terpercaya daripada kenaikan yang sepi. " +
          "Dipakai app ini sebagai konfirmasi, bukan sinyal berdiri sendiri.",
        citations: [{ text: "Granville, J. (1963). Granville's New Key to Stock Market Profits." }],
      },
    ],
  },
  {
    id: "fundamental",
    title: "Fundamental Perusahaan",
    emoji: "📒",
    intro: "Menilai 'isi' perusahaannya, bukan grafik harganya.",
    methods: [
      {
        id: "piotroski",
        emoji: "💪",
        title: "Skor Kesehatan Keuangan",
        technical: "Piotroski F-Score (0–9)",
        where: "📒 Fundamental",
        what:
          "Sembilan pemeriksaan ya/tidak atas laporan keuangan: profitabilitas, beban utang, dan " +
          "efisiensi operasi.",
        evidence: "peer_reviewed",
        finding:
          "Pada kelompok saham murah (book-to-market tinggi), memilih yang skor F-nya tinggi " +
          "meningkatkan return tahunan secara berarti dibanding membeli seluruh kelompok murah itu. " +
          "Intinya: 'murah' saja tidak cukup — murah DAN sehat yang membedakan.",
        caveat:
          "Dirancang untuk saham murah. Penerapannya ke saham mahal/pertumbuhan tidak diuji di paper aslinya.",
        citations: [
          {
            text:
              "Piotroski, J.D. (2000). Value Investing: The Use of Historical Financial Statement " +
              "Information to Separate Winners from Losers. Journal of Accounting Research, 38.",
            url: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=249455",
          },
        ],
      },
      {
        id: "altman",
        emoji: "🚨",
        title: "Skor Risiko Bangkrut",
        technical: "Altman Z-Score",
        where: "📒 Fundamental",
        what: "Lima rasio neraca digabung jadi satu angka zona: aman, abu-abu, atau bahaya.",
        evidence: "peer_reviewed",
        finding:
          "Model aslinya memprediksi kebangkrutan dengan akurasi sekitar 72% pada dua tahun sebelum " +
          "kejadian, dan lebih tinggi lagi untuk satu tahun sebelumnya. Salah satu model prediksi " +
          "kesulitan keuangan paling lama bertahan dalam literatur akuntansi.",
        caveat:
          "Rumus klasiknya dikalibrasi untuk perusahaan manufaktur. Untuk bank dan keuangan hasilnya " +
          "kurang bermakna karena struktur neracanya berbeda.",
        citations: [
          {
            text:
              "Altman, E.I. (1968). Financial Ratios, Discriminant Analysis and the Prediction of " +
              "Corporate Bankruptcy. Journal of Finance, 23(4), 589–609.",
            url: "https://doi.org/10.1111/j.1540-6261.1968.tb00843.x",
          },
          { text: "Ringkasan terbuka — Altman Z-Score", url: "https://en.wikipedia.org/wiki/Altman_Z-score" },
        ],
      },
    ],
  },
  {
    id: "chart",
    title: "Pembacaan Grafik & Sektor",
    emoji: "🔍",
    intro:
      "Alat baca grafik. Bagian inilah yang dukungan ilmiahnya paling lemah — dan app ini " +
      "menyebutkannya, bukan menutupinya.",
    methods: [
      {
        id: "ma_cross",
        emoji: "✂️",
        title: "Golden Cross / Dua Garis Bersilang",
        technical: "Moving-average crossover",
        where: "🔍 Pola · 🧪 Backtest",
        what: "Menandai saat garis rata-rata cepat memotong garis rata-rata lambat.",
        evidence: "mixed",
        finding:
          "Inilah alasan app selalu menyertakan peringatan pada sinyal ini. Uji menyeluruh dengan " +
          "koreksi data-snooping menemukan bahwa keunggulan aturan MA sederhana meluruh setelah era " +
          "1980-an dan tidak bertahan out-of-sample. Kinerja bagusnya di masa lalu sebagian besar " +
          "adalah hasil mencari-cari pola pada data yang sama.",
        caveat:
          "Jangan dipakai berdiri sendiri. Di app ini ia hanya salah satu input, dan selalu diberi catatan.",
        citations: [
          {
            text:
              "Sullivan, R., Timmermann, A. & White, H. (1999). Data-Snooping, Technical Trading Rule " +
              "Performance, and the Bootstrap. Journal of Finance, 54(5), 1647–1691.",
            url: "https://onlinelibrary.wiley.com/doi/10.1111/0022-1082.00163",
          },
          {
            text:
              "Brock, W., Lakonishok, J. & LeBaron (1992). Simple Technical Trading Rules and the " +
              "Stochastic Properties of Stock Returns. Journal of Finance, 47(5) — hasil awal yang lebih positif.",
            url: "https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.1992.tb04681.x",
          },
        ],
      },
      {
        id: "patterns",
        emoji: "🔺",
        title: "Pola Grafik Klasik",
        technical: "Double top/bottom, head & shoulders, breakout, RSI extreme",
        where: "🔍 Pola",
        what: "Mendeteksi bentuk-bentuk grafik klasik lewat aturan sederhana yang transparan.",
        evidence: "heuristic",
        finding:
          "Deteksinya memakai heuristik app ini sendiri (pivot lokal + ambang toleransi), bukan " +
          "definisi baku dari satu paper. Riset akademik atas pola grafik hasilnya bercampur dan sangat " +
          "sensitif pada bagaimana pola itu didefinisikan.",
        caveat:
          "Pola grafik rawan bias melihat-apa-yang-ingin-dilihat. Perlakukan sebagai pengarah perhatian, bukan sinyal.",
        citations: [
          {
            text:
              "Lo, A.W., Mamaysky, H. & Wang, J. (2000). Foundations of Technical Analysis. " +
              "Journal of Finance, 55(4) — pola grafik punya muatan informasi, tapi nilai praktisnya terbatas.",
            url: "https://onlinelibrary.wiley.com/doi/10.1111/0022-1082.00265",
          },
        ],
      },
      {
        id: "rrg",
        emoji: "🧭",
        title: "Peta Arah Sektor",
        technical: "JdK RS-Ratio / RS-Momentum (RRG)",
        where: "🧭 RRG",
        what:
          "Memetakan tiap saham terhadap pembandingnya pada dua sumbu: kekuatan relatif dan arah " +
          "perubahannya.",
        evidence: "established",
        finding:
          "Metode visual standar industri buatan Julius de Kempenaer untuk melihat rotasi kekuatan " +
          "antar-sektor. App ini menghitungnya secara terbuka dengan rolling z-score — tanpa " +
          "penghalusan proprietary.",
        caveat: "Alat visualisasi kekuatan relatif, bukan model prediksi.",
        citations: [
          {
            text: "de Kempenaer, J. — Relative Rotation Graphs (situs resmi metode ini)",
            url: "https://www.relativerotationgraphs.com/",
          },
        ],
      },
      {
        id: "cmf",
        emoji: "🕵️",
        title: "Jejak Bandar",
        technical: "Chaikin Money Flow + lonjakan volume + KSEI",
        where: "🕵️ Jejak Bandar",
        what:
          "Memperkirakan akumulasi/distribusi dari posisi harga penutupan dalam rentang hariannya, " +
          "dikalikan volume.",
        evidence: "heuristic",
        finding:
          "CMF sendiri indikator standar (Marc Chaikin), tapi pemakaiannya di sini sebagai 'jejak bandar' " +
          "adalah PROKSI — bukan Broker Summary IDX yang sesungguhnya. Data broker per-transaksi itu " +
          "berbayar dan tidak tersedia gratis.",
        caveat:
          "Jangan dibaca sebagai 'bandar sedang beli'. Ini hanya pola harga-volume yang konsisten dengan akumulasi.",
        citations: [
          {
            text: "Chaikin, M. — Chaikin Money Flow (StockCharts ChartSchool)",
            url: "https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/chaikin-money-flow-cmf",
          },
          { text: "KSEI — arsip Balance Position Efek (kepemilikan bulanan IDX)", url: "https://www.ksei.co.id/" },
        ],
      },
      {
        id: "correlation",
        emoji: "🔗",
        title: "Saham yang Gerak Bareng",
        technical: "Korelasi Pearson return harian (~6 bulan)",
        where: "🔍 Pola → Gerak Bareng",
        what: "Mencari saham lain yang biasanya naik-turun bersamaan atau berlawanan dengan saham ini.",
        evidence: "established",
        finding:
          "Korelasi adalah ukuran statistik baku. Kegunaannya di sini adalah melihat konsentrasi risiko: " +
          "portofolio berisi lima saham yang semuanya bergerak bareng sebenarnya bukan portofolio " +
          "terdiversifikasi.",
        caveat:
          "Korelasi bukan sebab-akibat, dan cenderung melonjak ke arah 1 saat pasar jatuh — persis ketika " +
          "diversifikasi paling dibutuhkan.",
        citations: [
          {
            text:
              "Markowitz, H. (1952). Portfolio Selection. Journal of Finance, 7(1) — dasar diversifikasi " +
              "berbasis korelasi.",
            url: "https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.1952.tb01525.x",
          },
        ],
      },
      {
        id: "news",
        emoji: "📰",
        title: "Sentimen Berita",
        technical: "Hitungan kata kunci (lexicon)",
        where: "💼 Portofolio",
        what: "Menghitung kata positif/negatif pada judul berita terkini.",
        evidence: "heuristic",
        finding:
          "Ini hitungan kata sederhana, BUKAN NLP maupun model bahasa. Cukup untuk memberi sedikit " +
          "dorongan pada saran portofolio, dan sengaja dibatasi agar tidak pernah bisa menimpa pola harga.",
        caveat: "Tidak paham konteks, sarkasme, maupun kalimat negasi. Perlakukan sebagai penanda kasar.",
        citations: [
          {
            text:
              "Tetlock, P.C. (2007). Giving Content to Investor Sentiment. Journal of Finance, 62(3) — " +
              "sentimen media memang berkaitan dengan pergerakan harga; metode app ini jauh lebih sederhana.",
            url: "https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.2007.01232.x",
          },
        ],
      },
    ],
  },
  {
    id: "backtest",
    title: "Uji Strategi (Backtest)",
    emoji: "🧪",
    intro: "Menguji strategi pada data masa lalu — beserta jebakan yang menyertainya.",
    methods: [
      {
        id: "trend_follow",
        emoji: "📈",
        title: "Ikut Tren Jangka Panjang",
        technical: "Time-series momentum / moving-average timing",
        where: "🧪 Backtest",
        what: "Pegang saham selama harga di atas garis rata-rata panjang, minggir ke tunai saat di bawah.",
        evidence: "peer_reviewed",
        finding:
          "Berbeda dari crossover jangka pendek, aturan tren jangka panjang punya dukungan lebih baik: " +
          "penelitian menemukan return berlebih yang konsisten lintas kelas aset dan lintas dekade. " +
          "Manfaat utamanya bukan menaikkan return, melainkan menekan kejeblokan terdalam.",
        caveat:
          "Menghasilkan banyak sinyal palsu di pasar menyamping, dan selalu telat di titik balik.",
        citations: [
          {
            text:
              "Moskowitz, T., Ooi, Y.H. & Pedersen, L.H. (2012). Time Series Momentum. " +
              "Journal of Financial Economics, 104(2), 228–250.",
            url: "https://www.sciencedirect.com/science/article/pii/S0304405X11002613",
          },
          {
            text: "Faber, M. (2007). A Quantitative Approach to Tactical Asset Allocation.",
            url: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=962461",
          },
        ],
      },
      {
        id: "snooping",
        emoji: "🕳️",
        title: "Kenapa hasil backtest sering terlalu indah",
        technical: "Data snooping / backtest overfitting",
        where: "🧪 Backtest",
        what:
          "Bukan fitur, melainkan peringatan: mencoba banyak kombinasi parameter lalu memakai yang " +
          "terbaik hampir selalu menghasilkan angka yang tidak terulang di masa depan.",
        evidence: "peer_reviewed",
        finding:
          "Semakin banyak variasi strategi yang kamu coba pada data yang sama, semakin besar peluang " +
          "menemukan yang tampak hebat karena kebetulan semata. Peneliti bahkan menunjukkan bahwa dengan " +
          "cukup banyak percobaan, backtest dengan Sharpe ratio tinggi bisa dibuat dari data yang " +
          "sepenuhnya acak.",
        caveat:
          "Kalau kamu mengubah-ubah parameter sampai hasilnya bagus, yang kamu temukan kemungkinan besar " +
          "adalah kebetulan — bukan strategi.",
        citations: [
          {
            text:
              "Bailey, D., Borwein, J., López de Prado, M. & Zhu, Q.J. (2014). Pseudo-Mathematics and " +
              "Financial Charlatanism: The Effects of Backtest Overfitting. Notices of the AMS, 61(5).",
            url: "https://www.ams.org/notices/201405/rnoti-p458.pdf",
          },
          {
            text: "Sullivan, Timmermann & White (1999) — lihat Golden Cross di atas.",
            url: "https://onlinelibrary.wiley.com/doi/10.1111/0022-1082.00163",
          },
        ],
      },
    ],
  },
];

// Jumlah metode per tingkat bukti — dipakai ringkasan di kepala modal.
export function evidenceCounts(): Record<Evidence, number> {
  const out: Record<Evidence, number> = { peer_reviewed: 0, established: 0, heuristic: 0, mixed: 0 };
  for (const g of REFERENCE_GROUPS) for (const m of g.methods) out[m.evidence] += 1;
  return out;
}
