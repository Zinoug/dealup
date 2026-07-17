import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  brand900: '#001B14',
  brand800: '#003526',
  brand700: '#075F3A',
  brand600: '#0B8C4C',
  brand500: '#39B94A',
  brand400: '#77D94E',
  lime: '#C4F52A',
  limeSoft: '#E8F9B8',
  ivory: '#F7F7F1',
  paper: '#071F19',
  white: '#FAFCF8',
  ink: '#F7FAF6',
  inkMuted: '#9EB0A8',
  inkSoft: '#71877D',
  border: 'rgba(153, 192, 174, 0.18)',
  borderStrong: 'rgba(173, 210, 193, 0.32)',
  amber: '#FFAA25',
  amberSoft: 'rgba(255, 170, 37, 0.13)',
  orange: '#FF7A1A',
  orangeSoft: 'rgba(255, 122, 26, 0.14)',
  red: '#FF5148',
  redSoft: 'rgba(255, 81, 72, 0.14)',
  blueGray: '#8EB2A2',
  blueSoft: 'rgba(142, 178, 162, 0.12)',
  shadow: '#000B07',
  lightInk: '#082016',
  lightMuted: '#657068',
  lightBorder: '#DADDD5',
  lightSurface: '#F8F8F3',
  darkCard: '#05251D',
} as const;

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 } as const;
export const radii = { sm: 10, md: 16, lg: 22, xl: 30, pill: 999 } as const;

export const type = {
  display: { fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -1.4 } satisfies TextStyle,
  h1: { fontSize: 30, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8 } satisfies TextStyle,
  h2: { fontSize: 23, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 } satisfies TextStyle,
  h3: { fontSize: 18, lineHeight: 23, fontWeight: '600', letterSpacing: -0.15 } satisfies TextStyle,
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' } satisfies TextStyle,
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' } satisfies TextStyle,
  small: { fontSize: 14, lineHeight: 19, fontWeight: '400' } satisfies TextStyle,
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.1 } satisfies TextStyle,
  label: { fontSize: 15, lineHeight: 19, fontWeight: '700' } satisfies TextStyle,
  score: { fontSize: 62, lineHeight: 66, fontWeight: '700', letterSpacing: -2 } satisfies TextStyle,
} as const;

export const shadows = {
  floating: { shadowColor: colors.lime, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.22, shadowRadius: 18, elevation: 8 } satisfies ViewStyle,
  subtle: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 4 } satisfies ViewStyle,
} as const;

export const layout = { gutter: 20, contentMax: 520, touchTarget: 48 } as const;
export const motion = { instant: 120, state: 240, reveal: 650 } as const;
