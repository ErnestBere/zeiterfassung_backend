import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import db from './database.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const app = express();
app.use(cors());
app.use(express.json());

// ==========================
// HELPERS
// ==========================

// helper to apply sort and return query
const applySort = (query, sortParam) => {
  if (!sortParam) return query;
  const dir = sortParam.startsWith('-') ? 'desc' : 'asc';
  const field = sortParam.replace(/^-/, '');
  const allowed = ['created_date', 'activity_date', 'project_name', 'employee_name', 'actual_hours', 'project_number', 'name', 'role'];
  if (!allowed.includes(field)) return query;
  return query.orderBy(field, dir);
};

// helper to validate required fields
const validateRequired = (body, fields) => {
  const missing = fields.filter(f => !body[f] && body[f] !== 0);
  if (missing.length > 0) {
    return `Pflichtfelder fehlen: ${missing.join(', ')}`;
  }
  return null;
};

// ==========================
// AUTH
// ==========================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich.' });
    }

    const snapshot = await db.collection('employees')
      .where('email_lower', '==', email.trim().toLowerCase())
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(401).json({ error: 'E-Mail oder Passwort falsch.' });
    }

    const employee = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

    if (!employee.password_hash) {
      return res.status(403).json({ error: 'password_not_set', message: 'Für dieses Konto wurde noch kein Passwort vergeben.' });
    }

    const isValid = bcrypt.compareSync(password, employee.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'E-Mail oder Passwort falsch.' });
    }

    res.json({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      hourly_rate: employee.hourly_rate,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/set-password', async (req, res) => {
  try {
    const { email, password, invite_code } = req.body;
    const VALID_INVITE_CODE = process.env.invite_code || '85fce0c7af4544e48b97630d337f0141';
    
    if (invite_code?.trim() !== VALID_INVITE_CODE) {
      return res.status(403).json({ error: 'Ungültiger Invite-Code.' });
    }

    const snapshot = await db.collection('employees')
      .where('email_lower', '==', email.trim().toLowerCase())
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ error: 'Kein Konto gefunden.' });
    
    const doc = snapshot.docs[0];
    const employee = doc.data();

    if (employee.password_hash) return res.status(400).json({ error: 'Passwort bereits vergeben.' });

    const password_hash = bcrypt.hashSync(password, 10);
    await doc.ref.update({ password_hash });

    res.json({ id: doc.id, ...employee, password_hash: undefined });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    const snapshot = await db.collection('employees')
      .where('email_lower', '==', email.trim().toLowerCase())
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ exists: false });

    const employee = snapshot.docs[0].data();
    res.json({
      exists: true,
      hasPassword: !!employee.password_hash,
      name: employee.name,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// EMPLOYEES
// ==========================

app.get('/api/employees', async (req, res) => {
  try {
    let query = db.collection('employees');
    query = applySort(query, req.query.sort);
    const snapshot = await query.get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', async (req, res) => {
  try {
    const data = req.body;
    const error = validateRequired(data, ['name']);
    if (error) return res.status(400).json({ error });

    const created_date = new Date().toISOString();
    const email_lower = data.email ? data.email.toLowerCase() : null;
    
    const docRef = await db.collection('employees').add({
      role: 'MA',
      ...data,
      email_lower,
      created_date
    });
    res.json({ id: docRef.id, ...data, created_date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const data = req.body;
    const email_lower = data.email ? data.email.toLowerCase() : null;
    await db.collection('employees').doc(req.params.id).update({
      ...data,
      email_lower
    });
    res.json({ id: req.params.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    await db.collection('employees').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// PROJECTS
// ==========================

app.get('/api/projects', async (req, res) => {
  try {
    let query = db.collection('projects');
    query = applySort(query, req.query.sort);
    const snapshot = await query.get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const data = req.body;
    const error = validateRequired(data, ['project_number', 'project_name']);
    if (error) return res.status(400).json({ error });

    const created_date = new Date().toISOString();
    const docRef = await db.collection('projects').add({
      payment_terms: 30,
      vat_rate: 19,
      ...data,
      created_date
    });
    res.json({ id: docRef.id, ...data, created_date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const data = req.body;
    await db.collection('projects').doc(req.params.id).update(data);
    res.json({ id: req.params.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const id = req.params.id;
    // Cascade delete activities
    const activities = await db.collection('activities').where('project_id', '==', id).get();
    const batch = db.batch();
    activities.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('projects').doc(id));
    await batch.commit();
    res.json({ success: true, deletedActivities: activities.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// SUBPROJECTS
// ==========================

app.get('/api/subprojects', async (req, res) => {
  try {
    const { project_id } = req.query;
    let query = db.collection('subprojects');
    if (project_id) query = query.where('project_id', '==', project_id);
    const snapshot = await query.orderBy('name').get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subprojects', async (req, res) => {
  try {
    const data = req.body;
    const error = validateRequired(data, ['project_id', 'name']);
    if (error) return res.status(400).json({ error });

    const created_date = new Date().toISOString();
    const docRef = await db.collection('subprojects').add({
      ...data,
      created_date
    });
    res.json({ id: docRef.id, ...data, created_date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/subprojects/:id', async (req, res) => {
  try {
    const data = req.body;
    await db.collection('subprojects').doc(req.params.id).update(data);
    res.json({ id: req.params.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/subprojects/:id', async (req, res) => {
  try {
    await db.collection('subprojects').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// ACTIVITIES
// ==========================

app.get('/api/activities', async (req, res) => {
  try {
    let query = db.collection('activities');
    query = applySort(query, req.query.sort);
    const snapshot = await query.get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/activities', async (req, res) => {
  try {
    const data = req.body;
    const error = validateRequired(data, ['project_id', 'description', 'activity_date', 'actual_hours']);
    if (error) return res.status(400).json({ error });

    const created_date = new Date().toISOString();
    const docRef = await db.collection('activities').add({
      status: 'offen',
      ...data,
      created_date
    });
    res.json({ id: docRef.id, ...data, created_date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/activities/:id', async (req, res) => {
  try {
    const data = req.body;
    await db.collection('activities').doc(req.params.id).update(data);
    res.json({ id: req.params.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/activities/:id', async (req, res) => {
  try {
    await db.collection('activities').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// BATCH STATUS UPDATES
// ==========================

app.post('/api/activities/confirm', async (req, res) => {
  try {
    const { activity_ids, confirmed_by } = req.body;
    const confirmed_at = new Date().toISOString();
    const batch = db.batch();
    
    activity_ids.forEach(id => {
      batch.update(db.collection('activities').doc(id), {
        status: 'bestätigt',
        confirmed_at,
        confirmed_by: confirmed_by || null
      });
    });
    
    await batch.commit();
    res.json({ success: true, confirmed: activity_ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/activities/approve', async (req, res) => {
  try {
    const { activity_ids, approved_by } = req.body;
    const approved_at = new Date().toISOString();
    const batch = db.batch();
    
    activity_ids.forEach(id => {
      batch.update(db.collection('activities').doc(id), {
        status: 'freigegeben',
        approved_at,
        approved_by: approved_by || null
      });
    });
    
    await batch.commit();
    res.json({ success: true, approved: activity_ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/activities/reset-status', async (req, res) => {
  try {
    const { activity_ids } = req.body;
    const batch = db.batch();
    activity_ids.forEach(id => {
      batch.update(db.collection('activities').doc(id), {
        status: 'offen',
        confirmed_at: null,
        confirmed_by: null,
        approved_at: null,
        approved_by: null
      });
    });
    await batch.commit();
    res.json({ success: true, reset: activity_ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// TIMESHEETS
// ==========================

app.get('/api/timesheets', async (req, res) => {
  try {
    const snapshot = await db.collection('timesheets').orderBy('month', 'desc').get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/timesheets/confirm', async (req, res) => {
  try {
    const { employee_name, project_id, month, confirmed_by } = req.body;
    const snapshot = await db.collection('timesheets')
      .where('employee_name', '==', employee_name)
      .where('project_id', '==', project_id)
      .where('month', '==', month)
      .limit(1)
      .get();

    const now = new Date().toISOString();
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      if (doc.data().status !== 'offen') return res.status(400).json({ error: 'Status nicht offen.' });
      await doc.ref.update({ status: 'MA bestätigt', confirmed_at: now, confirmed_by });
      return res.json({ id: doc.id, ...doc.data(), status: 'MA bestätigt' });
    } else {
      const docRef = await db.collection('timesheets').add({
        employee_name, project_id, month, status: 'MA bestätigt', confirmed_at: now, confirmed_by, created_date: now
      });
      res.json({ id: docRef.id, employee_name, project_id, month, status: 'MA bestätigt' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/timesheets/approve', async (req, res) => {
  try {
    const { id, approved_by } = req.body;
    const now = new Date().toISOString();
    await db.collection('timesheets').doc(id).update({
      status: 'GF freigegeben',
      approved_at: now,
      approved_by
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/timesheets/reset', async (req, res) => {
  try {
    await db.collection('timesheets').doc(req.body.id).update({
      status: 'offen',
      confirmed_at: null,
      confirmed_by: null,
      approved_at: null,
      approved_by: null
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/timesheets/:id', async (req, res) => {
  try {
    await db.collection('timesheets').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// PROJECT BILLINGS
// ==========================

app.get('/api/project-billings', async (req, res) => {
  try {
    const snapshot = await db.collection('project_billings').get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/project-billings', async (req, res) => {
  try {
    const { project_id, month, invoiced, payment_date, paid } = req.body;
    const snapshot = await db.collection('project_billings')
      .where('project_id', '==', project_id)
      .where('month', '==', month)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({ invoiced, payment_date, paid });
      res.json({ id: snapshot.docs[0].id, ...req.body });
    } else {
      const docRef = await db.collection('project_billings').add({
        ...req.body,
        created_date: new Date().toISOString()
      });
      res.json({ id: docRef.id, ...req.body });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, async () => {
  console.log(`Backend Server running on port ${PORT}`);
  
  // Seed: Thomas (GF) anlegen falls er fehlt
  try {
    const thomasEmail = 'thomas.kedzierski@projektwaerts.de';
    const snapshot = await db.collection('employees')
      .where('email_lower', '==', thomasEmail.toLowerCase())
      .limit(1)
      .get();
      
    if (snapshot.empty) {
      const password_hash = bcrypt.hashSync('zeit-beta-2026', 10);
      const created_date = new Date().toISOString();
      await db.collection('employees').add({
        name: 'Thomas Kedzierski',
        email: thomasEmail,
        email_lower: thomasEmail.toLowerCase(),
        role: 'GF',
        hourly_rate: null,
        password_hash,
        created_date
      });
      console.log('✅ Seed: Thomas Kedzierski (Inhaber) in Firestore angelegt.');
    } else {
      console.log('ℹ️ Seed: Thomas Kedzierski bereits vorhanden.');
    }
  } catch (err) {
    console.error('❌ Seed Fehler:', err.message);
  }
});
