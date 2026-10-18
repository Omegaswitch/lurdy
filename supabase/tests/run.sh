#!/usr/bin/env bash
# Runs the database test suite on a throwaway local Postgres:
# shim (Supabase auth stand-in) → migrations → helpers → every tests/[0-9]*.sql (each rolls back).
#   supabase/tests/run.sh            all tests
#   supabase/tests/run.sh 02         only files starting with 02
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
bin=$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)
data=$(mktemp -d)
port=${PGTEST_PORT:-54329}
cleanup() { "$bin/pg_ctl" -D "$data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$data"; }
trap cleanup EXIT
# initdb refuses to run as root; use the postgres OS user when we are root.
as_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$data"
as_pg "$bin/initdb" -D "$data" -U postgres -A trust >/dev/null
as_pg "$bin/pg_ctl" -D "$data" -o "-p $port -k $data -c listen_addresses='' -c wal_level=logical" -l "$data/log" -w start >/dev/null
export PGHOST=$data PGPORT=$port PGUSER=postgres PGDATABASE=postgres
psql() { command psql -X -q -v ON_ERROR_STOP=1 "$@"; }

psql -f "$here/shim.sql" >/dev/null
for m in "$root"/supabase/migrations/*.sql; do psql -f "$m" >/dev/null || { echo "migration failed: $m"; exit 1; }; done
[ "${1:-}" = fingerprint ] && { command psql -X -At -f "$here/fingerprint.sql"; exit; }
psql -f "$here/helpers.sql" >/dev/null

fail=0
pat=${1:-[0-9]}
for t in "$here"/$pat*.sql "$here"/$pat*.sh; do
  [ -e "$t" ] || continue
  name=$(basename "$t")
  if [[ $t == *.sh ]]; then out=$(bash "$t" 2>&1) && echo "ok   $name" || { echo "FAIL $name"; echo "$out" | tail -20; fail=1; }
  else out=$(psql -f "$t" 2>&1) && echo "ok   $name" || { echo "FAIL $name"; echo "$out" | grep -E "ERROR|FAIL|NOTICE" | head -20; fail=1; }
  fi
done
exit $fail
