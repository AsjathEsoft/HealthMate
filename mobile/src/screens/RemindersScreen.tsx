// Reminders screen for scheduling daily water and health logging notifications

import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Switch,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  DEFAULT_REMINDER_SETTINGS,
  getReminderSettings,
  saveReminderSettings,
} from '../database/userDb';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  scheduleReminderNotifications,
  sendTestNotificationNow,
} from '../utils/notifications';
import AppIcon from '../components/AppIcon';
import CommonButton from '../components/CommonButton';

type PickerSlot = 'water1' | 'water2' | 'water3' | 'daily' | null;

export default function RemindersScreen({ navigation }: any) {
  const { currentUser } = useAuth();
  const { colors, isDark } = useTheme();

  const [waterEnabled, setWaterEnabled] = useState(DEFAULT_REMINDER_SETTINGS.waterEnabled);
  const [waterTime1, setWaterTime1] = useState(DEFAULT_REMINDER_SETTINGS.waterTime1);
  const [waterTime2, setWaterTime2] = useState(DEFAULT_REMINDER_SETTINGS.waterTime2);
  const [waterTime3, setWaterTime3] = useState(DEFAULT_REMINDER_SETTINGS.waterTime3);
  const [dailyEnabled, setDailyEnabled] = useState(DEFAULT_REMINDER_SETTINGS.dailyEnabled);
  const [dailyTime, setDailyTime] = useState(DEFAULT_REMINDER_SETTINGS.dailyTime);
  const [scheduledIds, setScheduledIds] = useState<string[]>([]);

  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>(
    'undetermined'
  );
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const [pickerTarget, setPickerTarget] = useState<PickerSlot>(null);
  const [pickerDate, setPickerDate] = useState<Date>(new Date());

  async function loadSavedReminders() {
    if (!currentUser) {
      return;
    }

    try {
      const saved = await getReminderSettings(currentUser.id);
      setWaterEnabled(saved.waterEnabled);
      setWaterTime1(saved.waterTime1);
      setWaterTime2(saved.waterTime2);
      setWaterTime3(saved.waterTime3);
      setDailyEnabled(saved.dailyEnabled);
      setDailyTime(saved.dailyTime);
      setScheduledIds(saved.scheduledIds);

      const status = await getNotificationPermissionStatus();
      setPermissionStatus(status);
    } catch {
      setErrorMessage('Could not load saved reminder settings.');
    }
  }

  useEffect(() => {
    loadSavedReminders();

    const unsubscribe = navigation.addListener('focus', () => {
      loadSavedReminders();
    });

    return unsubscribe;
  }, [navigation, currentUser?.id]);

  // Convert "HH:mm" into a Date object for the native time picker
  function convertTimeToDate(timeText: string): Date {
    const parts = timeText.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const date = new Date();
    date.setHours(isNaN(hours) ? 9 : hours, isNaN(minutes) ? 0 : minutes, 0, 0);
    return date;
  }

  function handleOpenTimePicker(slot: PickerSlot, currentTime: string) {
    setErrorMessage(null);
    setFeedbackMessage(null);
    setPickerTarget(slot);
    setPickerDate(convertTimeToDate(currentTime));
  }

  function handleTimeChange(event: DateTimePickerEvent, chosenDate?: Date) {
    if (Platform.OS === 'android') {
      setPickerTarget(null);
    }

    if (event.type === 'dismissed' || !chosenDate) {
      setPickerTarget(null);
      return;
    }

    const hours = String(chosenDate.getHours()).padStart(2, '0');
    const minutes = String(chosenDate.getMinutes()).padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

    if (pickerTarget === 'water1') setWaterTime1(timeString);
    if (pickerTarget === 'water2') setWaterTime2(timeString);
    if (pickerTarget === 'water3') setWaterTime3(timeString);
    if (pickerTarget === 'daily') setDailyTime(timeString);

    setPickerTarget(null);
  }

  // Ensure notification permission is granted before turning reminders on
  async function ensurePermissionGranted(): Promise<boolean> {
    let status = await getNotificationPermissionStatus();
    if (status !== 'granted') {
      const granted = await requestNotificationPermission();
      status = granted ? 'granted' : 'denied';
      setPermissionStatus(status);
    }

    if (status !== 'granted') {
      setErrorMessage('Notification permission is required to enable daily reminders.');
      return false;
    }

    return true;
  }

  // Save reminder settings to SQLite and update device notifications
  async function applyReminderSchedule(
    nextWaterEnabled: boolean,
    nextDailyEnabled: boolean,
    successText: string
  ): Promise<boolean> {
    if (!currentUser) {
      return false;
    }

    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      setSaving(true);

      if (nextWaterEnabled || nextDailyEnabled) {
        const hasPermission = await ensurePermissionGranted();
        if (!hasPermission) {
          return false;
        }
      }

      const newIds = await scheduleReminderNotifications(
        nextWaterEnabled,
        [waterTime1, waterTime2, waterTime3],
        nextDailyEnabled,
        dailyTime,
        scheduledIds
      );

      await saveReminderSettings(currentUser.id, {
        waterEnabled: nextWaterEnabled,
        waterTime1,
        waterTime2,
        waterTime3,
        dailyEnabled: nextDailyEnabled,
        dailyTime,
        scheduledIds: newIds,
      });

      setScheduledIds(newIds);
      setFeedbackMessage(successText);
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update reminder settings.';
      setErrorMessage(message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleWater(value: boolean) {
    setWaterEnabled(value);
    const saved = await applyReminderSchedule(
      value,
      dailyEnabled,
      value ? 'Water reminders activated.' : 'Water reminders turned off.'
    );
    if (!saved) {
      setWaterEnabled(!value);
    }
  }

  async function handleToggleDaily(value: boolean) {
    setDailyEnabled(value);
    const saved = await applyReminderSchedule(
      waterEnabled,
      value,
      value ? 'Daily logging reminder activated.' : 'Daily reminder turned off.'
    );
    if (!saved) {
      setDailyEnabled(!value);
    }
  }

  async function handleSaveScheduleTimes() {
    await applyReminderSchedule(
      waterEnabled,
      dailyEnabled,
      'Reminder schedule updated successfully!'
    );
  }

  async function handleSendTest() {
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      setSaving(true);
      const hasPermission = await ensurePermissionGranted();
      if (!hasPermission) {
        return;
      }

      await sendTestNotificationNow();
      setFeedbackMessage('Test notification sent! Check your notification tray or banner.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to send test notification.';
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenDeviceSettings() {
    try {
      await Linking.openSettings();
    } catch {
      setErrorMessage('Could not open device notification settings.');
    }
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['bottom', 'left', 'right']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Reminders</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Schedule local notifications to stay hydrated and record daily activity on time.
          </Text>
        </View>

        {/* Permission Status */}
        {permissionStatus === 'denied' ? (
          <View
            style={[
              styles.permissionCard,
              { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
            ]}
          >
            <View style={styles.permissionHeader}>
              <AppIcon name="alert-circle-outline" size={20} color={colors.error} />
              <Text style={[styles.permissionTitle, { color: colors.error }]}>
                Notification Permission Blocked
              </Text>
            </View>
            <Text style={[styles.permissionBody, { color: colors.textMuted }]}>
              Notifications are currently disabled for HealthMate in device settings. Reminders
              cannot trigger until permission is granted.
            </Text>
            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: colors.error }]}
              onPress={handleOpenDeviceSettings}
              activeOpacity={0.8}
            >
              <Text style={styles.permissionButtonText}>Open Device Settings</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={[
              styles.permissionStatusPill,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.surfaceBorder },
            ]}
          >
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    permissionStatus === 'granted' ? colors.success : colors.warning,
                },
              ]}
            />
            <Text style={[styles.pillText, { color: colors.textMuted }]}>
              Permission: {permissionStatus === 'granted' ? 'Allowed' : 'Not Requested Yet'}
            </Text>
          </View>
        )}

        {feedbackMessage ? (
          <View
            style={[
              styles.banner,
              { backgroundColor: colors.statusSuccessBg, borderColor: colors.cardBorder },
            ]}
          >
            <AppIcon name="checkmark-circle" size={18} color={colors.statusSuccessText} />
            <Text style={[styles.bannerText, { color: colors.statusSuccessText }]}>
              {feedbackMessage}
            </Text>
          </View>
        ) : null}

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

        {/* Water Reminders Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleGroup}>
              <View style={[styles.iconPill, { backgroundColor: colors.waterBg }]}>
                <AppIcon name="water-outline" size={18} color={colors.water} />
              </View>
              <View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Water Reminders</Text>
                <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                  3 daily hydration prompts
                </Text>
              </View>
            </View>
            <Switch
              value={waterEnabled}
              onValueChange={handleToggleWater}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={waterEnabled ? colors.primary : '#94a3b8'}
              disabled={saving}
            />
          </View>

          <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
            Receive periodic notifications reminding you to drink water and meet your hydration
            target.
          </Text>

          <View style={styles.timesContainer}>
            <Text style={[styles.timesLabel, { color: colors.textSubtle }]}>
              DAILY REMINDER TIMES
            </Text>
            <View style={styles.timeButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.timeSlotButton,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.surfaceBorder },
                ]}
                onPress={() => handleOpenTimePicker('water1', waterTime1)}
                activeOpacity={0.7}
                accessibilityLabel="Edit first water reminder time"
              >
                <Text style={[styles.slotIndex, { color: colors.primary }]}>#1</Text>
                <Text style={[styles.slotTime, { color: colors.text }]}>{waterTime1}</Text>
                <AppIcon name="create-outline" size={14} color={colors.textSubtle} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.timeSlotButton,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.surfaceBorder },
                ]}
                onPress={() => handleOpenTimePicker('water2', waterTime2)}
                activeOpacity={0.7}
                accessibilityLabel="Edit second water reminder time"
              >
                <Text style={[styles.slotIndex, { color: colors.primary }]}>#2</Text>
                <Text style={[styles.slotTime, { color: colors.text }]}>{waterTime2}</Text>
                <AppIcon name="create-outline" size={14} color={colors.textSubtle} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.timeSlotButton,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.surfaceBorder },
                ]}
                onPress={() => handleOpenTimePicker('water3', waterTime3)}
                activeOpacity={0.7}
                accessibilityLabel="Edit third water reminder time"
              >
                <Text style={[styles.slotIndex, { color: colors.primary }]}>#3</Text>
                <Text style={[styles.slotTime, { color: colors.text }]}>{waterTime3}</Text>
                <AppIcon name="create-outline" size={14} color={colors.textSubtle} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Daily Health Record Reminder Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleGroup}>
              <View style={[styles.iconPill, { backgroundColor: colors.primaryLight }]}>
                <AppIcon name="calendar-outline" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Daily Health Record</Text>
                <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                  Evening activity log alert
                </Text>
              </View>
            </View>
            <Switch
              value={dailyEnabled}
              onValueChange={handleToggleDaily}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={dailyEnabled ? colors.primary : '#94a3b8'}
              disabled={saving}
            />
          </View>

          <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
            Reminds you in the evening to log your steps, calories burned, and total water intake.
          </Text>

          <View style={styles.timesContainer}>
            <Text style={[styles.timesLabel, { color: colors.textSubtle }]}>
              DAILY REMINDER TIME
            </Text>
            <TouchableOpacity
              style={[
                styles.singleTimeSlotButton,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.surfaceBorder },
              ]}
              onPress={() => handleOpenTimePicker('daily', dailyTime)}
              activeOpacity={0.7}
              accessibilityLabel="Edit daily health record reminder time"
            >
              <View style={styles.singleTimeInner}>
                <AppIcon name="time-outline" size={18} color={colors.primary} />
                <Text style={[styles.singleTimeText, { color: colors.text }]}>{dailyTime}</Text>
              </View>
              <View style={[styles.changeBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.changeBadgeText, { color: colors.primary }]}>
                  Change Time
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <CommonButton
          title="Save Reminder Schedule"
          iconName="time-outline"
          onPress={handleSaveScheduleTimes}
          loading={saving}
          style={styles.saveTimesButton}
        />

        {/* Test Notification Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Text style={[styles.testSectionTitle, { color: colors.text }]}>
            Test Notification System
          </Text>
          <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
            Send an instant test notification to verify notification delivery and alert sounds.
          </Text>
          <TouchableOpacity
            style={[
              styles.testButton,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.surfaceBorder },
            ]}
            onPress={handleSendTest}
            disabled={saving}
            activeOpacity={0.8}
          >
            <AppIcon name="notifications-outline" size={18} color={colors.primary} />
            <Text style={[styles.testButtonText, { color: colors.primary }]}>
              Send Test Notification
            </Text>
          </TouchableOpacity>
        </View>

        {pickerTarget !== null ? (
          <DateTimePicker
            value={pickerDate}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
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
  permissionStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  permissionCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  permissionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  permissionBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  permissionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconPill: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  timesContainer: {
    marginTop: 4,
  },
  timesLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  timeButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timeSlotButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  slotIndex: {
    fontSize: 12,
    fontWeight: '800',
  },
  slotTime: {
    fontSize: 15,
    fontWeight: '700',
  },
  singleTimeSlotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  singleTimeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  singleTimeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  changeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  changeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  saveTimesButton: {
    marginBottom: 16,
  },
  testSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginTop: 4,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

