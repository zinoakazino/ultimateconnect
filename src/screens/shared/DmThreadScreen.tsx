import React, { useEffect } from 'react';
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useIsFocused } from '@react-navigation/native';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Brandmark } from '../../components/Brandmark';
import { ChatThread } from '../../components/ChatThread';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useUnread } from '../../context/UnreadContext';
import { dmMessages, useMessages } from '../../hooks/useMessages';
import { dmThreadExists, sendDirectMessage } from '../../lib/api';
import { toDate } from '../../lib/dates';
import { useLive } from '../../lib/live';
import { fonts, spacing } from '../../theme';
import type { Colors } from '../../theme';
import type { DmThreadParams } from '../../navigation/types';

interface Props {
  route: { params: DmThreadParams };
  navigation: { goBack: () => void };
}

/** One 1:1 conversation. Shared by staff (who start threads) and consultants (who reply). */
export function DmThreadScreen({ route, navigation }: Props) {
  const p = route.params;
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { profile } = useAuth();
  const { markThreadRead } = useUnread();
  const focused = useIsFocused();

  // The thread only exists once staff send the first message: nothing to load before that.
  const { data: exists } = useLive<boolean>(() => dmThreadExists(p.threadId), false, [p.threadId], {
    tables: ['dm_threads'],
    poll: 5000,
  });

  const { messages } = useMessages(exists ? dmMessages(p.threadId) : null);

  const newestMs = toDate(messages[0]?.createdAt)?.getTime();
  useEffect(() => {
    if (focused && exists) markThreadRead(p.threadId, newestMs);
  }, [focused, exists, newestMs, p.threadId, markThreadRead]);

  const onSend = async (text: string) => {
    if (!profile) return;
    await sendDirectMessage({ staffId: p.staffId, consultantId: p.consultantId, text });
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']} background={colors.greenDeep}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Feather
            name={I18nManager.isRTL ? 'arrow-right' : 'arrow-left'}
            size={18}
            color={colors.white}
          />
        </Pressable>
        <Brandmark size="sm" onDark letter={p.title.charAt(0).toUpperCase()} />
        <Text style={styles.title} numberOfLines={1}>
          {p.title}
        </Text>
      </View>
      <View style={styles.body}>
        <ChatThread messages={messages} currentUid={profile?.uid ?? ''} onSend={onSend} />
      </View>
    </ScreenContainer>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    title: {
      flex: 1,
      fontFamily: fonts.display,
      fontSize: 16,
      color: colors.white,
    },
    body: {
      flex: 1,
      backgroundColor: colors.bg,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      overflow: 'hidden',
    },
  });
}
