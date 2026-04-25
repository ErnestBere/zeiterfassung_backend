import admin from 'firebase-admin';
import bcrypt from 'bcryptjs';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Seed: Thomas als Inhaber (GF) anlegen falls nicht vorhanden
async function seedDatabase() {
  try {
    const employeesRef = db.collection('employees');
    const thomasQuery = await employeesRef
      .where('email_lower', '==', 'thomas.kedzierski@projektwaerts.de')
      .limit(1)
      .get();

    if (thomasQuery.empty) {
      const password_hash = bcrypt.hashSync('zeit-beta-2026', 10);
      const thomasData = {
        name: 'Thomas Kedzierski',
        email: 'thomas.kedzierski@projektwaerts.de',
        email_lower: 'thomas.kedzierski@projektwaerts.de',
        role: 'GF',
        hourly_rate: null,
        password_hash: password_hash,
        created_date: new Date().toISOString()
      };
      
      await employeesRef.add(thomasData);
      console.log('✅ Seed: Thomas Kedzierski (Inhaber) angelegt.');
    } else {
      const thomas = thomasQuery.docs[0];
      const thomasData = thomas.data();
      
      if (!thomasData.password_hash) {
        const password_hash = bcrypt.hashSync('zeit-beta-2026', 10);
        await thomas.ref.update({ 
          password_hash: password_hash,
          role: 'GF'
        });
        console.log('✅ Seed: Passwort-Hash für Thomas Kedzierski nachgetragen.');
      } else {
        console.log('ℹ️  Seed: Thomas Kedzierski bereits vollständig konfiguriert.');
      }
    }
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  }
}

// Seed beim Start ausführen
seedDatabase();

export default db;
