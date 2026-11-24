// Daily Goals screen for setting daily steps, calories, and water intake targets

import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getDailyGoals, saveDailyGoals } from '../database/healthDb';
import { parsePositiveNumber } from '../utils/validation';
import AppIcon from '../components/AppIcon';
import CommonButton from '../components/CommonButton';

export default function GoalsScreen({ navigation }: any) {
  const { currentUser } = useAuth();
  const { colors, isDark } = useTheme();

  const [stepsGoal, setStepsGoal] = useState<string>('8000');
  const [caloriesGoal, setCaloriesGoal] = useState<string>('2000');
  const [waterGoal, setWaterGoal] = useState<string>('2000');

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadSavedGoals() {
    if (!currentUser) {
      return;
    }

    try {
      const saved = await getDailyGoals(currentUser.id);
      setStepsGoal(String(saved.steps));
      setCaloriesGoal(String(saved.calories));
      setWaterGoal(String(saved.water));
    } catch {
      setErrorMessage('Could not load saved daily goals.');
    }
  }

  useEffect(() => {
    loadSavedGoals();

    const unsubscribe = navigation.addListener('focus', () => {
      setErrorMessage(null);
      setSuccessMessage(null);
      loadSavedGoals();
    });

    return unsubscribe;
  }, [navigation, currentUser?.id]);

  async function handleSaveGoals() {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentUser) {
      setErrorMessage('You must be logged in to save daily goals.');
      return;
    }

    const steps = parsePositiveNumber(stepsGoal);
    if (steps === null) {
      setErrorMessage('Steps goal must be a whole number greater than 0.');
      return;
    }

    const calories = parsePositiveNumber(caloriesGoal);
    if (calories === null) {
      setErrorMessage('Calories goal must be a whole number greater than 0.');
      return;
    }

    const water = parsePositiveNumber(waterGoal);
    if (water === null) {
      setErrorMessage('Water intake goal must be a whole number greater than 0.');
      return;
    }

    try {
      setSaving(true);
      await saveDailyGoals(currentUser.id, steps, calories, water);
      setSuccessMessage('Daily targets saved! Your Dashboard progress is updated.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not save daily goals.';
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Daily Goals</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Set activity and hydration targets to visualize progress on your Dashboard.
            </Text>
          </View>

          {errorMessage ? (
            <View
              style={[
                styles.banner,
                { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
              ]}
            >
              <AppIcon name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={[styles.bannerText, { color: colors.error }]}>{errorMessage}</Text>
            </View>
          ) : null}

          {successMessage ? (
            <View
              style={[
                styles.banner,
                { backgroundColor: colors.statusSuccessBg, borderColor: colors.cardBorder },
              ]}
            >
              <AppIcon name="checkmark-circle" size={18} color={colors.statusSuccessText} />
              <Text style={[styles.bannerText, { color: colors.statusSuccessText }]}>
                {successMessage}
              </Text>
            </View>
          ) : null}

          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            {/* Steps Goal */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <View style={styles.labelLeft}>
                  <View style={[styles.iconPill, { backgroundColor: colors.primaryLight }]}>
                    <AppIcon name="walk-outline" size={16} color={colors.stepRing} />
                  </View>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                    DAILY STEPS TARGET
                  </Text>
                </View>
                <View
                  style={[
                    styles.unitBadge,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.surfaceBorder },
                  ]}
                >
                  <Text style={[styles.unitText, { color: colors.textSubtle }]}>steps</Text>
                </View>
              </View>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  },
                ]}
                value={stepsGoal}
                onChangeText={(text) => {
                  setStepsGoal(text);
                  setSuccessMessage(null);
                }}
                placeholder="e.g. 8000"
                placeholderTextColor={colors.textSubtle}
                keyboardType="numeric"
                editable={!saving}
              />
            </View>

            {/* Calories Goal */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <View style={styles.labelLeft}>
                  <View style={[styles.iconPill, { backgroundColor: colors.caloriesBg }]}>
                    <AppIcon name="flame-outline" size={16} color={colors.calories} />
                  </View>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                    DAILY CALORIES TARGET
                  </Text>
                </View>
                <View
                  style={[
                    styles.unitBadge,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.surfaceBorder },
                  ]}
                >
                  <Text style={[styles.unitText, { color: colors.textSubtle }]}>kcal</Text>
                </View>
              </View>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  },
                ]}
                value={caloriesGoal}
                onChangeText={(text) => {
                  setCaloriesGoal(text);
                  setSuccessMessage(null);
                }}
                placeholder="e.g. 2000"
                placeholderTextColor={colors.textSubtle}
                keyboardType="numeric"
                editable={!saving}
              />
            </View>

            {/* Water Goal */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <View style={styles.labelLeft}>
                  <View style={[styles.iconPill, { backgroundColor: colors.waterBg }]}>
                    <AppIcon name="water-outline" size={16} color={colors.water} />
                  </View>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                    DAILY WATER TARGET
                  </Text>
                </View>
                <View
                  style={[
                    styles.unitBadge,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.surfaceBorder },
                  ]}
                >
                  <Text style={[styles.unitText, { color: colors.textSubtle }]}>ml</Text>
                </View>
              </View>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  },
                ]}
                value={waterGoal}
                onChangeText={(text) => {
                  setWaterGoal(text);
                  setSuccessMessage(null);
                }}
                placeholder="e.g. 2000"
                placeholderTextColor={colors.textSubtle}
                keyboardType="numeric"
                editable={!saving}
              />
            </View>

            <CommonButton
              title="Save Daily Goals"
              iconName="save-outline"
              onPress={handleSaveGoals}
              loading={saving}
              style={styles.saveButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconPill: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  unitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  unitText: {
    fontSize: 11,
    fontWeight: '700',
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 8,
  },
});

