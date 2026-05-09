const admin = require('firebase-admin');
const axios = require('axios');

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error("ERROR: Secret FIREBASE_SERVICE_ACCOUNT tidak ditemukan!");
    process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkExpiry() {
    console.log("Memulai pengecekan database...");
    const now = new Date();
    const inventoryRef = db.collection('inventory_expired');
    const snapshot = await inventoryRef.get();

    if (snapshot.empty) {
        console.log("Database kosong, tidak ada yang perlu dikirim.");
        return;
    }

    let message = "*PENGINGAT BARANG EXPIRED*\n\n";
    let found = false;

    snapshot.forEach(doc => {
        const data = doc.data();
        const expDate = new Date(data.expiryDate);
        const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));

        if (diffDays <= 30) {
            message += `- *${data.itemName}*\n  SKU: ${data.sku}\n  Exp: ${data.expiryDate} (${diffDays} hari lagi)\n\n`;
            found = true;
        }
    });

    if (found) {
        console.log("Mengirim ke WhatsApp...");
        await axios.post('https://api.fonnte.com/send', {
            target: process.env.WA_TARGET,
            message: message
        }, {
            headers: { 'Authorization': process.env.FONNTE_TOKEN }
        });
        console.log("Pesan terkirim!");
    }
}

checkExpiry().catch(err => {
    console.error("CRITICAL ERROR:", err);
    process.exit(1);
});
