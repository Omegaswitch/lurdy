// Big, plain building blocks for the field app. Every control is at least 64 pt high, text is large, and
// status is always said in words with an icon, never by colour alone.
import { iconPaths, type IconName } from '@lurdy/shared';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useStore } from './store';
import { colors, fonts, size, space, touch } from './theme';

export function Icon({ name, color = colors.ink, size: s = 28 }: { name: IconName; color?: string; size?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={iconPaths[name]} />
    </Svg>
  );
}

// Text that follows the in-app "larger text" setting (and the system font size).
export function T({ style, kind = 'body', children, ...rest }: { style?: TextStyle | TextStyle[]; kind?: 'body' | 'label' | 'big' | 'title' | 'huge'; children: ReactNode } & React.ComponentProps<typeof Text>) {
  const { scale } = useStore();
  const base: TextStyle = {
    body: { fontFamily: fonts.regular, fontSize: size.body * scale, lineHeight: size.body * scale * 1.4, color: colors.text },
    label: { fontFamily: fonts.semibold, fontSize: size.label * scale, color: colors.muted },
    big: { fontFamily: fonts.semibold, fontSize: size.big * scale, lineHeight: size.big * scale * 1.25, color: colors.ink },
    title: { fontFamily: fonts.bold, fontSize: size.title * scale, lineHeight: size.title * scale * 1.2, color: colors.ink },
    huge: { fontFamily: fonts.bold, fontSize: size.huge * scale, lineHeight: size.huge * scale * 1.15, color: colors.ink },
  }[kind];
  return <Text style={[base, ...(Array.isArray(style) ? style : style ? [style] : [])]} {...rest}>{children}</Text>;
}

// A screen: big header title, scrollable content, offline notice when showing cached data.
export function Screen({ title, children, scroll = true }: { title: string; children: ReactNode; scroll?: boolean }) {
  const { offline, data, t } = useStore();
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={s.screen} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title }} />
      {offline && data && (
        <View style={s.offline} accessibilityRole="alert">
          <Icon name="info" color={colors.warn} size={22} />
          <T kind="label" style={{ color: colors.warn, flex: 1 }}>
            {t('sync.offline')} · {t('sync.asOf')} {new Date(data.generated_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </T>
        </View>
      )}
      {/* on the web a scrolling area must be reachable by keyboard even when it holds only text (WCAG 2.1.1) */}
      <Body style={{ flex: 1 }} contentContainerStyle={scroll ? s.content : undefined}
        {...(scroll && Platform.OS === 'web' ? { focusable: true, accessibilityLabel: title } : {})}>{children}</Body>
    </SafeAreaView>
  );
}

export function BigButton({ icon, label, hint, onPress, tone = 'plain', disabled, testID }: {
  icon?: IconName; label: string; hint?: string; onPress: () => void; tone?: 'plain' | 'primary' | 'danger'; disabled?: boolean; testID?: string;
}) {
  const fg = tone === 'plain' ? colors.ink : '#fff';
  return (
    <Pressable onPress={onPress} disabled={disabled} testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [s.button, tone === 'primary' && s.primary, tone === 'danger' && s.danger, pressed && { opacity: 0.75 }, disabled && { opacity: 0.45 }]}>
      {icon && <Icon name={icon} color={fg} size={32} />}
      <View style={{ flex: 1 }}>
        <T kind="big" style={{ color: fg }}>{label}</T>
        {hint ? <T kind="label" style={{ color: tone === 'plain' ? colors.muted : '#fff' }}>{hint}</T> : null}
      </View>
      <Icon name="arrow" color={fg} size={26} />
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={{ gap: 2 }}>
      <T kind="label">{label}</T>
      {typeof value === 'string' || typeof value === 'number' ? <T kind="big">{value}</T> : value}
    </View>
  );
}

export function Banner({ kind, title, children }: { kind: 'ok' | 'warn' | 'bad' | 'info'; title: string; children?: ReactNode }) {
  const map = {
    ok: { bg: colors.okWash, fg: colors.ok, icon: 'check' as const },
    warn: { bg: colors.warnWash, fg: colors.warn, icon: 'alert' as const },
    bad: { bg: colors.badWash, fg: colors.bad, icon: 'x' as const },
    info: { bg: '#eef3fa', fg: '#1f4a80', icon: 'info' as const },
  }[kind];
  return (
    <View style={[s.banner, { backgroundColor: map.bg, borderColor: map.fg }]} accessibilityRole="alert">
      <Icon name={map.icon} color={map.fg} size={36} />
      <View style={{ flex: 1, gap: 4 }}>
        <T kind="title" style={{ color: map.fg }}>{title}</T>
        {children}
      </View>
    </View>
  );
}

export function Empty({ children }: { children: string }) {
  return <Card><T>{children}</T></Card>;
}

export const fmtTime = (iso: string | null | undefined, tz: string) =>
  iso ? new Intl.DateTimeFormat('cs-CZ', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '';
export const fmtDay = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('cs-CZ', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'numeric' }).format(new Date(iso));

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: space.l, gap: space.l, paddingBottom: space.xxl * 2 },
  offline: { flexDirection: 'row', alignItems: 'center', gap: space.s, padding: space.m, backgroundColor: colors.warnWash, borderBottomWidth: 1, borderColor: '#ecd08f' },
  button: { minHeight: touch + 16, flexDirection: 'row', alignItems: 'center', gap: space.l, paddingHorizontal: space.l, paddingVertical: space.m,
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.rule },
  primary: { backgroundColor: colors.red, borderColor: colors.red },
  danger: { backgroundColor: colors.redStrong, borderColor: colors.redStrong },
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: space.l, gap: space.m },
  banner: { flexDirection: 'row', gap: space.l, alignItems: 'flex-start', padding: space.l, borderRadius: 12, borderWidth: 2 },
});
