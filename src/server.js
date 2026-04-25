import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import db from './database.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const app = express();
app.use(cors());
app.use(express.json());

// helper to build sort query
const buildSort = (sortParam) => {
  if (!sortParam) return '';
  const dir = sortParam.startsWith('-') ? 'DESC' : 'ASC';
  const field = sortParam.replace(/^-/, '');
  const allowed = ['created_date', 'activity_date', 'project_name', 'employee_name', 'actual_hours', 'project_number', 'name', 'role'];
  return allowed.includes(field) ? `ORDER BY ${field} ${dir}` : '';
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

// POST /api/auth/login — E-Mail + Passwort prüfen
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich.' });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE LOWER(email) = LOWER(?)').get(email.trim());

  if (!employee) {
    return res.status(401).json({ error: 'E-Mail oder Passwort falsch.' });
  }

  if (!employee.password_hash) {
    // Account exists but no password set yet
    return res.status(403).json({ error: 'password_not_set', message: 'Für dieses Konto wurde noch kein Passwort vergeben. Bitte Erstanmeldung durchführen.' });
  }

  const isValid = bcrypt.compareSync(password, employee.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'E-Mail oder Passwort falsch.' });
  }

  // Login successful
  res.json({
    id: employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    hourly_rate: employee.hourly_rate,
  });
});

// POST /api/auth/set-password — Erstanmeldung: Passwort setzen (mit Invite-Code)
app.post('/api/auth/set-password', (req, res) => {
  const { email, password, invite_code } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich.' });
  }

  if (!invite_code) {
    return res.status(400).json({ error: 'Invite-Code ist erforderlich.' });
  }

  // Validate invite code
  const VALID_INVITE_CODE = process.env.invite_code || '85fce0c7af4544e48b97630d337f0141';
  if (invite_code.trim() !== VALID_INVITE_CODE) {
    return res.status(403).json({ error: 'Ungültiger Invite-Code.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein.' });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE LOWER(email) = LOWER(?)').get(email.trim());

  if (!employee) {
    return res.status(404).json({ error: 'Kein Konto mit dieser E-Mail gefunden.' });
  }

  if (employee.password_hash) {
    return res.status(400).json({ error: 'Für dieses Konto wurde bereits ein Passwort vergeben.' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE employees SET password_hash = ? WHERE id = ?').run(password_hash, employee.id);

  res.json({
    id: employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    hourly_rate: employee.hourly_rate,
  });
});

// POST /api/auth/check-email — Prüfen ob E-Mail existiert und ob Passwort gesetzt ist
app.post('/api/auth/check-email', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'E-Mail ist erforderlich.' });
  }

  const employee = db.prepare('SELECT id, name, email, password_hash FROM employees WHERE LOWER(email) = LOWER(?)').get(email.trim());

  if (!employee) {
    return res.status(404).json({ exists: false });
  }

  res.json({
    exists: true,
    hasPassword: !!employee.password_hash,
    name: employee.name,
  });
});

// ==========================
// EMPLOYEES
// ==========================
app.get('/api/employees', (req, res) => {
  const sort = buildSort(req.query.sort);
  const rows = db.prepare(`SELECT * FROM employees ${sort}`).all();
  res.json(rows);
});

app.post('/api/employees', (req, res) => {
  const error = validateRequired(req.body, ['name']);
  if (error) return res.status(400).json({ error });

  const id = uuidv4();
  const data = req.body;
  const created_date = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO employees (id, name, email, role, hourly_rate, created_date)
    VALUES (@id, @name, @email, @role, @hourly_rate, @created_date)
  `);
  stmt.run({ email: null, role: 'MA', hourly_rate: null, ...data, id, created_date });
  res.json({ id, ...data, created_date });
});

app.put('/api/employees/:id', (req, res) => {
  const data = req.body;
  const id = req.params.id;
  const stmt = db.prepare(`
    UPDATE employees SET name=@name, email=@email, role=@role, hourly_rate=@hourly_rate WHERE id=@id
  `);
  stmt.run({ email: null, role: 'MA', hourly_rate: null, ...data, id });
  res.json({ id, ...data });
});

app.delete('/api/employees/:id', (req, res) => {
  db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==========================
// PROJECTS
// ==========================
app.get('/api/projects', (req, res) => {
  const sort = buildSort(req.query.sort);
  const rows = db.prepare(`SELECT * FROM projects ${sort}`).all();
  res.json(rows);
});

app.post('/api/projects', (req, res) => {
  const error = validateRequired(req.body, ['project_number', 'project_name']);
  if (error) return res.status(400).json({ error });

  const id = uuidv4();
  const data = req.body;
  const created_date = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO projects (id, project_number, project_name, customer_name, project_leader, project_leader_email, planned_hours, start_date, end_date, order_number, external_project_number, customer_number, contract_number, hourly_rate, payment_terms, vat_rate, employee_name, created_date)
    VALUES (@id, @project_number, @project_name, @customer_name, @project_leader, @project_leader_email, @planned_hours, @start_date, @end_date, @order_number, @external_project_number, @customer_number, @contract_number, @hourly_rate, @payment_terms, @vat_rate, @employee_name, @created_date)
  `);
  
  stmt.run({ 
    project_number: null, project_name: null, customer_name: null, project_leader: null, project_leader_email: null,
    planned_hours: null, start_date: null, end_date: null,
    order_number: null, external_project_number: null, customer_number: null, contract_number: null, 
    hourly_rate: null, payment_terms: 30, vat_rate: 19, employee_name: null,
    ...data, id, created_date 
  });
  res.json({ id, ...data, created_date });
});

app.put('/api/projects/:id', (req, res) => {
  const data = req.body;
  const id = req.params.id;
  const stmt = db.prepare(`
    UPDATE projects 
    SET project_number=@project_number, project_name=@project_name, customer_name=@customer_name, 
        project_leader=@project_leader, project_leader_email=@project_leader_email, planned_hours=@planned_hours, start_date=@start_date, end_date=@end_date,
        order_number=@order_number, external_project_number=@external_project_number, customer_number=@customer_number, contract_number=@contract_number,
        hourly_rate=@hourly_rate, payment_terms=@payment_terms, vat_rate=@vat_rate, employee_name=@employee_name
    WHERE id=@id
  `);
  stmt.run({ 
    project_number: null, project_name: null, customer_name: null, project_leader: null, project_leader_email: null,
    planned_hours: null, start_date: null, end_date: null,
    order_number: null, external_project_number: null, customer_number: null, contract_number: null,
    hourly_rate: null, payment_terms: 30, vat_rate: 19, employee_name: null,
    ...data, id 
  });
  res.json({ id, ...data });
});

app.delete('/api/projects/:id', (req, res) => {
  const id = req.params.id;
  const activityCount = db.prepare('SELECT COUNT(*) as count FROM activities WHERE project_id = ?').get(id).count;
  
  if (activityCount > 0) {
    // Cascade: delete associated activities first
    db.prepare('DELETE FROM activities WHERE project_id = ?').run(id);
  }
  
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  res.json({ success: true, deletedActivities: activityCount });
});

// ==========================
// SUBPROJECTS
// ==========================
app.get('/api/subprojects', (req, res) => {
  const { project_id } = req.query;
  if (project_id) {
    const rows = db.prepare('SELECT * FROM subprojects WHERE project_id = ? ORDER BY name').all(project_id);
    res.json(rows);
  } else {
    const rows = db.prepare('SELECT * FROM subprojects ORDER BY name').all();
    res.json(rows);
  }
});

app.post('/api/subprojects', (req, res) => {
  const error = validateRequired(req.body, ['project_id', 'name']);
  if (error) return res.status(400).json({ error });

  const id = uuidv4();
  const { project_id, name, number } = req.body;
  const created_date = new Date().toISOString();

  const stmt = db.prepare('INSERT INTO subprojects (id, project_id, name, number, created_date) VALUES (?, ?, ?, ?, ?)');
  stmt.run(id, project_id, name, number || null, created_date);
  res.json({ id, project_id, name, number: number || null, created_date });
});

app.put('/api/subprojects/:id', (req, res) => {
  const { name, number } = req.body;
  const id = req.params.id;
  const stmt = db.prepare('UPDATE subprojects SET name = ?, number = ? WHERE id = ?');
  stmt.run(name, number || null, id);
  res.json({ id, name, number: number || null });
});

app.delete('/api/subprojects/:id', (req, res) => {
  db.prepare('DELETE FROM subprojects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==========================
// ACTIVITIES
// ==========================
app.get('/api/activities', (req, res) => {
  const sort = buildSort(req.query.sort);
  const rows = db.prepare(`SELECT * FROM activities ${sort}`).all();
  res.json(rows);
});

app.post('/api/activities', (req, res) => {
  const error = validateRequired(req.body, ['project_id', 'description', 'activity_date', 'actual_hours']);
  if (error) return res.status(400).json({ error });

  const id = uuidv4();
  const data = req.body;
  const created_date = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO activities (id, project_id, description, employee_name, activity_date, actual_hours, notes, status, subproject_id, created_date)
    VALUES (@id, @project_id, @description, @employee_name, @activity_date, @actual_hours, @notes, @status, @subproject_id, @created_date)
  `);
  
  stmt.run({ employee_name: null, notes: null, status: 'offen', subproject_id: null, ...data, id, created_date });
  res.json({ id, ...data, created_date });
});

app.put('/api/activities/:id', (req, res) => {
  const data = req.body;
  const id = req.params.id;
  const stmt = db.prepare(`
    UPDATE activities 
    SET project_id=@project_id, description=@description, employee_name=@employee_name, 
        activity_date=@activity_date, actual_hours=@actual_hours, notes=@notes, subproject_id=@subproject_id
    WHERE id=@id
  `);
  stmt.run({ employee_name: null, notes: null, subproject_id: null, ...data, id });
  res.json({ id, ...data });
});

app.delete('/api/activities/:id', (req, res) => {
  db.prepare('DELETE FROM activities WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==========================
// ACTIVITY STATUS (Freigabe-Workflow)
// ==========================

// MA bestätigt eigene Tätigkeiten (Batch: alle für einen Monat/Projekt)
app.post('/api/activities/confirm', (req, res) => {
  const { activity_ids, confirmed_by } = req.body;
  if (!activity_ids || !Array.isArray(activity_ids) || activity_ids.length === 0) {
    return res.status(400).json({ error: 'activity_ids (Array) ist erforderlich' });
  }
  const confirmed_at = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE activities SET status='bestätigt', confirmed_at=@confirmed_at, confirmed_by=@confirmed_by WHERE id=@id AND status='offen'
  `);
  const tx = db.transaction(() => {
    let count = 0;
    for (const id of activity_ids) {
      const result = stmt.run({ id, confirmed_at, confirmed_by: confirmed_by || null });
      count += result.changes;
    }
    return count;
  });
  const updated = tx();
  res.json({ success: true, confirmed: updated });
});

// GF gibt Tätigkeiten frei (Batch)
app.post('/api/activities/approve', (req, res) => {
  const { activity_ids, approved_by } = req.body;
  if (!activity_ids || !Array.isArray(activity_ids) || activity_ids.length === 0) {
    return res.status(400).json({ error: 'activity_ids (Array) ist erforderlich' });
  }
  const approved_at = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE activities SET status='freigegeben', approved_at=@approved_at, approved_by=@approved_by WHERE id=@id AND status='bestätigt'
  `);
  const tx = db.transaction(() => {
    let count = 0;
    for (const id of activity_ids) {
      const result = stmt.run({ id, approved_at, approved_by: approved_by || null });
      count += result.changes;
    }
    return count;
  });
  const updated = tx();
  res.json({ success: true, approved: updated });
});

// Status zurücksetzen (nur GF)
app.post('/api/activities/reset-status', (req, res) => {
  const { activity_ids } = req.body;
  if (!activity_ids || !Array.isArray(activity_ids) || activity_ids.length === 0) {
    return res.status(400).json({ error: 'activity_ids (Array) ist erforderlich' });
  }
  const stmt = db.prepare(`
    UPDATE activities SET status='offen', confirmed_at=NULL, confirmed_by=NULL, approved_at=NULL, approved_by=NULL WHERE id=@id
  `);
  const tx = db.transaction(() => {
    let count = 0;
    for (const id of activity_ids) {
      const result = stmt.run({ id });
      count += result.changes;
    }
    return count;
  });
  const updated = tx();
  res.json({ success: true, reset: updated });
});

// ==========================
// TIMESHEETS (Stundenzettel)
// ==========================

// Liste aller Timesheets
app.get('/api/timesheets', (req, res) => {
  const rows = db.prepare('SELECT * FROM timesheets ORDER BY month DESC, employee_name ASC').all();
  res.json(rows);
});

// Timesheet erstellen oder holen (MA bestätigt)
app.post('/api/timesheets/confirm', (req, res) => {
  const { employee_name, project_id, month, confirmed_by } = req.body;
  if (!employee_name || !project_id || !month) {
    return res.status(400).json({ error: 'employee_name, project_id und month sind erforderlich' });
  }

  const existing = db.prepare('SELECT * FROM timesheets WHERE employee_name=? AND project_id=? AND month=?').get(employee_name, project_id, month);

  if (existing && existing.status !== 'offen') {
    return res.status(400).json({ error: `Stundenzettel ist bereits im Status: ${existing.status}` });
  }

  const now = new Date().toISOString();

  if (existing) {
    db.prepare('UPDATE timesheets SET status=?, confirmed_at=?, confirmed_by=? WHERE id=?')
      .run('MA bestätigt', now, confirmed_by || employee_name, existing.id);
    res.json({ ...existing, status: 'MA bestätigt', confirmed_at: now, confirmed_by: confirmed_by || employee_name });
  } else {
    const id = uuidv4();
    db.prepare('INSERT INTO timesheets (id, employee_name, project_id, month, status, confirmed_at, confirmed_by, created_date) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, employee_name, project_id, month, 'MA bestätigt', now, confirmed_by || employee_name, now);
    res.json({ id, employee_name, project_id, month, status: 'MA bestätigt', confirmed_at: now, confirmed_by: confirmed_by || employee_name, created_date: now });
  }
});

// GF gibt Stundenzettel frei
app.post('/api/timesheets/approve', (req, res) => {
  const { id, approved_by } = req.body;
  if (!id) return res.status(400).json({ error: 'id ist erforderlich' });

  const ts = db.prepare('SELECT * FROM timesheets WHERE id=?').get(id);
  if (!ts) return res.status(404).json({ error: 'Stundenzettel nicht gefunden' });
  if (ts.status !== 'MA bestätigt') {
    return res.status(400).json({ error: `Stundenzettel muss erst von MA bestätigt werden (aktuell: ${ts.status})` });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE timesheets SET status=?, approved_at=?, approved_by=? WHERE id=?')
    .run('GF freigegeben', now, approved_by || null, id);
  res.json({ ...ts, status: 'GF freigegeben', approved_at: now, approved_by });
});

// Status zurücksetzen (nur GF)
app.post('/api/timesheets/reset', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id ist erforderlich' });

  db.prepare('UPDATE timesheets SET status=?, confirmed_at=NULL, confirmed_by=NULL, approved_at=NULL, approved_by=NULL WHERE id=?')
    .run('offen', id);
  res.json({ success: true });
});

// Timesheet löschen (nur GF)
app.delete('/api/timesheets/:id', (req, res) => {
  db.prepare('DELETE FROM timesheets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==========================
// PROJECT BILLINGS (Abrechnungsübersicht)
// ==========================
app.get('/api/project-billings', (req, res) => {
  const rows = db.prepare('SELECT * FROM project_billings').all();
  // Transform boolean fields
  res.json(rows.map(r => ({
    ...r,
    invoiced: !!r.invoiced,
    paid: !!r.paid
  })));
});

app.post('/api/project-billings', (req, res) => {
  const { project_id, month, invoiced, payment_date, paid } = req.body;
  if (!project_id || !month) return res.status(400).json({ error: 'project_id and month are required' });

  const existing = db.prepare('SELECT id FROM project_billings WHERE project_id = ? AND month = ?').get(project_id, month);
  const now = new Date().toISOString();

  if (existing) {
    db.prepare(`
      UPDATE project_billings SET invoiced = ?, payment_date = ?, paid = ? WHERE id = ?
    `).run(invoiced ? 1 : 0, payment_date || null, paid ? 1 : 0, existing.id);
    res.json({ id: existing.id, project_id, month, invoiced, payment_date, paid });
  } else {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO project_billings (id, project_id, month, invoiced, payment_date, paid, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, project_id, month, invoiced ? 1 : 0, payment_date || null, paid ? 1 : 0, now);
    res.json({ id, project_id, month, invoiced, payment_date, paid, created_date: now });
  }
});

// ==========================
// EMAIL (Microsoft Graph API — OAuth Delegated Flow)
// ==========================

// Refresh Token aus Firestore holen
async function getStoredTokens() {
  const doc = await db.collection('app_settings').doc('ms_oauth').get();
  if (!doc.exists) return null;
  return doc.data();
}

// Tokens in Firestore speichern
async function storeTokens(tokens) {
  await db.collection('app_settings').doc('ms_oauth').set({
    ...tokens,
    updated_at: new Date().toISOString(),
  }, { merge: true });
}

// Access Token via Refresh Token erneuern
async function refreshAccessToken(refreshToken) {
  const tenantId = process.env.M365_TENANT_ID;
  const clientId = process.env.M365_CLIENT_ID;
  const clientSecret = process.env.M365_CLIENT_SECRET;

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    scope: 'https://graph.microsoft.com/Mail.Send offline_access',
  });

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Token-Refresh fehlgeschlagen: ${err}`);
  }

  return response.json();
}

// GET /api/email/auth-url — OAuth-Login-URL generieren
app.get('/api/email/auth-url', (req, res) => {
  const tenantId = process.env.M365_TENANT_ID;
  const clientId = process.env.M365_CLIENT_ID;
  const redirectUri = process.env.M365_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/email/callback`;

  if (!tenantId || !clientId) {
    return res.status(500).json({ error: 'M365_TENANT_ID und M365_CLIENT_ID müssen gesetzt sein.' });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'https://graph.microsoft.com/Mail.Send offline_access',
    response_mode: 'query',
    prompt: 'select_account',
  });

  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  res.json({ url: authUrl });
});

// GET /api/email/callback — OAuth-Callback: Code gegen Tokens tauschen
app.get('/api/email/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/?ms_auth=error&message=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.status(400).send('Kein Authorization Code erhalten.');
  }

  try {
    const tenantId = process.env.M365_TENANT_ID;
    const clientId = process.env.M365_CLIENT_ID;
    const clientSecret = process.env.M365_CLIENT_SECRET;
    const redirectUri = process.env.M365_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/email/callback`;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      scope: 'https://graph.microsoft.com/Mail.Send offline_access',
    });

    const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      throw new Error(`Token-Austausch fehlgeschlagen: ${err}`);
    }

    const tokens = await tokenResponse.json();

    // Sender-Email aus dem ID-Token lesen
    let senderEmail = null;
    if (tokens.id_token) {
      try {
        const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
        senderEmail = payload.preferred_username || payload.email || payload.upn;
      } catch {}
    }

    // Tokens + Email in Firestore speichern
    await storeTokens({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      sender_email: senderEmail,
    });

    // Zurück zur App mit Erfolg
    res.redirect(`/?ms_auth=success&email=${encodeURIComponent(senderEmail || '')}`);
  } catch (err) {
    console.error('OAuth Callback Fehler:', err.message);
    res.redirect(`/?ms_auth=error&message=${encodeURIComponent(err.message)}`);
  }
});

// GET /api/email/config — Verbindungsstatus prüfen
app.get('/api/email/config', async (req, res) => {
  try {
    const tokens = await getStoredTokens();
    res.json({
      connected: !!(tokens?.refresh_token),
      senderEmail: tokens?.sender_email || null,
      expiresAt: tokens?.expires_at || null,
    });
  } catch (err) {
    res.json({ connected: false, senderEmail: null });
  }
});

// DELETE /api/email/disconnect — Microsoft-Verbindung trennen
app.delete('/api/email/disconnect', async (req, res) => {
  try {
    await db.collection('app_settings').doc('ms_oauth').delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/email/send-timesheet — Stundenzettel per Microsoft Graph API senden
app.post('/api/email/send-timesheet', async (req, res) => {
  const { to, cc, subject, body, pdf_base64, pdf_filename } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'to, subject und body sind erforderlich.' });
  }

  try {
    // Gespeicherte Tokens laden
    let tokens = await getStoredTokens();
    if (!tokens?.refresh_token) {
      return res.status(401).json({ error: 'Microsoft-Konto nicht verbunden. Bitte zuerst mit Microsoft anmelden.' });
    }

    // Access Token erneuern falls abgelaufen
    const isExpired = !tokens.expires_at || new Date(tokens.expires_at) <= new Date(Date.now() + 60000);
    if (isExpired || !tokens.access_token) {
      const refreshed = await refreshAccessToken(tokens.refresh_token);
      tokens.access_token = refreshed.access_token;
      tokens.expires_at = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      if (refreshed.refresh_token) tokens.refresh_token = refreshed.refresh_token;
      await storeTokens(tokens);
    }

    const senderEmail = tokens.sender_email;
    if (!senderEmail) {
      return res.status(500).json({ error: 'Sender-Email nicht bekannt. Bitte erneut mit Microsoft verbinden.' });
    }

    const toList = (Array.isArray(to) ? to : [to]).map(email => ({ emailAddress: { address: email } }));
    const ccList = cc ? (Array.isArray(cc) ? cc : [cc]).map(email => ({ emailAddress: { address: email } })) : [];

    const message = {
      subject,
      body: { contentType: 'Text', content: body },
      toRecipients: toList,
      ccRecipients: ccList,
    };

    if (pdf_base64 && pdf_filename) {
      message.attachments = [{
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: pdf_filename,
        contentType: 'application/pdf',
        contentBytes: pdf_base64,
      }];
    }

    const graphResponse = await fetch(`https://graph.microsoft.com/v1.0/me/sendMail`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });

    if (!graphResponse.ok) {
      const errText = await graphResponse.text();
      return res.status(502).json({ error: `Graph API Fehler: ${graphResponse.status} ${errText}` });
    }

    res.json({ success: true, sentFrom: senderEmail });
  } catch (err) {
    res.status(500).json({ error: `Fehler beim Senden: ${err.message}` });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Local Backend Server running on http://localhost:${PORT}`);
});
