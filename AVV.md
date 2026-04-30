# Vertrag zur Auftragsverarbeitung (AVV) gemäß Art. 28 DSGVO

## Zeiterfassung PROJEKTWÄRTS

---

zwischen der

**projektwärts GmbH**
Friedrich-Wilhelm-Straße 59, 42655 Solingen
vertreten durch den Geschäftsführer: Thomas Kedzierski
— nachfolgend „Verantwortlicher" genannt —

und der

**Plinius UG (haftungsbeschränkt)**
Wolkenburg 16, 42119 Wuppertal
vertreten durch den Geschäftsführer: Ernest Berezovskyy
Ansprechpartner für Datenschutz: Ernest Berezovskyy
— nachfolgend „Auftragsverarbeiter" genannt —

---

## § 1 Gegenstand und Dauer des Vertrages

(1) Gegenstand dieses Vertrages ist die Verarbeitung personenbezogener Daten durch den Auftragsverarbeiter im Auftrag des Verantwortlichen zur Erbringung der Dienste der Software „Zeiterfassung" (nachfolgend „die App").

(2) Die Dauer dieses Vertrages richtet sich nach der Laufzeit des zugrundeliegenden Nutzungsvertrages.

## § 2 Art und Zweck der Verarbeitung, Art der Daten und Kreis der Betroffenen

(1) Die Art und der Zweck der Verarbeitung, die Art der personenbezogenen Daten sowie die Kategorien betroffener Personen sind in **Anlage 1** zu diesem Vertrag detailliert beschrieben.

(2) Die Erbringung der vertraglich vereinbarten Datenverarbeitung findet ausschließlich in einem Mitgliedsstaat der Europäischen Union (EU) oder in einem Vertragsstaat des Abkommens über den Europäischen Wirtschaftsraum (EWR) statt.

## § 3 Weisungsbefugnis des Verantwortlichen

(1) Der Auftragsverarbeiter darf Daten von betroffenen Personen nur im Rahmen des Auftrages und der dokumentierten Weisungen des Verantwortlichen verarbeiten, außer es liegt eine rechtliche Verpflichtung vor.

(2) Der Auftragsverarbeiter informiert den Verantwortlichen unverzüglich, wenn er der Auffassung ist, dass eine Weisung gegen anwendbare Datenschutzvorschriften verstößt.

## § 4 Pflichten des Auftragsverarbeiters

(1) Der Auftragsverarbeiter gewährleistet die vertragsgemäße Verarbeitung der Daten nach Art. 28 DSGVO.

(2) Er verpflichtet alle Personen, die Zugang zu personenbezogenen Daten haben, zur Vertraulichkeit.

(3) Der Auftragsverarbeiter unterstützt den Verantwortlichen bei der Erfüllung der Rechte der betroffenen Personen (Auskunft, Berichtigung, Löschung etc.) im Rahmen seiner technischen Möglichkeiten.

## § 5 Einschaltung von Unterauftragsverarbeitern

(1) Der Verantwortliche stimmt der Beauftragung der in **Anlage 2** genannten Unterauftragsverarbeiter zu.

(2) Der Auftragsverarbeiter informiert den Verantwortlichen vorab über jede beabsichtigte Änderung in Bezug auf die Hinzuziehung oder den Ersatz von Unterauftragsverarbeitern, wodurch der Verantwortliche die Möglichkeit erhält, gegen derartige Änderungen Einspruch zu erheben.

## § 6 Technische und organisatorische Maßnahmen (TOM)

(1) Der Auftragsverarbeiter hat die in **Anlage 3** (separates Dokument: TOM.md) beschriebenen technischen und organisatorischen Maßnahmen vor Beginn der Verarbeitung umgesetzt und wird diese während der Vertragslaufzeit aufrechterhalten.

(2) Die Maßnahmen müssen ein der Art der Daten angemessenes Schutzniveau gewährleisten.

## § 7 Löschung und Rückgabe von personenbezogenen Daten

Nach Abschluss der vertraglichen Arbeiten oder nach Beendigung dieses Vertrages hat der Auftragsverarbeiter sämtliche in seinen Besitz gelangten personenbezogenen Daten nach Wahl des Verantwortlichen datenschutzgerecht zu löschen oder zurückzugeben, sofern keine gesetzlichen Aufbewahrungspflichten bestehen.

## § 8 Kontrollrechte des Verantwortlichen

(1) Der Verantwortliche hat das Recht, die Einhaltung der Vorschriften über den Datenschutz und der vertraglichen Vereinbarungen beim Auftragsverarbeiter in angemessenem Umfang zu kontrollieren.

(2) Der Auftragsverarbeiter stellt dem Verantwortlichen alle erforderlichen Informationen zum Nachweis der Einhaltung der in Art. 28 DSGVO niedergelegten Pflichten zur Verfügung.

## § 9 Meldepflicht bei Datenschutzverletzungen

Der Auftragsverarbeiter unterrichtet den Verantwortlichen unverzüglich, nachdem er eine Verletzung des Schutzes personenbezogener Daten festgestellt hat (Art. 33 Abs. 2 DSGVO).

---

[Ort, Datum] __________________________

Für den Verantwortlichen (projektwärts GmbH):

(Unterschrift Thomas Kedzierski)

Für den Auftragsverarbeiter (Plinius UG):

(Unterschrift Ernest Berezovskyy)

---

## Anlage 1: Daten, Betroffene und Zwecke

### 1. Zweck der Verarbeitung

Bereitstellung und Betrieb einer webbasierten Zeiterfassungs- und Projektmanagement-Anwendung. Das System ermöglicht die Erfassung von Arbeitszeiten, Verwaltung von Projekten und Mitarbeitern, Erstellung von Stundenzetteln (PDF), Versand von E-Mail-Entwürfen an Projektleiter sowie automatische Datensicherung nach OneDrive.

### 2. Kategorien der betroffenen Personen

- Mitarbeiter (Beschäftigte) des Verantwortlichen
- Projektleiter externer Kunden (Name, E-Mail)

### 3. Arten der verarbeiteten personenbezogenen Daten

| Datenkategorie | Beispiele | Sensibilität |
|---|---|---|
| Mitarbeiter-Stammdaten | Name, E-Mail-Adresse, Rolle (GF/MA) | Normal |
| Arbeitszeitdaten | Tätigkeitsbeschreibung, Datum, Ist-Stunden, Projekt | Normal |
| Projektdaten | Projektname, Projektnummer, Kundenname | Normal |
| Finanzdaten | Stundensatz, Zahlungsziel, MwSt-Satz | Normal (nur GF sichtbar) |
| Authentifizierungsdaten | E-Mail, Passwort-Hash (bcrypt), JWT-Token | Normal |
| Projektleiter-Daten | Name, E-Mail-Adresse externer Projektleiter | Normal |
| E-Mail-Metadaten | Absender (Microsoft-Konto), Betreff, Zeitstempel | Normal |

**Hinweis:** Es werden keine besonderen Kategorien personenbezogener Daten im Sinne von Art. 9 DSGVO verarbeitet. Stundensätze sind nur für Geschäftsführer sichtbar und werden im API-Response für Mitarbeiter herausgefiltert.

---

## Anlage 2: Genehmigte Unterauftragsverarbeiter

| Subunternehmer | Dienstleistung / Zweck | Serverstandort |
|---|---|---|
| Google Cloud EMEA Ltd. | Backend-Hosting (Cloud Run), Datenbank (Firestore), Firestore-Backup (Cloud Storage) | EU (Frankfurt / europe-west3) |
| Microsoft Ireland Operations Ltd. | Graph API (E-Mail-Entwürfe, OneDrive-Backup), Azure AD (OAuth2) | EU (Im Tenant des Kunden) |
| Cloudflare, Inc. | Frontend-Hosting (nur statischer Code, keine PB-Daten) | Global (CDN) |
| Sendinblue GmbH (Brevo) | Transaktionale E-Mails (Passwort-Reset) | EU (Deutschland/Frankreich) |

Hinweis: Für US-Anbieter (Google, Microsoft, Cloudflare) greift das EU-US Data Privacy Framework (DPF) bzw. es sind Standardvertragsklauseln (SCC) geschlossen.

---

*Erstellt: April 2026 — Plinius Systems*
*Dieses Dokument ist eine technische Vorlage und ersetzt keine rechtliche Beratung durch einen Datenschutzbeauftragten.*
