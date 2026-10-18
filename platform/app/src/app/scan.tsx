import { normaliseBadgePayload, type ParticipantCard, type ScanAction, type ScanResult, type Tables } from '@lurdy/shared';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { colors, fonts, space, touch } from '../lib/theme';
import { Banner, BigButton, Card, Field, fmtTime, Icon, Screen, T } from '../lib/ui';

type Leg = Pick<Tables<'transport_legs'>, 'id' | 'code' | 'kind' | 'direction' | 'departs_at' | 'responsible_id'>;
type Person = Pick<Tables<'participants'>, 'id' | 'first_name' | 'last_name' | 'access_code'>;
const actions: ScanAction[] = ['lookup', 'board', 'arrive', 'check_in'];
// An idempotency key for the scan log (offline replays), not a secret.
const scanId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0;
  return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
});
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export default function Scan() {
  const { data, t } = useStore();
  const [action, setAction] = useState<ScanAction>('lookup');
  const [legId, setLegId] = useState<string | null>(null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [permission, requestPermission] = useCameraPermissions();
  const last = useRef<{ payload: string; at: number } | null>(null);
  const editionId = data?.edition.id;
  const meId = data?.me?.id;

  useEffect(() => {
    if (!editionId) return;
    supabase.from('transport_legs').select('id, code, kind, direction, departs_at, responsible_id').eq('edition_id', editionId)
      .order('departs_at', { nullsFirst: false }).order('code')
      .then(({ data: l }) => setLegs(((l ?? []) as Leg[]).sort((a, b) => Number(b.responsible_id === meId) - Number(a.responsible_id === meId))));
    supabase.from('participants').select('id, first_name, last_name, access_code').eq('edition_id', editionId).order('last_name')
      .then(({ data: p }) => setPeople((p ?? []) as Person[]));
  }, [editionId, meId]);

  const needsLeg = action === 'board' || action === 'arrive';
  const ready = !needsLeg || !!legId;

  const submit = useCallback(async (payload: string) => {
    if (busy) return;
    const clean = normaliseBadgePayload(payload);
    // the camera reports the same code many times per second; ignore repeats for 3 s
    const now = Date.now();
    if (last.current && last.current.payload === payload && now - last.current.at < 3000) return;
    last.current = { payload, at: now };
    if (!clean) return setResult({ result: 'invalid' });
    setBusy(true);
    const { data: r, error } = await supabase.rpc('scan_badge', { p_payload: clean, p_action: action, p_leg: needsLeg ? legId! : undefined, p_client_scan_id: scanId() });
    setBusy(false);
    setResult(error ? { result: 'not_authorized' } : (r as unknown as ScanResult));
  }, [action, busy, legId, needsLeg]);

  async function manual(id: string) {
    setBusy(true);
    const { data: r, error } = await supabase.rpc('staff_action', { p_participant: id, p_action: action, p_leg: needsLeg ? legId! : undefined, p_client_scan_id: scanId() });
    setBusy(false);
    setSearch('');
    setResult(error ? { result: 'not_authorized' } : (r as unknown as ScanResult));
  }

  if (!data) return null;
  if (result) return <ResultView result={result} legId={needsLeg ? legId : null} legs={legs} onNext={() => setResult(null)} />;

  const q = fold(search.trim());
  const matches = q.length >= 2 ? people.filter((p) => fold(`${p.first_name} ${p.last_name}`).includes(q) || p.access_code === q).slice(0, 6) : [];

  return (
    <Screen title={t('scan.title')}>
      <T kind="label">{t('scan.context')}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup">
        {actions.map((a) => (
          <Chip key={a} label={t(`scan.${a}`)} selected={a === action} onPress={() => setAction(a)} />
        ))}
      </View>
      {needsLeg && (
        <>
          <T kind="label">{t('scan.leg_required')}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup">
            {legs.map((l) => (
              <Chip key={l.id} label={`${t(`leg.${l.kind}`)} ${l.code}${l.departs_at ? ` · ${fmtTime(l.departs_at, data.edition.timezone)}` : ''}`}
                selected={l.id === legId} onPress={() => setLegId(l.id)} />
            ))}
          </View>
        </>
      )}

      {ready && (
        permission?.granted ? (
          <View style={{ height: 320, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
            <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={busy ? undefined : ({ data: d }) => submit(d)} accessibilityLabel="Kamera pro skenování jmenovky" />
          </View>
        ) : (
          <Card>
            <T>{permission?.canAskAgain === false ? t('scan.cameraDenied') : 'Pro skenování povolte kameru.'}</T>
            {permission?.canAskAgain !== false && <BigButton icon="scan" label="Povolit kameru" tone="primary" onPress={requestPermission} />}
          </Card>
        )
      )}

      {ready && (
        <Card>
          <T kind="label">Kód z jmenovky (čtečka nebo ručně)</T>
          <TextInput value={typed} onChangeText={setTyped} onSubmitEditing={() => { submit(typed); setTyped(''); }} autoCapitalize="characters"
            autoCorrect={false} placeholder="LRD1.…" accessibilityLabel="Kód z jmenovky" testID="payload"
            style={{ minHeight: touch, borderWidth: 2, borderColor: colors.rule, borderRadius: 12, paddingHorizontal: space.m, fontFamily: fonts.regular, fontSize: 18 }} />
          <BigButton label="Ověřit kód" icon="check" onPress={() => { submit(typed); setTyped(''); }} disabled={!typed.trim() || busy} testID="submit-payload" />
          <T kind="label">{t('scan.manual')}</T>
          <TextInput value={search} onChangeText={setSearch} placeholder="Jméno nebo čtyřmístný kód" accessibilityLabel={t('scan.manual')}
            style={{ minHeight: touch, borderWidth: 2, borderColor: colors.rule, borderRadius: 12, paddingHorizontal: space.m, fontFamily: fonts.regular, fontSize: 20 }} />
          {matches.map((p) => <BigButton key={p.id} label={`${p.first_name} ${p.last_name}`} onPress={() => manual(p.id)} />)}
        </Card>
      )}
    </Screen>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }}
      style={{ minHeight: touch, paddingHorizontal: space.l, justifyContent: 'center', borderRadius: 12, borderWidth: 2,
        borderColor: selected ? colors.red : colors.rule, backgroundColor: selected ? colors.red : colors.surface, flexDirection: 'row', alignItems: 'center', gap: space.s }}>
      {selected && <Icon name="check" color="#fff" size={22} />}
      <T kind="big" style={{ color: selected ? '#fff' : colors.ink }}>{label}</T>
    </Pressable>
  );
}

function ResultView({ result, legId, legs, onNext }: { result: ScanResult; legId: string | null; legs: Leg[]; onNext: () => void }) {
  const { t, data } = useStore();
  const p = result.participant;
  const kind = result.result === 'ok' ? 'ok' : result.result === 'wrong_leg' || result.result === 'no_room' ? 'warn' : 'bad';
  const chosen = legs.find((l) => l.id === legId);
  const sameDirection = p?.legs.filter((l) => !chosen || l.direction === chosen.direction) ?? [];
  return (
    <Screen title={t('scan.title')}>
      <Banner kind={kind} title={t(`scan.${result.result}`)}>
        {result.result === 'wrong_leg' && sameDirection.length > 0 && (
          <T kind="big">{t('scan.belongsTo')}: {sameDirection.map((l) => `${t(`leg.${l.kind}`)} ${l.code}`).join(', ')}</T>
        )}
      </Banner>
      {p && <PersonCard p={p} tz={data?.edition.timezone ?? 'Europe/Paris'} />}
      <BigButton icon="scan" label={t('scan.next')} tone="primary" onPress={onNext} testID="scan-next" />
    </Screen>
  );
}

function PersonCard({ p, tz }: { p: ParticipantCard; tz: string }) {
  const { t } = useStore();
  return (
    <Card>
      <T kind="huge" testID="scan-name">{[p.title, p.preferred_name || p.first_name, p.last_name].filter(Boolean).join(' ')}</T>
      <T kind="big">{t(`category.${p.category}`)}{p.mobility !== 'walks' ? ` · ${t(`mobility.${p.mobility}`)}` : ''}</T>
      {p.room && <Field label={t('home.room')} value={`${p.room.facility_label ?? p.room.facility} · ${t('room.room')} ${p.room.number}`} />}
      {p.legs.length > 0 && (
        <Field label={t('home.journey')} value={
          <View style={{ gap: 4 }}>
            {p.legs.map((l) => (
              <T kind="big" key={l.leg_id} testID="scan-leg">
                {t(`leg.${l.kind}`)} {l.code}{l.departs_at ? ` · ${fmtTime(l.departs_at, tz)}` : ''}{l.arrived_at ? ' · dorazil(a)' : l.boarded_at ? ` · ${t('journey.boarded').toLowerCase()}` : ''}
              </T>
            ))}
          </View>
        } />
      )}
      {p.carers.length > 0 && <Field label="Asistent" value={p.carers.map((c) => c.name).join(', ')} />}
      {p.in_care.length > 0 && <Field label="Pečuje o" value={p.in_care.map((c) => c.name).join(', ')} />}
      {p.logistics_note ? <Field label="Poznámka" value={p.logistics_note} /> : null}
      {p.emergency_contacts.length > 0 && (
        <Field label="Kontakt v nouzi" value={p.emergency_contacts.map((c) => `${c.name}${c.relation ? ` (${c.relation})` : ''}: ${c.phone}`).join('\n')} />
      )}
    </Card>
  );
}
