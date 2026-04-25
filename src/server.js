import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import db from './database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://zeiterfassung-frontend.pages.dev',
  credentials: true
}));
app.use(express.json());

// ==========================
// CONSTANTS
// ==========================

const VALID_INVITE_CODE = process.env.INVITE_CODE || process.env.invite_code;
if (!VALID_INVITE_CODE) {
  console.warn('⚠️ WARNUNG: Kein INVITE_CODE gesetzt! Erstanmeldung und Seed-User sind deaktiviert.');
}

const JWT_SECRET = process.env.JWT_SECRET || 'zeiterfassung-jwt-secret-change-me';
const JWT_EXPIRES_IN = '7d'; // Token läuft nach 7 Tagen ab

// ==========================
// AUTH MIDDLEWARE
// ==========================

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht authentifiziert.' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, name, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token ungültig oder abgelaufen.' });
  }
};

const requireGF = (req, res, next) => {
  if (req.user?.role !== 'GF') {
    return res.status(403).json({ error: 'Nur für Geschäftsführer.' });
  }
  next();
};

// ==========================
// HEALTH & INFO
// ==========================

app.get('/health', async (req, res) => {
  try {
    const employeesRef = db.collection('employees');
    const snapshot = await employeesRef.limit(1).get();
    
    res.json({ 
      status: 'healthy', 
      database: 'firestore',
      connected: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'firestore',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Zeiterfassung Backend API (Firestore)',
    version: '2.0.0',
    database: 'firestore',
    endpoints: [
      'GET /health',
      'GET /',
      'POST /api/auth/login',
      'POST /api/auth/set-password',
      'POST /api/auth/check-email',
      'POST /api/admin/seed-user',
      'GET /api/employees',
      'POST /api/employees',
      'GET /api/projects',
      'GET /api/activities'
    ]
  });
});

// ==========================
// HELPERS
// ==========================

const applySort = (query, sortParam) => {
  if (!sortParam) return query;
  const dir = sortParam.startsWith('-') ? 'desc' : 'asc';
  const field = sortParam.replace(/^-/, '');
  const allowed = ['created_date', 'activity_date', 'project_name', 'employee_name', 'actual_hours', 'project_number', 'name', 'role'];
  if (!allowed.includes(field)) return query;
  return query.orderBy(field, dir);
};

const validateRequired = (body, fields) => {
  const missing = fields.filter(f => !body[f] && body[f] !== 0);
  return missing.length > 0 ? `Pflichtfelder fehlen: ${missing.join(', ')}` : null;
};

// ==========================
// AUTH
// ==========================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich.' });

    const snapshot = await db.collection('employees')
      .where('email_lower', '==', email.trim().toLowerCase())
      .limit(1).get();

    if (snapshot.empty) return res.status(401).json({ error: 'E-Mail oder Passwort falsch.' });

    const employee = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

    if (!employee.password_hash) {
      return res.status(403).json({ error: 'password_not_set', message: 'Für dieses Konto wurde noch kein Passwort vergeben.' });
    }

    if (!bcrypt.compareSync(password, employee.password_hash)) {
      return res.status(401).json({ error: 'E-Mail oder Passwort falsch.' });
    }

    const token = jwt.sign(
      { id: employee.id, name: employee.name, email: employee.email, role: employee.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({ id: employee.id, name: employee.name, email: employee.email, role: employee.role, hourly_rate: employee.hourly_rate, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/set-password', async (req, res) => {
  try {
    const { email, password, invite_code } = req.body;
    if (invite_code?.trim() !== VALID_INVITE_CODE) return res.status(403).json({ error: 'Ungültiger Invite-Code.' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein.' });

    const snapshot = await db.collection('employees')
      .where('email_lower', '==', email.trim().toLowerCase())
      .limit(1).get();

    if (snapshot.empty) return res.status(404).json({ error: 'Kein Konto mit dieser E-Mail gefunden.' });

    const doc = snapshot.docs[0];
    if (doc.data().password_hash) return res.status(400).json({ error: 'Für dieses Konto wurde bereits ein Passwort vergeben.' });

    const password_hash = bcrypt.hashSync(password, 10);
    await doc.ref.update({ password_hash });

    const emp = doc.data();
    const token = jwt.sign(
      { id: doc.id, name: emp.name, email: emp.email, role: emp.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.json({ id: doc.id, name: emp.name, email: emp.email, role: emp.role, hourly_rate: emp.hourly_rate, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-Mail ist erforderlich.' });

    const snapshot = await db.collection('employees')
      .where('email_lower', '==', email.trim().toLowerCase())
      .limit(1).get();

    if (snapshot.empty) return res.status(404).json({ exists: false });

    const emp = snapshot.docs[0].data();
    res.json({ exists: true, hasPassword: !!emp.password_hash, name: emp.name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================
// ROUTE PROTECTION
// ==========================
// Alle /api/ Routen schützen, AUSSER Auth-Endpoints und Email-Callback
app.use('/api', (req, res, next) => {
  const openPaths = [
    '/api/auth/login',
    '/api/auth/set-password',
    '/api/auth/check-email',
    '/api/email/callback',
  ];
  if (openPaths.includes(req.path)) return next();
  // Admin seed-user ist durch invite_code geschützt
  if (req.path === '/api/admin/seed-user') return next();
  // Health & Info sind offen (kein /api/ Prefix)
  return requireAuth(req, res, next);
});

// ==========================
// ADMIN SEED
// ==========================

// POST /api/admin/seed-user — GF-Account anlegen (geschützt mit invite_code)
app.post('/api/admin/seed-user', async (req, res) => {
  try {
    const { name, email, role, invite_code } = req.body;
    if (invite_code?.trim() !== VALID_INVITE_CODE) return res.status(403).json({ error: 'Ungültiger Invite-Code.' });
    if (!name || !email) return res.status(400).json({ error: 'name und email sind erforderlich.' });

    const emailLower = email.trim().toLowerCase();
    const existing = await db.collection('employees').where('email_lower', '==', emailLower).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: 'Ein Konto mit dieser E-Mail existiert bereits.' });

    const created_date = new Date().toISOString();
    const docRef = await db.collection('employees').add({
      name: name.trim(),
      email: email.trim(),
      email_lower: emailLower,
      role: role || 'GF',
      hourly_rate: null,
      created_date,
    });

    res.json({ id: docRef.id, name, email, role: role || 'GF', message: 'Account angelegt. Passwort kann über Erstanmeldung gesetzt werden.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================
// EMPLOYEES
// ==========================

app.get('/api/employees', async (req, res) => {
  try {
    let query = db.collection('employees');
    query = applySort(query, req.query.sort);
    const snapshot = await query.get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), password_hash: undefined })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/employees', async (req, res) => {
  try {
    const data = req.body;
    const error = validateRequired(data, ['name']);
    if (error) return res.status(400).json({ error });

    const created_date = new Date().toISOString();
    const email_lower = data.email ? data.email.toLowerCase() : null;
    const docRef = await db.collection('employees').add({ role: 'MA', ...data, email_lower, created_date });
    res.json({ id: docRef.id, ...data, created_date });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const data = req.body;
    const email_lower = data.email ? data.email.toLowerCase() : null;
    await db.collection('employees').doc(req.params.id).update({ ...data, email_lower });
    res.json({ id: req.params.id, ...data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    await db.collection('employees').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/projects', async (req, res) => {
  try {
    const data = req.body;
    const error = validateRequired(data, ['project_number', 'project_name']);
    if (error) return res.status(400).json({ error });
    const created_date = new Date().toISOString();
    
    // Extrahiere initial_subprojects falls vorhanden
    const { initial_subprojects, ...projectData } = data;
    
    const docRef = await db.collection('projects').add({ payment_terms: 30, vat_rate: 19, ...projectData, created_date });
    const projectId = docRef.id;
    
    // Erstelle Subprojekte falls vorhanden
    if (initial_subprojects && Array.isArray(initial_subprojects) && initial_subprojects.length > 0) {
      const batch = db.batch();
      initial_subprojects.forEach(sub => {
        if (sub.name && sub.name.trim()) {
          const subRef = db.collection('subprojects').doc();
          batch.set(subRef, {
            project_id: projectId,
            name: sub.name.trim(),
            number: sub.number?.trim() || null,
            created_date
          });
        }
      });
      await batch.commit();
    }
    
    res.json({ id: projectId, ...projectData, created_date });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    await db.collection('projects').doc(req.params.id).update(req.body);
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const activities = await db.collection('activities').where('project_id', '==', id).get();
    const batch = db.batch();
    activities.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('projects').doc(id));
    await batch.commit();
    res.json({ success: true, deletedActivities: activities.size });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================
// SUBPROJECTS
// ==========================

app.get('/api/subprojects', async (req, res) => {
  try {
    const { project_id } = req.query;
    let query = db.collection('subprojects');
    if (project_id) query = query.where('project_id', '==', project_id);
    const snapshot = await query.get();
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sortierung im Code statt Firestore (vermeidet Composite Index)
    results.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subprojects', async (req, res) => {
  try {
    const data = req.body;
    const error = validateRequired(data, ['project_id', 'name']);
    if (error) return res.status(400).json({ error });
    const created_date = new Date().toISOString();
    const docRef = await db.collection('subprojects').add({ ...data, created_date });
    res.json({ id: docRef.id, ...data, created_date });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/subprojects/:id', async (req, res) => {
  try {
    await db.collection('subprojects').doc(req.params.id).update(req.body);
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/subprojects/:id', async (req, res) => {
  try {
    await db.collection('subprojects').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/activities', async (req, res) => {
  try {
    const data = req.body;
    const error = validateRequired(data, ['project_id', 'description', 'activity_date', 'actual_hours']);
    if (error) return res.status(400).json({ error });
    
    const created_date = new Date().toISOString();
    
    // Wenn employee_name mehrere Mitarbeiter enthält (durch Komma getrennt),
    // erstelle für jeden eine separate Tätigkeit
    const employeeNames = data.employee_name 
      ? data.employee_name.split(',').map(name => name.trim()).filter(Boolean)
      : [null];
    
    if (employeeNames.length === 1) {
      // Einzelner Mitarbeiter oder kein Mitarbeiter
      const docRef = await db.collection('activities').add({ 
        status: 'offen', 
        ...data, 
        employee_name: employeeNames[0],
        created_date 
      });
      return res.json({ id: docRef.id, ...data, employee_name: employeeNames[0], created_date });
    }
    
    // Mehrere Mitarbeiter: Erstelle separate Tätigkeiten
    const batch = db.batch();
    const createdActivities = [];
    
    for (const employeeName of employeeNames) {
      const activityData = {
        ...data,
        employee_name: employeeName,
        status: 'offen',
        created_date
      };
      const docRef = db.collection('activities').doc(); // Neue ID generieren
      batch.set(docRef, activityData);
      createdActivities.push({ id: docRef.id, ...activityData });
    }
    
    await batch.commit();
    
    // Gebe alle erstellten Tätigkeiten zurück
    res.json({ 
      success: true, 
      count: createdActivities.length,
      activities: createdActivities 
    });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.put('/api/activities/:id', async (req, res) => {
  try {
    await db.collection('activities').doc(req.params.id).update(req.body);
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/activities/:id', async (req, res) => {
  try {
    await db.collection('activities').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================
// ACTIVITY STATUS
// ==========================

app.post('/api/activities/confirm', async (req, res) => {
  try {
    const { activity_ids, confirmed_by } = req.body;
    const confirmed_at = new Date().toISOString();
    const batch = db.batch();
    activity_ids.forEach(id => batch.update(db.collection('activities').doc(id), { status: 'bestätigt', confirmed_at, confirmed_by: confirmed_by || null }));
    await batch.commit();
    res.json({ success: true, confirmed: activity_ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/activities/approve', async (req, res) => {
  try {
    const { activity_ids, approved_by } = req.body;
    const approved_at = new Date().toISOString();
    const batch = db.batch();
    activity_ids.forEach(id => batch.update(db.collection('activities').doc(id), { status: 'freigegeben', approved_at, approved_by: approved_by || null }));
    await batch.commit();
    res.json({ success: true, approved: activity_ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/activities/reset-status', async (req, res) => {
  try {
    const { activity_ids } = req.body;
    const batch = db.batch();
    activity_ids.forEach(id => batch.update(db.collection('activities').doc(id), { status: 'offen', confirmed_at: null, confirmed_by: null, approved_at: null, approved_by: null }));
    await batch.commit();
    res.json({ success: true, reset: activity_ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================
// TIMESHEETS
// ==========================

app.get('/api/timesheets', async (req, res) => {
  try {
    const snapshot = await db.collection('timesheets').orderBy('month', 'desc').get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/timesheets/confirm', async (req, res) => {
  try {
    const { employee_name, project_id, month, confirmed_by } = req.body;
    const snapshot = await db.collection('timesheets')
      .where('employee_name', '==', employee_name)
      .where('project_id', '==', project_id)
      .where('month', '==', month)
      .limit(1).get();

    const now = new Date().toISOString();
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      if (doc.data().status !== 'offen') return res.status(400).json({ error: 'Status nicht offen.' });
      await doc.ref.update({ status: 'MA bestätigt', confirmed_at: now, confirmed_by });
      return res.json({ id: doc.id, ...doc.data(), status: 'MA bestätigt' });
    } else {
      const docRef = await db.collection('timesheets').add({ employee_name, project_id, month, status: 'MA bestätigt', confirmed_at: now, confirmed_by, created_date: now });
      res.json({ id: docRef.id, employee_name, project_id, month, status: 'MA bestätigt' });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/timesheets/approve', async (req, res) => {
  try {
    const { id, approved_by } = req.body;
    const now = new Date().toISOString();
    await db.collection('timesheets').doc(id).update({ status: 'GF freigegeben', approved_at: now, approved_by });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/timesheets/reset', async (req, res) => {
  try {
    await db.collection('timesheets').doc(req.body.id).update({ status: 'offen', confirmed_at: null, confirmed_by: null, approved_at: null, approved_by: null });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/timesheets/:id', async (req, res) => {
  try {
    await db.collection('timesheets').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================
// PROJECT BILLINGS
// ==========================

app.get('/api/project-billings', async (req, res) => {
  try {
    const snapshot = await db.collection('project_billings').get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/project-billings', async (req, res) => {
  try {
    const { project_id, month, invoiced, payment_date, paid } = req.body;
    const snapshot = await db.collection('project_billings')
      .where('project_id', '==', project_id)
      .where('month', '==', month)
      .limit(1).get();

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({ invoiced, payment_date, paid });
      res.json({ id: snapshot.docs[0].id, ...req.body });
    } else {
      const docRef = await db.collection('project_billings').add({ ...req.body, created_date: new Date().toISOString() });
      res.json({ id: docRef.id, ...req.body });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================
// EMAIL TEMPLATES
// ==========================

app.get('/api/email/templates', async (req, res) => {
  try {
    const doc = await db.collection('app_settings').doc('email_templates').get();
    if (!doc.exists) {
      return res.json({ 
        subject: "Stundenzettel {month} - {project_number} {project_name}",
        body: `Sehr geehrte Frau/Herr {project_leader_lastname},\n\nanbei erhalten Sie den Stundenzettel für {month}.\n\nProjekt: {project_number} - {project_name}\nProjektleiter: {project_leader}\nMitarbeiter: {employee_name}\nGesamtstunden: {total_hours}\n\nMit freundlichen Grüßen\n{sender_name}`
      });
    }
    res.json(doc.data());
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/email/templates', async (req, res) => {
  try {
    const { subject, body } = req.body;
    if (!subject || !body) return res.status(400).json({ error: 'subject und body sind erforderlich.' });
    
    await db.collection('app_settings').doc('email_templates').set({ 
      subject, 
      body, 
      updated_at: new Date().toISOString() 
    }, { merge: true });
    
    res.json({ success: true, subject, body });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// ==========================
// EMAIL (Microsoft Graph API — OAuth Delegated Flow)
// ==========================

async function getStoredTokens() {
  const doc = await db.collection('app_settings').doc('ms_oauth').get();
  if (!doc.exists) return null;
  return doc.data();
}

async function storeTokens(tokens) {
  await db.collection('app_settings').doc('ms_oauth').set({ ...tokens, updated_at: new Date().toISOString() }, { merge: true });
}

function replacePlaceholders(text, data) {
  if (!text) return text;
  
  // Extrahiere Vor- und Nachname aus project_leader
  let firstName = '';
  let lastName = '';
  let isMultipleLeaders = false;
  
  if (data.project_leader) {
    // Prüfe ob mehrere Projektleiter (durch Komma getrennt)
    const leaders = data.project_leader.split(',').map(l => l.trim()).filter(Boolean);
    isMultipleLeaders = leaders.length > 1;
    
    if (isMultipleLeaders) {
      // Bei mehreren PLs: Neutrale Anrede
      firstName = '';
      lastName = '';
    } else {
      // Bei einem PL: Extrahiere Vor- und Nachname
      const parts = leaders[0].trim().split(' ');
      if (parts.length > 1) {
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
      } else {
        lastName = parts[0];
      }
    }
  }
  
  // Ersetze Platzhalter
  let result = text
    .replace(/{month}/g, data.month || '')
    .replace(/{project_number}/g, data.project_number || '')
    .replace(/{project_name}/g, data.project_name || '')
    .replace(/{project_leader}/g, data.project_leader || '')
    .replace(/{employee_name}/g, data.employee_name || '')
    .replace(/{total_hours}/g, data.total_hours || '')
    .replace(/{sender_name}/g, data.sender_name || '');
  
  // Spezielle Behandlung für Anrede bei mehreren PLs
  if (isMultipleLeaders) {
    // Ersetze personalisierte Anrede durch neutrale
    result = result
      .replace(/Sehr geehrte(?:r)? (?:Frau|Herr) \{project_leader_lastname\}/gi, 'Sehr geehrte Damen und Herren')
      .replace(/\{project_leader_firstname\}/g, '')
      .replace(/\{project_leader_lastname\}/g, '');
  } else {
    // Normale Ersetzung für einen PL
    result = result
      .replace(/{project_leader_firstname}/g, firstName)
      .replace(/{project_leader_lastname}/g, lastName);
  }
  
  return result;
}

async function refreshAccessToken(refreshToken) {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.M365_CLIENT_ID,
    client_secret: process.env.M365_CLIENT_SECRET,
    refresh_token: refreshToken,
    scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Files.ReadWrite offline_access',
  });

  const response = await fetch(`https://login.microsoftonline.com/${process.env.M365_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) throw new Error(`Token-Refresh fehlgeschlagen: ${await response.text()}`);
  return response.json();
}

app.get('/api/email/auth-url', (req, res) => {
  const redirectUri = process.env.M365_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/email/callback`;
  const params = new URLSearchParams({
    client_id: process.env.M365_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Files.ReadWrite offline_access',
    response_mode: 'query',
    prompt: 'select_account',
  });
  res.json({ url: `https://login.microsoftonline.com/${process.env.M365_TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}` });
});

app.get('/api/email/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect(`/?ms_auth=error&message=${encodeURIComponent(error)}`);
  if (!code) return res.status(400).send('Kein Authorization Code erhalten.');

  try {
    const redirectUri = process.env.M365_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/email/callback`;
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.M365_CLIENT_ID,
      client_secret: process.env.M365_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Files.ReadWrite offline_access',
    });

    const tokenResponse = await fetch(`https://login.microsoftonline.com/${process.env.M365_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!tokenResponse.ok) throw new Error(await tokenResponse.text());
    const tokens = await tokenResponse.json();

    let senderEmail = null;
    if (tokens.id_token) {
      try {
        const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
        senderEmail = payload.preferred_username || payload.email || payload.upn;
      } catch {}
    }

    await storeTokens({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), sender_email: senderEmail });
    
    // Redirect zur Frontend-URL (nicht Backend!)
    const frontendUrl = process.env.FRONTEND_URL || 'https://zeiterfassung-frontend.pages.dev';
    res.redirect(`${frontendUrl}/settings?ms_auth=success&email=${encodeURIComponent(senderEmail || '')}`);
  } catch (err) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://zeiterfassung-frontend.pages.dev';
    res.redirect(`${frontendUrl}/settings?ms_auth=error&message=${encodeURIComponent(err.message)}`);
  }
});

app.get('/api/email/config', async (req, res) => {
  try {
    const tokens = await getStoredTokens();
    res.json({ connected: !!(tokens?.refresh_token), senderEmail: tokens?.sender_email || null, expiresAt: tokens?.expires_at || null });
  } catch { res.json({ connected: false, senderEmail: null }); }
});

app.delete('/api/email/disconnect', async (req, res) => {
  try {
    await db.collection('app_settings').doc('ms_oauth').delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/email/send-timesheet', async (req, res) => {
  const { to, cc, subject, body, pdf_base64, pdf_filename, project_data } = req.body;
  if (!to || !subject || !body) return res.status(400).json({ error: 'to, subject und body sind erforderlich.' });

  try {
    let tokens = await getStoredTokens();
    if (!tokens?.refresh_token) return res.status(401).json({ error: 'Microsoft-Konto nicht verbunden. Bitte zuerst in Einstellungen verbinden.' });

    const isExpired = !tokens.expires_at || new Date(tokens.expires_at) <= new Date(Date.now() + 60000);
    if (isExpired || !tokens.access_token) {
      const refreshed = await refreshAccessToken(tokens.refresh_token);
      tokens.access_token = refreshed.access_token;
      tokens.expires_at = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      if (refreshed.refresh_token) tokens.refresh_token = refreshed.refresh_token;
      await storeTokens(tokens);
    }

    // Platzhalter ersetzen (falls project_data vorhanden)
    let finalSubject = subject;
    let finalBody = body;
    if (project_data) {
      const placeholderData = {
        ...project_data,
        sender_name: tokens.sender_email?.split('@')[0] || ''
      };
      finalSubject = replacePlaceholders(subject, placeholderData);
      finalBody = replacePlaceholders(body, placeholderData);
    }

    const toList = (Array.isArray(to) ? to : [to]).map(email => ({ emailAddress: { address: email } }));
    const ccList = cc ? (Array.isArray(cc) ? cc : [cc]).map(email => ({ emailAddress: { address: email } })) : [];

    const message = { subject: finalSubject, body: { contentType: 'Text', content: finalBody }, toRecipients: toList, ccRecipients: ccList };
    if (pdf_base64 && pdf_filename) {
      message.attachments = [{ '@odata.type': '#microsoft.graph.fileAttachment', name: pdf_filename, contentType: 'application/pdf', contentBytes: pdf_base64 }];
    }

    // E-Mail als ENTWURF speichern (nicht direkt senden!)
    // Erstelle Entwurf im Drafts-Ordner
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!graphResponse.ok) return res.status(502).json({ error: `Graph API Fehler: ${graphResponse.status} ${await graphResponse.text()}` });
    
    const draft = await graphResponse.json();
    res.json({ 
      success: true, 
      draftId: draft.id,
      message: 'E-Mail wurde als Entwurf gespeichert. Bitte in Outlook prüfen und manuell senden.',
      sentFrom: tokens.sender_email 
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================
// BACKUP (nur für GF)
// ==========================

app.get('/api/admin/backup/status', async (req, res) => {
  try {
    // Backup-Status aus Firestore laden
    const doc = await db.collection('app_settings').doc('last_backup').get();
    
    if (!doc.exists) {
      return res.json({ 
        status: 'never',
        message: 'Noch kein Backup erstellt'
      });
    }
    
    res.json(doc.data());
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.get('/api/admin/backup', async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    
    // Alle Collections exportieren
    const collections = ['employees', 'projects', 'subprojects', 'activities', 
                        'timesheets', 'project_billings', 'app_settings'];
    
    const backup = {
      created_at: new Date().toISOString(),
      version: '1.0',
      collections: {}
    };
    
    let totalDocs = 0;
    for (const collectionName of collections) {
      const snapshot = await db.collection(collectionName).get();
      backup.collections[collectionName] = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      totalDocs += snapshot.size;
    }
    
    // Backup-Status speichern
    await db.collection('app_settings').doc('last_backup').set({
      timestamp: new Date().toISOString(),
      status: 'success',
      type: 'manual',
      total_documents: totalDocs,
      collections: collections.length
    }, { merge: true });
    
    // Als JSON zurückgeben
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="zeiterfassung_backup_${timestamp}.json"`);
    res.json(backup);
    
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.get('/api/admin/backup/csv', async (req, res) => {
  try {
    const { collection } = req.query;
    if (!collection) return res.status(400).json({ error: 'collection parameter required' });
    
    const snapshot = await db.collection(collection).get();
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (docs.length === 0) {
      return res.status(404).json({ error: 'No documents found' });
    }
    
    // CSV generieren
    const keys = Object.keys(docs[0]);
    const csv = [
      keys.join(','),
      ...docs.map(doc => keys.map(key => {
        const value = doc[key];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${collection}_${timestamp}.csv"`);
    res.send('\uFEFF' + csv); // UTF-8 BOM für Excel
    
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// ==========================
// ONEDRIVE BACKUP
// ==========================

// OneDrive-Pfad speichern/laden
app.get('/api/admin/onedrive-config', async (req, res) => {
  try {
    const doc = await db.collection('app_settings').doc('onedrive_backup').get();
    res.json(doc.exists ? doc.data() : { folder_path: '/Zeiterfassung/Backups' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/onedrive-config', async (req, res) => {
  try {
    const { folder_path } = req.body;
    if (!folder_path) return res.status(400).json({ error: 'folder_path ist erforderlich.' });
    await db.collection('app_settings').doc('onedrive_backup').set({ 
      folder_path, 
      updated_at: new Date().toISOString() 
    }, { merge: true });
    res.json({ success: true, folder_path });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Backup nach OneDrive hochladen
app.post('/api/admin/backup/onedrive', async (req, res) => {
  try {
    // 1. Tokens laden
    let tokens = await getStoredTokens();
    if (!tokens?.refresh_token) {
      return res.status(401).json({ error: 'Microsoft-Konto nicht verbunden. Bitte zuerst in Einstellungen verbinden.' });
    }

    // Token refreshen falls nötig
    const isExpired = !tokens.expires_at || new Date(tokens.expires_at) <= new Date(Date.now() + 60000);
    if (isExpired || !tokens.access_token) {
      const refreshed = await refreshAccessToken(tokens.refresh_token);
      tokens.access_token = refreshed.access_token;
      tokens.expires_at = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      if (refreshed.refresh_token) tokens.refresh_token = refreshed.refresh_token;
      await storeTokens(tokens);
    }

    // 2. OneDrive-Pfad laden
    const configDoc = await db.collection('app_settings').doc('onedrive_backup').get();
    const folderPath = configDoc.exists ? configDoc.data().folder_path : '/Zeiterfassung/Backups';

    // 3. Backup-Daten erstellen
    const collections = ['employees', 'projects', 'subprojects', 'activities', 'timesheets', 'project_billings', 'app_settings'];
    const backup = { created_at: new Date().toISOString(), version: '1.0', collections: {} };
    let totalDocs = 0;

    for (const collectionName of collections) {
      const snapshot = await db.collection(collectionName).get();
      backup.collections[collectionName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      totalDocs += snapshot.size;
    }

    // 4. Nach OneDrive hochladen
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const fileName = `zeiterfassung_backup_${timestamp}.json`;
    // Pfad normalisieren: führende/trailing Slashes entfernen
    const cleanPath = folderPath.replace(/^\/+|\/+$/g, '');
    const uploadPath = `/me/drive/root:/${cleanPath}/${fileName}:/content`;

    const uploadResponse = await fetch(`https://graph.microsoft.com/v1.0${uploadPath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backup),
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      throw new Error(`OneDrive Upload fehlgeschlagen: ${uploadResponse.status} ${errText}`);
    }

    const uploadResult = await uploadResponse.json();

    // 5. Backup-Status speichern
    await db.collection('app_settings').doc('last_backup').set({
      timestamp: new Date().toISOString(),
      status: 'success',
      type: 'onedrive',
      total_documents: totalDocs,
      collections: collections.length,
      onedrive_path: `${cleanPath}/${fileName}`,
      onedrive_url: uploadResult.webUrl || null,
    }, { merge: true });

    res.json({ 
      success: true, 
      fileName,
      path: `${cleanPath}/${fileName}`,
      webUrl: uploadResult.webUrl || null,
      totalDocuments: totalDocs,
    });
  } catch (err) { 
    // Fehler-Status speichern
    await db.collection('app_settings').doc('last_backup').set({
      timestamp: new Date().toISOString(),
      status: 'failed',
      type: 'onedrive',
      error: err.message,
    }, { merge: true }).catch(() => {});
    res.status(500).json({ error: err.message }); 
  }
});

// ==========================
// START
// ==========================

const PORT = process.env.PORT || 8080;
app.listen(PORT, async () => {
  console.log(`Backend Server running on port ${PORT}`);

  // Seed: Thomas (GF) anlegen falls er fehlt
  try {
    const thomasEmail = 'thomas.kedzierski@projektwaerts.de';
    const snapshot = await db.collection('employees').where('email_lower', '==', thomasEmail).limit(1).get();
    if (snapshot.empty) {
      const seedPassword = process.env.SEED_PASSWORD;
      if (!seedPassword) {
        console.warn('⚠️ SEED_PASSWORD nicht gesetzt – Thomas wird ohne Passwort angelegt.');
        await db.collection('employees').add({ name: 'Thomas Kedzierski', email: thomasEmail, email_lower: thomasEmail, role: 'GF', hourly_rate: null, created_date: new Date().toISOString() });
      } else {
        const password_hash = bcrypt.hashSync(seedPassword, 10);
        await db.collection('employees').add({ name: 'Thomas Kedzierski', email: thomasEmail, email_lower: thomasEmail, role: 'GF', hourly_rate: null, password_hash, created_date: new Date().toISOString() });
      }
      console.log('✅ Seed: Thomas Kedzierski angelegt.');
    } else {
      console.log('ℹ️ Seed: Thomas Kedzierski bereits vorhanden.');
    }
  } catch (err) { console.error('❌ Seed Fehler:', err.message); }

  // Seed: Admin Plinius (GF) anlegen falls er fehlt
  try {
    const adminEmail = 'admin@plinius-systems.de';
    const snapshot = await db.collection('employees').where('email_lower', '==', adminEmail).limit(1).get();
    if (snapshot.empty) {
      const seedPassword = process.env.SEED_PASSWORD;
      if (!seedPassword) {
        console.warn('⚠️ SEED_PASSWORD nicht gesetzt – Admin Plinius wird ohne Passwort angelegt.');
        await db.collection('employees').add({ name: 'Admin Plinius', email: adminEmail, email_lower: adminEmail, role: 'GF', hourly_rate: null, created_date: new Date().toISOString() });
      } else {
        const password_hash = bcrypt.hashSync(seedPassword, 10);
        await db.collection('employees').add({ name: 'Admin Plinius', email: adminEmail, email_lower: adminEmail, role: 'GF', hourly_rate: null, password_hash, created_date: new Date().toISOString() });
      }
      console.log('✅ Seed: Admin Plinius angelegt.');
    } else {
      console.log('ℹ️ Seed: Admin Plinius bereits vorhanden.');
    }
  } catch (err) { console.error('❌ Seed Fehler:', err.message); }
});
