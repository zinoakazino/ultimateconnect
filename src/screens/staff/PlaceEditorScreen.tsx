import React, { useEffect, useState } from 'react';
import { I18nManager, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/ScreenContainer';
import { FormField } from '../../components/FormField';
import { Button } from '../../components/Button';
import { SectionLabel } from '../../components/SectionLabel';
import { useTheme } from '../../context/ThemeContext';
import { usePlaces } from '../../hooks/usePlaces';
import { deletePlace, savePlace } from '../../lib/api';
import { parseCoordinates } from '../../lib/maps';
import { fonts, radii, spacing } from '../../theme';
import type { Colors } from '../../theme';
import type { StaffStackParamList } from '../../navigation/types';
import type { PlaceCategory } from '../../types/models';
import { GUIDE_SECTIONS } from '../consultant/TripGuideScreen';

type Props = NativeStackScreenProps<StaffStackParamList, 'PlaceEditor'>;

export function PlaceEditorScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { places } = usePlaces();
  const placeId = route.params?.placeId;
  const existing = placeId ? places.find((p) => p.id === placeId) : undefined;

  const [category, setCategory] = useState<PlaceCategory>('recommended');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [coords, setCoords] = useState('');
  const [hydrated, setHydrated] = useState(!placeId);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated || !existing) return;
    setCategory(existing.category);
    setName(existing.name);
    setDescription(existing.description ?? '');
    setAddress(existing.address ?? '');
    setPhone(existing.phone ?? '');
    setCoords(
      existing.lat !== undefined && existing.lng !== undefined
        ? `${existing.lat}, ${existing.lng}`
        : ''
    );
    setHydrated(true);
  }, [existing, hydrated]);

  const onSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError(t('manage.nameRequired'));
      return;
    }
    let lat: number | undefined;
    let lng: number | undefined;
    if (coords.trim()) {
      const parsed = parseCoordinates(coords);
      if (!parsed) {
        setError(t('manage.coordinatesInvalid'));
        return;
      }
      lat = parsed.lat;
      lng = parsed.lng;
    }
    setSaving(true);
    try {
      // The whole row is rewritten, so a field cleared in the form is really removed.
      await savePlace(placeId ?? null, {
        category,
        name: name.trim(),
        description: description.trim(),
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
      });
      navigation.goBack();
    } catch {
      setError(t('auth.errorGeneric'));
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!placeId) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deletePlace(placeId);
      navigation.goBack();
    } catch {
      setError(t('auth.errorGeneric'));
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Feather
            name={I18nManager.isRTL ? 'arrow-right' : 'arrow-left'}
            size={18}
            color={colors.ink}
          />
        </Pressable>
        <Text style={styles.title}>
          {placeId ? t('manage.editPlace') : t('manage.newPlace')}
        </Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <SectionLabel style={styles.firstLabel}>{t('manage.category')}</SectionLabel>
        <View style={styles.pillWrap}>
          {GUIDE_SECTIONS.map((s) => (
            <Pressable
              key={s.key}
              style={[styles.pill, category === s.key && styles.pillOn]}
              onPress={() => setCategory(s.key)}
            >
              <Text style={[styles.pillText, category === s.key && styles.pillTextOn]}>
                {t(s.titleKey)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.fields}>
          <FormField label={t('manage.name')} value={name} onChangeText={setName} />
          <FormField
            label={t('manage.description')}
            value={description}
            onChangeText={setDescription}
            multiline
            style={styles.multiline}
          />
          <FormField label={t('manage.address')} value={address} onChangeText={setAddress} />
          <FormField
            label={t('manage.phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <FormField
            label={t('manage.coordinates')}
            value={coords}
            onChangeText={setCoords}
            placeholder="41.0082, 28.9784"
            autoCapitalize="none"
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label={t('manage.save')} onPress={onSave} loading={saving} />

        {placeId ? (
          <Button
            label={confirmDelete ? t('manage.confirmDelete') : t('manage.delete')}
            variant="outline"
            onPress={onDelete}
            style={styles.deleteBtn}
          />
        ) : null}
      </ScrollView>
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
    scroll: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    firstLabel: {
      marginTop: 2,
    },
    pillWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    pill: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
    },
    pillOn: {
      backgroundColor: colors.green,
      borderColor: colors.green,
    },
    pillText: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.inkSoft,
    },
    pillTextOn: {
      color: colors.white,
    },
    fields: {
      marginTop: spacing.lg,
    },
    multiline: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    error: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: colors.danger,
      marginBottom: spacing.sm,
    },
    deleteBtn: {
      marginTop: spacing.md,
    },
  });
}
