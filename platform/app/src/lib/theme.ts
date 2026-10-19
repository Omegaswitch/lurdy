// Field app tokens: same Grand Magistry palette as the admin, sized for older eyes and outdoor light.
export const colors = {
  red: '#e31818', redStrong: '#b90f0f', redWash: '#fdecec',
  ink: '#111111', text: '#2b2b2b', muted: '#555555', rule: '#c7c7c7', line: '#e2e2e2',
  ground: '#f3f3f3', surface: '#ffffff',
  ok: '#1d6b35', okWash: '#e7f3ea', warn: '#8a5a00', warnWash: '#fff4dc', bad: '#a40e0e', badWash: '#fdecec',
  focus: '#1f5fa8',
} as const;

export const fonts = { regular: 'Asap_400Regular', medium: 'Asap_500Medium', semibold: 'Asap_600SemiBold', bold: 'Asap_700Bold' } as const;

// Base sizes; the "larger text" setting multiplies them, and the system font scale applies on top.
export const size = { body: 19, label: 17, big: 24, title: 30, huge: 40 } as const;
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const touch = 64; // minimum height of every main control
