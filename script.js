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
};

const SEED = (window.PDPB_DATA && window.PDPB_DATA.rekap) ? window.PDPB_DATA : FALLBACK_DATA;

let dbRekap = SEED.rekap;
let dbMeninggal = SEED.meninggal;
let dbPindah = SEED.pindah;
let dbGenerasi = SEED.usia;

// Judul halaman per tab
const pageTitles = {
  home: "Beranda & Ringkasan Eksekutif",
  rekap: "Rekapitulasi Data Pemilih per Kecamatan",
  usia: "Demografi Usia & Generasi",
  mutasi: "Mutasi Pemilih (Meninggal / Pindah Domisili)",
  import: "Import Database Excel",
  export: "Tools Unduh Laporan",
};

let chartGenInstance = null;
let chartGenderInstance = null;

// --------------------------------------------------------------------------
// 2. NAVIGASI TAB
// --------------------------------------------------------------------------

function switchTab(tab) {
  const views = ["home", "rekap", "usia", "mutasi", "import", "export"];

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

  const fileBase = `PDPB2026_${datasetKey}${keyword ? "_" + keyword.replace(/\s+/g, "-") : ""}`;

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
  doc.text(config.label, 14, 15);
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
    rekap: dbRekap,
    meninggal: dbMeninggal,
    pindah: dbPindah,
    usia: dbGenerasi,
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
    if (/kecamatan|kategori|generasi|usia/.test(text)) return i;
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
    result.push({ no: no++, kecamatan: String(row[map.kecamatan]).trim(), desa, l, p, total: l + p });
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
    result.push({ kategori: String(row[map.kategori]).trim(), l, p, total: l + p });
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
    result.push({ no: no++, kecamatan: String(row[map.kecamatan]).trim(), l, p, jml: l + p });
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
async function fetchFirstMatchingTab(sheetId, candidates) {
  for (const name of candidates) {
    try {
      const rows = await fetchSheetTabRows(sheetId, name);
      if (rows && rows.length > 0) return { rows, tabName: name };
    } catch (err) {
      // coba kandidat nama berikutnya
    }
  }
  return null;
}

// Mengambil keempat jenis data dari Google Sheets. Mengembalikan ringkasan
// tab mana yang berhasil/gagal supaya bisa dilaporkan ke pengguna.
async function loadFromGoogleSheets() {
  if (!isSheetConfigured()) return { attempted: false, success: false, failedTabs: [] };

  const sheetId = window.PDPB_SHEET_ID.trim();
  const failedTabs = [];
  let successCount = 0;

  for (const [key, candidates] of Object.entries(SHEET_TAB_CANDIDATES)) {
    try {
      const found = await fetchFirstMatchingTab(sheetId, candidates);
      if (!found) {
        failedTabs.push(candidates[0]);
        continue;
      }

      let parsed = null;
      if (key === "rekap") parsed = extractRekap(found.rows);
      else if (key === "usia") parsed = extractUsia(found.rows);
      else parsed = extractMutasi(found.rows);

      if (parsed) {
        if (key === "rekap") dbRekap = parsed;
        else if (key === "usia") dbGenerasi = parsed;
        else if (key === "meninggal") dbMeninggal = parsed;
        else if (key === "pindah") dbPindah = parsed;
        successCount++;
      } else {
        failedTabs.push(found.tabName);
      }
    } catch (err) {
      console.error(`Gagal memuat data "${key}" dari Google Sheets:`, err);
      failedTabs.push(candidates[0]);
    }
  }

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
            if (parsed) { dbRekap = parsed; updatedTypes.push("rekap"); }
            else failedSheets.push(sheetName);
          } else if (type === "usia") {
            const parsed = extractUsia(rows);
            if (parsed) { dbGenerasi = parsed; updatedTypes.push("usia"); }
            else failedSheets.push(sheetName);
          } else if (type === "meninggal") {
            const parsed = extractMutasi(rows);
            if (parsed) { dbMeninggal = parsed; updatedTypes.push("meninggal"); }
            else failedSheets.push(sheetName);
          } else if (type === "pindah") {
            const parsed = extractMutasi(rows);
            if (parsed) { dbPindah = parsed; updatedTypes.push("pindah"); }
            else failedSheets.push(sheetName);
          } else {
            // Struktur kolom tidak dikenali sama sekali: coba tiap parser
            // sebagai upaya terakhir sebelum menyerah pada sheet ini.
            const asRekap = extractRekap(rows);
            if (asRekap) {
              dbRekap = asRekap;
              updatedTypes.push("rekap");
              return;
            }
            const asUsia = extractUsia(rows);
            if (asUsia) {
              dbGenerasi = asUsia;
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
        renderAllTables();
        updateSummaryCards();

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
  renderAllTables();
  initCharts();
  updateSummaryCards();
  switchTab("home");

  const badge = document.getElementById("db-status-badge");

  if (isSheetConfigured()) {
    if (badge) badge.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>Memuat data terbaru...';

    const result = await loadFromGoogleSheets();

    if (result.success) {
      renderAllTables();
      updateSummaryCards();
      updateGenChart();
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
  }

  // Efek drag-over sederhana pada dropzone import Excel
  const dropzone = document.querySelector('label[for="excelFileDrop"]')?.parentElement;
  if (dropzone) {
    ["dragenter", "dragover"].forEach((evt) =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add("pdpb-dropzone-active");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove("pdpb-dropzone-active");
      })
    );
    dropzone.addEventListener("drop", (e) => {
      const file = e.dataTransfer.files[0];
      if (file) {
        const input = document.getElementById("excelFileDrop");
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event("change"));
      }
    });
  }
});
