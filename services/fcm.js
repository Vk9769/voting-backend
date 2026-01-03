import admin from "firebase-admin";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || "eu-north-1",
});

let firebaseInitialized = false;
let firebaseDisabled = false;

async function initFirebase() {
  if (firebaseInitialized || firebaseDisabled) return;

  const secretArn = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!secretArn) {
    console.warn("⚠️ FCM disabled: FIREBASE_SERVICE_ACCOUNT not set");
    firebaseDisabled = true;
    return;
  }

  try {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretArn })
    );

    const serviceAccount = JSON.parse(response.SecretString);

    if (!serviceAccount.project_id) {
      throw new Error("Missing project_id");
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    firebaseInitialized = true;
    console.log("✅ Firebase Admin initialized");
  } catch (err) {
    console.error("❌ Firebase init failed:", err.message);
    firebaseDisabled = true; // disable forever for this container
  }
}

export async function sendPush(tokens, title, body) {
  try {
    await initFirebase();

    if (!firebaseInitialized) return;
    if (!Array.isArray(tokens) || tokens.length === 0) return;

    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      android: { priority: "high" },
    });
  } catch (err) {
    console.error("⚠️ Push failed (ignored):", err.message);
  }
}
