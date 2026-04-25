import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In Docker: DB_PATH env var nutzen, sonst lokaler Pfad
const dbFile = process.env.DB_PATH || join(__dirname, 'database.sqlite');
const db = new Database(dbFile);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    project_number TEXT,
    project_name TEXT,
    customer_name TEXT,
    project_leader TEXT,
    project_leader_email TEXT,
    planned_hours REAL,
    start_date TEXT,
    end_date TEXT,
    order_number TEXT,
    external_project_number TEXT,
    customer_number TEXT,
    contract_number TEXT,
    hourly_rate REAL,
    payment_terms INTEGER DEFAULT 30,
    vat_rate REAL DEFAULT 19,
    employee_name TEXT,
    created_date TEXT
  );

  CREATE TABLE IF NOT EXISTS subprojects (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    number TEXT,
    created_date TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'MA',
    hourly_rate REAL,
    created_date TEXT
  );

  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    description TEXT,
    employee_name TEXT,
    activity_date TEXT,
    actual_hours REAL,
    notes TEXT,
    created_date TEXT
  );

  CREATE TABLE IF NOT EXISTS project_billings (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    month TEXT NOT NULL,
    invoiced INTEGER DEFAULT 0,
    payment_date TEXT,
    paid INTEGER DEFAULT 0,
    created_date TEXT,
    UNIQUE(project_id, month)
  );
`);

// Migrate projects: add new columns if they don't exist
const projectColumns = db.pragma('table_info(projects)').map(c => c.name);
const newProjectCols = [
  { name: 'order_number', type: 'TEXT' },
  { name: 'external_project_number', type: 'TEXT' },
  { name: 'project_leader_email', type: 'TEXT' },
  { name: 'customer_number', type: 'TEXT' },
  { name: 'contract_number', type: 'TEXT' },
  { name: 'hourly_rate', type: 'REAL' },
  { name: 'payment_terms', type: 'INTEGER DEFAULT 30' },
  { name: 'vat_rate', type: 'REAL DEFAULT 19' },
  { name: 'employee_name', type: 'TEXT' },
];
for (const col of newProjectCols) {
  if (!projectColumns.includes(col.name)) {
    db.exec(`ALTER TABLE projects ADD COLUMN ${col.name} ${col.type}`);
  }
}

// Migrate activities: add status/approval fields and subproject_id
const activityColumns = db.pragma('table_info(activities)').map(c => c.name);
const newActivityCols = [
  { name: 'status', type: "TEXT DEFAULT 'offen'" },
  { name: 'confirmed_at', type: 'TEXT' },
  { name: 'confirmed_by', type: 'TEXT' },
  { name: 'approved_at', type: 'TEXT' },
  { name: 'approved_by', type: 'TEXT' },
  { name: 'subproject_id', type: 'TEXT' },
];
for (const col of newActivityCols) {
  if (!activityColumns.includes(col.name)) {
    db.exec(`ALTER TABLE activities ADD COLUMN ${col.name} ${col.type}`);
  }
}

// Migrate employees: add password_hash column if not exists
const employeeColumns = db.pragma('table_info(employees)').map(c => c.name);
if (!employeeColumns.includes('password_hash')) {
  db.exec(`ALTER TABLE employees ADD COLUMN password_hash TEXT`);
}

// Migrate subprojects: add number column if not exists
const subprojectColumns = db.pragma('table_info(subprojects)').map(c => c.name);
if (subprojectColumns.length > 0 && !subprojectColumns.includes('number')) {
  db.exec(`ALTER TABLE subprojects ADD COLUMN number TEXT`);
}

// Timesheets table
db.exec(`
  CREATE TABLE IF NOT EXISTS timesheets (
    id TEXT PRIMARY KEY,
    employee_name TEXT NOT NULL,
    project_id TEXT NOT NULL,
    month TEXT NOT NULL,
    status TEXT DEFAULT 'offen',
    confirmed_at TEXT,
    confirmed_by TEXT,
    approved_at TEXT,
    approved_by TEXT,
    comment TEXT,
    created_date TEXT,
    UNIQUE(employee_name, project_id, month)
  );
`);

// Seed: create Thomas as Inhaber (GF) if he doesn't exist yet, or set hash if missing
const thomas = db.prepare("SELECT * FROM employees WHERE LOWER(email) = LOWER(?)").get('thomas.kedzierski@projektwaerts.de');
if (!thomas) {
  const { v4: uuidv4 } = await import('uuid');
  const id = uuidv4();
  const password_hash = bcrypt.hashSync('zeit-beta-2026', 10);
  const created_date = new Date().toISOString();
  db.prepare(`
    INSERT INTO employees (id, name, email, role, hourly_rate, password_hash, created_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, 'Thomas Kedzierski', 'thomas.kedzierski@projektwaerts.de', 'GF', null, password_hash, created_date);
  console.log('✅ Seed: Thomas Kedzierski (Inhaber) angelegt.');
} else if (!thomas.password_hash) {
  // Account exists but hash missing (legacy migration) — set default password
  const password_hash = bcrypt.hashSync('zeit-beta-2026', 10);
  db.prepare("UPDATE employees SET password_hash = ?, role = 'GF' WHERE id = ?").run(password_hash, thomas.id);
  console.log('✅ Seed: Passwort-Hash für Thomas Kedzierski nachgetragen.');
} else {
  console.log('ℹ️  Seed: Thomas Kedzierski bereits vollständig konfiguriert.');
}

export default db;
