# Zeiterfassung — Technische Dokumentation

> Version: 1.0 | Stand: April 2026 | Projekt: Zeiterfassung PROJEKTWÄRTS

---

## Inhaltsverzeichnis

1. [Projektübersicht](#1-projektübersicht)
2. [Systemarchitektur](#2-systemarchitektur)
3. [Infrastruktur & Hosting](#3-infrastruktur--hosting)
4. [Authentifizierung & Sicherheit](#4-authentifizierung--sicherheit)
5. [Datenmodell (Firestore)](#5-datenmodell-firestore)
6. [Backend — API-Endpunkte](#6-backend--api-endpunkte)
7. [Frontend — Seiten & Komponenten](#7-frontend--seiten--komponenten)
8. [Microsoft Integration (Email & OneDrive)](#8-microsoft-integration-email--onedrive)
9. [Backup-System](#9-backup-system)
10. [Deployment](#10-deployment)
11. [Umgebungsvariablen](#11-umgebungsvariablen)

---

## 1. Projektübersicht

Die **Zeiterfassung** ist ein internes Projektmanagement- und Zeiterfassungstool für die PROJEKTWÄRTS GmbH. Es ermöglicht:

- Verwaltung von Projekten, Subprojekten und Mitarbeitern
- Erfassung von Tätigkeiten mit Stunden, Datum und Beschreibung
- Stundenzettel-Workflow (Offen → MA bestätigt → GF freigegeben)
- PDF-Export von Stundenzetteln
- E-Mail-Entwürfe an Projektleiter (via Microsoft Graph API)
- Abrechnung und Billing-Übersicht
- Datensicherung nach OneDrive (manuell + automatisch)

### Technologie-Stack

| Schicht | Technologie |
|---------|-------------|
| Backend | Node.js 22, Express.js |
| Datenbank | Google Firestore |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Email/OneDrive | Microsoft Graph API (OAuth2 Delegated Flow) |
| Frontend | React 18, Vite, TanStack Query |
| UI-Library | shadcn/ui (Radix UI + Tailwind CSS) |
| PDF-Erzeugung | jsPDF + jspdf-autotable |
| Backend-Hosting | Google Cloud Run (europe-west3, Frankfurt) |
| Frontend-Hosting | Cloudflare Pages |

### Rollen

| Rolle | Kürzel | Berechtigungen |
|-------|--------|----------------|
| Geschäftsführer | GF | Alles: CRUD auf alle Ressourcen, Finanzdaten, Einstellungen, Backup |
| Mitarbeiter | MA | Eigene Tätigkeiten erfassen, eigene Stundenzettel bestätigen, keine Finanzdaten |

---

## 2. Systemarchitektur

```
[Browser — React SPA]
     |
     | HTTPS (JWT Bearer Token)
     v
[Google Cloud Run — zeiterfassung-backend]
     |
     |-- Firestore (Datenbank)
     |-- Microsoft Graph API (Email-Entwürfe, OneDrive-Backup)
     |
     v
[Google Cloud Scheduler — Tägliches Backup]
     |
     | POST /api/cron/backup-onedrive (x-cron-secret Header)
     v
[OneDrive — Backup-Ordner]
```

### Repo-Struktur

```
zeiterfassung_backend/
  src/
    server.js          # Express API Server (alle Endpoints)
    database.js        # Firestore-Initialisierung
  package.json
  Dockerfile
  .env.example

zeiterfassung_frontend/
  src/
    api/apiClient.js   # API-Client mit JWT-Auth
    lib/
      AuthContext.jsx   # Auth-State & Login-Logik
      notify.js         # Zentrales Toast-System
      utils.js          # Tailwind Utilities
    pages/
      Dashboard.jsx     # KPI-Dashboard
      Projects.jsx      # Projektverwaltung
      Activities.jsx    # Tätigkeitserfassung
      Timesheets.jsx    # Stundenzettel-Workflow
      Billing.jsx       # Abrechnungsübersicht
      Employees.jsx     # Mitarbeiterverwaltung
      Summary.jsx       # Auswertungen & Export
      Settings.jsx      # Einstellungen (Email, Backup, Vorlagen)
    components/
      projects/
        ProjectDialog.jsx       # Projekt erstellen/bearbeiten
        SubprojectManager.jsx   # Subprojekte verwalten
      activities/
        ActivityDialog.jsx      # Tätigkeit erstellen/bearbeiten
      employees/
        EmployeeDialog.jsx      # Mitarbeiter erstellen/bearbeiten
      timesheets/
        EmailToPLDialog.jsx     # Email-Entwurf an Projektleiter
      ui/                       # shadcn/ui Komponenten
      Layout.jsx                # Sidebar-Navigation
      LoginPage.jsx             # Login & Erstanmeldung
  package.json
  vite.config.ts
```

---

## 3. Infrastruktur & Hosting

### Google Cloud Platform

| Dienst | Zweck | Region | Projekt-ID |
|--------|-------|--------|------------|
| Cloud Run | Backend-API | europe-west3 (Frankfurt) | zeiterfassung-494018 |
| Firestore | Datenbank | europe-west3 (Frankfurt) | zeiterfassung-494018 |
| Cloud Scheduler | Tägliches Backup | europe-west3 | zeiterfassung-494018 |

**Projekt-Nummer:** 339855266648
**Backend-URL:** `https://zeiterfassung-backend-339855266648.europe-west3.run.app`

### Cloudflare Pages

| Dienst | Zweck |
|--------|-------|
| Cloudflare Pages | Frontend-Hosting (statische SPA) |

**Hinweis:** Cloudflare hostet nur statischen Code (HTML/JS/CSS). Keine personenbezogenen Daten werden auf Cloudflare gespeichert.

### Microsoft Azure AD

| Dienst | Zweck |
|--------|-------|
| Azure AD App-Registrierung | OAuth2 für Email-Entwürfe und OneDrive-Backup |
| Microsoft Graph API | Email-Entwürfe erstellen, OneDrive-Upload |

**Berechtigungen (Delegated):**
- `Mail.ReadWrite` — E-Mail-Entwürfe erstellen
- `Files.ReadWrite` — OneDrive-Backup hochladen
- `offline_access` — Refresh Token für dauerhaften Zugriff

**Plattform:** Web (NICHT Single Page Application!)
**Redirect URI:** `https://zeiterfassung-backend-339855266648.europe-west3.run.app/api/email/callback`

---

## 4. Authentifizierung & Sicherheit

### Auth-Flow

```
1. User gibt Email + Passwort ein
2. POST /api/auth/login → Backend prüft bcrypt-Hash
3. Backend generiert JWT-Token (7 Tage gültig)
4. Frontend speichert Token in localStorage
5. Jeder API-Call sendet "Authorization: Bearer <token>"
6. Backend-Middleware prüft Token-Signatur und Ablauf
7. Bei 401 → Frontend loggt automatisch aus
```

### JWT-Token Inhalt

```json
{
  "id": "firestore-doc-id",
  "name": "Thomas Kedzierski",
  "email": "thomas@projektwaerts.de",
  "role": "GF",
  "iat": 1714060800,
  "exp": 1714665600
}
```

### Sicherheitsmaßnahmen

| Maßnahme | Details |
|----------|---------|
| JWT Auth Middleware | Alle /api/ Endpoints geschützt (außer Login, Callback) |
| Rollen-basierte Autorisierung | GF sieht Finanzdaten, MA nicht |
| Passwort-Hashing | bcryptjs mit Salt (10 Rounds) |
| CORS | Eingeschränkt auf FRONTEND_URL |
| Secrets externalisiert | JWT_SECRET, INVITE_CODE, SEED_PASSWORD als Env-Vars |
| Cron-Schutz | x-cron-secret Header für Scheduler-Endpoints |
| Body-Limit | 25MB (für PDF-Anhänge) |
| Token-Ablauf | 7 Tage, danach automatischer Logout |

### Offene Endpoints (ohne JWT)

| Endpoint | Schutz |
|----------|--------|
| `GET /health` | Kein Schutz (Health Check) |
| `GET /` | Kein Schutz (Info) |
| `POST /api/auth/login` | Email + Passwort |
| `POST /api/auth/set-password` | Invite-Code |
| `POST /api/auth/check-email` | Kein Schutz (gibt nur exists/hasPassword zurück) |
| `GET /api/email/callback` | Microsoft OAuth Redirect |
| `POST /api/admin/seed-user` | Invite-Code |
| `POST /api/cron/backup-onedrive` | x-cron-secret Header |

---

## 5. Datenmodell (Firestore)

### Collection: `employees`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| name | string | Vollständiger Name |
| email | string | E-Mail-Adresse |
| email_lower | string | Lowercase E-Mail (für Login-Suche) |
| role | string | "GF" oder "MA" |
| hourly_rate | number/null | Stundensatz (nur für GF sichtbar) |
| password_hash | string/null | bcrypt-Hash |
| created_date | string | ISO-Timestamp |

### Collection: `projects`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| project_number | string | Projektnummer (z.B. "P-2024-001") |
| project_name | string | Projektname |
| customer_name | string | Kundenname |
| project_leader | string | Projektleiter-Name(n), komma-getrennt |
| project_leader_email | string | PL-Email(s), komma-getrennt |
| employee_name | string | Zugewiesene Mitarbeiter, komma-getrennt |
| hourly_rate | number | Projekt-Stundensatz |
| payment_terms | number | Zahlungsziel in Tagen (Default: 30) |
| vat_rate | number | MwSt-Satz in % (Default: 19) |
| planned_hours | number | Soll-Stunden |
| start_date | string | Projektbeginn (YYYY-MM-DD) |
| end_date | string | Projektende (YYYY-MM-DD) |
| order_number | string | Bestellnummer |
| external_project_number | string | Externe Projektnummer |
| customer_number | string | Kundennummer |
| contract_number | string | Vertragsnummer |
| created_date | string | ISO-Timestamp |

### Collection: `subprojects`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| project_id | string | Referenz auf Projekt |
| name | string | Subprojekt-Name |
| number | string/null | Subprojekt-Nummer |
| created_date | string | ISO-Timestamp |

### Collection: `activities`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| project_id | string | Referenz auf Projekt |
| subproject_id | string/null | Referenz auf Subprojekt |
| description | string | Tätigkeitsbeschreibung |
| employee_name | string | Mitarbeitername |
| actual_hours | number | Ist-Stunden |
| activity_date | string | Datum (YYYY-MM-DD) |
| notes | string | Notizen |
| status | string | "offen", "bestätigt", "freigegeben" |
| confirmed_at | string/null | Bestätigungszeitpunkt |
| confirmed_by | string/null | Bestätigt von |
| approved_at | string/null | Freigabezeitpunkt |
| approved_by | string/null | Freigegeben von |
| created_date | string | ISO-Timestamp |

### Collection: `timesheets`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| employee_name | string | Mitarbeitername |
| project_id | string | Referenz auf Projekt |
| month | string | Monat (YYYY-MM) |
| status | string | "offen", "MA bestätigt", "GF freigegeben" |
| confirmed_at | string/null | Bestätigungszeitpunkt |
| confirmed_by | string/null | Bestätigt von |
| approved_at | string/null | Freigabezeitpunkt |
| approved_by | string/null | Freigegeben von |
| created_date | string | ISO-Timestamp |

### Collection: `project_billings`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| project_id | string | Referenz auf Projekt |
| month | string | Monat (YYYY-MM) |
| invoiced | boolean | Rechnung gestellt |
| payment_date | string/null | Zahlungsdatum |
| paid | boolean | Bezahlt |
| created_date | string | ISO-Timestamp |

### Collection: `app_settings`

Dokumente:
- `email_templates` — E-Mail-Vorlagen (subject, body)
- `ms_oauth` — Microsoft OAuth Tokens (access_token, refresh_token, sender_email)
- `onedrive_backup` — OneDrive-Pfad (folder_path)
- `last_backup` — Letzter Backup-Status (timestamp, status, type)

---

## 6. Backend — API-Endpunkte

### Auth

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|--------------|
| POST | /api/auth/login | - | Login, gibt JWT-Token zurück |
| POST | /api/auth/set-password | Invite-Code | Erstanmeldung: Passwort setzen |
| POST | /api/auth/check-email | - | Prüft ob E-Mail existiert |
| POST | /api/admin/seed-user | Invite-Code | Neuen User anlegen |

### Employees (CRUD)

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|--------------|
| GET | /api/employees | JWT | Liste aller Mitarbeiter (MA: ohne hourly_rate) |
| POST | /api/employees | JWT | Neuen Mitarbeiter anlegen |
| PUT | /api/employees/:id | JWT | Mitarbeiter bearbeiten |
| DELETE | /api/employees/:id | JWT | Mitarbeiter löschen |

### Projects (CRUD)

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|--------------|
| GET | /api/projects | JWT | Liste aller Projekte (MA: ohne Finanzdaten) |
| POST | /api/projects | JWT | Neues Projekt anlegen (inkl. initiale Subprojekte) |
| PUT | /api/projects/:id | JWT | Projekt bearbeiten |
| DELETE | /api/projects/:id | JWT | Projekt + zugehörige Tätigkeiten löschen |

### Subprojects (CRUD)

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|--------------|
| GET | /api/subprojects?project_id=X | JWT | Subprojekte eines Projekts |
| POST | /api/subprojects | JWT | Neues Subprojekt |
| PUT | /api/subprojects/:id | JWT | Subprojekt bearbeiten |
| DELETE | /api/subprojects/:id | JWT | Subprojekt löschen |

### Activities (CRUD + Status)

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|--------------|
| GET | /api/activities | JWT | Alle Tätigkeiten |
| POST | /api/activities | JWT | Neue Tätigkeit (splittet bei mehreren MA) |
| PUT | /api/activities/:id | JWT | Tätigkeit bearbeiten |
| DELETE | /api/activities/:id | JWT | Tätigkeit löschen |
| POST | /api/activities/confirm | JWT | Batch: Status → "bestätigt" |
| POST | /api/activities/approve | JWT | Batch: Status → "freigegeben" |
| POST | /api/activities/reset-status | JWT | Batch: Status → "offen" |

### Timesheets

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|--------------|
| GET | /api/timesheets | JWT | Alle Stundenzettel |
| POST | /api/timesheets/confirm | JWT | MA bestätigt Stundenzettel |
| POST | /api/timesheets/approve | JWT | GF gibt Stundenzettel frei |
| POST | /api/timesheets/reset | JWT | Status zurücksetzen |
| DELETE | /api/timesheets/:id | JWT | Stundenzettel löschen |

### Project Billings

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|--------------|
| GET | /api/project-billings | JWT | Alle Abrechnungen |
| POST | /api/project-billings | JWT | Abrechnung speichern/aktualisieren |

### Email

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|--------------|
| GET | /api/email/auth-url | JWT | Microsoft OAuth URL generieren |
| GET | /api/email/callback | - | OAuth Callback (Redirect von Microsoft) |
| GET | /api/email/config | JWT | Verbindungsstatus prüfen |
| DELETE | /api/email/disconnect | JWT | Microsoft-Verbindung trennen |
| GET | /api/email/templates | JWT | E-Mail-Vorlagen laden |
| POST | /api/email/templates | JWT | E-Mail-Vorlagen speichern |
| POST | /api/email/send-timesheet | JWT | E-Mail-Entwurf erstellen (Outlook) |

### Backup & Admin

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|--------------|
| GET | /api/admin/backup/status | JWT | Letzter Backup-Status |
| GET | /api/admin/backup | JWT | Vollständiges JSON-Backup herunterladen |
| GET | /api/admin/backup/csv?collection=X | JWT | CSV-Export einer Collection |
| POST | /api/admin/backup/restore | JWT | Backup wiederherstellen |
| GET | /api/admin/onedrive-config | JWT | OneDrive-Pfad laden |
| POST | /api/admin/onedrive-config | JWT | OneDrive-Pfad speichern |
| POST | /api/admin/backup/onedrive | JWT | Manuelles OneDrive-Backup (JSON + CSV) |
| POST | /api/cron/backup-onedrive | Cron-Secret | Automatisches tägliches Backup |

---

## 7. Frontend — Seiten & Komponenten

### Dashboard (/)
- KPI-Karten: Projekte, Stunden, Mitarbeiter, Umsatz
- Filter: Mitarbeiter, Projekt, Monat, Zeitraum (Monat/Jahr)
- Stunden-Kontingent pro Projekt (Fortschrittsbalken)
- Performance-Übersicht: Stunden pro Mitarbeiter/Projekt
- Letzte Tätigkeiten (editierbar)

### Projekte (/projects)
- Projektliste mit Subprojekt-Badges
- Projekt erstellen/bearbeiten Dialog:
  - Grunddaten (Nummer, Name, Kunde)
  - Projektleiter: Name + E-Mail als Paare (mehrere möglich)
  - Mitarbeiter-Zuweisung (Dropdown + Freitext)
  - Identifier (Bestellnr., ext. Projektnr., Kundennr., Vertragsnr.)
  - Finanzen (nur GF): Stundensatz, Zahlungsziel, MwSt
  - Zeitraum & Soll-Stunden
  - Subprojekte beim Erstellen direkt anlegen
- Subprojekt-Manager beim Bearbeiten

### Tätigkeiten (/activities)
- Tätigkeitsliste mit Status-Badges
- Filter: Mitarbeiter, Projekt, Monat
- Tätigkeit erstellen Dialog:
  - Projekt + Subprojekt Auswahl
  - Beschreibung mit Spracheingabe + Autocomplete
  - Mehrere Mitarbeiter gleichzeitig (werden als separate Tätigkeiten angelegt)
  - Mehrere Daten gleichzeitig (Bulk-Erstellung)
- Batch-Aktionen: Bestätigen, Freigeben, Zurücksetzen

### Stundenzettel (/timesheets)
- Gruppierung: Mitarbeiter × Projekt × Monat
- Aufklappbare Detailansicht
- Status-Workflow: Offen → MA bestätigt → GF freigegeben
- PDF-Export (jsPDF)
- E-Mail-Entwurf an Projektleiter (mit PDF-Anhang)
  - Empfänger: automatisch aus Projekt-Daten
  - CC: automatisch MA-Email
  - Platzhalter in Betreff und Text

### Abrechnung (/billing) — nur GF
- Abrechnungsübersicht pro Projekt/Monat
- Netto, MwSt, Brutto Berechnung
- Rechnungsstatus (gestellt/bezahlt)
- CSV-Export

### Mitarbeiter (/employees) — nur GF
- Mitarbeiterliste mit Rollen-Badges
- CRUD-Dialog (Name, Email, Rolle, Stundensatz)

### Auswertungen (/summary)
- Zwei Tabs: Nach Mitarbeiter / Nach Projekt
- Detaillierte Tätigkeitstabellen
- CSV-Export
- Druckfunktion

### Einstellungen (/settings) — nur GF
- Microsoft Email-Integration (Verbinden/Trennen)
- E-Mail-Vorlagen (Betreff + Text mit Platzhaltern)
- Datensicherung:
  - Manueller Download (JSON + CSV)
  - OneDrive-Backup (Pfad konfigurierbar, manuell auslösbar)
  - Backup-Status Anzeige

### E-Mail-Platzhalter

| Platzhalter | Beschreibung |
|-------------|--------------|
| `{month}` | Monat (z.B. "April 2026") |
| `{project_number}` | Projektnummer |
| `{project_name}` | Projektname |
| `{project_leader}` | PL vollständiger Name |
| `{project_leader_firstname}` | PL Vorname |
| `{project_leader_lastname}` | PL Nachname |
| `{employee_name}` | Mitarbeitername |
| `{total_hours}` | Gesamtstunden |
| `{sender_name}` | Absender-Name |

Bei mehreren Projektleitern wird die Anrede automatisch zu "Sehr geehrte Damen und Herren" geändert.

---

## 8. Microsoft Integration (Email & OneDrive)

### OAuth2 Delegated Flow

```
1. User klickt "Mit Microsoft verbinden" in Settings
2. Backend generiert Auth-URL mit Scopes
3. User wird zu Microsoft weitergeleitet
4. User autorisiert die App
5. Microsoft leitet zu /api/email/callback zurück
6. Backend tauscht Code gegen Access Token + Refresh Token
7. Tokens werden in Firestore gespeichert (app_settings/ms_oauth)
8. Redirect zurück zum Frontend
```

### Token-Refresh

- Access Token: ~1 Stunde gültig
- Refresh Token: ~90 Tage gültig
- Bei jedem API-Call wird geprüft ob das Access Token abgelaufen ist
- Falls ja: automatischer Refresh mit dem Refresh Token
- Der tägliche Backup-Cron hält das Refresh Token am Leben

### E-Mail-Entwurf erstellen

```
POST /api/email/send-timesheet
→ Platzhalter in Betreff/Text ersetzen
→ POST https://graph.microsoft.com/v1.0/me/messages
→ Entwurf erscheint in Outlook Drafts
→ User prüft und sendet manuell
```

### OneDrive-Backup

```
POST /api/admin/backup/onedrive
→ Alle Collections aus Firestore laden
→ JSON-Backup erstellen
→ CSV pro Collection erstellen
→ PUT https://graph.microsoft.com/v1.0/me/drive/root:/{path}/{file}:/content
→ Dateien erscheinen in OneDrive
```

Ordnerstruktur in OneDrive:
```
/Zeiterfassung/Backups/
  └── 2026-04-25T14-30-00/
      ├── zeiterfassung_backup.json
      ├── employees.csv
      ├── projects.csv
      ├── subprojects.csv
      ├── activities.csv
      ├── timesheets.csv
      └── project_billings.csv
```

---

## 9. Backup-System

### Manueller Download
- **JSON**: Vollständiges Backup aller Collections
- **CSV**: Einzelne Collections (Mitarbeiter, Projekte, Tätigkeiten, Stundenzettel)
- Download direkt im Browser

### OneDrive-Backup (manuell)
- Button in Settings → lädt JSON + alle CSVs nach OneDrive
- Pfad konfigurierbar (Default: `/Zeiterfassung/Backups`)
- Jedes Backup in eigenem Ordner mit Timestamp

### Automatisches Backup (Cloud Scheduler)
- Täglich um 02:00 Uhr (Europe/Berlin)
- Cloud Scheduler ruft `POST /api/cron/backup-onedrive` auf
- Geschützt durch `x-cron-secret` Header
- Identisch zum manuellen OneDrive-Backup

### Restore
- `POST /api/admin/backup/restore` mit JSON-Body
- Löscht bestehende Daten und importiert aus Backup
- app_settings werden gemerged (nicht gelöscht)

---

## 10. Deployment

### Backend (Google Cloud Run)

Deployment erfolgt automatisch bei `git push`:

```bash
# Manuelles Deployment (falls nötig):
gcloud run deploy zeiterfassung-backend \
  --source . \
  --region europe-west3 \
  --allow-unauthenticated
```

### Frontend (Cloudflare Pages)

Deployment erfolgt automatisch bei `git push`.

### Seed-Users beim Start

Beim Backend-Start werden automatisch zwei GF-Accounts angelegt (falls nicht vorhanden):

1. **Thomas Kedzierski** (thomas.kedzierski@projektwaerts.de)
2. **Admin Plinius** (admin@plinius-systems.de)

Wenn `SEED_PASSWORD` gesetzt ist, werden sie mit Passwort angelegt. Sonst müssen sie die Erstanmeldung nutzen.

---

## 11. Umgebungsvariablen

### Backend (Cloud Run)

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `JWT_SECRET` | ✅ | Geheimer Schlüssel für JWT-Signierung (min. 32 Zeichen) |
| `INVITE_CODE` | ✅ | Code für Erstanmeldung neuer Mitarbeiter |
| `FRONTEND_URL` | ✅ | Frontend-URL für CORS und OAuth-Redirect |
| `SEED_PASSWORD` | Optional | Passwort für Seed-Users (Thomas + Admin) |
| `CRON_SECRET` | Optional | Secret für Cloud Scheduler Backup-Job |
| `M365_TENANT_ID` | Optional | Azure AD Tenant ID |
| `M365_CLIENT_ID` | Optional | Azure AD Client ID |
| `M365_CLIENT_SECRET` | Optional | Azure AD Client Secret |
| `M365_REDIRECT_URI` | Optional | OAuth Callback URL |
| `PORT` | Auto | Wird von Cloud Run automatisch gesetzt (8080) |

### Frontend (.env)

| Variable | Beschreibung |
|----------|--------------|
| `VITE_BACKEND_API_URL` | Backend-URL (Cloud Run) |

---

*Erstellt: April 2026 — Plinius Systems*
