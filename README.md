# Zeiterfassung Backend (Firestore)

## Technologie-Stack

- **Node.js** + Express.js
- **Firestore** (Cloud-Native NoSQL Datenbank)
- **Firebase Admin SDK**
- **bcryptjs** für Passwort-Hashing
- **Automatisches Deployment** zu Google Cloud Run

## Deployment

Das Backend deployed **automatisch** bei Git Push zu Cloud Run.

### URL
```
https://zeiterfassung-backend-339855266648.europe-west3.run.app
```

### Environment Variables (in Cloud Run konfiguriert)

```env
PORT=8080
invite_code=YOUR_INVITE_CODE
AZURE_TENANT_ID=YOUR_TENANT_ID
AZURE_CLIENT_ID=YOUR_CLIENT_ID
AZURE_CLIENT_SECRET=YOUR_CLIENT_SECRET
AZURE_SENDER_EMAIL=YOUR_SENDER_EMAIL
```

## Firestore Setup

### 1. Firestore aktivieren

In Google Cloud Console:
1. Gehe zu **Firestore**
2. Wähle **Native Mode**
3. Wähle Region: **europe-west3**

### 2. Collections

Das Backend erstellt automatisch folgende Collections:
- `employees` - Mitarbeiter mit Authentifizierung
- `projects` - Projekte
- `subprojects` - Unterprojekte
- `activities` - Tätigkeiten/Zeiterfassung
- `timesheets` - Stundenzettel
- `project_billings` - Abrechnungen

### 3. Seed-Daten

Thomas Kedzierski wird **automatisch beim ersten Start** angelegt:
- **E-Mail**: thomas.kedzierski@projektwaerts.de
- **Passwort**: zeit-beta-2026
- **Rolle**: GF (Geschäftsführer)

## API Endpoints

### Health & Info
- `GET /health` - Health Check
- `GET /` - API Info

### Authentication
- `POST /api/auth/login` - Login mit E-Mail + Passwort
- `POST /api/auth/set-password` - Erstanmeldung (mit Invite-Code)
- `POST /api/auth/check-email` - E-Mail prüfen

### Admin
- `POST /api/admin/seed-user` - Neuen GF-Account anlegen (mit Invite-Code)

### Employees
- `GET /api/employees` - Alle Mitarbeiter
- `POST /api/employees` - Mitarbeiter anlegen
- `PUT /api/employees/:id` - Mitarbeiter aktualisieren
- `DELETE /api/employees/:id` - Mitarbeiter löschen

### Projects
- `GET /api/projects` - Alle Projekte
- `POST /api/projects` - Projekt anlegen
- `PUT /api/projects/:id` - Projekt aktualisieren
- `DELETE /api/projects/:id` - Projekt löschen

### Subprojects
- `GET /api/subprojects` - Alle Unterprojekte
- `POST /api/subprojects` - Unterprojekt anlegen
- `PUT /api/subprojects/:id` - Unterprojekt aktualisieren
- `DELETE /api/subprojects/:id` - Unterprojekt löschen

### Activities
- `GET /api/activities` - Alle Tätigkeiten
- `POST /api/activities` - Tätigkeit anlegen
- `PUT /api/activities/:id` - Tätigkeit aktualisieren
- `DELETE /api/activities/:id` - Tätigkeit löschen
- `POST /api/activities/confirm` - Tätigkeiten bestätigen (MA)
- `POST /api/activities/approve` - Tätigkeiten freigeben (GF)
- `POST /api/activities/reset-status` - Status zurücksetzen

### Timesheets
- `GET /api/timesheets` - Alle Stundenzettel
- `POST /api/timesheets/confirm` - Stundenzettel bestätigen (MA)
- `POST /api/timesheets/approve` - Stundenzettel freigeben (GF)
- `POST /api/timesheets/reset` - Status zurücksetzen
- `DELETE /api/timesheets/:id` - Stundenzettel löschen

### Project Billings
- `GET /api/project-billings` - Alle Abrechnungen
- `POST /api/project-billings` - Abrechnung anlegen/aktualisieren

### Email
- `POST /api/email/send-timesheet` - Stundenzettel per E-Mail senden
- `GET /api/email/config` - E-Mail-Konfiguration prüfen

## Lokale Entwicklung

### Voraussetzungen
- Node.js 22+
- Service Account JSON von Google Cloud

### Setup

```bash
# Dependencies installieren
npm install

# Service Account JSON herunterladen
# Google Cloud Console > IAM & Admin > Service Accounts > Create Key (JSON)

# .env Datei erstellen
cp .env.example .env

# GOOGLE_APPLICATION_CREDENTIALS setzen
echo "GOOGLE_APPLICATION_CREDENTIALS=./service-account.json" >> .env

# Server starten
npm start
```

Server läuft auf: `http://localhost:3001`

## Testing

### Health Check
```bash
curl https://zeiterfassung-backend-339855266648.europe-west3.run.app/health
```

Erwartete Antwort:
```json
{
  "status": "healthy",
  "database": "firestore",
  "connected": true,
  "timestamp": "2026-04-25T..."
}
```

### Login Test
```bash
curl -X POST https://zeiterfassung-backend-339855266648.europe-west3.run.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"thomas.kedzierski@projektwaerts.de","password":"zeit-beta-2026"}'
```

## Troubleshooting

### Problem: 500 Internal Server Error

**Lösung 1**: Logs prüfen
```bash
gcloud run logs read zeiterfassung-backend --region=europe-west3 --limit=50
```

**Lösung 2**: Firestore Permissions prüfen
```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

### Problem: "Could not load the default credentials"

**Lösung**: Service Account braucht Firestore-Zugriff
- Lokal: `GOOGLE_APPLICATION_CREDENTIALS` in `.env` setzen
- Cloud Run: Service Account muss `Cloud Datastore User` Rolle haben

### Problem: Seed-Daten nicht vorhanden

**Lösung**: Backend neu starten (deployed automatisch)
- Seed-Script läuft beim Start
- Thomas Kedzierski wird automatisch angelegt

## Struktur

```
zeiterfassung_backend/
├── src/
│   ├── database.js      # Firestore Initialisierung + Seed
│   └── server.js        # Express API + Routes
├── .env.example         # Environment Variables Template
├── .gitignore
├── Dockerfile           # Cloud Run Container
├── package.json
└── README.md
```

## Firestore Datenmodell

### employees
```javascript
{
  name: string,
  email: string,
  email_lower: string,  // Für case-insensitive Suche
  role: 'GF' | 'MA',
  hourly_rate: number | null,
  password_hash: string | null,
  created_date: ISO8601 string
}
```

### projects
```javascript
{
  project_number: string,
  project_name: string,
  customer_name: string | null,
  project_leader: string | null,
  project_leader_email: string | null,
  planned_hours: number | null,
  start_date: ISO8601 string | null,
  end_date: ISO8601 string | null,
  // ... weitere Felder
  created_date: ISO8601 string
}
```

### activities
```javascript
{
  project_id: string,
  description: string,
  employee_name: string | null,
  activity_date: ISO8601 string,
  actual_hours: number,
  notes: string | null,
  status: 'offen' | 'bestätigt' | 'freigegeben',
  subproject_id: string | null,
  confirmed_at: ISO8601 string | null,
  confirmed_by: string | null,
  approved_at: ISO8601 string | null,
  approved_by: string | null,
  created_date: ISO8601 string
}
```

## Status

✅ **Produktionsbereit** - Backend läuft auf Cloud Run mit Firestore
