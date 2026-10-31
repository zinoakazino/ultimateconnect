export interface Colors {
  greenDeep: string;
  green: string;
  greenMid: string;
  greenPale: string;
  greenPaleText: string;
  bg: string;
  white: string;
  surface: string;
  ink: string;
  inkSoft: string;
  line: string;
  lineOnDark: string;
  warn: string;
  warnPaleBg: string;
  warnPaleText: string;
  info: string;
  danger: string;
}

export const lightColors: Colors = {
  greenDeep: '#0F3225',
  green: '#1F6B45',
  greenMid: '#2C7A52',
  greenPale: '#E4F2E9',
  greenPaleText: '#B9E0C8',
  bg: '#F6FAF7',
  white: '#FFFFFF',
  surface: '#FFFFFF',
  ink: '#142019',
  inkSoft: '#5B6B60',
  line: 'rgba(15,50,37,0.12)',
  lineOnDark: 'rgba(255,255,255,0.6)',
  warn: '#B4652C',
  warnPaleBg: '#F5E9DE',
  warnPaleText: '#B4652C',
  info: '#2C6BB4',
  danger: '#D9634A',
};

// "Pale" surfaces are deliberately light in both themes (an intentional bright
// accent card floating on the dark page, same pattern as light mode) — so their
// paired text stays a dark, saturated tone in both themes too. `greenDeep` on
// its own also doubles as a dark SURFACE color (confirm card, chat header);
// it's lightened here versus light-mode's near-black so it still visibly pops
// against the near-black page background instead of blending into it.
export const darkColors: Colors = {
  greenDeep: '#1B4A34',
  green: '#3A9468',
  greenMid: '#2C7A52',
  greenPale: '#CFE8DB',
  greenPaleText: '#0F3225',
  bg: '#0B140F',
  white: '#FFFFFF',
  surface: '#16241C',
  ink: '#EAF3EC',
  inkSoft: '#93A69A',
  line: 'rgba(234,243,236,0.14)',
  lineOnDark: 'rgba(255,255,255,0.6)',
  warn: '#E0965B',
  warnPaleBg: '#EDD9C4',
  warnPaleText: '#7A4419',
  info: '#5B9BE0',
  danger: '#E88268',
};
