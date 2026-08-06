#!/bin/bash

echo "============================================="
echo "   Starting Sierra Leone Server Services...  "
echo "============================================="

# Start Daemon (Port 4001)
echo "[+] Launching SLS Daemon..."
(cd ../sls-daemon && npm run dev) &

# Start API (Port 4000)
echo "[+] Launching SLS API..."
(cd ../sls-api && npm run dev) &

# Start Dashboard (Port 3000)
echo "[+] Launching SLS Dashboard..."
(cd ../sls-dashboard && npm run dev) &

echo "============================================="
echo " All services initialized in background."
echo " Dashboard: http://localhost:3000"
echo " API:       http://localhost:4000"
echo " Daemon:    http://localhost:4001"
echo "============================================="
