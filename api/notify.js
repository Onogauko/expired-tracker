const admin = require('firebase-admin');
const axios = require('axios');

module.exports = async (req, res) => {

    try {

        if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
            throw new Error("Secret FIREBASE_SERVICE_ACCOUNT tidak ditemukan!");
        }

        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }

        const db = admin.firestore();

        const snapshot = await db.collection('inventory_expired').get();

        if (snapshot.empty) {
            return res.status(200).send("Tidak ada data.");
        }

        let items = [];

        // =========================
        // TANGGAL HARI INI
        // =========================
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const bulanIndo = [
            "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
            "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
        ];

        snapshot.forEach(doc => {

            const data = doc.data();

            console.log("FULL DATA:", JSON.stringify(data));
            console.log("notificationFlags RAW:", JSON.stringify(data.notificationFlags));

            if (data.expiredDate && data.itemDescription) {

                // =========================
                // FIX PERHITUNGAN EXPIRED
                // =========================
                const expDate = new Date(data.expiredDate + 'T23:59:59');

                const diffDays = Math.floor(
                    (expDate - today) / 86400000
                );

                // =========================
                // STOP NOTIF SETELAH EXPIRED
                // =========================
                if (diffDays < 0) {
                    return;
                }

                const tgl = expDate.getDate();
                const bln = bulanIndo[expDate.getMonth()];
                const thn = expDate.getFullYear();

                const formatTanggalIndo = `${tgl} ${bln} ${thn}`;

                let skuValue = "N/A";
                let qtyValue = 0;

                // =========================
                // DETEKSI SEMUA KEMUNGKINAN
                // =========================

                if (data.sku) {
                    skuValue = data.sku;
                }

                if (data.qty) {
                    qtyValue = data.qty;
                }

                if (data.notificationFlags && typeof data.notificationFlags === 'object') {

                    skuValue =
                        data.notificationFlags.sku ||
                        data.notificationFlags.SKU ||
                        skuValue;

                    qtyValue =
                        data.notificationFlags.qty ||
                        data.notificationFlags.QTY ||
                        qtyValue;
                }

                if (data.notificationFlags && typeof data.notificationFlags === 'string') {

                    try {

                        const parsed = JSON.parse(data.notificationFlags);

                        skuValue =
                            parsed.sku ||
                            parsed.SKU ||
                            skuValue;

                        qtyValue =
                            parsed.qty ||
                            parsed.QTY ||
                            qtyValue;

                    } catch (e) {
                        console.log("notificationFlags bukan JSON valid");
                    }
                }

                console.log("FINAL SKU:", skuValue);
                console.log("FINAL QTY:", qtyValue);

                items.push({
                    nama: data.itemDescription,
                    sku: skuValue,
                    qty: qtyValue,
                    expFormatted: formatTanggalIndo,
                    daysLeft: diffDays
                });
            }
        });

        // =========================
        // SORT TERDEKAT
        // =========================
        items.sort((a, b) => a.daysLeft - b.daysLeft);

        if (items.length > 0) {

            let report = `⚠️ *LAPORAN EXPIRED*\n`;
            report += `Halo Team, ada ${items.length} barang perlu dicek.\n`;
            report += `(Diurutkan dari expired terdekat)\n\n`;

            items.forEach((item, index) => {

                report += `${index + 1}. *${item.nama.toUpperCase()}*\n`;
                report += `    🔖 SKU: ${item.sku}\n`;
                report += `    📦 Qty: ${item.qty}\n`;
                report += `    ⏳ Exp: ${item.expFormatted} (${item.daysLeft} hari lagi)\n\n`;

            });

            await axios.post(
                'https://api.fonnte.com/send',
                {
                    target: process.env.WA_TARGET,
                    message: report.trim()
                },
                {
                    headers: {
                        Authorization: process.env.FONNTE_TOKEN
                    }
                }
            );

        }

        return res.status(200).send("Notif berhasil dikirim.");

    } catch (err) {

        console.error("ERROR:", err);

        return res.status(500).send(err.message);

    }
};
