# Association Spirale — Chat

Plateforme de communication par groupes pour l'association : chats nommés, accès par jeton email (Gmail), renouvellement hebdomadaire optionnel.

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

- Frontend : http://localhost:8080
- API : http://localhost:3000
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

Frontend dev : http://localhost:5173 (proxy API vers :3000)

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
| `FRONTEND_URL` | URL publique (ex. `https://chat.spirale.org`) |
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
| `GHCR_TOKEN` | Token lecture registry (si images privées) |
| `HTTP_PORT` | Port exposé (défaut `80`) |

## Déploiement VPS

Sur le serveur :

```bash
git clone <repo> /opt/association-spirale
cd /opt/association-spirale
# Copier docker-compose.prod.yml — les variables viennent du workflow deploy
```

Le workflow **Deploy** (push `main`) se connecte en SSH, pull les images GHCR et lance `docker compose -f docker-compose.prod.yml up -d`.

## Structure

```
association-spirale/
├── backend/          Express + Prisma + Socket.IO
├── frontend/         Svelte SPA
├── docker-compose.yml
├── docker-compose.prod.yml
└── .github/workflows/
```

## Licence

Usage interne — Association Spirale.
# chat-spirale
