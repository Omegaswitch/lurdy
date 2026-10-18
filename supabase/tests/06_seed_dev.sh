# The development seed applies cleanly on top of the migrations and is idempotent.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
q() { psql -X -q -v ON_ERROR_STOP=1 -At "$@"; }
q -c "update public.editions set status = 'draft' where status = 'active'" # the fixture's active edition
q -f "$here/../seed-dev.sql"
q -f "$here/../seed-dev.sql"
n=$(q -c "select count(*) from public.participants p join public.editions e on e.id = p.edition_id where e.title like 'Vývojový%'")
[ "$n" = 5 ] || { echo "FAIL: $n dev participants"; exit 1; }
