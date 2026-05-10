const admin = require('firebase-admin');
const axios = require('axios');

async function run() {
    try {

        // ================= FIREBASE =================
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

        // ================= AMBIL DATA =================
        const snapshot = await db.collection('inventory_expired').get();

        if (snapshot.empty) {
            console.log("Tidak ada data.");
            return;
        }

        let items = [];

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const bulanIndo = [
            "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
            "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
        ];

        snapshot.forEach(doc => {

            const data = doc.data();

            // ================= DEBUG =================
            console.log("FULL DATA:", JSON.stringify(data));
            console.log("notificationFlags:", data.notificationFlags);

            if (data.notificationFlags) {
                console.log("SKU:", data.notificationFlags.sku);
                console.log("QTY:", data.notificationFlags.qty);
            }

            console.log("==========================");

            // ================= VALIDASI =================
            if (data.expiredDate && data.itemDescription) {

                const expDate = new Date(data.expiredDate);

                const diffTime = expDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                const tgl = expDate.getDate();
                const bln = bulanIndo[expDate.getMonth()];
                const thn = expDate.getFullYear();

                const formatTanggalIndo = `${tgl} ${bln} ${thn}`;

                // ================= AMBIL SKU & QTY =================
                let skuValue = "N/A";
                let qtyValue = 0;

                if (data.notificationFlags) {
                    skuValue = data.notificationFlags.sku || "N/A";
                    qtyValue = data.notificationFlags.qty || 0;
                }

                // ================= FILTER BELUM EXPIRED =================
                if (diffDays >= 0) {

                    items.push({
                        nama: data.itemDescription,
                        sku: skuValue,
                        qty: qtyValue,
                        expFormatted: formatTanggalIndo,
                        daysLeft: diffDays
                    });

                }
            }
        });

        // ================= SORTING =================
        items.sort((a, b) => a.daysLeft - b.daysLeft);

        // ================= KIRIM WA =================
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

            console.log("Laporan WA berhasil terkirim.");

        } else {

            console.log("Tidak ada barang mendekati expired.");

        }

    } catch (err) {

        console.error("DETEKSI ERROR:", err);
        process.exit(1);

    }
}

run();
