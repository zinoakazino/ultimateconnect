import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ChatThread } from '../../components/ChatThread';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useUnread } from '../../context/UnreadContext';
import { GROUP_MESSAGES, useMessages } from '../../hooks/useMessages';
import { useChatLock } from '../../hooks/useChatLock';
import { useTrip } from '../../hooks/useTrip';
import { sendGroupMessage } from '../../lib/api';
import { toDate } from '../../lib/dates';
import { fonts, spacing } from '../../theme';
import type { Colors } from '../../theme';

export function StaffChatScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { profile, authUser } = useAuth();
  const { trip } = useTrip();
  const { messages } = useMessages(GROUP_MESSAGES);
  const { locked, setLock } = useChatLock();
  const { markGroupRead } = useUnread();
  const focused = useIsFocused();

  const newestMs = toDate(messages[0]?.createdAt)?.getTime();
  useEffect(() => {
    if (focused) markGroupRead(newestMs);
  }, [focused, newestMs, markGroupRead]);

  const onSend = async (text: string) => {
    if (!profile) return;
    await sendGroupMessage(text);
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']} background={colors.greenDeep}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {trip?.name ?? t('chat.groupDefault')}
        </Text>
        <Pressable
          style={[styles.lockBtn, locked && styles.lockBtnOn]}
          onPress={() => authUser && setLock(!locked, authUser.uid)}
          accessibilityLabel={
            (locked ? t('staffBroadcast.chatClosedTitle') : t('staffBroadcast.chatOpenTitle')) ??
            undefined
          }
          hitSlop={8}
        >
          <Feather name={locked ? 'lock' : 'unlock'} size={14} color={colors.white} />
        </Pressable>
      </View>
      <View style={styles.body}>
        {/* Staff can always post — the lock only blocks consultants (enforced by the
            database rules too), so `locked` is deliberately not passed to the thread. */}
        <ChatThread messages={messages} currentUid={authUser?.uid ?? ''} onSend={onSend} />
      </View>
    </ScreenContainer>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
    lockBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1.4,
      borderColor: 'rgba(255,255,255,0.5)',
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    lockBtnOn: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
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
