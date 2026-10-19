import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { colors, space } from '../lib/theme';
import { Card, Empty, fmtDay, fmtTime, Icon, Screen, T, NoData } from '../lib/ui';

type MyLeg = { id: string; code: string; kind: string; leg_assignments: { boarded_at: string | null; participants: { first_name: string; last_name: string } | null }[] };

export default function Duty() {
  const { data, t, isStaff } = useStore();
  const [legs, setLegs] = useState<MyLeg[]>([]);
  const meId = data?.me?.id;

  // Buses I am responsible for, with who has boarded and who is still missing ("nobody left behind").
  useEffect(() => {
    if (!meId || !isStaff) return;
    const load = () => supabase.from('transport_legs').select('id, code, kind, leg_assignments(boarded_at, participants(first_name, last_name))')
      .eq('responsible_id', meId).then(({ data: l }) => setLegs((l ?? []) as unknown as MyLeg[]));
    load();
    const ch = supabase.channel(`duty:${meId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'leg_assignments' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [meId, isStaff]);

  if (!data) return <NoData />;
  const tz = data.edition.timezone;
  return (
    <Screen title={t('home.duty')}>
      {legs.map((l) => {
        const missing = l.leg_assignments.filter((a) => !a.boarded_at);
        return (
          <Card key={l.id}>
            <T kind="title">{t(`leg.${l.kind as 'bus'}`)} {l.code}</T>
            <T kind="huge">{l.leg_assignments.length - missing.length} / {l.leg_assignments.length}</T>
            <T kind="label">nastoupilo</T>
            {missing.length === 0 ? (
              <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
                <Icon name="check" color={colors.ok} /><T kind="big" style={{ color: colors.ok }}>Všichni nastoupili</T>
              </View>
            ) : (
              <>
                <T kind="big" style={{ color: colors.warn }}>Chybí ({missing.length}):</T>
                {missing.map((a, i) => <T key={i}>{a.participants ? `${a.participants.last_name} ${a.participants.first_name}` : '—'}</T>)}
              </>
            )}
          </Card>
        );
      })}
      {data.in_care.length > 0 && <T kind="title" accessibilityRole="header">Moje péče</T>}
      {data.in_care.map((c) => (
        <Card key={c.id + (c.starts_at ?? '')}>
          <T kind="big">{c.name}</T>
          <T>{t(`care.${c.kind}`)}{c.room ? ` · ${t('room.room')} ${c.room}` : ''}</T>
          {c.ends_at && <T kind="label">do {fmtDay(c.ends_at, tz)} {fmtTime(c.ends_at, tz)}</T>}
        </Card>
      ))}
      {data.duties.length > 0 && <T kind="title" accessibilityRole="header">Služby</T>}
      {data.duties.map((d, i) => (
        <Card key={i}>
          <T kind="big">{d.title}</T>
          <T>{fmtDay(d.starts_at, tz)} {fmtTime(d.starts_at, tz)}–{fmtTime(d.ends_at, tz)}{d.location ? ` · ${d.location}` : ''}</T>
          {d.note ? <T>{d.note}</T> : null}
        </Card>
      ))}
      {legs.length === 0 && data.in_care.length === 0 && data.duties.length === 0 && <Empty>Teď nemáte přidělenou žádnou službu.</Empty>}
    </Screen>
  );
}
