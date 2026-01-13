# 🚂 Railway Deployment Guide für tinyCRM

## Voraussetzungen
- Railway Account (https://railway.app)
- GitHub Repository verbunden

## Deployment Schritte

### 1. Zwei Services erstellen

Erstelle auf Railway **zwei separate Services**:

#### **Service 1: Backend (Server)**
- **Root Directory:** `/server`
- **Build Command:** `pnpm install && pnpm run build`
- **Start Command:** `node dist/index.js`

#### **Service 2: Frontend (Client)**
- **Root Directory:** `/client`
- **Build Command:** `pnpm install && pnpm run build`
- **Start Command:** `pnpm run preview --host 0.0.0.0 --port $PORT`

---

## 🔐 Umgebungsvariablen

### Backend Service (Server)

```bash
# PostgreSQL Database (nutze Railway PostgreSQL Plugin)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# JWT Secret (generiere einen zufälligen String mit mindestens 32 Zeichen)
JWT_SECRET=dein-super-sicherer-zufaelliger-string-mit-mindestens-32-zeichen

# Port (automatisch von Railway gesetzt)
PORT=${{PORT}}

# Environment
NODE_ENV=production
```

**JWT_SECRET generieren:**
```bash
# Option 1: OpenSSL
openssl rand -base64 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Frontend Service (Client)

```bash
# API URL - URL deines Backend Services
VITE_API_URL=${{Backend.RAILWAY_PUBLIC_DOMAIN}}/api
```

**Wichtig:** Ersetze `Backend` mit dem Namen deines Backend-Services auf Railway.

---

## 📊 PostgreSQL Datenbank

### Option 1: Railway PostgreSQL Plugin (Empfohlen)

1. Im Backend Service: **Add Plugin** → **PostgreSQL**
2. Railway erstellt automatisch die Variable `${{Postgres.DATABASE_URL}}`
3. Nutze diese in deiner `DATABASE_URL` Variable

### Option 2: Neon Database (Extern)

1. Erstelle eine Datenbank auf https://neon.tech
2. Kopiere die Connection String
3. Setze als `DATABASE_URL` im Backend Service

---

## 🗄️ Datenbank Migrationen

Nach dem ersten Deployment musst du die Datenbank initialisieren:

### In Railway Console (Backend Service):

```bash
# Datenbank Schema erstellen
npm run db:migrate
```

Dies führt das Schema und die Migrationen aus:
- Erstellt alle Tabellen (users, leads, stages, tags, etc.)
- Erstellt Default Admin User:
  - **Email:** admin@leadtimelabs.com
  - **Passwort:** admin123

**⚠️ WICHTIG:** Ändere das Admin-Passwort nach dem ersten Login!

---

## 🔗 Service URLs

Nach dem Deployment erhältst du:

- **Backend:** `https://dein-backend-name.up.railway.app`
- **Frontend:** `https://dein-frontend-name.up.railway.app`

---

## ✅ Deployment Checkliste

- [ ] Backend Service erstellt mit PostgreSQL Plugin
- [ ] `DATABASE_URL` automatisch von Railway gesetzt
- [ ] `JWT_SECRET` generiert und gesetzt (mindestens 32 Zeichen!)
- [ ] `NODE_ENV=production` gesetzt
- [ ] Frontend Service erstellt
- [ ] `VITE_API_URL` zeigt auf Backend Service
- [ ] Beide Services erfolgreich deployed
- [ ] Datenbank-Migration ausgeführt (`npm run db:migrate`)
- [ ] Frontend öffnet und zeigt Login-Seite
- [ ] Login mit Default-Credentials funktioniert
- [ ] Admin-Passwort geändert

---

## 🔧 Troubleshooting

### Backend startet nicht
- Überprüfe `DATABASE_URL` (muss valid PostgreSQL Connection String sein)
- Überprüfe `JWT_SECRET` (mindestens 32 Zeichen)
- Schaue in Railway Logs nach Fehlern

### Frontend kann Backend nicht erreichen
- Überprüfe `VITE_API_URL` in Frontend Service
- Muss auf `https://dein-backend.up.railway.app/api` zeigen (ohne Trailing Slash!)
- Überprüfe CORS-Einstellungen im Backend

### "Table does not exist" Fehler
- Datenbank-Migration nicht ausgeführt
- Führe `npm run db:migrate` in Railway Console aus

### Login funktioniert nicht
- Überprüfe ob Datenbank-Migration erfolgreich war
- Default User sollte erstellt worden sein
- Überprüfe Backend Logs für Authentifizierungs-Fehler

---

## 📝 Zusätzliche Konfiguration

### Custom Domain (Optional)

1. In Railway → Service Settings → Domains
2. Füge deine Custom Domain hinzu
3. Setze DNS Records wie von Railway angegeben
4. Aktualisiere `VITE_API_URL` im Frontend Service

### Environment Variables Updates

Wenn du Umgebungsvariablen änderst:
1. Service wird automatisch neu deployed
2. Warte auf erfolgreichen Deployment
3. Teste die Anwendung

---

## 🎉 Fertig!

Deine tinyCRM Anwendung läuft jetzt auf Railway!

**Next Steps:**
1. Ändere das Admin-Passwort
2. Erstelle weitere Benutzer
3. Konfiguriere Stages
4. Importiere Leads

Bei Fragen: https://docs.railway.app
