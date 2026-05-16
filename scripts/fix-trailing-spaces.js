/**
 * Einmaliges Cleanup-Script: Trailing Spaces in employee names bereinigen
 * 
 * Behebt:
 * 1. employees.name — Trailing Spaces entfernen
 * 2. activities.employee_name — Trailing Spaces entfernen
 * 
 * Ausführung:
 *   node scripts/fix-trailing-spaces.js
 * 
 * Voraussetzung: GOOGLE_APPLICATION_CREDENTIALS muss gesetzt sein
 * oder das Script muss in einer Umgebung mit Firestore-Zugriff laufen.
 */

import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function fixEmployeeNames() {
  console.log('=== Fixing employee names ===');
  const snapshot = await db.collection('employees').get();
  let fixed = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const name = data.name;
    if (name && name !== name.trim()) {
      const trimmed = name.trim();
      await doc.ref.update({ name: trimmed });
      console.log(`  ✅ Employee "${name}" → "${trimmed}" (ID: ${doc.id})`);
      fixed++;
    }
  }

  console.log(`  ${fixed} Mitarbeiter korrigiert.\n`);
  return fixed;
}

async function fixActivityEmployeeNames() {
  console.log('=== Fixing activity employee_name ===');
  const snapshot = await db.collection('activities').get();
  let fixed = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const name = data.employee_name;
    if (name && name !== name.trim()) {
      const trimmed = name.trim();
      batch.update(doc.ref, { employee_name: trimmed });
      batchCount++;
      fixed++;

      // Firestore Batch-Limit: max 500 Operationen
      if (batchCount >= 450) {
        await batch.commit();
        console.log(`  ... ${fixed} Activities bisher korrigiert (Batch committed)`);
        batch = db.batch();
        batchCount = 0;
      }
    }
  }

  // Letzten Batch committen
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`  ✅ ${fixed} Activities korrigiert.\n`);
  return fixed;
}

async function main() {
  console.log('\n🔧 Trailing-Space Cleanup gestartet...\n');

  const employeesFixed = await fixEmployeeNames();
  const activitiesFixed = await fixActivityEmployeeNames();

  console.log('=== Zusammenfassung ===');
  console.log(`  Mitarbeiter korrigiert: ${employeesFixed}`);
  console.log(`  Activities korrigiert:  ${activitiesFixed}`);
  console.log('\n✅ Fertig! Die Stundenzettel sollten jetzt korrekt gruppiert sein.\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Fehler:', err);
  process.exit(1);
});
