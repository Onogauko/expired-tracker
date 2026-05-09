const axios = require('axios');
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function sendNotification() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const alertDays = [90, 60, 30, 15, 14, 10, 7, 3, 1, 0];
    const snapshot = await db.collection('inventory_expired').get();

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const expDate = new Date(data.expiredDate);
        const diffTime = expDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (alertDays.includes(diffDays)) {
            const flagKey = `h${diffDays}`;
            if (!data.notificationFlags || !data.notificationFlags[flagKey]) {
                const message = `⚠️ *EXPIRY ALERT H-${diffDays}*\n\n` +
                                `Produk: ${data.itemDescription}\n` +
                                `SKU: ${data.sku}\n` +
                                `Expired: ${data.expiredDate}\n` +
                                `PIC: ${data.pic}\n\n` +
                                `Mohon segera cek stok!`;
                try {
                    await axios.post('https://api.fonnte.com/send', {
                        target: process.env.WA_TARGET,
                        message: message,
                    }, {
                        headers: { 'Authorization': process.env.FONNTE_TOKEN }
                    });
                    await doc.ref.update({ [`notificationFlags.${flagKey}`]: true });
                } catch (err) {
                    console.error(`Error: ${err.message}`);
                }
            }
        }
    }
}
sendNotification();
