# Two sessions race for the last seat on a bus: exactly one must win (capacity trigger locks the leg).
set -euo pipefail
q() { psql -X -q -v ON_ERROR_STOP=1 -At "$@"; }
q -c "insert into public.transport_legs (id, edition_id, kind, direction, code, capacity)
      values (tests.id('race'), tests.id('e1'), 'bus', 'local', 'RACE', 1)"
try() {
  q -c "begin; insert into public.leg_assignments (leg_id, participant_id) values (tests.id('race'), tests.id('$1'));
        select pg_sleep(0.5); commit;" >/dev/null 2>&1 && echo won || echo lost
}
results=$( { try p5 & try p7 & wait; } )
n=$(q -c "select count(*) from public.leg_assignments where leg_id = tests.id('race')")
q -c "delete from public.transport_legs where id = tests.id('race')"
[ "$n" = 1 ] || { echo "FAIL: $n passengers on a 1-seat bus ($results)"; exit 1; }
echo "$results" | grep -q lost || { echo "FAIL: nobody was refused ($results)"; exit 1; }
