/* ==========================================================================
   PDPB 2026 - Data Pemilih
   File ini dipakai bersama oleh index.html (mode Admin) dan viewer.html
   (mode Publik/Viewer). Cara memperbarui data publik:
     1. Buka index.html, import Excel seperti biasa.
     2. Di menu "Import Database Excel", klik "Unduh data.js untuk Viewer".
     3. Timpa file data.js di server/hosting dengan file yang baru diunduh.
     4. viewer.html akan otomatis menampilkan data terbaru untuk semua
        pengunjung pada kunjungan berikutnya.

   Catatan: seluruh angka di bawah ini adalah DATA CONTOH (dummy) untuk
   keperluan demonstrasi tampilan.
   ========================================================================== */

window.PDPB_DATA = {
  rekap: [
    { no: 1,  kecamatan: "Kecamatan Anggrek",    desa: 8,  l: 45000, p: 44700, total: 89700 },
    { no: 2,  kecamatan: "Kecamatan Melati",     desa: 6,  l: 38500, p: 39200, total: 77700 },
    { no: 3,  kecamatan: "Kecamatan Cempaka",    desa: 10, l: 52300, p: 51800, total: 104100 },
    { no: 4,  kecamatan: "Kecamatan Kenanga",    desa: 5,  l: 29800, p: 30500, total: 60300 },
    { no: 5,  kecamatan: "Kecamatan Flamboyan",  desa: 12, l: 61200, p: 60100, total: 121300 },
    { no: 6,  kecamatan: "Kecamatan Mawar",      desa: 7,  l: 33400, p: 34200, total: 67600 },
    { no: 7,  kecamatan: "Kecamatan Tanjung",    desa: 9,  l: 47600, p: 46900, total: 94500 },
    { no: 8,  kecamatan: "Kecamatan Bunga Raya", desa: 11, l: 55900, p: 56700, total: 112600 },
    { no: 9,  kecamatan: "Kecamatan Sejahtera",  desa: 6,  l: 40100, p: 39800, total: 79900 },
    { no: 10, kecamatan: "Kecamatan Makmur",     desa: 8,  l: 36700, p: 37500, total: 74200 },
    { no: 11, kecamatan: "Kecamatan Damai",      desa: 10, l: 48300, p: 49600, total: 97900 },
    { no: 12, kecamatan: "Kecamatan Harapan",    desa: 14, l: 35084, p: 34732, total: 69816 },
  ],

  meninggal: [
    { no: 1, kecamatan: "Kecamatan Anggrek",    l: 42,  p: 51,  jml: 93 },
    { no: 2, kecamatan: "Kecamatan Melati",     l: 30,  p: 27,  jml: 57 },
    { no: 3, kecamatan: "Kecamatan Cempaka",    l: 58,  p: 64,  jml: 122 },
    { no: 4, kecamatan: "Kecamatan Kenanga",    l: 19,  p: 22,  jml: 41 },
    { no: 5, kecamatan: "Kecamatan Flamboyan",  l: 71,  p: 68,  jml: 139 },
    { no: 6, kecamatan: "Kecamatan Mawar",      l: 25,  p: 28,  jml: 53 },
    { no: 7, kecamatan: "Kecamatan Tanjung",    l: 44,  p: 40,  jml: 84 },
    { no: 8, kecamatan: "Kecamatan Bunga Raya", l: 61,  p: 66,  jml: 127 },
  ],

  pindah: [
    { no: 1, kecamatan: "Kecamatan Anggrek",    l: 18, p: 21, jml: 39 },
    { no: 2, kecamatan: "Kecamatan Melati",     l: 12, p: 15, jml: 27 },
    { no: 3, kecamatan: "Kecamatan Cempaka",    l: 27, p: 24, jml: 51 },
    { no: 4, kecamatan: "Kecamatan Kenanga",    l: 9,  p: 11, jml: 20 },
    { no: 5, kecamatan: "Kecamatan Flamboyan",  l: 33, p: 30, jml: 63 },
    { no: 6, kecamatan: "Kecamatan Sejahtera",  l: 14, p: 17, jml: 31 },
    { no: 7, kecamatan: "Kecamatan Makmur",     l: 10, p: 9,  jml: 19 },
    { no: 8, kecamatan: "Kecamatan Damai",      l: 20, p: 23, jml: 43 },
  ],

  usia: [
    { kategori: "Gen Z (1997-2012)",        l: 131496, p: 122575, total: 254069 },
    { kategori: "Milenial (1981-1996)",     l: 161673, p: 154347, total: 316020 },
    { kategori: "Gen X (1965-1980)",        l: 147083, p: 150171, total: 297254 },
    { kategori: "Baby Boomer (1946-1964)",  l: 74694,  p: 83425,  total: 158119 },
    { kategori: "Pre Boomer (<=1945)",      l: 8938,   p: 15214,  total: 24152 },
  ],
};
