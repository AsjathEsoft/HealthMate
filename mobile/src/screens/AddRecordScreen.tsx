// Screen for adding a new daily health record or editing an existing one

import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  HealthRecord,
  addHealthRecord,
  updateHealthRecord,
} from '../database/healthDb';
import { formatIsoDate, formatDisplayDate, parseLocalDate } from '../utils/dateHelper';
import { isValidCalendarDate, parseWholeNumber } from '../utils/validation';
import AppIcon from '../components/AppIcon';
import CommonButton from '../components/CommonButton';

export default function AddRecordScreen({ route, navigation }: any) {
  const existingRecord: HealthRecord | undefined = route.params?.record;
  const isEditing = Boolean(existingRecord);

  const { currentUser } = useAuth();
  const { colors, isDark } = useTheme();

  const [selectedDate, setSelectedDate] = useState<string>(
    existingRecord?.date || route.params?.initialDate || formatIsoDate(new Date())
  );
  const [steps, setSteps] = useState<string>(
    existingRecord ? String(existingRecord.steps) : ''
  );
  const [calories, setCalories] = useState<string>(
    existingRecord ? String(existingRecord.calories) : ''
  );
  const [waterIntake, setWaterIntake] = useState<string>(
    existingRecord ? String(existingRecord.water) : ''
  );

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  const pickerDate = parseLocalDate(selectedDate);

  function handleDateChange(event: DateTimePickerEvent, chosenDate?: Date) {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'set' && chosenDate) {
      setSelectedDate(formatIsoDate(chosenDate));
    }
  }

  async function handleSave() {
    setErrorMessage(null);

    if (!currentUser) {
      setErrorMessage('You must be logged in to save a health record.');
      return;
    }

    if (!isValidCalendarDate(selectedDate)) {
      setErrorMessage('Please select a valid calendar date.');
      return;
    }

    if (steps.trim() === '') {
      setErrorMessage('Steps walked is required. (Enter 0 if none)');
      return;
    }
    const parsedSteps = parseWholeNumber(steps);
    if (parsedSteps === null) {
      setErrorMessage('Steps walked must be a whole number (no decimals or symbols).');
      return;
    }

    if (calories.trim() === '') {
      setErrorMessage('Calories burned is required. (Enter 0 if none)');
      return;
    }
    const parsedCalories = parseWholeNumber(calories);
    if (parsedCalories === null) {
      setErrorMessage('Calories burned must be a whole number (no decimals or symbols).');
      return;
    }

    if (waterIntake.trim() === '') {
      setErrorMessage('Water intake is required. (Enter 0 if none)');
      return;
    }
    const parsedWater = parseWholeNumber(waterIntake);
    if (parsedWater === null) {
      setErrorMessage('Water intake must be a whole number (no decimals or symbols).');
      return;
    }

    try {
      setSaving(true);

      if (isEditing && existingRecord) {
        await updateHealthRecord(
          existingRecord.id,
          currentUser.id,
          selectedDate,
          parsedSteps,
          parsedCalories,
          parsedWater
        );
      } else {
        await addHealthRecord(
          currentUser.id,
          selectedDate,
          parsedSteps,
          parsedCalories,
          parsedWater
        );
      }

      navigation.goBack();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save health record.';
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['bottom', 'left', 'right']}
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
          {/* Screen Title */}
          <View style={styles.headerBlock}>
            <Text style={[styles.screenTitle, { color: colors.text }]}>
              {isEditing ? 'Edit Health Record' : 'Log Health Activity'}
            </Text>
            <Text style={[styles.screenSubtitle, { color: colors.textMuted }]}>
              {isEditing
                ? 'Update your recorded steps, calories, and hydration metrics.'
                : 'Log daily health metrics. Stored securely on your device.'}
            </Text>
          </View>

          {errorMessage ? (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
              ]}
            >
              <AppIcon name="alert-circle-outline" size={20} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Form Card */}
          <View
            style={[
              styles.formCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            {/* Date Picker */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>RECORD DATE</Text>
              <TouchableOpacity
                style={[
                  styles.dateSelector,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                ]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
                accessibilityLabel="Select record date"
              >
                <View style={styles.dateSelectorLeft}>
                  <View style={[styles.fieldIconPill, { backgroundColor: colors.primaryLight }]}>
                    <AppIcon name="calendar-outline" size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.dateSelectorText, { color: colors.text }]}>
                    {formatDisplayDate(pickerDate)}
                  </Text>
                </View>
                <View style={styles.dateSelectorRight}>
                  <Text style={[styles.dateIsoTag, { color: colors.textSubtle }]}>
                    {selectedDate}
                  </Text>
                  <AppIcon name="chevron-down" size={16} color={colors.textSubtle} />
                </View>
              </TouchableOpacity>
            </View>

            {showDatePicker ? (
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date(2099, 11, 31)}
              />
            ) : null}

            {/* Steps Input */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <View style={styles.labelTitleGroup}>
                  <View style={[styles.fieldIconPill, { backgroundColor: colors.primaryLight }]}>
                    <AppIcon name="walk-outline" size={15} color={colors.stepRing} />
                  </View>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>STEPS WALKED</Text>
                </View>
                <View
                  style={[
                    styles.unitPill,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.surfaceBorder },
                  ]}
                >
                  <Text style={[styles.unitTag, { color: colors.textSubtle }]}>steps</Text>
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
                value={steps}
                onChangeText={setSteps}
                placeholder="e.g. 8000 (or 0)"
                placeholderTextColor={colors.textSubtle}
                keyboardType="numeric"
                editable={!saving}
              />
            </View>

            {/* Calories Input */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <View style={styles.labelTitleGroup}>
                  <View style={[styles.fieldIconPill, { backgroundColor: colors.caloriesBg }]}>
                    <AppIcon name="flame-outline" size={15} color={colors.calories} />
                  </View>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                    CALORIES BURNED
                  </Text>
                </View>
                <View
                  style={[
                    styles.unitPill,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.surfaceBorder },
                  ]}
                >
                  <Text style={[styles.unitTag, { color: colors.textSubtle }]}>kcal</Text>
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
                value={calories}
                onChangeText={setCalories}
                placeholder="e.g. 2000 (or 0)"
                placeholderTextColor={colors.textSubtle}
                keyboardType="numeric"
                editable={!saving}
              />
            </View>

            {/* Water Intake Input */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <View style={styles.labelTitleGroup}>
                  <View style={[styles.fieldIconPill, { backgroundColor: colors.waterBg }]}>
                    <AppIcon name="water-outline" size={15} color={colors.water} />
                  </View>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>WATER INTAKE</Text>
                </View>
                <View
                  style={[
                    styles.unitPill,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.surfaceBorder },
                  ]}
                >
                  <Text style={[styles.unitTag, { color: colors.textSubtle }]}>ml</Text>
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
                value={waterIntake}
                onChangeText={setWaterIntake}
                placeholder="e.g. 2000 (or 0)"
                placeholderTextColor={colors.textSubtle}
                keyboardType="numeric"
                editable={!saving}
              />
            </View>
          </View>

          {/* Save and Cancel Buttons */}
          <View style={styles.actionContainer}>
            <CommonButton
              title={isEditing ? 'Update Health Record' : 'Save Health Record'}
              iconName="save-outline"
              onPress={handleSave}
              loading={saving}
            />

            <TouchableOpacity
              style={[
                styles.cancelButton,
                { borderColor: colors.cardBorder, backgroundColor: colors.surfaceSecondary },
              ]}
              onPress={() => navigation.goBack()}
              disabled={saving}
              activeOpacity={0.7}
              accessibilityLabel="Cancel editing"
            >
              <Text style={[styles.cancelButtonText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
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
    paddingTop: 12,
    paddingBottom: 40,
  },
  headerBlock: {
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  formCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldIconPill: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  unitTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  dateSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateSelectorRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateSelectorText: {
    fontSize: 15,
    fontWeight: '700',
  },
  dateIsoTag: {
    fontSize: 12,
    fontWeight: '500',
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  actionContainer: {
    gap: 12,
  },
  cancelButton: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
});

