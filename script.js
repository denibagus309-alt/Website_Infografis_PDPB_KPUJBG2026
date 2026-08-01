/* ==========================================================================
   PDPB 2026 - Application Logic
   Dipakai bersama oleh index.html (mode Admin) dan viewer.html (mode Publik).
   Data awal diambil dari data.js (window.PDPB_DATA). Kalau data.js tidak ada
   / gagal dimuat, dipakai data cadangan bawaan di bawah ini supaya halaman
   tetap bisa tampil.
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. DATA
// --------------------------------------------------------------------------

const FALLBACK_DATA = {
  rekap: [
    { no: 1, kecamatan: "Kecamatan Contoh A", desa: 5, l: 1000, p: 1000, total: 2000 },
    { no: 2, kecamatan: "Kecamatan Contoh B", desa: 5, l: 1000, p: 1000, total: 2000 },
  ],
  meninggal: [],
  pindah: [],
  usia: [
    { kategori: "Gen Z", l: 0, p: 0, total: 0 },
    { kategori: "Milenial", l: 0, p: 0, total: 0 },
    { kategori: "Gen X", l: 0, p: 0, total: 0 },
    { kategori: "Baby Boomer", l: 0, p: 0, total: 0 },
    { kategori: "Pre Boomer", l: 0, p: 0, total: 0 },
  ],
  beritaAcara: [],
};

const SEED = (window.PDPB_DATA && window.PDPB_DATA.rekap) ? window.PDPB_DATA : FALLBACK_DATA;

// rawXxx = seluruh data hasil load (bisa berisi banyak tahapan sekaligus).
// dbXxx  = subset yang sedang ditampilkan (hasil filter tahapan aktif).
// Kalau data tidak punya kolom Tahapan sama sekali, dbXxx == rawXxx (semua
// tampil, perilaku lama tetap jalan seperti biasa).
let rawRekap = SEED.rekap;
let rawMeninggal = SEED.meninggal;
let rawPindah = SEED.pindah;
let rawUsia = SEED.usia;
let rawBeritaAcara = SEED.beritaAcara || [];

let dbRekap = rawRekap;
let dbMeninggal = rawMeninggal;
let dbPindah = rawPindah;
let dbGenerasi = rawUsia;
let dbBeritaAcara = rawBeritaAcara;

let currentTahapan = null; // null/"" = tampilkan semua (tidak ada filter aktif)

// Judul halaman per tab
const pageTitles = {
  home: "Beranda & Ringkasan Eksekutif",
  rekap: "Rekapitulasi Data Pemilih per Kecamatan",
  usia: "Demografi Usia & Generasi",
  mutasi: "Mutasi Pemilih (Meninggal / Pindah Domisili)",
  peta: "Peta Sebaran Pemilih Kabupaten Jombang",
  import: "Kelola Berita Acara",
  export: "Tools Unduh Laporan",
};

let chartGenInstance = null;
let chartGenderInstance = null;
let sebaranMapInstance = null;
let sebaranMarkers = [];

// --------------------------------------------------------------------------
// 2. NAVIGASI TAB
// --------------------------------------------------------------------------

function switchTab(tab) {
  const views = ["home", "rekap", "usia", "mutasi", "peta", "import", "export"];

  views.forEach((v) => {
    const section = document.getElementById(`view-${v}`);
    if (section) section.classList.toggle("hidden", v !== tab);

    const navLink = document.getElementById(`nav-${v}`);
    if (navLink) {
      if (v === tab) {
        navLink.classList.add("bg-cyan-600", "text-white", "font-medium");
        navLink.classList.remove("hover:bg-slate-800", "hover:text-white");
      } else {
        navLink.classList.remove("bg-cyan-600", "text-white", "font-medium");
        navLink.classList.add("hover:bg-slate-800", "hover:text-white");
      }
    }
  });

  const titleEl = document.getElementById("page-title");
  if (titleEl) titleEl.textContent = pageTitles[tab] || "PDPB 2026";

  // Tutup drawer sidebar di tampilan mobile setelah memilih menu
  const aside = document.querySelector("aside");
  if (aside && aside.classList.contains("pdpb-sidebar-open")) {
    closeSidebar();
  }

  // Render ulang chart saat kembali ke Beranda (Chart.js butuh reflow
  // ketika canvas sebelumnya berada di container yang hidden)
  if (tab === "home" && chartGenInstance && chartGenderInstance) {
    chartGenInstance.resize();
    chartGenderInstance.resize();
  }

  // Peta Leaflet juga butuh "diberitahu" ukurannya setelah container-nya
  // yang tadinya hidden jadi terlihat, kalau tidak petanya tampil terpotong.
  if (tab === "peta" && sebaranMapInstance) {
    setTimeout(() => sebaranMapInstance.invalidateSize(), 50);
  }
}

// --------------------------------------------------------------------------
// 3. SIDEBAR MOBILE
// --------------------------------------------------------------------------

function toggleSidebar() {
  const aside = document.querySelector("aside");
  if (!aside) return;

  if (aside.classList.contains("pdpb-sidebar-open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

function openSidebar() {
  const aside = document.querySelector("aside");
  aside.classList.remove("hidden");
  aside.classList.add("pdpb-sidebar-open");

  const backdrop = document.createElement("div");
  backdrop.className = "pdpb-sidebar-backdrop";
  backdrop.id = "pdpb-sidebar-backdrop";
  backdrop.addEventListener("click", closeSidebar);
  document.body.appendChild(backdrop);
}

function closeSidebar() {
  const aside = document.querySelector("aside");
  aside.classList.remove("pdpb-sidebar-open");
  if (window.innerWidth < 768) aside.classList.add("hidden");

  const backdrop = document.getElementById("pdpb-sidebar-backdrop");
  if (backdrop) backdrop.remove();
}

// --------------------------------------------------------------------------
// 4. RENDER TABEL
// --------------------------------------------------------------------------

// Kolom yang ditampilkan sebagai teks apa adanya (tidak diformat sebagai angka)
const TEXT_FIELDS = new Set(["kecamatan", "kategori"]);

function formatCell(field, value) {
  if (TEXT_FIELDS.has(field)) return value;
  if (typeof value === "number") return value.toLocaleString("id-ID");
  return value;
}

function populateTable(tableId, data, fields) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  data.forEach((row) => {
    const tr = document.createElement("tr");
    tr.dataset.kecamatan = (row.kecamatan || "").toLowerCase();

    fields.forEach((field) => {
      const td = document.createElement("td");
      td.className = "p-3" + (TEXT_FIELDS.has(field) ? "" : " text-right");
      if (field === "kecamatan" || field === "kategori") td.classList.add("font-medium");
      td.textContent = formatCell(field, row[field]);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

function renderAllTables() {
  populateTable("tableRekap", dbRekap, ["no", "kecamatan", "desa", "l", "p", "total"]);
  populateTable("tableUsia", dbGenerasi, ["kategori", "l", "p", "total"]);
  populateTable("tableMeninggal", dbMeninggal, ["no", "kecamatan", "l", "p", "jml"]);
  populateTable("tablePindah", dbPindah, ["no", "kecamatan", "l", "p", "jml"]);
  updateAllFooterTotals();
}

// --------------------------------------------------------------------------
// 3b. FILTER TAHAPAN (Triwulan 1 / 2 / 3 / dst)
//     Aktif otomatis kalau data (Excel, Google Sheets, atau data.js) punya
//     kolom Tahapan/Triwulan/Periode. Kalau tidak ada sama sekali, dropdown
//     ini disembunyikan dan seluruh data tetap tampil seperti biasa.
// --------------------------------------------------------------------------

// Sortir alami: "Triwulan 2" sebelum "Triwulan 10", dst.
function collectTahapanList() {
  const set = new Set();
  [...rawRekap, ...rawUsia, ...rawMeninggal, ...rawPindah, ...rawBeritaAcara].forEach((r) => {
    if (r && r.tahapan) set.add(r.tahapan);
  });
  return Array.from(set).sort((a, b) => {
    const na = parseInt((a.match(/\d+/) || [])[0], 10);
    const nb = parseInt((b.match(/\d+/) || [])[0], 10);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return a.localeCompare(b, "id");
  });
}

// Menerapkan filter tahapan ke dataset aktif (dbRekap dkk), lalu render ulang.
function applyTahapanFilter(tahapan) {
  currentTahapan = tahapan || null;
  const matches = (r) => !currentTahapan || (r.tahapan || "") === currentTahapan;

  dbRekap = rawRekap.filter(matches).map((r, i) => ({ ...r, no: i + 1 }));
  dbGenerasi = rawUsia.filter(matches);
  dbMeninggal = rawMeninggal.filter(matches).map((r, i) => ({ ...r, no: i + 1 }));
  dbPindah = rawPindah.filter(matches).map((r, i) => ({ ...r, no: i + 1 }));
  dbBeritaAcara = rawBeritaAcara.filter(matches);

  renderAllTables();
  updateSummaryCards();
  updateGenChart();
  updateSebaranMap();
  renderBeritaAcaraLists();
}

// Membaca tahapan apa saja yang tersedia di rawXxx, lalu menyiapkan dropdown.
// Dipanggil setiap kali data baru dimuat (awal, setelah import Excel, atau
// setelah fetch Google Sheets).
function refreshTahapanFilterUI() {
  const list = collectTahapanList();
  const wrapper = document.getElementById("tahapan-filter-wrapper");
  const select = document.getElementById("tahapanFilter");

  if (list.length === 0) {
    if (wrapper) wrapper.style.display = "none";
    applyTahapanFilter(null);
    return;
  }

  if (select) {
    const prevValue = select.value;
    select.innerHTML = list.map((t) => `<option value="${t}">${t}</option>`).join("");
    // Pertahankan pilihan sebelumnya kalau masih ada di daftar baru,
    // kalau tidak pakai tahapan paling akhir/terbaru sebagai default.
    const nextValue = list.includes(prevValue) ? prevValue : list[list.length - 1];
    select.value = nextValue;
  }
  if (wrapper) wrapper.style.display = "flex";

  applyTahapanFilter(select ? select.value : list[list.length - 1]);
}

function onTahapanChange() {
  const select = document.getElementById("tahapanFilter");
  if (select) applyTahapanFilter(select.value);
}

// --------------------------------------------------------------------------
// 3c. PETA SEBARAN PEMILIH (Kabupaten Jombang)
//     Titik-titik di window.PDPB_KECAMATAN_GEO (lihat kecamatan-geo.js)
//     dicocokkan dengan dbRekap yang sedang aktif (sudah mengikuti filter
//     tahapan). Ukuran & warna lingkaran mengikuti jumlah total pemilih.
// --------------------------------------------------------------------------

function initSebaranMap() {
  const container = document.getElementById("petaSebaran");
  if (!container || typeof L === "undefined") return;
  if (sebaranMapInstance) return; // sudah pernah diinisialisasi

  sebaranMapInstance = L.map("petaSebaran", { scrollWheelZoom: false }).setView([-7.56, 112.26], 10);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 17,
  }).addTo(sebaranMapInstance);

  updateSebaranMap();
}

// Warna berdasar jumlah pemilih: makin banyak, makin gelap (skala cyan).
function colorForTotal(total, maxTotal) {
  if (!maxTotal) return "#0891b2";
  const ratio = Math.min(1, total / maxTotal);
  const stops = ["#a5f3fc", "#67e8f9", "#22d3ee", "#0891b2", "#0e7490", "#164e63"];
  const idx = Math.min(stops.length - 1, Math.floor(ratio * (stops.length - 1)));
  return stops[idx];
}

function updateSebaranMap() {
  if (!sebaranMapInstance || typeof L === "undefined") return;

  sebaranMarkers.forEach((m) => sebaranMapInstance.removeLayer(m));
  sebaranMarkers = [];

  const geo = window.PDPB_KECAMATAN_GEO || {};
  const maxTotal = dbRekap.reduce((max, r) => Math.max(max, toNum(r.total)), 0);
  let matchedCount = 0;

  dbRekap.forEach((row) => {
    const key = String(row.kecamatan || "").trim().toUpperCase();
    const point = geo[key];
    if (!point) return; // koordinat kecamatan ini belum ada di kecamatan-geo.js
    matchedCount++;

    const total = toNum(row.total);
    const radius = 6 + (maxTotal ? (total / maxTotal) * 22 : 0);

    const marker = L.circleMarker([point.lat, point.lng], {
      radius,
      color: "#0e7490",
      weight: 1,
      fillColor: colorForTotal(total, maxTotal),
      fillOpacity: 0.75,
    }).addTo(sebaranMapInstance);

    marker.bindPopup(
      `<strong>${row.kecamatan}</strong>` +
      (row.tahapan ? ` <span style="color:#64748b">(${row.tahapan})</span>` : "") +
      `<br>Laki-laki: ${toNum(row.l).toLocaleString("id-ID")}` +
      `<br>Perempuan: ${toNum(row.p).toLocaleString("id-ID")}` +
      `<br><strong>Total: ${total.toLocaleString("id-ID")}</strong>`
    );

    sebaranMarkers.push(marker);
  });

  const noteEl = document.getElementById("peta-unmatched-note");
  if (noteEl) {
    const unmatched = dbRekap.length - matchedCount;
    noteEl.textContent =
      unmatched > 0
        ? `${unmatched} kecamatan belum punya koordinat di kecamatan-geo.js, jadi belum muncul titiknya di peta.`
        : "";
    noteEl.classList.toggle("hidden", unmatched <= 0);
  }
}

// --------------------------------------------------------------------------
// 3d. BERITA ACARA
//     Daftar link PDF Berita Acara per tahapan, dibaca dari tab "BeritaAcara"
//     di Google Sheets (kolom: Tahapan, Judul, Link PDF). Ditampilkan di
//     halaman "Berita Acara" (Admin) dan kartu unduhan di "Tools Unduh
//     Laporan" (Admin & Viewer).
// --------------------------------------------------------------------------

let baFilterValue = "__semua__"; // filter tahapan khusus untuk daftar unduhan Berita Acara

function renderBeritaAcaraLists() {
  const list = document.getElementById("beritaAcaraList");
  if (!list) return;

  // --- Isi dropdown filter tahapan (independen dari filter utama) ---
  const select = document.getElementById("baFilterTahapan");
  if (select) {
    const tahapanOptions = Array.from(new Set(rawBeritaAcara.map((b) => b.tahapan).filter(Boolean))).sort(
      (a, b) => {
        const na = parseInt((a.match(/\d+/) || [])[0], 10);
        const nb = parseInt((b.match(/\d+/) || [])[0], 10);
        if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
        return a.localeCompare(b, "id");
      }
    );

    const prevValue = select.value || baFilterValue;
    select.innerHTML =
      '<option value="__semua__">Semua Tahapan</option>' +
      tahapanOptions.map((t) => `<option value="${t}">${t}</option>`).join("");
    select.value = tahapanOptions.includes(prevValue) || prevValue === "__semua__" ? prevValue : "__semua__";
    baFilterValue = select.value;
  }

  // --- Susun daftar sesuai filter yang aktif ---
  const filtered =
    baFilterValue === "__semua__"
      ? rawBeritaAcara
      : rawBeritaAcara.filter((b) => (b.tahapan || "") === baFilterValue);

  if (filtered.length === 0) {
    list.innerHTML = '<p class="text-sm text-slate-400 text-center py-4">Belum ada Berita Acara untuk tahapan ini.</p>';
    return;
  }

  list.innerHTML = filtered
    .map(
      (b) => `
    <a href="${b.link}" target="_blank" rel="noopener" download
       class="flex items-center justify-between gap-3 p-3 border border-slate-200 rounded-xl hover:border-cyan-400 hover:bg-cyan-50/50 transition">
      <div class="min-w-0 flex items-center gap-2">
        <i class="fa-solid fa-file-pdf text-rose-500"></i>
        <div class="min-w-0">
          <p class="font-medium text-slate-700 truncate">${b.judul || "Berita Acara"}</p>
          <p class="text-xs text-slate-400">${[b.tahapan, b.tanggal].filter(Boolean).join(" &middot; ")}</p>
        </div>
      </div>
      <i class="fa-solid fa-download text-slate-400 shrink-0"></i>
    </a>`
    )
    .join("");
}

// Dipanggil dari dropdown filter di dalam kartu Berita Acara (view-export).
// Sengaja terpisah dari filter tahapan utama di header, supaya viewer bisa
// menelusuri/mengunduh Berita Acara tahapan mana pun tanpa mengubah seluruh
// tampilan dashboard.
function onBeritaAcaraFilterChange() {
  const select = document.getElementById("baFilterTahapan");
  baFilterValue = select ? select.value : "__semua__";
  renderBeritaAcaraLists();
}

// --------------------------------------------------------------------------
// 3f. DIAGNOSTIK GOOGLE SHEETS (halaman Kelola Berita Acara, Admin)
//     Menampilkan status pemuatan tiap tab -- ketemu tab-nya atau tidak,
//     nama kolom header yang terbaca -- supaya gampang dilacak kalau ada
//     data yang tidak muncul.
// --------------------------------------------------------------------------

const DIAG_LABELS = {
  rekap: "Rekapitulasi",
  usia: "Usia",
  meninggal: "Meninggal",
  pindah: "Pindah",
  beritaAcara: "Berita Acara",
};

function renderSheetDiagnostics() {
  const box = document.getElementById("sheetDiagnostics");
  if (!box) return;

  if (!isSheetConfigured()) {
    box.innerHTML = '<p class="text-sm text-slate-400">Google Sheets belum dikonfigurasi (sheets-config.js).</p>';
    return;
  }

  const rows = Object.entries(DIAG_LABELS).map(([key, label]) => {
    const d = lastSheetDiagnostics[key];
    if (!d) return `<tr><td class="p-2">${label}</td><td class="p-2 text-slate-400" colspan="2">Belum dicek</td></tr>`;

    let statusHtml, detailHtml;
    if (d.status === "ok") {
      statusHtml = `<span class="text-emerald-600"><i class="fa-solid fa-circle-check"></i> Terbaca (${d.rowCount} baris)</span>`;
      detailHtml = `Tab: "<strong>${d.tabName}</strong>"`;
    } else if (d.status === "tab_not_found") {
      statusHtml =
        key === "beritaAcara"
          ? '<span class="text-slate-400"><i class="fa-solid fa-minus"></i> Belum ada tab</span>'
          : '<span class="text-rose-600"><i class="fa-solid fa-circle-xmark"></i> Tab tidak ditemukan</span>';
      detailHtml = `Dicoba: ${d.triedNames.map((n) => `"${n}"`).join(", ")}`;
    } else if (d.status === "no_header_row") {
      statusHtml = '<span class="text-amber-600"><i class="fa-solid fa-triangle-exclamation"></i> Tab ada, header tidak ketemu</span>';
      detailHtml = `Tab: "${d.tabName}" -- baris pertama tidak dikenali sebagai header`;
    } else if (d.status === "header_not_recognized") {
      statusHtml = '<span class="text-amber-600"><i class="fa-solid fa-triangle-exclamation"></i> Kolom tidak dikenali</span>';
      detailHtml = `Tab: "${d.tabName}" -- header terbaca: <code class="bg-slate-100 px-1 rounded">${(d.headerRow || []).filter(Boolean).join(" | ")}</code>`;
    } else {
      statusHtml = `<span class="text-rose-600"><i class="fa-solid fa-circle-xmark"></i> Error</span>`;
      detailHtml = d.message || "";
    }

    return `<tr class="border-t border-slate-100"><td class="p-2 font-medium">${label}</td><td class="p-2">${statusHtml}</td><td class="p-2 text-slate-500 text-xs">${detailHtml}</td></tr>`;
  });

  box.innerHTML = `<table class="w-full text-sm"><tbody>${rows.join("")}</tbody></table>`;
}

async function refreshSheetDataManually() {
  const btn = document.getElementById("btnRefreshSheets");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Memuat...';
  }

  const result = await loadFromGoogleSheets();
  refreshTahapanFilterUI();
  renderBeritaAcaraLists();
  renderSheetDiagnostics();

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-arrows-rotate mr-1"></i> Cek Ulang Google Sheets';
  }

  return result;
}

// --------------------------------------------------------------------------
// 3e. STAGING LOKAL BERITA ACARA (form di halaman "Kelola Berita Acara")
//     Karena situs ini statis (tanpa server), admin mengisi form di sini
//     dulu, lalu "Salin Baris" untuk ditempel manual ke tab Berita Acara
//     di Google Sheets -- bukan langsung tersimpan otomatis.
// --------------------------------------------------------------------------

let beritaAcaraLokal = [];

function renderBeritaAcaraLokalTable() {
  const wrapper = document.getElementById("baListWrapper");
  const tbody = document.querySelector("#tableBeritaAcaraLokal tbody");
  if (!tbody) return;

  if (beritaAcaraLokal.length === 0) {
    if (wrapper) wrapper.style.display = "none";
    return;
  }

  if (wrapper) wrapper.style.display = "block";
  tbody.innerHTML = beritaAcaraLokal
    .map(
      (b, i) => `
    <tr>
      <td class="p-2">${b.judul}</td>
      <td class="p-2">${b.tahapan || "-"}</td>
      <td class="p-2">${b.tanggal || "-"}</td>
      <td class="p-2 truncate max-w-[160px]"><a href="${b.link}" target="_blank" rel="noopener" class="text-cyan-600 hover:underline">${b.link}</a></td>
      <td class="p-2 text-right">
        <button onclick="hapusBeritaAcaraLokal(${i})" class="text-slate-400 hover:text-rose-600" title="Hapus">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>`
    )
    .join("");
}

function tambahBeritaAcaraLokal() {
  const judul = document.getElementById("baJudul")?.value.trim();
  const tahapan = document.getElementById("baTahapan")?.value.trim();
  const tanggal = document.getElementById("baTanggal")?.value.trim();
  const link = document.getElementById("baLink")?.value.trim();

  if (!judul || !link) {
    alert("Judul dan Link PDF wajib diisi.");
    return;
  }

  beritaAcaraLokal.push({ judul, tahapan, tanggal, link });
  renderBeritaAcaraLokalTable();

  // Bersihkan form untuk entri berikutnya
  ["baJudul", "baTahapan", "baTanggal", "baLink"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const copyStatus = document.getElementById("baCopyStatus");
  if (copyStatus) copyStatus.classList.add("hidden");
}

function hapusBeritaAcaraLokal(index) {
  beritaAcaraLokal.splice(index, 1);
  renderBeritaAcaraLokalTable();
}

async function salinBeritaAcaraUntukSheets() {
  if (beritaAcaraLokal.length === 0) return;

  // Urutan kolom sesuai instruksi di halaman: Judul, Tahapan, Tanggal, Link
  const tsv = beritaAcaraLokal
    .map((b) => [b.judul, b.tahapan || "", b.tanggal || "", b.link].join("\t"))
    .join("\n");

  try {
    await navigator.clipboard.writeText(tsv);
    const statusEl = document.getElementById("baCopyStatus");
    if (statusEl) {
      statusEl.classList.remove("hidden");
      setTimeout(() => statusEl.classList.add("hidden"), 4000);
    }
  } catch (err) {
    console.error("Gagal menyalin ke clipboard:", err);
    alert("Gagal menyalin otomatis. Salin manual teks berikut:\n\n" + tsv);
  }
}

// --------------------------------------------------------------------------
// 4b. PENJUMLAHAN OTOMATIS (baris "JUMLAH TOTAL" di setiap tabel)
// --------------------------------------------------------------------------

// Menjumlahkan satu atau beberapa kolom numerik dari sebuah dataset.
function sumFields(data, fields) {
  const totals = {};
  fields.forEach((f) => (totals[f] = 0));
  data.forEach((row) => {
    fields.forEach((f) => {
      totals[f] += toNum(row[f]);
    });
  });
  return totals;
}

function setFootText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = Number(value).toLocaleString("id-ID");
}

function updateRekapFooter() {
  const t = sumFields(dbRekap, ["desa", "l", "p", "total"]);
  setFootText("rekap-foot-desa", t.desa);
  setFootText("rekap-foot-l", t.l);
  setFootText("rekap-foot-p", t.p);
  setFootText("rekap-foot-total", t.total);
  return t;
}

function updateUsiaFooter() {
  const t = sumFields(dbGenerasi, ["l", "p", "total"]);
  setFootText("usia-foot-l", t.l);
  setFootText("usia-foot-p", t.p);
  setFootText("usia-foot-total", t.total);
  return t;
}

function updateMeninggalFooter() {
  const t = sumFields(dbMeninggal, ["l", "p", "jml"]);
  setFootText("meninggal-foot-l", t.l);
  setFootText("meninggal-foot-p", t.p);
  setFootText("meninggal-foot-jml", t.jml);
  return t;
}

function updatePindahFooter() {
  const t = sumFields(dbPindah, ["l", "p", "jml"]);
  setFootText("pindah-foot-l", t.l);
  setFootText("pindah-foot-p", t.p);
  setFootText("pindah-foot-jml", t.jml);
  return t;
}

function updateAllFooterTotals() {
  updateRekapFooter();
  updateUsiaFooter();
  updateMeninggalFooter();
  updatePindahFooter();
}

// --------------------------------------------------------------------------
// 5. FILTER TABEL (pencarian kecamatan)
// --------------------------------------------------------------------------

function filterTable(tableId, inputId) {
  const input = document.getElementById(inputId);
  const table = document.getElementById(tableId);
  if (!input || !table) return;

  const keyword = input.value.trim().toLowerCase();
  const rows = table.querySelectorAll("tbody tr");

  rows.forEach((row) => {
    const match = !keyword || (row.dataset.kecamatan || row.textContent.toLowerCase()).includes(keyword);
    row.classList.toggle("pdpb-row-hidden", !match);
  });
}

// --------------------------------------------------------------------------
// 6. RINGKASAN & CHART
// --------------------------------------------------------------------------

function updateSummaryCards() {
  const totalPemilih = dbRekap.reduce((acc, curr) => acc + curr.total, 0);
  const totalL = dbRekap.reduce((acc, curr) => acc + curr.l, 0);
  const totalP = dbRekap.reduce((acc, curr) => acc + curr.p, 0);

  document.getElementById("stat-total").textContent = totalPemilih.toLocaleString("id-ID");
  document.getElementById("stat-l").textContent = totalL.toLocaleString("id-ID");
  document.getElementById("stat-p").textContent = totalP.toLocaleString("id-ID");

  const pctL = totalPemilih ? ((totalL / totalPemilih) * 100).toFixed(2) : "0.00";
  const pctP = totalPemilih ? ((totalP / totalPemilih) * 100).toFixed(2) : "0.00";
  const badgeL = document.querySelector("#stat-l").nextElementSibling;
  const badgeP = document.querySelector("#stat-p").nextElementSibling;
  if (badgeL) badgeL.innerHTML = `<i class="fa-solid fa-mars"></i> ${pctL}% Total Pemilih`;
  if (badgeP) badgeP.innerHTML = `<i class="fa-solid fa-venus"></i> ${pctP}% Total Pemilih`;

  updateGenderChart(totalL, totalP);
  updateAllFooterTotals();
  updateGenChart();
}

function initCharts() {
  const genCtx = document.getElementById("chartGen");
  const genderCtx = document.getElementById("chartGender");
  if (!genCtx || !genderCtx || typeof Chart === "undefined") return;

  chartGenInstance = new Chart(genCtx, {
    type: "doughnut",
    data: {
      labels: dbGenerasi.map((g) => g.kategori),
      datasets: [
        {
          data: dbGenerasi.map((g) => g.total),
          backgroundColor: ["#0891b2", "#06b6d4", "#67e8f9", "#f59e0b", "#f43f5e"],
          borderWidth: 2,
          borderColor: "#ffffff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed.toLocaleString("id-ID")}`,
          },
        },
      },
    },
  });

  const totalL = dbRekap.reduce((acc, curr) => acc + curr.l, 0);
  const totalP = dbRekap.reduce((acc, curr) => acc + curr.p, 0);

  chartGenderInstance = new Chart(genderCtx, {
    type: "bar",
    data: {
      labels: ["Laki-Laki", "Perempuan"],
      datasets: [
        {
          label: "Jumlah Pemilih",
          data: [totalL, totalP],
          backgroundColor: ["#2563eb", "#e11d48"],
          borderRadius: 8,
          maxBarThickness: 90,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.y.toLocaleString("id-ID")} pemilih`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (val) => Number(val).toLocaleString("id-ID") },
        },
      },
    },
  });
}

function updateGenderChart(totalL, totalP) {
  if (!chartGenderInstance) return;
  chartGenderInstance.data.datasets[0].data = [totalL, totalP];
  chartGenderInstance.update();
}

function updateGenChart() {
  if (!chartGenInstance) return;
  chartGenInstance.data.labels = dbGenerasi.map((g) => g.kategori);
  chartGenInstance.data.datasets[0].data = dbGenerasi.map((g) => g.total);
  chartGenInstance.update();
}

// --------------------------------------------------------------------------
// 7. EXPORT LAPORAN (Excel / PDF)
// --------------------------------------------------------------------------

const EXPORT_DATASETS = {
  rekap: {
    label: "Rekapitulasi Pemilih per Kecamatan",
    fields: ["no", "kecamatan", "desa", "l", "p", "total"],
    headers: ["No", "Kecamatan", "Desa/Kel", "Laki-Laki", "Perempuan", "Total Pemilih"],
    getData: () => dbRekap,
  },
  usia: {
    label: "Demografi Usia & Generasi",
    fields: ["kategori", "l", "p", "total"],
    headers: ["Kategori Generasi / Usia", "Laki-Laki", "Perempuan", "Jumlah Total"],
    getData: () => dbGenerasi,
    filterField: "kategori",
  },
  meninggal: {
    label: "Data Pemilih Meninggal",
    fields: ["no", "kecamatan", "l", "p", "jml"],
    headers: ["No", "Kecamatan", "L", "P", "Jumlah"],
    getData: () => dbMeninggal,
  },
  pindah: {
    label: "Data Pemilih Pindah Domisili",
    fields: ["no", "kecamatan", "l", "p", "jml"],
    headers: ["No", "Kecamatan", "L", "P", "Jumlah"],
    getData: () => dbPindah,
  },
};

function processExport() {
  const datasetKey = document.getElementById("exportDataset").value;
  const format = document.getElementById("exportFormat").value;
  const keyword = document.getElementById("exportFilter").value.trim().toLowerCase();

  const config = EXPORT_DATASETS[datasetKey];
  if (!config) return;

  const filterField = config.filterField || "kecamatan";
  let rows = config.getData();
  if (keyword) {
    rows = rows.filter((r) => String(r[filterField] || "").toLowerCase().includes(keyword));
  }

  if (rows.length === 0) {
    alert("Tidak ada data yang cocok dengan filter yang dimasukkan.");
    return;
  }

  const tahapanTag = currentTahapan ? "_" + currentTahapan.replace(/\s+/g, "-") : "";
  const fileBase = `PDPB2026_${datasetKey}${tahapanTag}${keyword ? "_" + keyword.replace(/\s+/g, "-") : ""}`;

  if (format === "excel") {
    exportToExcel(config, rows, fileBase);
  } else {
    exportToPdf(config, rows, fileBase);
  }
}

function exportToExcel(config, rows, fileBase) {
  if (typeof XLSX === "undefined") {
    alert("Pustaka Excel belum siap. Silakan coba lagi.");
    return;
  }
  const aoa = [config.headers, ...rows.map((r) => config.fields.map((f) => r[f]))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, config.label.slice(0, 31));
  XLSX.writeFile(wb, `${fileBase}.xlsx`);
}

function exportToPdf(config, rows, fileBase) {
  if (typeof window.jspdf === "undefined") {
    alert("Pustaka PDF belum siap. Silakan coba lagi.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.text(config.label + (currentTahapan ? ` - ${currentTahapan}` : ""), 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Diunduh: ${new Date().toLocaleString("id-ID")}`, 14, 21);

  doc.autoTable({
    startY: 26,
    head: [config.headers],
    body: rows.map((r) =>
      config.fields.map((f) => (typeof r[f] === "number" ? r[f].toLocaleString("id-ID") : r[f]))
    ),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [8, 145, 178] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`${fileBase}.pdf`);
}

// --------------------------------------------------------------------------
// 7b. PUBLIKASI KE VIEWER (unduh data.js terkini)
// --------------------------------------------------------------------------

function downloadDataJs() {
  const header =
    "/* ==========================================================================\n" +
    "   PDPB 2026 - Data Pemilih (dipublikasikan " + new Date().toLocaleString("id-ID") + ")\n" +
    "   Timpa file data.js di server/hosting dengan file ini agar viewer.html\n" +
    "   menampilkan data terbaru.\n" +
    "   ========================================================================== */\n\n";

  const payload = {
    rekap: rawRekap,
    meninggal: rawMeninggal,
    pindah: rawPindah,
    usia: rawUsia,
  };

  const content = header + "window.PDPB_DATA = " + JSON.stringify(payload, null, 2) + ";\n";

  const blob = new Blob([content], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data.js";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --------------------------------------------------------------------------
// 7b. IMPORT EXCEL MULTI-FORMAT
//     Mengenali otomatis apakah sheet berisi data Rekapitulasi, Usia/Generasi,
//     Meninggal, atau Pindah Domisili — lalu memetakan kolom & menjumlahkan
//     nilainya ke database yang sesuai. Mendukung satu sheet per file maupun
//     satu workbook berisi beberapa sheet sekaligus untuk tiap jenis data.
// --------------------------------------------------------------------------

const TYPE_LABELS = {
  rekap: "Rekapitulasi Pemilih",
  usia: "Demografi Usia/Generasi",
  meninggal: "Data Pemilih Meninggal",
  pindah: "Data Pemilih Pindah Domisili",
};

// Mencari baris header (baris pertama yang memuat kolom yang dikenali).
// Baris judul/merge-cell (mis. "REKAPITULASI DATA PEMILIH KECAMATAN...")
// biasanya cuma 1 sel terisi, jadi disyaratkan minimal 2 sel terisi supaya
// tidak ikut tertangkap sebagai baris header.
function findHeaderRowIndex(rows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const filledCells = row.filter((c) => String(c || "").trim() !== "");
    if (filledCells.length < 2) continue;
    const text = filledCells.join(" ").toLowerCase();
    if (/kecamatan|kategori|generasi|usia|judul|link|tahapan/.test(text)) return i;
  }
  return -1;
}

// Memetakan nama-nama kolom header ke indeks kolomnya, terlepas dari urutan
function mapColumns(headerRow) {
  const map = {};
  (headerRow || []).forEach((h, idx) => {
    const key = String(h || "").toLowerCase().trim();
    if (!key) return;
    if (/^no\.?$/.test(key)) map.no = idx;
    else if (/kecamatan/.test(key)) map.kecamatan = idx;
    else if (/kategori|generasi|usia/.test(key)) map.kategori = idx;
    else if (/desa|kelurahan/.test(key)) map.desa = idx;
    else if (/laki|^l$/.test(key)) map.l = idx;
    else if (/perempuan|^p$/.test(key)) map.p = idx;
    else if (/jumlah|jml|total/.test(key)) map.total = idx;
    else if (/tahapan|triwulan|periode/.test(key)) map.tahapan = idx;
    else if (/judul|keterangan|nama\s*dokumen/.test(key)) map.judul = idx;
    else if (/link|tautan|url/.test(key)) map.link = idx;
    else if (/tanggal|^date$/.test(key)) map.tanggal = idx;
  });
  return map;
}

// Mendeteksi jenis database. Prioritas utama: STRUKTUR KOLOM header itu
// sendiri (paling andal) — nama sheet hanya dipakai untuk membedakan
// Meninggal vs Pindah, karena keduanya punya struktur kolom yang identik
// (Kecamatan, L, P) sehingga tidak bisa dibedakan dari header saja.
function detectSheetType(sheetName, headerRow) {
  const map = mapColumns(headerRow);
  const hasKategori = map.kategori !== undefined;
  const hasKecamatan = map.kecamatan !== undefined;
  const hasDesa = map.desa !== undefined;
  const hasLP = map.l !== undefined && map.p !== undefined;

  // Kolom "Kategori/Generasi/Usia" + L + P -> pasti data Usia,
  // walaupun sheet-nya juga menyebut "kecamatan" di judul.
  if (hasKategori && hasLP) return "usia";

  if (hasKecamatan && hasLP) {
    if (/meninggal|wafat/i.test(sheetName || "")) return "meninggal";
    if (/pindah|domisili/i.test(sheetName || "")) return "pindah";
    // Ada kolom Desa/Kel -> jelas format Rekapitulasi.
    if (hasDesa) return "rekap";
    // Tidak ada kolom Desa & nama sheet tidak menyebut Meninggal/Pindah:
    // default paling aman adalah Rekapitulasi.
    return "rekap";
  }

  return null; // struktur kolom tidak dikenali sama sekali
}

// Baris dianggap baris data selama kolom nama (kecamatan/kategori) terisi
// dan bukan baris footer seperti "JUMLAH TOTAL"
// Mengurai angka dari sel Excel/Google Sheets dengan aman terhadap format
// Indonesia (titik = pemisah ribuan, koma = desimal), mis. "22.030" -> 22030,
// "1.049.616" -> 1049616. Angka polos seperti 22030 (numerik asli dari file
// Excel) tetap terbaca normal.
function toNum(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return isNaN(raw) ? 0 : raw;

  let s = String(raw).trim();
  if (!s || s === "-") return 0;
  s = s.replace(/[^\d,.\-]/g, "");
  if (!s) return 0;

  if (s.includes(",")) {
    // Ada koma -> anggap format Indonesia: titik ribuan dibuang, koma jadi desimal.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // Pola ribuan murni dengan titik, mis. "22.030" atau "1.049.616".
    s = s.replace(/\./g, "");
  }

  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

function isDataRow(row, nameIdx) {
  if (!row || nameIdx === undefined) return false;
  const nameVal = String(row[nameIdx] || "").trim();
  if (!nameVal) return false;
  return !/jumlah|total/i.test(nameVal);
}

function extractRekap(rows) {
  const headerIdx = findHeaderRowIndex(rows);
  if (headerIdx === -1) return null;
  const map = mapColumns(rows[headerIdx]);
  if (map.kecamatan === undefined || map.l === undefined || map.p === undefined) return null;

  const result = [];
  let no = 1;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!isDataRow(row, map.kecamatan)) continue;
    const l = toNum(row[map.l]);
    const p = toNum(row[map.p]);
    const desa = map.desa !== undefined ? toNum(row[map.desa]) : 0;
    const tahapan = map.tahapan !== undefined ? String(row[map.tahapan] || "").trim() : "";
    result.push({ no: no++, kecamatan: String(row[map.kecamatan]).trim(), desa, l, p, total: l + p, tahapan });
  }
  return result.length ? result : null;
}

function extractUsia(rows) {
  const headerIdx = findHeaderRowIndex(rows);
  if (headerIdx === -1) return null;
  const map = mapColumns(rows[headerIdx]);
  if (map.kategori === undefined || map.l === undefined || map.p === undefined) return null;

  const result = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!isDataRow(row, map.kategori)) continue;
    const l = toNum(row[map.l]);
    const p = toNum(row[map.p]);
    const tahapan = map.tahapan !== undefined ? String(row[map.tahapan] || "").trim() : "";
    result.push({ kategori: String(row[map.kategori]).trim(), l, p, total: l + p, tahapan });
  }
  return result.length ? result : null;
}

function extractMutasi(rows) {
  const headerIdx = findHeaderRowIndex(rows);
  if (headerIdx === -1) return null;
  const map = mapColumns(rows[headerIdx]);
  if (map.kecamatan === undefined || map.l === undefined || map.p === undefined) return null;

  const result = [];
  let no = 1;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!isDataRow(row, map.kecamatan)) continue;
    const l = toNum(row[map.l]);
    const p = toNum(row[map.p]);
    const tahapan = map.tahapan !== undefined ? String(row[map.tahapan] || "").trim() : "";
    result.push({ no: no++, kecamatan: String(row[map.kecamatan]).trim(), l, p, jml: l + p, tahapan });
  }
  return result.length ? result : null;
}

// Tab "BeritaAcara": kolom Tahapan, Judul, Link PDF (nama kolom bebas,
// yang penting mengandung kata-kata itu).
function extractBeritaAcara(rows) {
  const headerIdx = findHeaderRowIndex(rows);
  if (headerIdx === -1) return null;
  const map = mapColumns(rows[headerIdx]);
  if (map.link === undefined) return null;

  const result = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const link = String(row[map.link] || "").trim();
    if (!link) continue;
    const judul = map.judul !== undefined ? String(row[map.judul] || "").trim() : "";
    const tahapan = map.tahapan !== undefined ? String(row[map.tahapan] || "").trim() : "";
    const tanggal = map.tanggal !== undefined ? String(row[map.tanggal] || "").trim() : "";
    result.push({ judul, link, tahapan, tanggal });
  }
  return result.length ? result : null;
}

// --------------------------------------------------------------------------
// 7c. SUMBER DATA LIVE: GOOGLE SHEETS
//     Kalau window.PDPB_SHEET_ID sudah diisi (lihat sheets-config.js), data
//     diambil langsung dari Google Sheets setiap halaman dibuka -- baik di
//     index.html (admin) maupun viewer.html (publik) -- sehingga publik
//     otomatis melihat data terbaru tanpa perlu unduh/unggah data.js manual.
//     Beberapa variasi nama tab dicoba satu-satu (tidak harus persis sama).
// --------------------------------------------------------------------------

const SHEET_TAB_CANDIDATES = {
  rekap: ["Rekapitulasi", "REKAPITULASI", "Rekap", "REKAP"],
  usia: ["Usia", "USIA", "Generasi", "GENERASI", "Kategori Usia"],
  meninggal: ["Meninggal", "MENINGGAL", "Wafat", "WAFAT"],
  pindah: ["Pindah", "PINDAH", "Pindah Domisili", "PINDAH DOMISILI"],
  beritaAcara: ["BeritaAcara", "Berita Acara", "BERITA ACARA", "BA"],
};

function isSheetConfigured() {
  const id = window.PDPB_SHEET_ID;
  return typeof id === "string" && id.trim() !== "" && !id.includes("PASTE_SHEET_ID");
}

async function fetchSheetTabRows(sheetId, tabName) {
  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=` +
    encodeURIComponent(tabName);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} saat mengambil tab "${tabName}"`);
  const csvText = await res.text();
  // Google mengembalikan halaman error HTML (bukan CSV) kalau nama tab tidak ada.
  if (/^\s*<(!doctype|html)/i.test(csvText)) throw new Error(`Tab "${tabName}" tidak ditemukan`);
  if (typeof Papa === "undefined") throw new Error("Pustaka PapaParse belum dimuat.");
  return Papa.parse(csvText.trim()).data;
}

// Coba beberapa kandidat nama tab satu-satu sampai ada yang berhasil dibaca.
const SHEET_EXTRACTORS = {
  rekap: extractRekap,
  usia: extractUsia,
  meninggal: extractMutasi,
  pindah: extractMutasi,
  beritaAcara: extractBeritaAcara,
};

// Mengambil keempat jenis data dari Google Sheets. Mengembalikan ringkasan
// tab mana yang berhasil/gagal supaya bisa dilaporkan ke pengguna.
let lastSheetDiagnostics = {};

async function loadFromGoogleSheets() {
  if (!isSheetConfigured()) return { attempted: false, success: false, failedTabs: [] };

  const sheetId = window.PDPB_SHEET_ID.trim();
  const failedTabs = [];
  const diagnostics = {};
  let successCount = 0;

  for (const [key, candidates] of Object.entries(SHEET_TAB_CANDIDATES)) {
    const extractor = SHEET_EXTRACTORS[key];
    let matched = null; // kandidat yang isinya benar-benar cocok
    let lastAttempt = null; // kandidat yang ADA tapi isinya tidak cocok (untuk diagnostik)

    for (const name of candidates) {
      try {
        const rows = await fetchSheetTabRows(sheetId, name);
        if (!rows || rows.length === 0) continue;

        const parsed = extractor(rows);
        if (parsed) {
          matched = { tabName: name, rows, parsed };
          break; // isinya valid -- berhenti, tidak perlu coba nama lain
        }

        // Tab dengan nama ini ADA, tapi isinya tidak cocok sebagai data
        // jenis ini (mis. tab lain yang kebetulan namanya mirip). Simpan
        // untuk pesan diagnostik, lalu lanjut coba nama kandidat berikutnya
        // -- JANGAN langsung menyerah di sini.
        const headerIdx = findHeaderRowIndex(rows);
        lastAttempt = { tabName: name, headerRow: headerIdx !== -1 ? rows[headerIdx] : null };
      } catch (err) {
        // nama tab ini tidak ada / gagal diambil -- lanjut coba nama berikutnya
      }
    }

    if (matched) {
      if (key === "rekap") rawRekap = matched.parsed;
      else if (key === "usia") rawUsia = matched.parsed;
      else if (key === "meninggal") rawMeninggal = matched.parsed;
      else if (key === "pindah") rawPindah = matched.parsed;
      else if (key === "beritaAcara") rawBeritaAcara = matched.parsed;
      successCount++;
      const hIdx = findHeaderRowIndex(matched.rows);
      diagnostics[key] = {
        status: "ok",
        tabName: matched.tabName,
        headerRow: hIdx !== -1 ? matched.rows[hIdx] : null,
        rowCount: matched.parsed.length,
      };
    } else if (lastAttempt) {
      failedTabs.push(lastAttempt.tabName);
      diagnostics[key] = {
        status: lastAttempt.headerRow ? "header_not_recognized" : "no_header_row",
        tabName: lastAttempt.tabName,
        headerRow: lastAttempt.headerRow,
      };
    } else {
      diagnostics[key] = { status: "tab_not_found", triedNames: candidates };
      if (key !== "beritaAcara") failedTabs.push(candidates[0]);
    }
  }

  lastSheetDiagnostics = diagnostics;
  return { attempted: true, success: successCount > 0, failedTabs };
}

function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const updatedTypes = [];
      const failedSheets = [];

      workbook.SheetNames.forEach((sheetName) => {
        try {
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          if (!rows || rows.length === 0) return;

          const headerIdx = findHeaderRowIndex(rows);
          const headerRow = headerIdx !== -1 ? rows[headerIdx] : rows[0];
          const type = detectSheetType(sheetName, headerRow);

          if (type === "rekap") {
            const parsed = extractRekap(rows);
            if (parsed) { rawRekap = parsed; updatedTypes.push("rekap"); }
            else failedSheets.push(sheetName);
          } else if (type === "usia") {
            const parsed = extractUsia(rows);
            if (parsed) { rawUsia = parsed; updatedTypes.push("usia"); }
            else failedSheets.push(sheetName);
          } else if (type === "meninggal") {
            const parsed = extractMutasi(rows);
            if (parsed) { rawMeninggal = parsed; updatedTypes.push("meninggal"); }
            else failedSheets.push(sheetName);
          } else if (type === "pindah") {
            const parsed = extractMutasi(rows);
            if (parsed) { rawPindah = parsed; updatedTypes.push("pindah"); }
            else failedSheets.push(sheetName);
          } else {
            // Struktur kolom tidak dikenali sama sekali: coba tiap parser
            // sebagai upaya terakhir sebelum menyerah pada sheet ini.
            const asRekap = extractRekap(rows);
            if (asRekap) {
              rawRekap = asRekap;
              updatedTypes.push("rekap");
              return;
            }
            const asUsia = extractUsia(rows);
            if (asUsia) {
              rawUsia = asUsia;
              updatedTypes.push("usia");
              return;
            }
            failedSheets.push(sheetName);
          }
        } catch (sheetErr) {
          // Satu sheet bermasalah tidak boleh menggagalkan sheet lainnya.
          console.error(`Gagal memproses sheet "${sheetName}":`, sheetErr);
          failedSheets.push(sheetName);
        }
      });

      if (updatedTypes.length > 0) {
        refreshTahapanFilterUI();

        const labelText = updatedTypes.map((t) => TYPE_LABELS[t]).join(", ");
        document.getElementById("db-status-badge").textContent = `Database: Custom (${file.name})`;
        const statusEl = document.getElementById("uploadStatus");
        let msg = `<i class="fa-solid fa-circle-check mr-1"></i> Berhasil diperbarui: ${labelText}`;
        if (failedSheets.length > 0) {
          msg += `<br><span class="text-amber-600"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Sheet dilewati (format tidak dikenali): ${failedSheets.join(", ")}</span>`;
        }
        statusEl.innerHTML = msg;
        statusEl.classList.remove("hidden");

        const nextTab = updatedTypes.includes("rekap") ? "rekap" : updatedTypes[0];
        setTimeout(() => switchTab(nextTab), 1500);
      } else {
        alert(
          "Format struktur Excel tidak dikenali di sheet manapun" +
          (failedSheets.length ? ` (${failedSheets.join(", ")})` : "") + ".\n\n" +
          "Pastikan file memuat kolom Kecamatan (atau Kategori/Generasi/Usia untuk data usia), Laki-Laki, dan Perempuan. " +
          "Untuk data Meninggal/Pindah, beri nama sheet \"Meninggal\" atau \"Pindah\" agar terbaca tepat."
        );
      }
    } catch (err) {
      console.error(err);
      alert("Gagal membaca file Excel. Pastikan format file benar.");
    }
  };
  reader.readAsArrayBuffer(file);
}

// --------------------------------------------------------------------------
// 8. INISIALISASI
// --------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  // Render dulu dengan data lokal (data.js / fallback) supaya halaman
  // langsung tampil tanpa menunggu jaringan.
  initCharts();
  initSebaranMap();
  refreshTahapanFilterUI();
  renderBeritaAcaraLists();
  switchTab("home");

  const badge = document.getElementById("db-status-badge");

  if (isSheetConfigured()) {
    if (badge) badge.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>Memuat data terbaru...';

    const result = await loadFromGoogleSheets();

    if (result.success) {
      refreshTahapanFilterUI();
      renderBeritaAcaraLists();
      if (badge) {
        badge.className = "bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1 rounded-full";
        badge.innerHTML = '<i class="fa-solid fa-signal mr-1"></i>Live dari Google Sheets';
      }
      if (result.failedTabs.length > 0) {
        console.warn("Sebagian tab Google Sheets tidak terbaca:", result.failedTabs.join(", "));
      }
    } else if (badge) {
      badge.className = "bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1 rounded-full";
      badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation mr-1"></i>Google Sheets gagal dimuat, pakai data lokal';
    }

    renderSheetDiagnostics();
  }
});
