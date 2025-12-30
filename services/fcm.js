import admin from "firebase-admin";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || "eu-north-1",
});

let firebaseInitialized = false;

async function initFirebase() {
  if (firebaseInitialized) return;

  const secretArn = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!secretArn) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT env variable not set");
  }

  // ✅ Fetch secret value from AWS Secrets Manager
  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: secretArn,
    })
  );

  const serviceAccount = JSON.parse(response.SecretString);

  // ✅ Validate required fields (prevents silent crash)
  if (!serviceAccount.project_id) {
    throw new Error("Firebase service account missing project_id");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  firebaseInitialized = true;
  console.log("✅ Firebase Admin initialized");
}

// ✅ NAMED EXPORT (matches your controller import)
export async function sendPush(tokens, title, body) {
  if (!Array.isArray(tokens) || tokens.length === 0) return;

  await initFirebase();

  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title,
      body,
    },
    android: { priority: "high" },
  });
}
