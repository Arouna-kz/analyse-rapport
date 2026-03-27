# Guide d'Hébergement sur VPS (Plesk / cPanel / Docker / Supabase Self-Hosted)

## 📋 Table des matières

1. [Prérequis](#prérequis)
2. [Architecture cible](#architecture-cible)
3. [Option A : Supabase Cloud + VPS Frontend](#option-a--supabase-cloud--vps-frontend)
4. [Option B : Supabase Self-Hosted (Docker) — Recommandé](#option-b--supabase-self-hosted-docker--recommandé)
5. [Option C : Tout custom (Express/Node.js)](#option-c--tout-custom-expressnodejs)
6. [Gestion de l'IA (AI_PROVIDER)](#gestion-de-lia-ai_provider)
7. [Migration des Edge Functions](#migration-des-edge-functions)
8. [Déploiement sur Plesk](#déploiement-sur-plesk)
9. [Déploiement sur cPanel](#déploiement-sur-cpanel)
10. [SSL et domaine personnalisé](#ssl-et-domaine-personnalisé)
11. [Maintenance et mises à jour](#maintenance-et-mises-à-jour)

---

## Prérequis

### Serveur minimum

| Ressource | Minimum | Recommandé (Supabase Self-Hosted) |
|-----------|---------|-----------------------------------|
| CPU | 2 vCPU | 4+ vCPU |
| RAM | 4 Go | 8-16 Go |
| Stockage | 40 Go SSD | 100+ Go SSD |
| OS | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 LTS |
| Bande passante | 1 To/mois | Illimitée |

### Logiciels requis
- **Docker** 24+ et **Docker Compose** v2+
- **Git**
- **Nginx** (reverse proxy)
- **Certbot** (SSL Let's Encrypt)
- **Supabase CLI** (pour déployer les Edge Functions)

```bash
# Installer Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Installer Supabase CLI
npm install -g supabase
```

---

## Architecture cible

```
┌──────────────────────────────────────────────────────────┐
│                     VPS / Serveur                         │
│                                                          │
│  ┌──────────┐    ┌─────────────────────────────────────┐ │
│  │  Nginx   │    │      Supabase Self-Hosted           │ │
│  │ (reverse │    │  ┌─────────┐ ┌──────────────────┐   │ │
│  │  proxy)  │───▶│  │ Kong    │ │  PostgreSQL 15   │   │ │
│  │ :80/:443 │    │  │ Gateway │ │  + pgvector      │   │ │
│  └──────────┘    │  └────┬────┘ └──────────────────┘   │ │
│       │          │       │                              │ │
│       │          │  ┌────▼────┐ ┌──────────────────┐   │ │
│       │          │  │ GoTrue  │ │  Edge Functions   │   │ │
│       │          │  │ (Auth)  │ │  (Deno Runtime)   │   │ │
│       │          │  └─────────┘ └──────────────────┘   │ │
│       │          │                                      │ │
│       │          │  ┌─────────┐ ┌──────────────────┐   │ │
│       │          │  │ Storage │ │  Realtime         │   │ │
│       │          │  │ (S3)    │ │  (WebSocket)      │   │ │
│       │          │  └─────────┘ └──────────────────┘   │ │
│       │          └─────────────────────────────────────┘ │
│       │                                                  │
│  ┌────▼─────────────────────────────────────────────┐    │
│  │  Frontend (build statique)                        │    │
│  │  /var/www/app/dist                                │    │
│  └──────────────────────────────────────────────────┘    │
│       │                                                  │
└───────┼──────────────────────────────────────────────────┘
        │ (appels HTTPS sortants)
        ▼
┌──────────────────────────────────────────────────────────┐
│            APIs IA Externes (configurable)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ OpenAI   │ │ Google   │ │ Ollama   │ │Cloudmersive│  │
│  │ GPT-4o   │ │ Gemini   │ │ (local)  │ │(extraction)│  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Option A : Supabase Cloud + VPS Frontend

**La plus simple.** Vous gardez Supabase en cloud (gratuit jusqu'à 500 Mo) et déployez uniquement le frontend sur votre VPS.

### Étape 1 : Créer un projet Supabase
1. Aller sur [supabase.com](https://supabase.com) → Créer un compte
2. Créer un nouveau projet
3. Exécuter le schéma SQL depuis `docs/DATABASE_SCHEMA.sql`
4. Activer le storage bucket `reports`
5. Déployer les Edge Functions via Supabase CLI

### Étape 2 : Configurer les variables
```bash
# Sur votre VPS, créer un fichier .env.production
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbG...votre-clé-anon
```

### Étape 3 : Build et déploiement
```bash
git clone votre-repo
cd votre-repo
npm install
npm run build
cp -r dist/* /var/www/votre-site/
```

### Étape 4 : Configurer les secrets Supabase
Dans le dashboard Supabase → Settings → Edge Functions → Secrets :
```
AI_PROVIDER=openai           # ou gemini, ollama
OPENAI_API_KEY=sk-proj-...   # Si AI_PROVIDER=openai
GOOGLE_AI_API_KEY=AIza...    # Si AI_PROVIDER=gemini
CLOUDMERSIVE_API_KEY=...
RESEND_API_KEY=re_...
```

---

## Option B : Supabase Self-Hosted (Docker) — Recommandé

**Contrôle total avec la même architecture que Supabase Cloud.** Pas besoin de réécrire le backend en Express/Node.js.

### Pourquoi cette option ?
- ✅ **Aucune réécriture de code** : les Edge Functions, RLS policies, et le schéma fonctionnent tels quels
- ✅ **Contrôle total** : données stockées sur votre serveur
- ✅ **Pas de vendor lock-in** : migration facile depuis Lovable Cloud
- ✅ **Coût prévisible** : pas de facturation à l'usage

### Étape 1 : Cloner Supabase Self-Hosted

```bash
# Cloner le repo officiel Supabase
git clone --depth 1 https://github.com/supabase/supabase.git /opt/supabase
cd /opt/supabase/docker

# Copier le fichier de configuration
cp .env.example .env
```

### Étape 2 : Configurer l'environnement

Éditer `/opt/supabase/docker/.env` :

```env
############
# Secrets — CHANGER IMPÉRATIVEMENT en production
############

# Générer avec: openssl rand -base64 32
POSTGRES_PASSWORD=votre-mot-de-passe-postgres-fort
JWT_SECRET=votre-jwt-secret-de-32-caracteres-minimum
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Générer via jwt.io
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Générer via jwt.io
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=votre-mot-de-passe-dashboard

############
# URLs
############
SITE_URL=https://votre-domaine.com
API_EXTERNAL_URL=https://api.votre-domaine.com
SUPABASE_PUBLIC_URL=https://api.votre-domaine.com

############
# SMTP (pour les emails d'authentification)
############
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=re_votre-clé-resend
SMTP_SENDER_NAME=MonApp
SMTP_ADMIN_EMAIL=admin@votre-domaine.com
```

### Étape 3 : Générer les clés JWT

```bash
# Installer jwt-cli ou utiliser jwt.io
# Le JWT doit contenir:
# - iss: "supabase"
# - ref: "self-hosted"
# - role: "anon" (pour ANON_KEY) ou "service_role" (pour SERVICE_ROLE_KEY)
# - iat: timestamp actuel
# - exp: timestamp dans 10 ans

# Exemple avec Node.js:
node -e "
const jwt = require('jsonwebtoken');
const secret = 'votre-jwt-secret';
console.log('ANON_KEY:', jwt.sign({ role: 'anon', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 315360000 }, secret));
console.log('SERVICE_ROLE_KEY:', jwt.sign({ role: 'service_role', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 315360000 }, secret));
"
```

### Étape 4 : Démarrer Supabase

```bash
cd /opt/supabase/docker

# Démarrer tous les services
docker compose up -d

# Vérifier que tout fonctionne
docker compose ps

# Voir les logs
docker compose logs -f
```

Les services suivants seront disponibles :
| Service | Port | Description |
|---------|------|-------------|
| Kong (API Gateway) | 8000 | Point d'entrée principal |
| Supabase Studio | 3000 | Dashboard d'administration |
| PostgreSQL | 5432 | Base de données |
| GoTrue | 9999 | Authentification |
| Realtime | 4000 | WebSocket |
| Storage | 5000 | Stockage de fichiers |
| Edge Functions | 54321 | Fonctions Deno |

### Étape 5 : Importer le schéma de la base de données

```bash
# Se connecter à PostgreSQL
docker compose exec db psql -U supabase_admin -d postgres

# OU importer directement le schéma
docker compose exec -T db psql -U supabase_admin -d postgres < /chemin/vers/docs/DATABASE_SCHEMA.sql
```

### Étape 6 : Configurer les secrets des Edge Functions

```bash
# Créer le fichier de secrets pour les Edge Functions
cat > /opt/supabase/docker/volumes/functions/.env << 'EOF'
# Fournisseur IA — Choisir: lovable, openai, gemini, ollama, custom
AI_PROVIDER=openai

# Clés IA (selon le fournisseur choisi)
OPENAI_API_KEY=sk-proj-...
GOOGLE_AI_API_KEY=AIza...
# OLLAMA_BASE_URL=http://host.docker.internal:11434
# OLLAMA_MODEL=llama3.1:8b

# Services tiers
CLOUDMERSIVE_API_KEY=votre-clé
RESEND_API_KEY=re_votre-clé

# Supabase (auto-configuré)
SUPABASE_URL=http://kong:8000
SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
EOF
```

### Étape 7 : Déployer les Edge Functions

```bash
# Depuis le répertoire du projet
cd /chemin/vers/votre-projet

# Lier au projet self-hosted
supabase link --project-ref self-hosted

# Déployer toutes les Edge Functions
supabase functions deploy analyze-report --no-verify-jwt
supabase functions deploy chat --no-verify-jwt
supabase functions deploy arena --no-verify-jwt
supabase functions deploy generate-future-report
supabase functions deploy generate-from-template
supabase functions deploy multi-scenario-predictions
supabase functions deploy rag-chat
supabase functions deploy refine-analysis
supabase functions deploy validate-report
supabase functions deploy preview-extracted-content
supabase functions deploy get-shared-prediction --no-verify-jwt
supabase functions deploy send-notification-email --no-verify-jwt
supabase functions deploy weekly-digest --no-verify-jwt
supabase functions deploy export-share-analytics

# OU script automatisé
for fn in supabase/functions/*/; do
  fname=$(basename "$fn")
  if [ "$fname" != "_shared" ]; then
    echo "Deploying $fname..."
    supabase functions deploy "$fname"
  fi
done
```

### Étape 8 : Créer le bucket de stockage

```bash
# Via Supabase Studio (http://votre-serveur:3000)
# OU via SQL
docker compose exec -T db psql -U supabase_admin -d postgres -c "
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false);
"
```

### Étape 9 : Build et déployer le frontend

```bash
cd /chemin/vers/votre-projet

# Créer .env.production
cat > .env.production << EOF
VITE_SUPABASE_URL=https://api.votre-domaine.com
VITE_SUPABASE_PUBLISHABLE_KEY=votre-anon-key
VITE_SUPABASE_PROJECT_ID=self-hosted
EOF

# Build
npm install
npm run build

# Déployer
sudo mkdir -p /var/www/votre-domaine.com
sudo cp -r dist/* /var/www/votre-domaine.com/
```

### Étape 10 : Configurer Nginx (reverse proxy)

```nginx
# /etc/nginx/sites-available/votre-domaine.conf

# Frontend
server {
    listen 80;
    server_name votre-domaine.com www.votre-domaine.com;

    root /var/www/votre-domaine.com;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache les assets statiques
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# API Supabase (reverse proxy vers Kong)
server {
    listen 80;
    server_name api.votre-domaine.com;

    # Taille max des uploads (rapports)
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # SSE (streaming IA)
    location ~ ^/functions/v1/(chat|rag-chat) {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
        proxy_read_timeout 300;
    }

    # WebSocket (Realtime)
    location /realtime/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Supabase Studio (optionnel, accès admin)
server {
    listen 80;
    server_name studio.votre-domaine.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # Restreindre l'accès par IP
        # allow votre-ip-admin;
        # deny all;
    }
}
```

```bash
# Activer les sites
sudo ln -s /etc/nginx/sites-available/votre-domaine.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL avec Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com -d api.votre-domaine.com
```

---

## Option C : Tout custom (Express/Node.js)

**Plus complexe mais sans dépendance à Supabase.** Il faut convertir les Edge Functions en routes Express.

### Étape 1 : Installer PostgreSQL + pgvector

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install postgresql postgresql-contrib -y
sudo apt install postgresql-15-pgvector -y
sudo -u postgres psql -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Étape 2 : Créer la base de données

```bash
sudo -u postgres psql

CREATE DATABASE analyse_ia;
CREATE USER app_user WITH PASSWORD 'votre_mot_de_passe_fort';
GRANT ALL PRIVILEGES ON DATABASE analyse_ia TO app_user;

\c analyse_ia
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

```bash
sudo -u postgres psql -d analyse_ia -f docs/DATABASE_SCHEMA.sql
```

### Étape 3 : Créer le backend Express

Convertir chaque Edge Function en route Express. Voir la section [Migration des Edge Functions](#migration-des-edge-functions).

### Étape 4 : Variables d'environnement

```env
DATABASE_URL=postgresql://app_user:mot_de_passe@localhost:5432/analyse_ia
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...
GOOGLE_AI_API_KEY=AIza...
CLOUDMERSIVE_API_KEY=votre-clé
RESEND_API_KEY=re_...
JWT_SECRET=un-secret-très-long-et-aléatoire
```

---

## Gestion de l'IA (AI_PROVIDER)

### ⚠️ Point critique

L'application utilise le **Lovable AI Gateway** (`https://ai.gateway.lovable.dev`), qui n'est **pas accessible** en dehors de l'écosystème Lovable. Toutes les Edge Functions utilisent désormais une **couche d'abstraction AI_PROVIDER** qui permet de basculer facilement entre fournisseurs.

### Configuration via variable d'environnement

Définir `AI_PROVIDER` dans les secrets des Edge Functions :

| Valeur | Fournisseur | Clé requise | URL |
|--------|------------|-------------|-----|
| `lovable` | Lovable AI Gateway (défaut) | `LOVABLE_API_KEY` | `ai.gateway.lovable.dev` |
| `openai` | OpenAI (GPT-4o) | `OPENAI_API_KEY` | `api.openai.com` |
| `gemini` | Google Gemini | `GOOGLE_AI_API_KEY` | `generativelanguage.googleapis.com` |
| `ollama` | Ollama (local) | Aucune | `localhost:11434` |
| `custom` | Endpoint custom | `CUSTOM_AI_API_KEY` | `CUSTOM_AI_BASE_URL` |

### Mapping automatique des modèles

La couche d'abstraction traduit automatiquement les noms de modèles :

| Modèle Lovable | → OpenAI | → Gemini | → Ollama |
|----------------|----------|----------|----------|
| `google/gemini-2.5-pro` | `gpt-4o` | `gemini-2.5-pro` | `llama3.1:8b` |
| `google/gemini-2.5-flash` | `gpt-4o-mini` | `gemini-2.5-flash` | `llama3.1:8b` |
| `openai/gpt-5` | `gpt-4o` | `gemini-2.5-pro` | `llama3.1:8b` |

### Fichier d'abstraction : `supabase/functions/_shared/ai-provider.ts`

Ce fichier centralise toute la logique IA :

```typescript
import { getAIProviderConfig, callAI, callAIJson, translateModel } from '../_shared/ai-provider.ts';

// Appel simple
const response = await callAI({
  messages: [
    { role: 'system', content: 'Tu es un expert.' },
    { role: 'user', content: 'Analyse ce texte.' }
  ],
  model: 'google/gemini-2.5-flash', // Traduit automatiquement
  temperature: 0.7,
});

// Appel avec parsing JSON automatique
const { data } = await callAIJson({
  messages: [...],
  model: 'google/gemini-2.5-flash',
});
```

### Option 1 : OpenAI (GPT-4o) — Recommandé

**Coût :** ~$5-30/mois

```bash
# Secrets Supabase
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...
```

**Créer un compte :** [platform.openai.com](https://platform.openai.com)

### Option 2 : Google Gemini — Économique

**Coût :** Gratuit jusqu'à 15 req/min, puis ~$1-10/mois

```bash
AI_PROVIDER=gemini
GOOGLE_AI_API_KEY=AIza...
```

**Créer un compte :** [aistudio.google.com](https://aistudio.google.com)

### Option 3 : Ollama (local) — Gratuit

**Coût :** $0 (nécessite GPU ou CPU puissant)

```bash
# Installer Ollama sur le VPS
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b

# Secrets
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

⚠️ Sans GPU dédié (min. 8 Go VRAM), les réponses seront lentes (~5-30s).

### Option 4 : Endpoint Custom (LiteLLM, etc.)

```bash
AI_PROVIDER=custom
CUSTOM_AI_BASE_URL=http://localhost:4000/v1/chat/completions
CUSTOM_AI_API_KEY=votre-clé
CUSTOM_AI_MODEL=gpt-4o
```

### Tableau comparatif

| Solution | Coût/mois | Latence | Qualité | Setup |
|----------|-----------|---------|---------|-------|
| OpenAI GPT-4o | $5-30 | ~1-3s | ★★★★★ | Facile |
| Google Gemini Flash | $0-10 | ~0.5-2s | ★★★★☆ | Facile |
| Ollama (local) | $0 | ~5-30s | ★★★☆☆ | Moyen |
| LiteLLM (proxy) | Variable | Variable | Variable | Moyen |

### Adaptation du système Arena

Le système Arena multi-modèles fonctionne avec tous les fournisseurs. L'abstraction `AI_PROVIDER` est utilisée pour les modèles "Lovable AI" tandis que les modèles custom configurés via l'interface continuent d'utiliser leurs URLs directes.

---

## Migration des Edge Functions

### Depuis Lovable Cloud vers Supabase Self-Hosted

**Aucune modification de code nécessaire** si vous utilisez l'Option B (Supabase Self-Hosted). Les Edge Functions se déploient telles quelles avec `supabase functions deploy`.

La seule configuration requise est :
1. Définir `AI_PROVIDER` + la clé API correspondante
2. Configurer `CLOUDMERSIVE_API_KEY` et `RESEND_API_KEY`

### Depuis Lovable Cloud vers Express/Node.js (Option C)

Chaque Edge Function dans `supabase/functions/` doit être convertie en route Express. Le pattern est identique :

```javascript
// Edge Function (Deno)
serve(async (req) => {
  const { data } = await req.json();
  // ... logique
  return new Response(JSON.stringify(result));
});

// Équivalent Express (Node.js)
app.post('/api/fonction-name', async (req, res) => {
  const { data } = req.body;
  // ... même logique
  res.json(result);
});
```

### Liste des Edge Functions à migrer

| Fonction | Utilise l'IA | Authentification |
|----------|-------------|------------------|
| `analyze-report` | ✅ | Bearer token |
| `chat` | ✅ | Bearer token |
| `arena` | ✅ | Bearer token |
| `generate-future-report` | ✅ | Bearer token |
| `generate-from-template` | ✅ | Bearer token |
| `multi-scenario-predictions` | ✅ | Bearer token |
| `rag-chat` | ✅ + OpenAI Embeddings | Bearer token |
| `refine-analysis` | ✅ | Bearer token |
| `validate-report` | ❌ | Bearer token |
| `preview-extracted-content` | ❌ | Bearer token |
| `get-shared-prediction` | ❌ | Public |
| `send-notification-email` | ❌ | Public |
| `weekly-digest` | ❌ | Public |
| `export-share-analytics` | ❌ | Bearer token |

> **Note :** `rag-chat` utilise toujours l'API OpenAI Embeddings (`text-embedding-3-small`) pour la recherche vectorielle, indépendamment du `AI_PROVIDER` choisi pour le chat.

---

## Déploiement sur Plesk

### Étape 1 : Préparer le domaine
1. Connexion Plesk → **Websites & Domains**
2. Ajouter un domaine ou sous-domaine
3. Activer **SSL/TLS** (Let's Encrypt)

### Étape 2 : Installer Node.js
1. Plesk → **Extensions** → Installer "Node.js"
2. Dans les paramètres du domaine → **Node.js**
3. Configurer :
   - **Node.js version** : 20.x
   - **Document root** : `/dist`

### Étape 3 : Uploader les fichiers

```bash
npm run build
# Uploader dist/ vers /httpdocs/dist/
```

### Étape 4 : Configuration Nginx (Plesk)

Dans Plesk → Domaine → **Apache & nginx Settings** → **Additional nginx directives** :

```nginx
location / {
    root /var/www/vhosts/votre-domaine.com/dist;
    try_files $uri $uri/ /index.html;
}
```

---

## Déploiement sur cPanel

### Étape 1 : Activer Node.js
1. cPanel → **Setup Node.js App**
2. Créer une application :
   - **Node.js version** : 20.x
   - **Application mode** : Production
   - **Application root** : `votre-app`

### Étape 2 : Build et upload
```bash
npm run build
# Uploader via File Manager ou SFTP
```

### Étape 3 : Configuration .htaccess (Apache)
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## SSL et domaine personnalisé

### Avec Certbot (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com -d api.votre-domaine.com
```

### Renouvellement automatique
```bash
sudo crontab -e
# Ajouter :
0 0 1 * * certbot renew --quiet
```

---

## Maintenance et mises à jour

### Sauvegardes

```bash
# Supabase Self-Hosted : sauvegarde de la BDD
docker compose exec db pg_dump -U supabase_admin postgres > backup_$(date +%Y%m%d).sql

# Cron automatique
0 2 * * * cd /opt/supabase/docker && docker compose exec -T db pg_dump -U supabase_admin postgres | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz
```

### Mise à jour Supabase Self-Hosted

```bash
cd /opt/supabase/docker

# Pull les nouvelles images
docker compose pull

# Redémarrer
docker compose up -d

# Vérifier
docker compose ps
```

### Monitoring

```bash
# Logs en temps réel
docker compose logs -f

# État des services
docker compose ps

# Utilisation des ressources
docker stats
```

### Checklist de migration

- [ ] Docker installé et fonctionnel
- [ ] Supabase Self-Hosted démarré (`docker compose up -d`)
- [ ] Schéma SQL importé (`DATABASE_SCHEMA.sql`)
- [ ] Edge Functions déployées (`supabase functions deploy`)
- [ ] `AI_PROVIDER` configuré (openai/gemini/ollama)
- [ ] Clés API configurées (IA + Cloudmersive + Resend)
- [ ] Bucket `reports` créé
- [ ] Frontend buildé et servi (Nginx)
- [ ] SSL activé (Let's Encrypt)
- [ ] Sauvegardes automatiques configurées
- [ ] Tests de bout en bout effectués

---

## Résumé des coûts estimés

| Composant | Option économique | Option premium |
|-----------|-------------------|----------------|
| VPS (Hetzner/OVH) | ~5€/mois | ~20-40€/mois |
| Domaine | ~10€/an | ~10€/an |
| SSL | Gratuit (Let's Encrypt) | Gratuit |
| IA (Gemini Flash) | ~0-5€/mois | - |
| IA (OpenAI GPT-4o) | - | ~10-30€/mois |
| Cloudmersive | Gratuit (1000 appels/mois) | ~15€/mois |
| Resend (emails) | Gratuit (100 emails/jour) | ~20€/mois |
| **Total** | **~5-15€/mois** | **~55-100€/mois** |

---

© 2026 Plateforme d'Analyse IA - Guide d'Auto-Hébergement
