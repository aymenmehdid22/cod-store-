#!/usr/bin/env bash
# Usage: DATABASE_URL=postgres://… bash supabase/tests/run.sh
# Needs a SCRATCH database with migrations 001-004 applied and Supabase-like roles (anon, authenticated, service_role).
set -euo pipefail
for f in security_and_rpc cart_analytics_crm; do
  out=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$(dirname "$0")/$f.sql" 2>&1) || { echo "$out" | grep -E "ERROR|CONTEXT"; exit 1; }
  echo "$f: $(echo "$out" | grep -c 'NOTICE:  ok') assertions passed"
done
