#!/usr/bin/env bash
# Runs all migrations + tests against a throwaway local Postgres. Usage: supabase/test/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN=/usr/lib/postgresql/16/bin
DIR=$(mktemp -d)
trap '$PGBIN/pg_ctl -D "$DIR" stop -m immediate >/dev/null 2>&1; rm -rf "$DIR"' EXIT
chown postgres "$DIR" 2>/dev/null || true
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
as_pg "$PGBIN/initdb -D $DIR -A trust >/dev/null"
as_pg "$PGBIN/pg_ctl -D $DIR -o '-k $DIR -p 54329 -c listen_addresses=' -l $DIR/log start >/dev/null"
PSQL="psql -h $DIR -p 54329 -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
$PSQL -f test/auth_stub.sql
for f in migrations/*.sql; do echo "== $f"; $PSQL -f "$f"; done
for f in test/test_*.sql; do echo "== $f"; $PSQL -f "$f"; done
echo "ALL OK"
