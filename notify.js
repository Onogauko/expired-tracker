const admin = require('firebase-admin');
const axios = require('axios');

async function run() {
    try {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error("Secret FIREBASE_SERVICE_ACCOUNT tidak ditemukan!");

        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        
        if (!admin.apps.length) {
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        }

        const db = admin.firestore();
        const snapshot = await db.collection('inventory_expired').get();
        
        if (snapshot.empty) return;

        let items = [];
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const bulanIndo = [
            "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
            "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
        ];

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.expiredDate && data.itemDescription) {
                const expDate = new Date(data.expiredDate);
                const diffTime = expDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                const tgl = expDate.getDate();
                const bln = bulanIndo[expDate.getMonth()];
                const thn = expDate.getFullYear();
                const formatTanggalIndo = `${tgl} ${bln} ${thn}`;

                // PERBAIKAN KRUSIAL: Memastikan akses ke notificationFlags
                const flags = data.notificationFlags || {};
                const skuValue = flags.sku || "N/A";
                const qtyValue = flags.qty || 0;

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

        items.sort((a, b) => a.daysLeft - b.daysLeft);

        if (items.length > 0) {
            let report = `⚠️ *LAPORAN EXPIRED*\nHalo Team, ada ${items.length} barang perlu dicek (Diurutkan dari yang terdekat):\n\n`;
            
            items.forEach((item, index) => {
                report += `${index + 1}. *${item.nama.toUpperCase()}*\n`;
                report += `    🔖 SKU: ${item.sku}\n`;
                report += `    📦 Qty: ${item.qty}\n`;
                report += `    ⏳ Exp: ${item.expFormatted} (${item.daysLeft} hari lagi)\n\n`;
            });

            await axios.post('https://api.fonnte.com/send', {
                target: process.env.WA_TARGET,
                message: report.trim()
            }, {
                headers: { 'Authorization': process.env.FONNTE_TOKEN }
            });
            console.log("Laporan terkirim dengan SKU dan Qty yang sudah diperbaiki.");
        }

    } catch (err) {
        console.error("DETEKSI ERROR:", err.message);
        process.exit(1);
    }
}

run();
