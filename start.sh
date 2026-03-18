#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"

echo "Starting mod_orchestrator backend (server/)..."
(cd "$SERVER_DIR" && npm run start) &
SERVER_PID=$!

echo "Starting mod_orchestrator frontend (client/)..."
(cd "$CLIENT_DIR" && npm run dev) &
CLIENT_PID=$!

echo "Backend PID: $SERVER_PID"
echo "Frontend PID: $CLIENT_PID"

cleanup() {
  echo "Stopping mod_orchestrator..."
  kill "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || true
}

trap cleanup INT TERM
wait

