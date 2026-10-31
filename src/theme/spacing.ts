export const radii = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 18,
  xxl: 22,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const shadow = {
  card: {
    shadowColor: '#0F3225',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
} as const;
