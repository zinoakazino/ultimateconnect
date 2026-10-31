import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { buildMapHtml } from './mapHtml';
import type { MapEngineProps, MapEvent } from './mapProtocol';

/** The Leaflet map inside an iframe (web build, installed web app). */
export function MapEngine({ state, onEvent }: MapEngineProps) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const ready = useRef(false);
  const latest = useRef(state);
  latest.current = state;
  const handler = useRef(onEvent);
  handler.current = onEvent;

  const html = useMemo(() => buildMapHtml(), []);

  const push = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ __uc: latest.current }, '*');
  }, []);

  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const message = e.data && (e.data.__ucMap as MapEvent | undefined);
      if (!message) return;
      if (message.type === 'ready') {
        ready.current = true;
        push();
      }
      handler.current(message);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [push]);

  useEffect(() => {
    if (ready.current) push();
  }, [state, push]);

  return (
    <View style={StyleSheet.absoluteFill}>
      {React.createElement('iframe', {
        ref: frame,
        srcDoc: html,
        title: 'Carte d’Istanbul',
        style: { border: 0, width: '100%', height: '100%', display: 'block' },
      })}
    </View>
  );
}
