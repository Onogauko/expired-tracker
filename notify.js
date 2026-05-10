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

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.expiredDate && data.itemDescription) {
                const expDate = new Date(data.expiredDate);
                const diffTime = expDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                // Hanya ambil yang belum lewat atau segera expired (misal H-120 ke bawah)
                if (diffDays >= 0) {
                    items.push({
                        nama: data.itemDescription,
                        sku: data.notificationFlags ? data.notificationFlags.sku : "N/A",
                        qty: data.notificationFlags ? data.notificationFlags.qty : 0,
                        exp: data.expiredDate,
                        daysLeft: diffDays,
                        rawDate: expDate
                    });
                }
            }
        });

        // Urutkan dari yang terdekat (paling kecil sisa harinya)
        items.sort((a, b) => a.daysLeft - b.daysLeft);

        if (items.length > 0) {
            let report = `⚠️ *LAPORAN EXPIRED*\nHalo Team, ada ${items.length} barang perlu dicek (Diurutkan dari yang terdekat):\n\n`;
            
            items.forEach((item, index) => {
                // Format tanggal ke gaya Indonesia (opsional, saat ini mengikuti database)
                report += `${index + 1}. *${item.nama.toUpperCase()}*\n`;
                report += `    🔖 SKU: ${item.sku}\n`;
                report += `    📦 Qty: ${item.qty}\n`;
                report += `    ⏳ Exp: ${item.exp} (${item.daysLeft} hari lagi)\n\n`;
            });

            await axios.post('https://api.fonnte.com/send', {
                target: process.env.WA_TARGET,
                message: report.trim()
            }, {
                headers: { 'Authorization': process.env.FONNTE_TOKEN }
            });
            console.log("Laporan rapi berhasil dikirim!");
        }

    } catch (err) {
        console.error("DETEKSI ERROR:", err.message);
        process.exit(1);
    }
}

run();
