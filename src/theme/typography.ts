import { Platform } from 'react-native';

// Deep imports on purpose: the package roots re-export every weight and italic, which
// would put dozens of unused .ttf files into the app and the web bundle.
import { Jost_400Regular } from '@expo-google-fonts/jost/400Regular';
import { Jost_500Medium } from '@expo-google-fonts/jost/500Medium';
import { Jost_600SemiBold } from '@expo-google-fonts/jost/600SemiBold';
import { Jost_700Bold } from '@expo-google-fonts/jost/700Bold';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';

// On the web a font swaps in a moment after first paint; name a sans-serif fallback so the
// browser doesn't flash its default serif meanwhile. Native needs the bare family name.
const stack = (family: string) =>
  Platform.OS === 'web'
    ? `${family}, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`
    : family;

export const fonts = {
  display: stack('Jost_500Medium'),
  displaySemiBold: stack('Jost_600SemiBold'),
  displayBold: stack('Jost_700Bold'),
  body: stack('Manrope_400Regular'),
  bodyMedium: stack('Manrope_500Medium'),
  bodySemiBold: stack('Manrope_600SemiBold'),
  bodyBold: stack('Manrope_700Bold'),
  bodyExtraBold: stack('Manrope_800ExtraBold'),
  mono: stack('IBMPlexMono_400Regular'),
  monoMedium: stack('IBMPlexMono_500Medium'),
};

export const fontsToLoad = {
  Jost_400Regular,
  Jost_500Medium,
  Jost_600SemiBold,
  Jost_700Bold,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
};
