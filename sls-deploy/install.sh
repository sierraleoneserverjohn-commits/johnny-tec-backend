#!/bin/bash

set -e

echo "============================================="
echo "   Sierra Leone Server (SLS) - Installer     "
echo "============================================="

# 1. Environment Detection
if [ -d "/data/data/com.termux/files/usr" ]; then
    echo "[+] Platform: Termux (Android) Detected"
    PLATFORM="termux"
else
    echo "[+] Platform: Standard Linux Detected"
    PLATFORM="linux"
fi

# 2. Environment Variable Setup
if [ ! -f .env ]; then
    echo "[+] Creating .env from .env.example..."
    cp .env.example .env
fi

# 3. Install Platform Dependencies
if [ "$PLATFORM" = "termux" ]; then
    echo "[+] Installing Termux runtime packages..."
    pkg update -y
    pkg install nodejs postgresql redis git -y

    # Start database services in Termux background if not running
    if ! pg_ctl status > /dev/null 2>&1; then
        echo "[+] Initializing & Starting PostgreSQL inside Termux..."
        mkdir -p $PREFIX/var/lib/postgresql
        initdb $PREFIX/var/lib/postgresql || true
        pg_ctl -D $PREFIX/var/lib/postgresql -l $PREFIX/var/log/postgres.log start
    fi

    if ! pgrep redis-server > /dev/null; then
        echo "[+] Starting Redis inside Termux..."
        redis-server --daemonize yes
    fi
else
    echo "[+] Starting Docker services..."
    docker-compose up -d
fi

# 4. Clone / Sync Repositories if missing
GITHUB_USER="YOUR_GITHUB_USERNAME"

for REPO in sls-api sls-dashboard sls-daemon; do
    if [ ! -d "../$REPO" ]; then
        echo "[+] Cloning $REPO..."
        git clone https://github.com/$GITHUB_USER/$REPO.git "../$REPO"
    fi
    
    echo "[+] Installing dependencies for $REPO..."
    (cd "../$REPO" && npm install)
done

# 5. Run Database Migrations
echo "[+] Running Database Migrations via sls-api..."
(cd "../sls-api" && npm run migrate:latest)

echo "============================================="
echo "   SLS Installation Complete!                "
echo "   Run './start-all.sh' to boot services.   "
echo "============================================="
