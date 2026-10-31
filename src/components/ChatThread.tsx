import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { fonts, radii, spacing } from '../theme';
import type { Colors } from '../theme';
import type { MessageDoc } from '../types/models';

import { useLanguage } from '../context/LanguageContext';
interface ChatThreadProps {
  messages: MessageDoc[];
  currentUid: string;
  locked?: boolean;
  lockedMessage?: string;
  onSend: (text: string) => Promise<void> | void;
}

export function ChatThread({ messages, currentUid, locked, lockedMessage, onSend }: ChatThreadProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isRTL } = useLanguage();
  const styles = makeStyles(colors);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    try {
      await onSend(trimmed);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('chat.threadEmpty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <MessageBubble message={item} isMine={item.senderId === currentUid} colors={colors} />
        )}
      />

      {locked ? (
        <View style={styles.lockedBar}>
          <Feather name="lock" size={13} color={colors.greenDeep} />
          <Text style={styles.lockedText}>
            {lockedMessage ?? t('chat.chatClosedDefault')}
          </Text>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={t('chat.messagePlaceholder') ?? ''}
            placeholderTextColor={colors.inkSoft}
            multiline
          />
          <Pressable style={styles.sendBtn} onPress={handleSend} disabled={sending}>
            <Feather
              name={isRTL ? 'arrow-left' : 'arrow-right'}
              size={16}
              color={colors.white}
            />
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function MessageBubble({
  message,
  isMine,
  colors,
}: {
  message: MessageDoc;
  isMine: boolean;
  colors: Colors;
}) {
  const { t } = useTranslation();
  const styles = makeStyles(colors);
  const isStaff = message.senderRole === 'staff';
  // "Mine" aligns to the end of the reading direction: right in LTR, left in RTL.
  const mineFlexDirection = 'row-reverse';
  return (
    <View style={[styles.row, isMine && { flexDirection: mineFlexDirection }]}>
      {!isMine && (
        <View style={[styles.avatar, isStaff && styles.avatarStaff]}>
          <Text style={styles.avatarLetter}>{message.senderName.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMe : isStaff ? styles.bubbleStaff : styles.bubbleOther,
        ]}
      >
        {!isMine && (
          <Text style={[styles.tagline, isStaff && styles.taglineStaff]}>
            {message.senderName}
            {isStaff ? t('chat.staffTag') : ''}
          </Text>
        )}
        <Text
          style={[
            styles.bubbleText,
            isMine && styles.bubbleTextMe,
            !isMine && isStaff && styles.bubbleTextStaff,
          ]}
        >
          {message.text}
        </Text>
      </View>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    list: {
      padding: spacing.lg,
      gap: spacing.sm,
    },
    // The list is inverted, which flips its empty state too — flip it back.
    empty: {
      transform: [{ scaleY: -1 }],
      alignItems: 'center',
      paddingVertical: spacing.xxl,
    },
    emptyText: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.inkSoft,
      textAlign: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    avatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarStaff: {
      backgroundColor: colors.greenDeep,
    },
    avatarLetter: {
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      color: colors.white,
    },
    bubble: {
      maxWidth: '74%',
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: radii.lg,
    },
    bubbleMe: {
      backgroundColor: colors.green,
      borderBottomRightRadius: 4,
    },
    bubbleStaff: {
      backgroundColor: colors.greenPale,
      borderBottomLeftRadius: 4,
    },
    bubbleOther: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderBottomLeftRadius: 4,
    },
    tagline: {
      fontFamily: fonts.mono,
      fontSize: 8.5,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.inkSoft,
      marginBottom: 3,
    },
    taglineStaff: {
      color: colors.greenDeep,
      opacity: 0.75,
    },
    bubbleText: {
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 18,
      color: colors.ink,
    },
    bubbleTextMe: {
      color: colors.white,
    },
    // Staff bubbles sit on the pale green surface, which stays light in dark mode.
    bubbleTextStaff: {
      color: colors.greenDeep,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.ink,
      maxHeight: 100,
    },
    sendBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lockedBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      backgroundColor: colors.greenPale,
    },
    lockedText: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.greenDeep,
    },
  });
}
