# Technische und Organisatorische Maßnahmen (TOM)

## Anlage 3 zum AVV — Zeiterfassung PROJEKTWÄRTS

> Gemäß Art. 32 DSGVO | Stand: April 2026

---

## 1. Vertraulichkeit

### 1.1 Zutrittskontrolle
- Kein physischer Server — alle Systeme laufen auf Google Cloud Platform (Rechenzentrum Frankfurt)
- Google Cloud Rechenzentren sind ISO 27001, SOC 2 und BSI C5 zertifiziert
- Kein physischer Zugang durch Plinius-Mitarbeiter zu Rechenzentren erforderlich

### 1.2 Zugangskontrolle
- **Benutzerauthentifizierung**: E-Mail + Passwort mit bcrypt-Hashing (10 Salt Rounds)
- **JWT-basierte API-Authentifizierung**: Alle API-Endpoints geschützt (außer Login, Passwort-Reset, Health-Check)
- **Token-Ablauf**: JWT-Token läuft nach 7 Tagen ab, danach automatischer Logout
- **Passwort-Reset**: Über Brevo SMTP mit zeitlich begrenztem Token (1 Stunde gültig, einmalig verwendbar)
- **Erstanmeldung**: Nur mit Invite-Code möglich (verhindert unbefugte Registrierung)
- **Automatischer Logout**: Bei ungültigem oder abgelaufenem Token wird der User sofort ausgeloggt

### 1.3 Zugriffskontrolle
- **Rollen-basierte Autorisierung**: Zwei Rollen (GF = Geschäftsführer, MA = Mitarbeiter)
- **Finanzdaten-Schutz**: Stundensätze, Zahlungsziele und MwSt-Sätze werden im API-Response für MA-Rolle herausgefiltert — auch bei direktem API-Zugriff nicht sichtbar
- **Notizen-Sichtbarkeit**: Mitarbeiter sehen nur eigene Notizen, GF sieht alle
- **E-Mail-Entwürfe**: Nur GF kann E-Mail-Entwürfe erstellen, und nur bei freigegebenen Stundenzetteln
- **Einstellungen/Backup**: Nur für GF zugänglich

### 1.4 Trennungskontrolle
- Logische Trennung durch Firestore Collections (employees, projects, activities, etc.)
- Keine Multi-Tenancy — die App ist dediziert für einen Kunden (projektwärts)

### 1.5 Pseudonymisierung
- Passwörter werden als bcrypt-Hash gespeichert (nicht reversibel)
- JWT-Token enthält nur User-ID, Name, E-Mail und Rolle (keine sensiblen Daten)

---

## 2. Integrität

### 2.1 Weitergabekontrolle
- **HTTPS/TLS**: Alle Verbindungen verschlüsselt (Cloud Run, Microsoft Graph API, Brevo SMTP, Cloudflare)
- **CORS**: Backend akzeptiert nur Requests von der konfigurierten Frontend-URL
- **API-Authentifizierung**: Jeder Request muss ein gültiges JWT-Token im Authorization-Header enthalten

### 2.2 Eingabekontrolle
- **Audit-Trail**: Tätigkeiten enthalten `created_date`, `confirmed_by`, `approved_by` mit Zeitstempel
- **Status-Workflow**: Offen → MA bestätigt → GF freigegeben (nachvollziehbar)
- **Cloud Run Logs**: Alle API-Requests werden in Google Cloud Logging protokolliert (30 Tage Retention)

---

## 3. Verfügbarkeit und Belastbarkeit

### 3.1 Verfügbarkeitskontrolle
- **Google Cloud Run**: Automatische Skalierung, hochverfügbar, Region europe-west3 (Frankfurt)
- **Firestore**: Google-managed, automatische Replikation innerhalb der Region
- **Cloudflare Pages**: Global CDN für Frontend-Hosting

### 3.2 Wiederherstellbarkeit
- **Tägliches OneDrive-Backup**: Automatisch um 02:00 Uhr via Cloud Scheduler (JSON + CSV aller Collections)
- **Firestore-Export**: Alle 2 Tage um 03:00 Uhr nativer Firestore-Export in Cloud Storage
- **Manuelles Backup**: Jederzeit über Settings-Seite (Download oder OneDrive-Upload)
- **Restore-Endpoint**: `POST /api/admin/backup/restore` ermöglicht Wiederherstellung aus JSON-Backup
- **Cloud Storage Lifecycle**: Firestore-Exports werden nach 7 Tagen automatisch gelöscht (3 Versionen)

---

## 4. Verfahren zur regelmäßigen Überprüfung

### 4.1 Datenschutz-Management
- Technische Dokumentation wird im Repository gepflegt (DOKUMENTATION.md, SETUP.md)
- AVV und TOM werden bei wesentlichen Änderungen aktualisiert

### 4.2 Incident-Response
- **Cloud Monitoring**: Log-basierte Alerts bei Backup-Fehlern
- **Automatische Fehler-Erkennung**: Backend gibt strukturierte Fehlermeldungen zurück
- **Passwort-Reset**: Self-Service über E-Mail (Brevo SMTP)

### 4.3 Datenschutzfreundliche Voreinstellungen (Privacy by Design)
- **Minimale Berechtigungen**: Microsoft OAuth nutzt `Files.ReadWrite.AppFolder` (nur App-eigener Ordner) statt Vollzugriff
- **Keine dauerhafte Speicherung von PDFs**: Stundenzettel-PDFs werden im Browser generiert (jsPDF), nicht auf dem Server
- **Secrets externalisiert**: Alle Zugangsdaten als Cloud Run Environment Variables (nicht im Code)
- **Kein Tracking**: Keine Analytics, keine Cookies (außer funktionale localStorage für Auth)

---

## 5. Verschlüsselung

### 5.1 Verschlüsselung in Transit
- HTTPS/TLS für alle Verbindungen:
  - Browser ↔ Cloud Run (Backend)
  - Cloud Run ↔ Firestore
  - Cloud Run ↔ Microsoft Graph API
  - Cloud Run ↔ Brevo SMTP
  - Browser ↔ Cloudflare Pages (Frontend)

### 5.2 Verschlüsselung at Rest
- **Firestore**: Google-managed Encryption Keys (AES-256)
- **Cloud Storage** (Backups): Google-managed Encryption Keys (AES-256)
- **Cloud Run**: Keine persistente Speicherung (stateless)

### 5.3 Schlüsselverwaltung
- JWT-Secret: Als Environment Variable in Cloud Run (nicht im Code)
- Cron-Secret: Als Environment Variable in Cloud Run
- Microsoft OAuth Tokens: In Firestore gespeichert (Google-managed Encryption)
- SMTP-Credentials: Als Environment Variable in Cloud Run

---

## 6. Speicherorte personenbezogener Daten

| Speicherort | Was wird gespeichert | Aufbewahrungsdauer |
|---|---|---|
| Google Firestore (Frankfurt) | Mitarbeiter, Projekte, Tätigkeiten, Stundenzettel, Abrechnungen, Einstellungen | Solange Kundenvertrag läuft |
| Microsoft OneDrive (Kunde) | Backup-Dateien (JSON + CSV) | Vom Kunden verwaltet |
| Cloud Storage (Frankfurt) | Firestore-Exports (nativer Backup) | 7 Tage (Lifecycle Rule) |
| Cloud Run Logs | API-Request-Logs (keine PB-Daten im Body) | 30 Tage (Google Standard) |
| Browser localStorage | JWT-Token, User-Daten (Name, Rolle) | Bis Logout oder Token-Ablauf |

---

## 7. Löschkonzept

| Daten | Löschung |
|---|---|
| Mitarbeiter-Daten | Können vom GF über die App gelöscht werden (DELETE Endpoint) |
| Projekte + Tätigkeiten | Können vom GF gelöscht werden (Cascade-Delete für Tätigkeiten) |
| OneDrive-Backups | Vom Kunden verwaltet |
| Firestore-Exports | Automatisch nach 7 Tagen (Cloud Storage Lifecycle) |
| Cloud Run Logs | Automatisch nach 30 Tagen |
| JWT-Token | Läuft nach 7 Tagen ab, wird bei Logout aus localStorage entfernt |
| Passwort-Reset-Token | Läuft nach 1 Stunde ab, wird nach Nutzung gelöscht |
| Microsoft OAuth Tokens | Werden bei Disconnect gelöscht |
| Gesamte Datenbank | Kann bei Vertragsende vollständig gelöscht werden |

---

*Erstellt: April 2026 — Plinius Systems*
*Dieses Dokument ist Anlage 3 zum AVV und wird bei wesentlichen technischen Änderungen aktualisiert.*
