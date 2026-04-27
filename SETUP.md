# Zeiterfassung — Setup & Einrichtung

> Anleitung für die erstmalige Einrichtung und Konfiguration

---

## 1. Voraussetzungen

- Google Cloud Projekt (`zeiterfassung-494018`)
- Node.js 22+
- Google Cloud CLI (`gcloud`)
- Azure AD App-Registrierung (für Email/OneDrive)

---

## 2. Google Cloud Einrichtung

### 2.1 Firestore aktivieren

```bash
gcloud firestore databases create --location=europe-west3 --project=zeiterfassung-494018
```

### 2.2 Cloud Run deployen

```bash
gcloud run deploy zeiterfassung-backend \
  --source . \
  --region europe-west3 \
  --allow-unauthenticated \
  --project zeiterfassung-494018
```

### 2.3 Umgebungsvariablen setzen

```bash
# JWT Secret generieren
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Variablen setzen
gcloud run services update zeiterfassung-backend \
  --region europe-west3 \
  --set-env-vars \
    JWT_SECRET=<generierter-wert>,\
    INVITE_CODE=<dein-invite-code>,\
    FRONTEND_URL=https://zeiterfassung-frontend.pages.dev,\
    SEED_PASSWORD=<initiales-passwort>
```

### 2.4 Google Cloud CDPA akzeptieren

**Cloud Console → Compliance → Data Processing Terms → Akzeptieren**

Dies ist der Auftragsverarbeitungsvertrag mit Google nach Art. 28 DSGVO.

---

## 3. Azure AD Einrichtung (Microsoft Integration)

### 3.1 App-Registrierung erstellen

1. Azure Portal → Azure Active Directory → App-Registrierungen → Neue Registrierung
2. Name: "Zeiterfassung"
3. Unterstützte Kontotypen: "Nur Konten in diesem Organisationsverzeichnis"

### 3.2 Plattform konfigurieren

1. Authentifizierung → Plattform hinzufügen → **Web** (NICHT SPA!)
2. Redirect URI: `https://zeiterfassung-backend-339855266648.europe-west3.run.app/api/email/callback`

### 3.3 API-Berechtigungen

Folgende **Delegierte** Berechtigungen hinzufügen:
- `Mail.ReadWrite` — E-Mail-Entwürfe erstellen
- `Files.ReadWrite` — OneDrive-Backup
- `User.Read` — Benutzerprofil lesen
- `offline_access` — Refresh Token

**Administratorzustimmung erteilen** nach dem Hinzufügen.

### 3.4 Client Secret erstellen

1. Zertifikate & Geheimnisse → Neuer geheimer Clientschlüssel
2. Wert kopieren und als `M365_CLIENT_SECRET` in Cloud Run setzen

### 3.5 Cloud Run Variablen ergänzen

```bash
gcloud run services update zeiterfassung-backend \
  --region europe-west3 \
  --update-env-vars \
    M365_TENANT_ID=<deine-tenant-id>,\
    M365_CLIENT_ID=<deine-client-id>,\
    M365_CLIENT_SECRET=<dein-client-secret>,\
    M365_REDIRECT_URI=https://zeiterfassung-backend-339855266648.europe-west3.run.app/api/email/callback
```

---

## 4. Cloud Scheduler (Tägliches Backup)

### 4.1 Cron-Secret generieren und setzen

```bash
# Secret generieren
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"

# In Cloud Run setzen
gcloud run services update zeiterfassung-backend \
  --region europe-west3 \
  --update-env-vars CRON_SECRET=<generierter-wert>
```

### 4.2 Scheduler-Job erstellen

```bash
gcloud scheduler jobs create http zeiterfassung-daily-backup \
  --location=europe-west3 \
  --schedule="0 2 * * *" \
  --time-zone="Europe/Berlin" \
  --uri="https://zeiterfassung-backend-339855266648.europe-west3.run.app/api/cron/backup-onedrive" \
  --http-method=POST \
  --headers="x-cron-secret=<gleicher-wert-wie-CRON_SECRET>"
```

---

## 5. Frontend (Cloudflare Pages)

### 5.1 Repository verbinden

1. Cloudflare Dashboard → Pages → Create a project
2. Git-Repository verbinden
3. Build-Einstellungen:
   - Build command: `npm run build`
   - Build output: `dist`
   - Root directory: `/`

### 5.2 Umgebungsvariable

```
VITE_BACKEND_API_URL=https://zeiterfassung-backend-339855266648.europe-west3.run.app
```

---

## 6. Erster Login

1. Backend deployen (Cloud Run)
2. Frontend deployen (Cloudflare Pages)
3. App öffnen → Login-Seite
4. **Option A**: Mit SEED_PASSWORD einloggen (thomas.kedzierski@projektwaerts.de)
5. **Option B**: "Erstanmeldung" → E-Mail + Invite-Code → Passwort setzen
6. In Settings: Microsoft-Konto verbinden
7. OneDrive-Pfad konfigurieren
8. Fertig!

---

## 7. Monitoring

### Cloud Audit Logs aktivieren

Cloud Console → IAM & Admin → Audit Logs → Firestore:
- ✅ Data Read
- ✅ Data Write

### Alert für Backup-Fehler

Cloud Console → Logging → Log Explorer:
```
resource.type="cloud_run_revision"
resource.labels.service_name="zeiterfassung-backend"
textPayload=~"Cron-Backup Fehler"
```
→ "Create alert" → Email-Benachrichtigung einrichten

---

*Erstellt: April 2026 — Plinius Systems*
