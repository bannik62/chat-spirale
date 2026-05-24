# Association Spirale — Chat

Plateforme de communication par groupes pour l'association : chats nommés, accès par jeton email (Gmail), renouvellement hebdomadaire optionnel.

**Documentation complète** : [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) (architecture, API, champs frontend, sécurité, Apache, `.gitignore`).

## Stack

- **Frontend** : Svelte 5 SPA (Vite)
- **Backend** : Node.js, Express, Socket.IO, Prisma
- **Base** : PostgreSQL
- **Emails** : Nodemailer (SMTP Gmail — mot de passe d'application Google)
- **Déploiement** : Docker Compose + GitHub Actions

## Démarrage local

### Prérequis

- Node 22+, Docker

### 1. Variables d'environnement

```bash
cp backend/.env.example backend/.env
# Renseigner SMTP_USER / SMTP_PASS (compte Google + mot de passe application)
```

### 2. Avec Docker (recommandé)

```bash
docker compose up --build
```

- Frontend : http://localhost:8081 (Docker) — **8080** est utilisé par yt-webService
- API : http://localhost:3002 (yt-webService **4000**, codeurbase **3000**)
- Admin par défaut : `admin@spirale.local` / `admin123` (modifiable via `.env`)

### 3. Dev sans Docker (frontend + API)

```bash
# Terminal 1 — Postgres
docker compose up postgres -d

# Terminal 2 — Backend
cd backend && npm install && npm run db:push && npm run dev

# Terminal 3 — Frontend
cd frontend && npm install && npm run dev
```

Frontend dev : http://localhost:5174 (proxy API vers :3000) — **5173** = yt-webService

### Ports (éviter les conflits avec yt-webService)

| Service | yt-webService | Association Spirale |
|---------|---------------|---------------------|
| API | 4000 | **3002** (hôte) → 3000 (conteneur) |
| Front Docker | 8080 | **8081** |
| Front Vite dev | 5173 | **5174** |
| Front prod VPS (Apache → local) | 127.0.0.1:**7000** | 127.0.0.1:**8080** |
| Postgres | — | 5433 (hôte) → 5432 (conteneur) |

## Flux utilisateur

1. **Admin** : `/admin` → crée un chat + liste d'emails → invitations Gmail
2. **Participant** : clic lien `/chat?token=…` → choix du nom d'affichage → chat temps réel
3. **Expiration** : chats non permanents → `expiresAt` = prochain vendredi 23h59 ; cron supprime les chats expirés

## Gmail (Nodemailer)

1. Compte Google → Sécurité → validation en 2 étapes
2. Mots de passe des applications → créer un mot de passe pour « Association Spirale »
3. Secrets :

| Variable | Valeur |
|----------|--------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | adresse Gmail |
| `SMTP_PASS` | mot de passe application (16 car.) |

## Secrets GitHub Actions

À configurer dans **Settings → Secrets and variables → Actions** :

| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | URL PostgreSQL prod |
| `JWT_SECRET` | Secret JWT admin |
| `ADMIN_EMAIL` | Email admin initial |
| `ADMIN_PASSWORD` | Mot de passe admin (seed au 1er démarrage) |
| `FRONTEND_URL` | URL publique (ex. `https://spirale-beau-marais.vitalinfo.site`) |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Gmail asso |
| `SMTP_PASS` | Mot de passe application Google |
| `POSTGRES_USER` | Utilisateur DB prod |
| `POSTGRES_PASSWORD` | Mot de passe DB |
| `POSTGRES_DB` | Nom de la base |
| `DEPLOY_HOST` | IP/hostname du VPS |
| `DEPLOY_USER` | Utilisateur SSH |
| `DEPLOY_SSH_KEY` | Clé privée SSH |
| `DEPLOY_PATH` | Chemin du repo sur le VPS (ex. `/opt/association-spirale`) |
| `SPIRALE_HTTP_PORT` | Port local du conteneur (défaut `8080`, Apache proxy vers `127.0.0.1:8080`) |
| `AUTH_RATE_LIMIT_MAX` | Tentatives login max / 15 min par IP (défaut `100`) |

## Déploiement VPS (Apache en reverse proxy)

Schéma :

```
Internet → Apache (443, domaine public)
              ↓
         127.0.0.1:8080  (conteneur frontend / nginx)
              ↓ /api, /socket.io (réseau Docker interne)
         backend:3000  (non exposé sur Internet)
```

- **Apache** : SSL, nom de domaine, seul service face au public.
- **Conteneur frontend (nginx)** : SPA + proxy vers le backend ; écoute **uniquement** sur `127.0.0.1:8080`.
- **Backend / Postgres** : pas de ports publics ; communication interne Docker uniquement.

`FRONTEND_URL` (secrets GitHub) = URL publique Apache, ex. `https://spirale-beau-marais.vitalinfo.site` (CORS, cookies, liens email).

### Sécurité backend (prod)

- **Helmet** : en-têtes HTTP (HSTS, Referrer-Policy, etc.)
- **Rate limit** : 20 tentatives / 15 min sur `/api/auth`, 200 req/min sur le reste de `/api`
- **CORS** : uniquement `FRONTEND_URL` (+ `CORS_EXTRA_ORIGINS` si besoin)
- **Cookies** : `Secure` + `SameSite=strict` en production
- **Validation au démarrage** : `JWT_SECRET` ≥ 32 car., `DEV_SEED` interdit, `FRONTEND_URL` requis
- Modèle prod : `backend/.env.prod.example`

Modèle vhost : `deploy/apache-spirale.conf.example` — la copie active `deploy/apache-spirale.conf` est **gitignored**.

Sur le serveur :

```bash
git clone <repo> /opt/association-spirale
cd /opt/association-spirale
cp deploy/apache-spirale.conf.example deploy/apache-spirale.conf   # éditer puis installer dans Apache
cp docs/DEPLOIEMENT.md.example docs/DEPLOIEMENT.md                 # notes locales (gitignored)
# SPIRALE_HTTP_PORT=8080 dans l'environnement du compose prod
```

Voir [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md#apache-reverse-proxy) pour Apache et Let's Encrypt.

Le workflow **Deploy** (après CI sur `main`) : rsync du code → `.env.prod` sur le VPS → `docker compose build && up -d` (comme habitracks, sans GHCR).

## Structure

```
association-spirale/
├── backend/          Express + Prisma + Socket.IO
├── frontend/         Svelte SPA
├── docs/             DOCUMENTATION.md (+ DEPLOIEMENT.md local, gitignored)
├── deploy/           apache-spirale.conf.example (conf réelle gitignored)
├── docker-compose.yml
├── docker-compose.prod.yml
└── .github/workflows/
```

## Licence

Usage interne — Association Spirale.
# chat-spirale
