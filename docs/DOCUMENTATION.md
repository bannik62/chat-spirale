# Association Spirale — Documentation technique

Plateforme de chat par groupes pour l’association. Public peu à l’aise avec le web : une connexion, des gros boutons, peu d’écrans.

**URL production** : `https://spirale-beau-marais.vitalinfo.site`  
**Dépôt** : `bannik62/chat-spirale`

---

## Sommaire

1. [Architecture](#architecture)
2. [Parcours utilisateur](#parcours-utilisateur)
3. [API](#api)
4. [Modèle de données](#modèle-de-données)
5. [Frontend — champs encapsulés](#frontend--champs-encapsulés)
6. [Sécurité backend](#sécurité-backend)
7. [Variables d’environnement](#variables-denvironnement)
8. [Développement local](#développement-local)
9. [Déploiement production](#déploiement-production)
10. [Apache (reverse proxy)](#apache-reverse-proxy)
11. [Fichiers non versionnés (.gitignore)](#fichiers-non-versionnés-gitignore)

---

## Architecture

```
Internet
   │
   ▼
Apache (443) — SSL, domaine public
   │
   ▼
127.0.0.1:8080 — conteneur frontend (nginx : SPA + proxy)
   │
   ├── /api/*     → backend:3000 (réseau Docker)
   └── /socket.io → backend:3000 (WebSocket)

postgres — non exposé sur Internet
```

| Composant | Technologie |
|-----------|-------------|
| Frontend | Svelte 5, Vite |
| Backend | Node.js, Express 5, Socket.IO |
| Base | PostgreSQL 16, Prisma |
| Emails | Nodemailer (SMTP Gmail) |
| CI/CD | GitHub Actions → rsync → build Docker sur le VPS |

---

## Parcours utilisateur

### Participant

1. `/` — email + code à 8 caractères (reçu par mail)
2. `/mes-activites` — liste des salons autorisés (gros boutons)
3. `/salon/:id` — choix du pseudo si première visite, puis chat temps réel

### Formateur (admin)

1. `/` — onglet Formateur : email + mot de passe
2. `/admin` — onglets **Salons** et **Personnes**
3. Création salon, invitation par email, **Rejoindre** un salon pour modérer
4. Dans le chat : **+ Inviter** pour ajouter des personnes au salon courant

### Auth

| Rôle | Cookie / token | Durée |
|------|----------------|-------|
| Participant | `spirale_session` (HttpOnly) | 7 jours |
| Formateur | `spirale_admin` (HttpOnly) + `admin_token` (localStorage) | 8 h |

Une seule route de connexion : `POST /api/auth/portal-login`.

---

## API

### Auth (`/api/auth`)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/portal-login` | Connexion participant ou admin |
| GET | `/session` | Session courante |
| GET | `/me` | Participant connecté + salons |
| POST | `/logout` | Déconnexion |

### Salons participant (`/api/rooms/:roomId`)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/profile` | Profil dans le salon |
| POST | `/set-name` | Définir le pseudo |
| GET | `/messages` | Historique messages |

### Admin (`/api/admin`) — JWT ou cookie admin

| Méthode | Route | Description |
|---------|-------|-------------|
| GET/POST | `/chats` | Lister / créer salons |
| PATCH/DELETE | `/chats/:id` | Prolonger / supprimer |
| POST | `/chats/:id/join` | Rejoindre en formateur |
| POST | `/chats/:id/add-participants` | Inviter dans le salon |
| GET/POST | `/participants` | Lister / créer accès |
| POST | `/participants/:id/send-invite` | Renvoyer email |

### Temps réel

- Socket.IO sur `/socket.io`
- Auth via cookie `spirale_session`
- Événements : `message`, `system-message`

---

## Modèle de données

| Modèle | Rôle |
|--------|------|
| `Participant` | Email unique + `accessCode` (1 code / personne) |
| `RoomMembership` | Lien participant ↔ salon + `displayName` |
| `ChatRoom` | Salon nommé, `expiresAt` optionnel |
| `Message` | Messages du chat |
| `AdminUser` | Compte formateur |

**Règles métier**

- Ajout d’une personne existante à un nouveau salon : **merge** (ne retire pas les anciens droits, **même code**).
- Email automatique : uniquement pour une **nouvelle** personne, sauf si la case « envoyer mail » est cochée.
- Salons non permanents : expiration vendredi 23h59 ; cron de nettoyage hebdomadaire.

---

## Frontend — champs encapsulés

Les données saisies passent par des classes avec **getter / setter** (`value` ou `checked`), normalisation, validation et `toJSON()` pour l’API.

Répertoire : `frontend/src/lib/fields/`

### Champs de base

| Classe | Propriété | Normalisation / règles |
|--------|-----------|------------------------|
| `FormField` | `value` | `trim()` |
| `EmailField` | `value` | minuscules, doit contenir `@` et `.` |
| `AccessCodeField` | `value` | majuscules, alphanum, max 8 car. |
| `PasswordField` | `value` | non vide |
| `LoginModeField` | `value` | `participant` \| `admin` |
| `ChatNameField` | `value` | min. 2 caractères |
| `DisplayNameField` | `value` | espaces compressés, min. 2 car. |
| `MessageContentField` | `value` | trim, max 4000 car. → `toSocketPayload()` |
| `BooleanField` | `checked` | booléen |
| `EmailListField` | `items` | liste emails normalisés, `add` / `remove` |
| `RoomIdsField` | `ids` | IDs salons cochés, `toggle` |
| `ParticipantSearchField` | `value` | recherche picker (non envoyée telle quelle) |

### Formulaires composés

| Classe | Endpoint | `toJSON()` |
|--------|----------|------------|
| `PortalLoginForm` | `POST /api/auth/portal-login` | `{ email, mode, code? \| password? }` |
| `CreateChatForm` | `POST /api/admin/chats` | `{ name, isPermanent }` |
| `CreateParticipantForm` | `POST /api/admin/participants` | `payloadForEmail()` par personne |
| `InviteInRoomForm` | `POST /api/admin/chats/:id/add-participants` | `{ emails, sendEmailForNew }` |
| `SetDisplayNameForm` | `POST /api/rooms/:id/set-name` | `{ displayName }` |
| `JoinChatForm` | `POST /api/admin/chats/:id/join` | `{ displayName: 'Formateur' }` |

### Utilisation dans Svelte

```javascript
import { PortalLoginForm } from '../lib/fields/index.js';
import { touchForm } from '../lib/fields/reactive.js';

let form = $state(new PortalLoginForm());

// Liaison input
<input bind:value={form.email.value} />

// Envoi API
body: JSON.stringify(form.toJSON())

// Réactivité Svelte après mutation hors input
form.mode.value = 'admin';
form = touchForm(form);
```

### Pages

| Page | Route | Formulaires |
|------|-------|-------------|
| `Login.svelte` | `/` | `PortalLoginForm` |
| `Admin.svelte` | `/admin` | `CreateChatForm`, `CreateParticipantForm`, `JoinChatForm` |
| `RoomChat.svelte` | `/salon/:id` | `SetDisplayNameForm`, `MessageContentField`, `InviteInRoomForm` |
| `ParticipantPicker.svelte` | composant | `ParticipantSearchField`, `EmailListField` |

---

## Sécurité backend

| Mesure | Détail |
|--------|--------|
| Helmet | HSTS (prod), Referrer-Policy, `X-Powered-By` désactivé |
| Rate limit | 20 req / 15 min sur `/api/auth`, 200 req / min sur `/api` |
| CORS | `FRONTEND_URL` (+ `CORS_EXTRA_ORIGINS` optionnel) |
| Cookies prod | `Secure`, `SameSite=strict` |
| Corps JSON | Limite 100 Ko |
| Trust proxy | `TRUST_PROXY=1` derrière Apache |
| Démarrage prod | Refus si `JWT_SECRET` faible, `DEV_SEED=1`, ou `FRONTEND_URL` absent |

Fichiers : `backend/src/middleware/security.js`, `backend/src/utils/validateEnv.js`.

---

## Variables d’environnement

### Développement — `backend/.env` (copier depuis `.env.example`)

| Variable | Exemple dev |
|----------|-------------|
| `DATABASE_URL` | `postgresql://spirale:spirale@localhost:5433/spirale` |
| `JWT_SECRET` | secret long en prod uniquement |
| `FRONTEND_URL` | `http://localhost:5174` ou `http://localhost:8081` |
| `DEV_SEED` | `1` — compte test auto |
| `DEV_PARTICIPANT_EMAIL` | `participant.dev@spirale.local` |
| `DEV_PARTICIPANT_CODE` | `DEV8CODE` |
| `SMTP_*` | Gmail + mot de passe application |

### Production — `backend/.env.prod.example`

| Variable | Valeur |
|----------|--------|
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://spirale-beau-marais.vitalinfo.site` |
| `TRUST_PROXY` | `1` |
| `DEV_SEED` | `0` |
| `JWT_SECRET` | ≥ 32 caractères aléatoires |

---

## Développement local

### Docker (recommandé)

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:8081 |
| API | http://localhost:3002 |
| Postgres | port hôte 5433 |

**Comptes dev** (`DEV_SEED=1`) :

- Participant : `participant.dev@spirale.local` / `DEV8CODE`
- Admin : `admin@spirale.local` / `admin123`

### Sans Docker

```bash
docker compose up postgres -d
cd backend && npm install && npm run db:push && npm run dev
cd frontend && npm install && npm run dev
```

Frontend dev : http://localhost:5174

### Ports (éviter conflit yt-webService)

| Service | Spirale | yt-webService |
|---------|---------|---------------|
| API hôte | 3002 | 4000 |
| Front Docker | 8081 | 8080 |
| Vite dev | 5174 | 5173 |
| Postgres hôte | 5433 | — |

---

## Déploiement production

1. Secrets GitHub Actions (voir README).
2. Push sur `main` → CI → rsync code + `.env.prod` → `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build` sur le VPS.
3. Apache : copier le modèle de vhost (voir ci-dessous).
4. Fichier notes serveur : copier `docs/DEPLOIEMENT.md.example` → `docs/DEPLOIEMENT.md` (local, non versionné).

Conteneur frontend écoute **uniquement** `127.0.0.1:8080` (variable `SPIRALE_HTTP_PORT`).

---

## Apache (reverse proxy)

### Fichiers

| Fichier | Versionné Git ? |
|---------|-----------------|
| `deploy/apache-spirale.conf.example` | Oui — modèle |
| `deploy/apache-spirale.conf` | **Non** — copie active sur le VPS |

### Installation sur le serveur

```bash
# Depuis le dépôt cloné sur le VPS
sudo cp deploy/apache-spirale.conf.example /etc/apache2/sites-available/spirale.conf
# Éditer SSL, chemins Let's Encrypt, etc.
sudo cp deploy/apache-spirale.conf.example deploy/apache-spirale.conf   # copie locale gitignored

sudo a2enmod proxy proxy_http proxy_wstunnel rewrite ssl headers
sudo a2ensite spirale.conf
sudo apache2ctl configtest && sudo systemctl reload apache2
```

### Let's Encrypt (exemple)

```bash
sudo certbot --apache -d spirale-beau-marais.vitalinfo.site
```

Le vhost doit transmettre :

- `X-Forwarded-Proto: https`
- Proxy WebSocket pour `/socket.io`

---

## Fichiers non versionnés (.gitignore)

Ces fichiers restent **sur la machine** (dev ou serveur) et ne doivent **pas** être commités :

| Motif | Raison |
|-------|--------|
| `.env`, `.env.local`, `.env.prod` | Secrets |
| `backend/.env`, `backend/.env.prod` | Secrets backend |
| `deploy/apache-spirale.conf` | Config Apache réelle du serveur |
| `deploy/*.conf` (sauf `*.example`) | Autres vhosts locaux |
| `docs/DEPLOIEMENT.md` | Notes déploiement (IP, mots de passe, chemins serveur) |
| `docs/*.local.md` | Notes personnelles |
| `node_modules/`, `dist/` | Artefacts build |

**Versionnés** : modèles `.example`, `docs/DOCUMENTATION.md`, code source.

---

## Structure du dépôt

```
association-spirale/
├── backend/
│   ├── src/
│   │   ├── routes/       auth, admin, rooms
│   │   ├── middleware/   security, auth
│   │   ├── socket/
│   │   └── lib/fields/   (côté API : utils)
│   └── prisma/
├── frontend/
│   └── src/lib/fields/   champs encapsulés
├── deploy/
│   └── apache-spirale.conf.example
├── docs/
│   ├── DOCUMENTATION.md      ← ce fichier
│   └── DEPLOIEMENT.md.example
├── docker-compose.yml
├── docker-compose.prod.yml
└── .github/workflows/
```

---

## Licence

Usage interne — Association Spirale.
