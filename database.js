import admin from 'firebase-admin';

// Initialisierung von Firebase Admin
// In Cloud Run werden die "Application Default Credentials" automatisch verwendet.
// Lokal kann die Umgebungsvariable GOOGLE_APPLICATION_CREDENTIALS auf eine JSON-Datei zeigen.
if (!admin.apps.length) {
  admin.initializeApp({
    // projectID wird automatisch erkannt, wenn in GCP/Cloud Run
    // Falls lokal: process.env.FIREBASE_PROJECT_ID nutzen
  });
}

const db = admin.firestore();

// Wir exportieren die db-Instanz, damit server.js sie nutzen kann
export default db;
