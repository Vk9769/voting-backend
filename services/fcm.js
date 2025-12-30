import admin from "firebase-admin";

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT env variable not set");
}
console.log(
  "FCM ENV EXISTS:",
  !!process.env.FIREBASE_SERVICE_ACCOUNT
);

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export async function sendPush(tokens, title, body) {
  if (!Array.isArray(tokens) || tokens.length === 0) return;

  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    android: { priority: "high" },
  });
}
