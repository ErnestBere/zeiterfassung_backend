# Changelog — Zeiterfassung

## v2.0.0 (29. April 2026) — Großes Sicherheits- & Feature-Update

### 🔒 Sicherheit
- **JWT-Authentifizierung** auf allen API-Endpoints (außer Login/Callback)
- **Rollen-basierte Autorisierung**: MA sieht keine Finanzdaten (Stundensätze, MwSt, Zahlungsziel)
- **CORS eingeschränkt** auf Frontend-URL (statt offen für alle)
- **Secrets externalisiert**: JWT_SECRET, INVITE_CODE, SEED_PASSWORD als Env-Vars
- **Hardcoded Passwort/Invite-Code entfernt** aus Quellcode
- **Passwort-Reset** per E-Mail (Brevo SMTP, 1h Token)
- **OPTIONS Preflight** korrekt behandelt (CORS-Fix)
- **Finanzdaten-Schutz**: hourly_rate, payment_terms, vat_rate im API-Response für MA gefiltert
- **OAuth Multitenant**: `/common/` statt fester Tenant-ID
- **Files.ReadWrite.AppFolder** statt Files.ReadWrite (minimale OneDrive-Berechtigungen)

### 📧 E-Mail & Microsoft Integration
- **E-Mail-Entwürfe** statt direktem Versand (Outlook Drafts)
- **Entwurf nur bei GF-Freigabe** sichtbar (Button nur bei Status "GF freigegeben")
- **MA automatisch in CC** beim E-Mail-Entwurf
- **Projektleiter-Zuordnung**: Name + E-Mail als Paare (statt getrennte Listen)
- **Mehrere PLs**: Automatische neutrale Anrede bei >1 PL
- **E-Mail-Platzhalter**: {project_leader_firstname}, {project_leader_lastname}, etc.
- **Body-Limit 25MB** für PDF-Anhänge

### 💾 Backup-System
- **OneDrive-Backup**: JSON + CSV aller Collections
- **Täglicher Cron-Job** (Cloud Scheduler, 02:00 Uhr)
- **Firestore-Export** alle 2 Tage (nativer GCP-Backup)
- **AppFolder-Scope**: Backups in `OneDrive/Apps/Zeiterfassung/`
- **Timestamp-Ordner** pro Backup
- **Restore-Endpoint**: Wiederherstellung aus JSON-Backup
- **Cron-Secret** für Scheduler-Authentifizierung

### 📊 Projekte & Subprojekte
- **Aufklappbare Projektliste** mit Subprojekt-Zeilen
- **MA-Zuweisung für Subprojekte**
- **Subprojekte beim Erstellen** direkt anlegen
- **Subprojekt-Anzeige** in Tätigkeitsliste und Stundenzettel

### 📄 PDF-Stundenzettel
- **Subprojekt-Spalten**: "Nummer · Name" statt "Projekt 1"
- **Hauptprojekt-Spalte** (Projektname) links von Subprojekten
- **Tätigkeiten ohne Subprojekt** in Hauptprojekt-Spalte
- **Tag-Spalte breiter** (22mm statt 15mm)
- **Unterschriftsfelder**: Links "Datum", rechts "Freigegeben + PL-Name"

### 👥 Berechtigungen & Workflow
- **MA kann eigene Tätigkeiten** bearbeiten/löschen (solange nicht freigegeben)
- **MA kann eigene Tätigkeiten bestätigen** per Klick auf Status-Badge
- **GF kann Status in jedem Zustand** wechseln per Klick
- **Batch-Bestätigung** nur für eigene Tätigkeiten (MA)
- **Löschen-Button** in Zusammenfassung
- **Notizen-Spalte** in Tätigkeitsliste (MA: nur eigene, GF: alle)
- **Datums-Warnung** bei Tätigkeiten außerhalb des Projektzeitraums

### 📈 Dashboard
- **MA sieht eigene Stunden**, GF sieht Gesamt + eigene
- **10 letzte Tätigkeiten** statt 5
- **Abrechnungsübersicht entfernt** (eigene Seite reicht)

### 💰 Abrechnung
- **Gruppierung nach Projekt** (statt pro Mitarbeiter)
- **Rechnung-Checkbox**: Beim Abhaken wird Zahlungsdatum berechnet (heute + Zahlungsziel)
- **Bezahlt-Checkbox**: Nur klickbar wenn Rechnung gestellt
- **Nur für GF** sichtbar

### 🔧 Code-Qualität
- **Zentrales Toast-System** (`notify.js`) — react-hot-toast entfernt
- **Ungenutzter uuid Import** entfernt
- **Duplizierter Invite-Code** → einmalige Konstante
- **Case-insensitive Namensvergleiche** für Filter und Berechtigungen
- **Whitespace-Normalisierung** in Filtern

### 📝 Dokumentation
- **AVV** (Auftragsverarbeitungsvertrag)
- **TOM** (Technische und Organisatorische Maßnahmen)
- **VVT** (Verzeichnis der Verarbeitungstätigkeiten)
- **Technische Dokumentation** aktualisiert
- **Setup-Anleitung** aktualisiert
- **Temporäre Doku-Dateien** im Root gelöscht (16 Dateien)

### 🐛 Bugfixes
- Subprojekte werden beim Bearbeiten angezeigt (Query-Invalidierung)
- Firestore orderBy ohne Composite Index (Sortierung im Code)
- Cloud Run Generation 1 (schnellere Kaltstarts)
- OAuth Callback in Auth-Whitelist (relative Pfade)
- Projekt-Dialog: Buttons zentriert
- Projektnummer: whitespace-nowrap
