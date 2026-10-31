import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildMapHtml, injectStateScript, MAP_BASE_URL } from './mapHtml';
import type { MapEngineProps, MapEvent } from './mapProtocol';

/** The Leaflet map inside a WebView (Android and iOS). */
export function MapEngine({ state, onEvent }: MapEngineProps) {
  const webview = useRef<WebView>(null);
  const ready = useRef(false);
  const latest = useRef(state);
  latest.current = state;
  const handler = useRef(onEvent);
  handler.current = onEvent;

  const html = useMemo(() => buildMapHtml(), []);

  const push = useCallback(() => {
    webview.current?.injectJavaScript(injectStateScript(latest.current));
  }, []);

  useEffect(() => {
    if (ready.current) push();
  }, [state, push]);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let message: MapEvent;
      try {
        message = JSON.parse(e.nativeEvent.data) as MapEvent;
      } catch {
        return;
      }
      if (message.type === 'ready') {
        ready.current = true;
        push();
      }
      handler.current(message);
    },
    [push]
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        ref={webview}
        style={styles.web}
        originWhitelist={['*']}
        source={{ html, baseUrl: MAP_BASE_URL }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        setSupportMultipleWindows={false}
        // The OpenStreetMap / Leaflet attribution links open in the phone's browser.
        onShouldStartLoadWithRequest={(request) => {
          const url = request.url;
          if (url.startsWith('about:') || url.startsWith(MAP_BASE_URL) || url.startsWith('data:')) return true;
          if (/^https?:/i.test(url)) Linking.openURL(url).catch(() => {});
          return false;
        }}
        onContentProcessDidTerminate={() => {
          // iOS killed the web content process (memory): start again and re-send everything.
          ready.current = false;
          webview.current?.reload();
        }}
        onRenderProcessGone={() => {
          ready.current = false;
          webview.current?.reload();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: 'transparent' },
});
