import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useIsFocused, type CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { pickText } from '../../lib/localized';
import { HelpButton } from '../../components/GuideModal';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ChatThread } from '../../components/ChatThread';
import { EmergencyButton } from '../../features/istanbul/components/MapOverlays';
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
import type { ConsultantStackParamList, ConsultantTabParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<ConsultantTabParamList, 'Chat'>,
  NativeStackScreenProps<ConsultantStackParamList>
>;

export function ChatScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { profile, authUser } = useAuth();
  const { trip } = useTrip();
  const { messages } = useMessages(GROUP_MESSAGES);
  const { locked } = useChatLock();
  const { unreadThreadIds, markGroupRead } = useUnread();
  const focused = useIsFocused();

  // Reading the chat (including messages that arrive while it's open) clears the badge.
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
          {trip ? pickText(trip.name, trip.nameAr, i18n.language) : t('chat.groupDefault')}
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.inboxBtn}
            onPress={() => navigation.navigate('DmInbox')}
            accessibilityLabel={t('chat.privateMessages') ?? undefined}
            hitSlop={8}
          >
            <Feather name="mail" size={14} color={colors.white} />
            {unreadThreadIds.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadThreadIds.length}</Text>
              </View>
            )}
          </Pressable>
          <HelpButton guide="chat" />
          <EmergencyButton compact />
        </View>
      </View>
      <View style={styles.body}>
        <ChatThread
          messages={messages}
          currentUid={authUser?.uid ?? ''}
          locked={locked}
          onSend={onSend}
        />
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
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    title: {
      flex: 1,
      fontFamily: fonts.display,
      fontSize: 16,
      color: colors.white,
    },
    inboxBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1.4,
      borderColor: 'rgba(255,255,255,0.5)',
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      top: -5,
      right: -5,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 4,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      fontFamily: fonts.bodyBold,
      fontSize: 9,
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
