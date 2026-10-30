#!/bin/sh
# Creates the separate database n8n uses for its own state (runs once, on first init).
set -e
N8N_DB="${N8N_DB_NAME:-n8n}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
SELECT 'CREATE DATABASE "$N8N_DB"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$N8N_DB')\gexec
EOSQL
