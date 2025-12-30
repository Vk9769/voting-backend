import admin from "firebase-admin";

// 🔐 Load from ENV (ECS Secret)
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT env variable not set");
}

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

// 🛑 Prevent double initialization (VERY IMPORTANT for ECS)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// ✅ Named export (matches your controller import)
export async function sendPush(tokens, title, body) {
  if (!Array.isArray(tokens) || tokens.length === 0) return;

  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title,
      body,
    },
    android: {
      priority: "high",
    },
  });
}
