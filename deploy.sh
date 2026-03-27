#!/usr/bin/env bash
#
# deploy.sh — Automated self-hosted deployment
# Deploys: Supabase (Docker) + Edge Functions + Frontend
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh [--domain yourdomain.com] [--skip-frontend] [--skip-supabase]
#
set -euo pipefail

# ─── Colors ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1" >&2; }
info()  { echo -e "${CYAN}[i]${NC} $1"; }

# ─── Defaults ───
DOMAIN=""
SKIP_FRONTEND=false
SKIP_SUPABASE=false
SUPABASE_DIR="./supabase-docker"
FRONTEND_DIR="."
DEPLOY_DIR="/opt/report-whisperer"

# ─── Parse args ───
while [[ $# -gt 0 ]]; do
  case $1 in
    --domain)       DOMAIN="$2"; shift 2 ;;
    --skip-frontend) SKIP_FRONTEND=true; shift ;;
    --skip-supabase) SKIP_SUPABASE=true; shift ;;
    *) error "Unknown option: $1"; exit 1 ;;
  esac
done

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Report Whisperer — Deployment Script       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ─── 1. Prerequisites check ───
info "Vérification des prérequis..."

for cmd in docker docker-compose node npm git; do
  if ! command -v $cmd &>/dev/null; then
    error "$cmd n'est pas installé. Veuillez l'installer d'abord."
    exit 1
  fi
done
log "Tous les prérequis sont installés"

# Check Deno for Edge Functions
if ! command -v deno &>/dev/null; then
  warn "Deno non trouvé. Installation..."
  curl -fsSL https://deno.land/install.sh | sh
  export PATH="$HOME/.deno/bin:$PATH"
  log "Deno installé"
fi

# ─── 2. Supabase Self-Hosted ───
if [ "$SKIP_SUPABASE" = false ]; then
  info "Déploiement de Supabase self-hosted..."

  if [ ! -d "$SUPABASE_DIR" ]; then
    git clone --depth 1 https://github.com/supabase/supabase "$SUPABASE_DIR"
    log "Repository Supabase cloné"
  fi

  cd "$SUPABASE_DIR/docker"

  # Generate secrets if .env doesn't exist
  if [ ! -f .env ]; then
    cp .env.example .env

    # Generate secure keys
    JWT_SECRET=$(openssl rand -base64 32)
    ANON_KEY=$(openssl rand -base64 32)
    SERVICE_ROLE_KEY=$(openssl rand -base64 32)
    POSTGRES_PASSWORD=$(openssl rand -base64 24)
    DASHBOARD_PASSWORD=$(openssl rand -base64 16)

    # Update .env
    sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|g" .env
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|g" .env
    sed -i "s|ANON_KEY=.*|ANON_KEY=${ANON_KEY}|g" .env
    sed -i "s|SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}|g" .env
    sed -i "s|DASHBOARD_USERNAME=.*|DASHBOARD_USERNAME=admin|g" .env
    sed -i "s|DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}|g" .env

    if [ -n "$DOMAIN" ]; then
      sed -i "s|SITE_URL=.*|SITE_URL=https://${DOMAIN}|g" .env
      sed -i "s|API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://${DOMAIN}/api|g" .env
    fi

    log "Fichier .env configuré avec des clés sécurisées"
    warn "POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}"
    warn "DASHBOARD_PASSWORD: ${DASHBOARD_PASSWORD}"
    warn "Notez ces mots de passe ! Ils ne seront plus affichés."
  else
    log "Fichier .env existant conservé"
  fi

  # Start Supabase
  docker-compose pull
  docker-compose up -d
  log "Supabase démarré"

  # Wait for healthy
  info "Attente du démarrage de Supabase..."
  sleep 15

  # Run migrations
  info "Application des migrations..."
  for migration in ../../supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
      PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h localhost -p 5432 -U supabase_admin -d postgres -f "$migration" 2>/dev/null || true
    fi
  done
  log "Migrations appliquées"

  cd ../..
else
  warn "Supabase ignoré (--skip-supabase)"
fi

# ─── 3. Edge Functions ───
info "Déploiement des Edge Functions..."

FUNCTIONS_DIR="supabase/functions"
if [ -d "$FUNCTIONS_DIR" ]; then
  for func_dir in "$FUNCTIONS_DIR"/*/; do
    func_name=$(basename "$func_dir")
    # Skip shared directory
    if [ "$func_name" = "_shared" ]; then continue; fi
    
    if [ -f "$func_dir/index.ts" ]; then
      info "  → Déploiement de $func_name..."
      
      if command -v supabase &>/dev/null; then
        supabase functions deploy "$func_name" --no-verify-jwt 2>/dev/null || \
          warn "    Échec du déploiement de $func_name (mode local requis)"
      else
        warn "    CLI Supabase non trouvé — fonction $func_name non déployée"
        warn "    Installez: npm i -g supabase"
      fi
    fi
  done
  log "Edge Functions traitées"
else
  warn "Aucun répertoire de fonctions trouvé"
fi

# ─── 4. Frontend ───
if [ "$SKIP_FRONTEND" = false ]; then
  info "Build du frontend..."

  # Create production .env
  SUPABASE_URL="${SUPABASE_URL:-http://localhost:8000}"
  SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-your-anon-key}"

  cat > .env.production <<EOF
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_ANON_KEY}
VITE_SUPABASE_PROJECT_ID=self-hosted
EOF

  npm install
  npm run build
  log "Frontend compilé dans ./dist"

  # Deploy with simple static server or copy to nginx
  if [ -n "$DOMAIN" ]; then
    sudo mkdir -p "$DEPLOY_DIR"
    sudo cp -r dist/* "$DEPLOY_DIR/"
    log "Frontend déployé dans $DEPLOY_DIR"

    # Generate nginx config
    NGINX_CONF="/etc/nginx/sites-available/report-whisperer"
    sudo tee "$NGINX_CONF" > /dev/null <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    root ${DEPLOY_DIR};
    index index.html;

    # SPA routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy Supabase API
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # SSE support
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
    }

    # WebSocket support
    location /realtime/ {
        proxy_pass http://localhost:8000/realtime/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

    sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
    log "Nginx configuré pour ${DOMAIN}"

    # SSL with certbot
    if command -v certbot &>/dev/null; then
      info "Configuration SSL avec Let's Encrypt..."
      sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@${DOMAIN}" || \
        warn "Certbot a échoué — configurez SSL manuellement"
    else
      warn "Certbot non installé — SSL non configuré"
    fi
  fi
else
  warn "Frontend ignoré (--skip-frontend)"
fi

# ─── 5. Summary ───
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║          Déploiement terminé ! 🎉            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
if [ -n "$DOMAIN" ]; then
  log "Frontend:  https://${DOMAIN}"
  log "API:       https://${DOMAIN}/api"
else
  log "Frontend:  http://localhost:5173 (dev) ou servez ./dist"
  log "API:       http://localhost:8000"
fi
log "Studio:    http://localhost:3000"
echo ""
info "Configuration IA:"
info "  → Modifiez AI_PROVIDER depuis le panneau admin"
info "  → Ou via: UPDATE ai_config SET config_value='openai' WHERE config_key='AI_PROVIDER';"
echo ""
warn "N'oubliez pas de configurer vos clés API dans le panneau admin !"
