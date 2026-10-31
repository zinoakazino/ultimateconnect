import 'react-native-gesture-handler';
import './src/i18n';
import React, { useCallback, useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
import { UnreadProvider } from './src/context/UnreadContext';
import { LocationSharer } from './src/components/LocationSharer';
import { RootNavigator } from './src/navigation/RootNavigator';
import { fontsToLoad } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const WEB_MAX_WIDTH = 480;

/** On a desktop browser, show the app as a centred phone-width column instead of stretching. */
function WebFrame({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const { isRTL } = useLanguage();
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return <>{children}</>;
  const framed = width > WEB_MAX_WIDTH;
  // `dir` on the root mirrors everything below it while the app is in Arabic (left/right styles and rows flip by themselves).
  // react-native-web understands it; React Native's own View typings do not list it, hence the loose object.
  const direction = { dir: isRTL ? 'rtl' : 'ltr' } as object;
  return (
    <View {...direction} style={[styles.webOuter, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.webColumn,
          framed && { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.line },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function AppShell() {
  const { mode } = useTheme();
  return (
    <AuthProvider>
      <UnreadProvider>
        <LocationSharer />
        <WebFrame>
          <RootNavigator />
        </WebFrame>
      </UnreadProvider>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  webOuter: { flex: 1, alignItems: 'center' },
  webColumn: { flex: 1, width: '100%', maxWidth: WEB_MAX_WIDTH },
});

export default function App() {
  const [fontsLoaded, fontError] = useFonts(fontsToLoad);
  // A font that fails to load must not leave the app blank: fall back to system fonts.
  const ready = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (fontError) console.warn('[fonts] could not load:', fontError.message);
  }, [fontError]);

  const onLayoutRootView = useCallback(async () => {
    if (ready) {
      await SplashScreen.hideAsync();
    }
  }, [ready]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AppShell />
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
