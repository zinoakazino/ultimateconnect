import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useUnread } from '../../context/UnreadContext';
import { useDmThreads } from '../../hooks/useDmThreads';
import { timeAgo } from '../../lib/dates';
import { fonts, spacing } from '../../theme';
import type { Colors } from '../../theme';
import type { ConsultantStackParamList } from '../../navigation/types';

import { useLanguage } from '../../context/LanguageContext';
type Props = NativeStackScreenProps<ConsultantStackParamList, 'DmInbox'>;

/** Private messages from staff. Consultants reply here; staff are the ones who start threads. */
export function DmInboxScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isRTL } = useLanguage();
  const styles = makeStyles(colors);
  const { authUser } = useAuth();
  const threads = useDmThreads(authUser?.uid);
  const { unreadThreadIds } = useUnread();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Feather
            name={isRTL ? 'arrow-right' : 'arrow-left'}
            size={18}
            color={colors.ink}
          />
        </Pressable>
        <Text style={styles.title}>{t('chat.privateMessages')}</Text>
        <View style={{ width: 18 }} />
      </View>

      <FlatList
        data={threads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{t('chat.inboxEmpty')}</Text>}
        renderItem={({ item }) => {
          const unread = unreadThreadIds.includes(item.id);
          return (
            <Pressable
              style={styles.row}
              onPress={() =>
                navigation.navigate('DmThread', {
                  threadId: item.id,
                  title: item.staffName,
                  staffId: item.staffId,
                  staffName: item.staffName,
                  consultantId: item.consultantId,
                  consultantName: item.consultantName,
                })
              }
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>{item.staffName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, unread && styles.nameUnread]}>{item.staffName}</Text>
                <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
              </View>
              <Text style={styles.time}>{timeAgo(item.lastMessageAt)}</Text>
              {unread && <View style={styles.dot} />}
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 17,
      color: colors.ink,
    },
    list: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
      flexGrow: 1,
    },
    empty: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.inkSoft,
      textAlign: 'center',
      paddingVertical: spacing.xxl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.greenDeep,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarLetter: {
      fontFamily: fonts.display,
      fontSize: 14,
      color: colors.white,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.ink,
    },
    nameUnread: {
      fontFamily: fonts.bodyExtraBold,
    },
    preview: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.inkSoft,
      marginTop: 2,
    },
    previewUnread: {
      color: colors.ink,
      fontFamily: fonts.bodySemiBold,
    },
    time: {
      fontFamily: fonts.mono,
      fontSize: 8.5,
      color: colors.inkSoft,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.danger,
    },
  });
}
