#!/bin/sh
# Applies the platform migration. Connection settings come from PGHOST, PGUSER, PGPASSWORD and PGDATABASE.
set -eu

: "${NODE_RUNTIME_PASSWORD:?NODE_RUNTIME_PASSWORD is required}"
: "${RAG_RUNTIME_PASSWORD:?RAG_RUNTIME_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 \
  -v node_pw="$NODE_RUNTIME_PASSWORD" \
  -v rag_pw="$RAG_RUNTIME_PASSWORD" \
  -f "$(dirname "$0")/001_platform.sql"

echo "Platform migration applied"
