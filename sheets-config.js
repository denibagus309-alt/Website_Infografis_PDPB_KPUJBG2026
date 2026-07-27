/* ==========================================================================
   PDPB 2026 - Konfigurasi Google Sheets
   Ini SATU-SATUNYA baris yang perlu kamu ubah untuk mengaktifkan mode
   "data langsung dari Google Sheets" (viewer publik otomatis ikut update).

   CARA MENGISI:
   1. Buka Google Sheet yang sudah kamu siapkan (lihat panduan struktur
      kolom & nama tab di README / pesan chat).
   2. Klik "Share" / "Bagikan" -> ubah General access jadi
      "Anyone with the link" -> role "Viewer" -> Done.
   3. Salin ID Sheet dari URL-nya. Contoh URL:
        https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit
      ID-nya adalah bagian di antara "/d/" dan "/edit":
        1AbCdEfGhIjKlMnOpQrStUvWxYz
   4. Tempel ID itu menggantikan teks di bawah ini.

   Kalau dibiarkan kosong / masih "PASTE_SHEET_ID_DI_SINI", aplikasi akan
   otomatis pakai data.js seperti biasa (mode offline/manual, tidak berubah).
   ========================================================================== */

window.PDPB_SHEET_ID = "PASTE_SHEET_ID_DI_SINI";
