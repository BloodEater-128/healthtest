// config/firebase.admin.js
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Construct path to serviceAccountKey.json correctly in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.resolve(__dirname, "../../config/serviceAccountKey.json");

// Read and parse the JSON file manually (avoids ES module import assertions issue)
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

export const auth = admin.auth();
export const db = new admin.firestore.Firestore({
  projectId: serviceAccount.project_id,
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key
  },
  databaseId: "users" // ⚠️ Targets the custom named database!
});
export default admin;
