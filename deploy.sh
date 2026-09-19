#!/usr/bin/env bash
# MatuAI (ai-chat) — deploy en producción (VPS + PM2 + nginx)
#
# Uso:
#   chmod +x deploy.sh
#   ./deploy.sh              # git pull (si hay) + build + pm2 restart
#   ./deploy.sh --no-pull    # solo build + restart
#   ./deploy.sh --setup      # primera vez (deps + build + pm2)
#   ./deploy.sh --nginx      # instala/recarga site nginx (requiere root)
#   ./deploy.sh --certbot    # pide certificado SSL (DNS ya al VPS)
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

APP_NAME="matuai"
APP_PORT="${PORT:-8787}"
DOMAIN="ai.matubyte.com"
NGINX_SRC="$APP_DIR/deploy/nginx-ai.matubyte.com.conf"
NGINX_AVAILABLE="/etc/nginx/sites-available/${DOMAIN}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}"

DO_PULL=true
DO_SETUP=false
DO_NGINX=false
DO_CERTBOT=false

for arg in "$@"; do
  case "$arg" in
    --setup) DO_SETUP=true ;;
    --no-pull) DO_PULL=false ;;
    --nginx) DO_NGINX=true ;;
    --certbot) DO_CERTBOT=true ;;
    -h|--help)
      echo "Usage: ./deploy.sh [--setup|--no-pull|--nginx|--certbot]"
      exit 0
      ;;
    *) echo "Opción desconocida: $arg"; exit 1 ;;
  esac
done

ensure_env() {
  if [[ ! -f .env ]]; then
    if [[ -f .env.example ]]; then
      cp .env.example .env
      echo "Creado .env desde .env.example — edítalo y vuelve a correr."
      exit 1
    fi
    echo "ERROR: falta .env"
    exit 1
  fi
}

# Mismo origen detrás de nginx: VITE_API_URL vacío.
ensure_same_origin_api() {
  if [[ ! -f .env ]]; then
    return 0
  fi
  if grep -qE '^VITE_API_URL=.' .env; then
    echo "==> VITE_API_URL no vacío — en VPS debe quedar vacío (mismo origen)."
    echo "    Comenta o vacía VITE_API_URL= en .env y vuelve a buildear."
  fi
  if ! grep -qE '^VITE_API_URL=' .env; then
    echo 'VITE_API_URL=' >> .env
  fi
}

ensure_sizor_https() {
  if [[ ! -f .env ]]; then
    return 0
  fi
  if grep -qE '^VITE_SIZOR_URL=http://' .env; then
    echo "==> Corrigiendo VITE_SIZOR_URL a https..."
    sed -i 's|^VITE_SIZOR_URL=http://|VITE_SIZOR_URL=https://|' .env
  fi
  if ! grep -qE '^VITE_SIZOR_URL=' .env; then
    echo 'VITE_SIZOR_URL=https://sizor.online' >> .env
  fi
  grep -E '^VITE_SIZOR_URL=' .env || true
}

git_pull() {
  if [[ -d .git ]] && command -v git >/dev/null 2>&1; then
    echo "==> git pull..."
    local env_backup=""
    if [[ -f .env ]]; then
      env_backup="$(mktemp)"
      cp .env "$env_backup"
    fi
    if git ls-files --error-unmatch .env >/dev/null 2>&1; then
      if ! git diff --quiet -- .env 2>/dev/null; then
        git stash push -m "deploy-env-$(date +%s)" -- .env || true
      fi
    fi
    git pull --ff-only || true
    if [[ -n "$env_backup" && -f "$env_backup" ]]; then
      cp "$env_backup" .env
      rm -f "$env_backup"
      echo "==> .env del servidor restaurado"
    fi
  else
    echo "==> Sin repo git, omitiendo pull."
  fi
}

install_deps() {
  if [[ -f package-lock.json ]]; then
    npm ci --legacy-peer-deps
  else
    npm install --legacy-peer-deps
  fi
}

build_app() {
  echo "==> Build frontend (Vite lee VITE_* del .env)..."
  npm run build
}

ensure_pm2() {
  if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2
  fi
}

restart_pm2() {
  ensure_pm2
  if [[ -f ecosystem.config.cjs ]]; then
    if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
      echo "==> PM2 reload ${APP_NAME}..."
      pm2 reload ecosystem.config.cjs --update-env
    else
      echo "==> PM2 start ${APP_NAME}..."
      pm2 start ecosystem.config.cjs
    fi
    pm2 save
  else
    echo "==> PM2 start node server..."
    pm2 start npm --name "$APP_NAME" -- run server
    pm2 save
  fi
}

verify_local() {
  echo "==> Verificando http://127.0.0.1:${APP_PORT}/api/health..."
  if curl -sf "http://127.0.0.1:${APP_PORT}/api/health" | head -c 200; then
    echo ""
    echo "OK — API en :${APP_PORT}"
  else
    echo "AVISO: sin respuesta en :${APP_PORT}. Revisa: pm2 logs ${APP_NAME}"
  fi
}

install_nginx() {
  if [[ ! -f "$NGINX_SRC" ]]; then
    echo "ERROR: falta $NGINX_SRC"
    exit 1
  fi
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "ERROR: --nginx necesita root (sudo ./deploy.sh --nginx)"
    exit 1
  fi
  echo "==> Instalando nginx site ${DOMAIN}..."
  mkdir -p /var/www/certbot
  cp "$NGINX_SRC" "$NGINX_AVAILABLE"
  ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  nginx -t
  systemctl reload nginx
  echo "OK — nginx recargado. Luego: sudo ./deploy.sh --certbot (con DNS al VPS)."
}

run_certbot() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "ERROR: --certbot necesita root"
    exit 1
  fi
  if ! command -v certbot >/dev/null 2>&1; then
    echo "ERROR: certbot no instalado"
    exit 1
  fi
  echo "==> Certbot ${DOMAIN}..."
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || \
    certbot --nginx -d "$DOMAIN"
}

ensure_env
ensure_sizor_https
ensure_same_origin_api

if $DO_NGINX; then
  install_nginx
  exit 0
fi

if $DO_CERTBOT; then
  run_certbot
  exit 0
fi

if $DO_SETUP; then
  echo "==> Setup MatuAI en $APP_DIR"
  install_deps
  build_app
  restart_pm2
  verify_local
  echo ""
  echo "Siguiente: sudo ./deploy.sh --nginx && (DNS A → VPS) && sudo ./deploy.sh --certbot"
  exit 0
fi

echo "==> Deploy MatuAI en $APP_DIR"
if $DO_PULL; then
  git_pull
fi
ensure_sizor_https
ensure_same_origin_api
install_deps
build_app
restart_pm2
verify_local

echo ""
echo "Deploy completado — https://${DOMAIN} (si nginx+DNS listos)"
