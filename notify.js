const admin = require('firebase-admin');
const axios = require('axios');

async function run() {
    try {
        console.log("--- Memulai Robot Notifikasi (Versi Sate Kulit) ---");
        
        if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error("Secret FIREBASE_SERVICE_ACCOUNT tidak ditemukan!");

        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        
        if (!admin.apps.length) {
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        }

        const db = admin.firestore();
        const snapshot = await db.collection('inventory_expired').get();
        
        console.log(`Berhasil terhubung. Menemukan ${snapshot.size} dokumen.`);

        if (snapshot.empty) {
            console.log("Database kosong.");
            return;
        }

        let report = "*PENGINGAT EXPIRED (AEON)*\n\n";
        let found = false;

        snapshot.forEach(doc => {
            const data = doc.data();
            // SESUAI GAMBAR: mengambil expiredDate dan itemDescription
            const exp = data.expiredDate; 
            const nama = data.itemDescription;
            const sku = data.notificationFlags ? data.notificationFlags.sku : "N/A";

            if (exp && nama) {
                report += `- *${nama}*\n  SKU: ${sku}\n  Exp: ${exp}\n\n`;
                found = true;
            }
        });

        if (found) {
            console.log("Mengirim ke WhatsApp...");
            await axios.post('https://api.fonnte.com/send', {
                target: process.env.WA_TARGET,
                message: report
            }, {
                headers: { 'Authorization': process.env.FONNTE_TOKEN }
            });
            console.log("Pesan WA Berhasil Terkirim!");
        } else {
            console.log("Data ditemukan tapi format field salah.");
        }

    } catch (err) {
        console.error("DETEKSI ERROR:", err.message);
        process.exit(1);
    }
}

run();
