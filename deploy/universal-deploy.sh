#!/usr/bin/env bash

set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Please run this script as a regular sudo-capable user, not root."
  exit 1
fi

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This deploy script is intended for Linux (Debian/Ubuntu/Armbian)."
  exit 1
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo is required."
  exit 1
fi

prompt_default() {
  local prompt="$1"
  local default_value="$2"
  local input
  read -r -p "${prompt} [${default_value}]: " input
  if [[ -z "$input" ]]; then
    echo "$default_value"
  else
    echo "$input"
  fi
}

prompt_required() {
  local prompt="$1"
  local input
  while true; do
    read -r -p "${prompt}: " input
    if [[ -n "$input" ]]; then
      echo "$input"
      return
    fi
    echo "Value is required."
  done
}

prompt_secret_default() {
  local prompt="$1"
  local default_value="$2"
  local input
  read -r -s -p "${prompt} [hidden, press Enter for default hidden value]: " input
  echo
  if [[ -z "$input" ]]; then
    echo "$default_value"
  else
    echo "$input"
  fi
}

prompt_secret_optional() {
  local prompt="$1"
  local input
  read -r -s -p "${prompt} [leave empty if none]: " input
  echo
  echo "$input"
}

prompt_yes_no() {
  local prompt="$1"
  local default_value="$2"
  local input
  local normalized_default

  normalized_default="$(echo "$default_value" | tr '[:upper:]' '[:lower:]')"
  while true; do
    read -r -p "${prompt} [${default_value}]: " input
    input="$(echo "$input" | tr '[:upper:]' '[:lower:]')"
    if [[ -z "$input" ]]; then
      input="$normalized_default"
    fi
    if [[ "$input" == "y" || "$input" == "yes" ]]; then
      echo "yes"
      return
    fi
    if [[ "$input" == "n" || "$input" == "no" ]]; then
      echo "no"
      return
    fi
    echo "Please answer yes or no."
  done
}

auto_secret() {
  openssl rand -hex 32
}

echo "=== CyberStore Universal Production Deploy (Debian/Ubuntu/Armbian) ==="
echo

REPO_URL="$(prompt_required "Git repository URL (HTTPS)")"
BRANCH="$(prompt_default "Git branch" "main")"
APP_DIR="$(prompt_default "Install directory" "/opt/cyberstore")"
SERVICE_NAME="$(prompt_default "Systemd service name" "cyberstore")"
SERVICE_USER="$(prompt_default "System service user" "cyberstore")"

DOMAIN="$(prompt_required "Public domain (example: cyberstore.example.com)")"
APACHE_HTTP_PORT="$(prompt_default "Apache HTTP port" "80")"
APACHE_HTTPS_PORT="$(prompt_default "Apache HTTPS port" "443")"
APP_PORT="$(prompt_default "Next.js internal app port" "3000")"
DISABLE_DEFAULT_SITE="$(prompt_yes_no "Disable Apache default site (000-default.conf)?" "yes")"

DB_HOST="$(prompt_default "MySQL host" "127.0.0.1")"
DB_PORT="$(prompt_default "MySQL port" "3306")"
DB_NAME="$(prompt_default "MySQL database name" "cyberstore")"
DB_USER="$(prompt_default "MySQL app username" "cyberstore_user")"
DB_PASS="$(prompt_secret_default "MySQL app password" "cyberstore_password_change_me")"
DB_ROOT_USER="$(prompt_default "MySQL admin user for provisioning" "root")"
DB_ROOT_PASS="$(prompt_secret_optional "MySQL admin password (optional)")"

NEXTAUTH_URL="$(prompt_default "NEXTAUTH_URL" "https://${DOMAIN}")"

USE_AUTO_NEXTAUTH_SECRET="$(prompt_yes_no "Auto-generate NEXTAUTH_SECRET?" "yes")"
if [[ "$USE_AUTO_NEXTAUTH_SECRET" == "yes" ]]; then
  NEXTAUTH_SECRET="$(auto_secret)"
else
  NEXTAUTH_SECRET="$(prompt_secret_default "NEXTAUTH_SECRET" "change_me_nextauth_secret")"
fi

BREVO_API_KEY="$(prompt_secret_optional "BREVO_API_KEY (optional)")"
BREVO_SENDER_EMAIL="$(prompt_default "BREVO_SENDER_EMAIL" "noreply@${DOMAIN}")"

USE_AUTO_TASKER_SECRET="$(prompt_yes_no "Auto-generate TASKER_SECRET?" "yes")"
if [[ "$USE_AUTO_TASKER_SECRET" == "yes" ]]; then
  TASKER_SECRET="$(auto_secret)"
else
  TASKER_SECRET="$(prompt_secret_default "TASKER_SECRET" "change_me_tasker_secret")"
fi

USE_AUTO_TASKER_TOKEN="$(prompt_yes_no "Auto-generate TASKER_PROFILE_TOKEN?" "yes")"
if [[ "$USE_AUTO_TASKER_TOKEN" == "yes" ]]; then
  TASKER_PROFILE_TOKEN="$(auto_secret)"
else
  TASKER_PROFILE_TOKEN="$(prompt_secret_default "TASKER_PROFILE_TOKEN" "change_me_tasker_profile_token")"
fi

TRUST_PROXY="$(prompt_default "TRUST_PROXY (true/false)" "true")"
BASE_QRIS_STRING="$(prompt_required "BASE_QRIS_STRING (merchant base QRIS payload)")"

INSTALL_CERTBOT="$(prompt_yes_no "Install and run certbot for SSL now?" "yes")"
RUN_SEED="$(prompt_yes_no "Run prisma seed after migration?" "no")"

echo
echo "=== Summary ==="
echo "Repo: ${REPO_URL} (${BRANCH})"
echo "Path: ${APP_DIR}"
echo "Domain: ${DOMAIN}"
echo "Apache ports: ${APACHE_HTTP_PORT}/${APACHE_HTTPS_PORT}"
echo "App port: ${APP_PORT}"
echo "DB: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "Service: ${SERVICE_NAME} (user ${SERVICE_USER})"
echo "Run seed: ${RUN_SEED}"
echo

CONFIRM="$(prompt_yes_no "Proceed with deployment?" "yes")"
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Deployment cancelled."
  exit 0
fi

echo
echo "[1/11] Installing packages..."
sudo apt update
sudo apt install -y git curl apache2 build-essential ca-certificates openssl

echo
echo "[2/11] Installing Node.js 20 LTS (if needed)..."
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
else
  NODE_MAJOR="0"
fi

if [[ "$NODE_MAJOR" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

echo
echo "[3/11] Preparing service user and app directory..."
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  sudo useradd -r -s /usr/sbin/nologin "$SERVICE_USER"
fi

sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER":"$USER" "$APP_DIR"

if [[ -d "$APP_DIR/.git" ]]; then
  echo "Existing git repository detected. Pulling latest branch ${BRANCH}..."
  git -C "$APP_DIR" fetch --all
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
else
  echo "Cloning repository..."
  rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

echo
echo "[4/11] Provisioning MySQL database and user..."
MYSQL_CMD_BASE=(mysql -u "$DB_ROOT_USER")
if [[ -n "$DB_ROOT_PASS" ]]; then
  MYSQL_CMD_BASE+=("-p${DB_ROOT_PASS}")
fi

MYSQL_SQL="CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; \
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}'; \
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}'; \
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost'; \
FLUSH PRIVILEGES;"

if ! "${MYSQL_CMD_BASE[@]}" -e "$MYSQL_SQL"; then
  echo "Direct mysql command failed, retrying with sudo mysql..."
  sudo mysql -e "$MYSQL_SQL"
fi

echo
echo "[5/11] Writing production .env..."
DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

cat >"${APP_DIR}/.env" <<EOF
DATABASE_URL="${DATABASE_URL}"
NEXTAUTH_URL="${NEXTAUTH_URL}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"

BREVO_API_KEY="${BREVO_API_KEY}"
BREVO_SENDER_EMAIL="${BREVO_SENDER_EMAIL}"

TASKER_SECRET="${TASKER_SECRET}"
TASKER_PROFILE_TOKEN="${TASKER_PROFILE_TOKEN}"
TRUST_PROXY="${TRUST_PROXY}"
BASE_QRIS_STRING="${BASE_QRIS_STRING}"
EOF

chmod 600 "${APP_DIR}/.env"

echo
echo "[6/11] Installing dependencies and building app..."
npm --prefix "$APP_DIR" ci
npm --prefix "$APP_DIR" run prisma:generate
npx --prefix "$APP_DIR" prisma migrate deploy
if [[ "$RUN_SEED" == "yes" ]]; then
  npm --prefix "$APP_DIR" run prisma:seed
fi
npm --prefix "$APP_DIR" run build

echo
echo "[7/11] Setting ownership for runtime..."
sudo chown -R "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR"

echo
echo "[8/11] Creating systemd service..."
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
sudo tee "$SERVICE_PATH" >/dev/null <<EOF
[Unit]
Description=CyberStore Next.js Service
After=network.target mariadb.service mysql.service
Wants=network.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

echo
echo "[9/11] Configuring Apache2 reverse proxy..."
sudo a2enmod proxy proxy_http headers rewrite ssl

APACHE_SITE_PATH="/etc/apache2/sites-available/${SERVICE_NAME}.conf"
sudo tee "$APACHE_SITE_PATH" >/dev/null <<EOF
<VirtualHost *:${APACHE_HTTP_PORT}>
    ServerName ${DOMAIN}

    ProxyPreserveHost On
    ProxyRequests Off

    RequestHeader set X-Forwarded-Proto "http"

    ProxyPass / http://127.0.0.1:${APP_PORT}/
    ProxyPassReverse / http://127.0.0.1:${APP_PORT}/

    ErrorLog \\${APACHE_LOG_DIR}/${SERVICE_NAME}-error.log
    CustomLog \\${APACHE_LOG_DIR}/${SERVICE_NAME}-access.log combined
</VirtualHost>

<IfModule mod_ssl.c>
    <VirtualHost *:${APACHE_HTTPS_PORT}>
        ServerName ${DOMAIN}

        ProxyPreserveHost On
        ProxyRequests Off

        RequestHeader set X-Forwarded-Proto "https"

        ProxyPass / http://127.0.0.1:${APP_PORT}/
        ProxyPassReverse / http://127.0.0.1:${APP_PORT}/

        ErrorLog \\${APACHE_LOG_DIR}/${SERVICE_NAME}-error.log
        CustomLog \\${APACHE_LOG_DIR}/${SERVICE_NAME}-access.log combined

        SSLEngine on
        SSLCertificateFile /etc/letsencrypt/live/${DOMAIN}/fullchain.pem
        SSLCertificateKeyFile /etc/letsencrypt/live/${DOMAIN}/privkey.pem
        Include /etc/letsencrypt/options-ssl-apache.conf
    </VirtualHost>
</IfModule>
EOF

if [[ "$DISABLE_DEFAULT_SITE" == "yes" ]]; then
  sudo a2dissite 000-default.conf || true
fi
sudo a2ensite "${SERVICE_NAME}.conf"
sudo apache2ctl configtest
sudo systemctl restart apache2

echo
echo "[10/11] Optional SSL setup with certbot..."
if [[ "$INSTALL_CERTBOT" == "yes" ]]; then
  sudo apt install -y certbot python3-certbot-apache
  sudo certbot --apache -d "$DOMAIN" || true
fi

echo
echo "[11/11] Final status..."
sudo systemctl status "$SERVICE_NAME" --no-pager || true
sudo systemctl status apache2 --no-pager || true

echo
echo "=== Deployment Finished ==="
echo "Service: ${SERVICE_NAME}"
echo "App URL: https://${DOMAIN}"
echo "App path: ${APP_DIR}"
echo
echo "Important secrets you may want to store securely:"
echo "NEXTAUTH_SECRET=${NEXTAUTH_SECRET}"
echo "TASKER_SECRET=${TASKER_SECRET}"
echo "TASKER_PROFILE_TOKEN=${TASKER_PROFILE_TOKEN}"
