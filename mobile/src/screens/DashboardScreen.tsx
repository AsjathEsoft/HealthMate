// Main Dashboard screen showing daily steps, water intake, and calories progress

import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  HealthRecord,
  DailyGoals,
  DEFAULT_DAILY_GOALS,
  getHealthRecords,
  getDailyGoals,
} from '../database/healthDb';
import { syncFromPushedDatabase } from '../database/db';
import { formatIsoDate } from '../utils/dateHelper';
import AppIcon from '../components/AppIcon';
import ProgressRing from '../components/ProgressRing';
import CommonButton from '../components/CommonButton';

export default function DashboardScreen({ navigation }: any) {
  const { currentUser } = useAuth();
  const { colors, isDark, setThemeMode } = useTheme();

  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [dailyGoal, setDailyGoal] = useState<DailyGoals>(DEFAULT_DAILY_GOALS);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  // Load records and daily goals from SQLite
  async function loadDashboardData() {
    if (!currentUser) {
      setRecords([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      const userRecords = await getHealthRecords(currentUser.id);
      const userGoals = await getDailyGoals(currentUser.id);

      setRecords(userRecords);
      setDailyGoal(userGoals);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not load dashboard data.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  // Pull-to-refresh handler (also checks if new data was pushed from Windows)
  async function handleRefresh() {
    await syncFromPushedDatabase();
    await loadDashboardData();
  }

  // Reload data when the screen opens and whenever the user comes back to this tab
  useEffect(() => {
    loadDashboardData();

    const unsubscribe = navigation.addListener('focus', () => {
      loadDashboardData();
    });

    return unsubscribe;
  }, [navigation, currentUser?.id]);

  const userName = currentUser ? currentUser.name : 'Friend';
  const todayIso = formatIsoDate(new Date());
  const selectedDateIso = formatIsoDate(selectedDate);
  const isSelectedToday = selectedDateIso === todayIso;

  const dateChipText = selectedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  // Find the health record saved for the selected date (if one exists)
  const activeRecord = records.find((item) => item.date === selectedDateIso);

  const steps = activeRecord ? activeRecord.steps : 0;
  const calories = activeRecord ? activeRecord.calories : 0;
  const waterIntake = activeRecord ? activeRecord.water : 0;

  const stepsPercent = dailyGoal.steps > 0 ? Math.round((steps / dailyGoal.steps) * 100) : 0;
  const caloriesPercent =
    dailyGoal.calories > 0 ? Math.round((calories / dailyGoal.calories) * 100) : 0;
  const waterPercent =
    dailyGoal.water > 0 ? Math.round((waterIntake / dailyGoal.water) * 100) : 0;

  const caloriesBarWidth = `${Math.min(100, Math.max(0, caloriesPercent))}%` as const;
  const waterBarWidth = `${Math.min(100, Math.max(0, waterPercent))}%` as const;

  const recordedDaysCount = records.length;

  function getRootNavigation() {
    return navigation.getParent() || navigation;
  }

  function handleOpenSettings() {
    getRootNavigation().navigate('Settings');
  }

  function handleOpenGoals() {
    getRootNavigation().navigate('Goals');
  }

  function handleToggleTheme() {
    if (isDark) {
      setThemeMode('light');
    } else {
      setThemeMode('dark');
    }
  }

  function handleAddOrUpdateRecord() {
    const rootNav = getRootNavigation();
    if (activeRecord) {
      rootNav.navigate('AddRecord', { record: activeRecord });
    } else {
      rootNav.navigate('AddRecord', { initialDate: selectedDateIso });
    }
  }

  function handleDateChange(_event: any, newDate?: Date) {
    setShowDatePicker(false);
    if (newDate) {
      setSelectedDate(newDate);
    }
  }

  // Decide the status banner text and button label clearly
  let statusBannerText = 'No log recorded for this date';
  if (activeRecord && isSelectedToday) {
    statusBannerText = "Today's log is saved";
  } else if (activeRecord) {
    statusBannerText = 'Log saved for this date';
  } else if (isSelectedToday) {
    statusBannerText = 'No log recorded for today';
  }

  let actionButtonTitle = 'Add record for this date';
  if (activeRecord && isSelectedToday) {
    actionButtonTitle = "Update today's record";
  } else if (activeRecord) {
    actionButtonTitle = 'Update record for this date';
  } else if (isSelectedToday) {
    actionButtonTitle = "Add today's record";
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header: Brand + Theme Button + Settings Button */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={[styles.pulseIconBox, { backgroundColor: colors.primary }]}>
              <AppIcon name="pulse" size={20} color={isDark ? '#060d1a' : '#ffffff'} />
            </View>
            <Text style={[styles.brandTitle, { color: colors.text }]}>HealthMate</Text>
          </View>

          <View style={styles.topActionsRow}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              style={[
                styles.iconCircleBtn,
                {
                  backgroundColor: colors.headerIconBg,
                  borderColor: colors.headerIconBorder,
                },
              ]}
              onPress={handleToggleTheme}
              activeOpacity={0.7}
            >
              <AppIcon
                name={isDark ? 'moon-outline' : 'sunny-outline'}
                size={18}
                color={isDark ? '#38bdf8' : '#f59e0b'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              style={[
                styles.iconCircleBtn,
                {
                  backgroundColor: colors.headerIconBg,
                  borderColor: colors.headerIconBorder,
                },
              ]}
              onPress={handleOpenSettings}
              activeOpacity={0.7}
            >
              <AppIcon name="settings-outline" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* User Greeting & Date Selector */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingTextCol}>
            <Text style={[styles.greetingHeading, { color: colors.text }]} numberOfLines={1}>
              Hello, {userName}
            </Text>
            <Text style={[styles.greetingSubtitle, { color: colors.textMuted }]}>
              Your daily health journal
            </Text>
          </View>

          <View style={styles.dateChipWrapper}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Selected date: ${dateChipText}. Tap to change date.`}
              style={[
                styles.dateChip,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                },
              ]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.75}
            >
              <AppIcon name="calendar-outline" size={15} color={colors.primary} />
              <Text style={[styles.dateChipText, { color: colors.text }]}>{dateChipText}</Text>
              <AppIcon name="chevron-down" size={14} color={colors.textMuted} />
            </TouchableOpacity>

            {!isSelectedToday ? (
              <TouchableOpacity
                onPress={() => setSelectedDate(new Date())}
                style={[styles.returnTodayBtn, { backgroundColor: colors.primaryLight }]}
                activeOpacity={0.7}
                accessibilityLabel="Return to today's date"
              >
                <Text style={[styles.returnTodayText, { color: colors.primary }]}>Today</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {showDatePicker ? (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={handleDateChange}
          />
        ) : null}

        {errorMessage ? (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
            ]}
          >
            <AppIcon name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={[styles.errorBannerText, { color: colors.error }]}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Daily Log Status Banner */}
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor: activeRecord ? colors.statusSuccessBg : colors.statusWarningBg,
            },
          ]}
        >
          <View style={styles.statusInnerRow}>
            <View
              style={[
                styles.statusIconBadge,
                {
                  backgroundColor: activeRecord ? colors.success : colors.warning,
                },
              ]}
            >
              <AppIcon
                name={activeRecord ? 'checkmark' : 'information-circle-outline'}
                size={14}
                color="#ffffff"
              />
            </View>
            <Text
              style={[
                styles.statusBannerText,
                {
                  color: activeRecord ? colors.statusSuccessText : colors.statusWarningText,
                },
              ]}
            >
              {statusBannerText}
            </Text>
          </View>
        </View>

        {/* Daily Activity Heading + Edit Goals Link */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Daily activity</Text>
          <TouchableOpacity
            onPress={handleOpenGoals}
            style={styles.editGoalsButton}
            activeOpacity={0.7}
            accessibilityLabel="Edit daily goals"
          >
            <AppIcon name="settings-outline" size={14} color={colors.primary} />
            <Text style={[styles.editGoalsText, { color: colors.primary }]}>Edit goals</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Steps Card */}
        <View
          style={[
            styles.stepsCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              shadowColor: isDark ? '#000000' : '#0b192c',
            },
          ]}
        >
          <View style={styles.decorativeWaves} pointerEvents="none">
            <Svg width="180" height="90" viewBox="0 0 180 90">
              <Path
                d="M0,60 C40,40 80,75 120,50 C150,30 170,45 180,40"
                fill="none"
                stroke={colors.primary}
                strokeWidth="1.2"
                strokeOpacity={isDark ? 0.15 : 0.08}
              />
              <Path
                d="M10,75 C50,55 90,85 130,65 C160,50 175,60 180,55"
                fill="none"
                stroke={colors.primary}
                strokeWidth="1"
                strokeOpacity={isDark ? 0.1 : 0.05}
              />
            </Svg>
          </View>

          <View style={styles.stepsCardContent}>
            <View style={styles.stepsInfoCol}>
              <View style={styles.stepsLabelRow}>
                <View
                  style={[
                    styles.metricSmallBadge,
                    { backgroundColor: isDark ? '#0c2b38' : '#e0f7fa' },
                  ]}
                >
                  <AppIcon name="walk-outline" size={15} color={colors.stepRing} />
                </View>
                <Text style={[styles.stepsMetaLabel, { color: colors.textMuted }]}>
                  Steps recorded
                </Text>
              </View>

              <Text style={[styles.stepsValueText, { color: colors.text }]}>
                {steps.toLocaleString()}
              </Text>
              <Text style={[styles.stepsUnitText, { color: colors.text }]}>steps</Text>
              <Text style={[styles.stepsGoalText, { color: colors.textMuted }]}>
                Daily goal {dailyGoal.steps.toLocaleString()}
              </Text>

              <View style={styles.goalStatusPill}>
                {steps >= dailyGoal.steps && dailyGoal.steps > 0 ? (
                  <View style={styles.reachedRow}>
                    <AppIcon name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={[styles.reachedText, { color: colors.success }]}>
                      Daily goal reached
                    </Text>
                  </View>
                ) : (
                  <View style={styles.reachedRow}>
                    <AppIcon name="walk-outline" size={14} color={colors.textMuted} />
                    <Text style={[styles.reachedText, { color: colors.textMuted }]}>
                      {dailyGoal.steps > steps
                        ? `${(dailyGoal.steps - steps).toLocaleString()} steps to goal`
                        : `${stepsPercent}% completed`}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.stepsRingCol}>
              <ProgressRing
                progress={stepsPercent / 100}
                size={106}
                strokeWidth={11}
                progressColor={colors.stepRing}
                trackColor={colors.stepRingTrack}
              >
                <AppIcon name="walk-outline" size={24} color={colors.stepRing} />
                <Text style={[styles.ringPercentText, { color: colors.text }]}>
                  {stepsPercent}%
                </Text>
              </ProgressRing>
            </View>
          </View>
        </View>

        {/* Water & Calories Cards */}
        <View style={styles.metricsRow}>
          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                shadowColor: isDark ? '#000000' : '#0b192c',
              },
            ]}
          >
            <View style={styles.metricCardHeader}>
              <View style={[styles.metricCardIconCircle, { backgroundColor: colors.waterBg }]}>
                <AppIcon name="water-outline" size={16} color={colors.water} />
              </View>
              <Text style={[styles.metricCardTitle, { color: colors.text }]}>Water</Text>
            </View>

            <View style={styles.metricCardValueRow}>
              <Text style={[styles.metricLargeNumber, { color: colors.text }]}>
                {waterIntake.toLocaleString()}{' '}
                <Text style={[styles.metricUnitInline, { color: colors.textMuted }]}>ml</Text>
              </Text>
            </View>
            <Text style={[styles.metricGoalSubtext, { color: colors.textMuted }]}>
              of {dailyGoal.water.toLocaleString()} ml
            </Text>

            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarTrack, { backgroundColor: colors.stepRingTrack }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: waterBarWidth,
                      backgroundColor: colors.water,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressPercentText, { color: colors.textMuted }]}>
                {waterPercent}%
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                shadowColor: isDark ? '#000000' : '#0b192c',
              },
            ]}
          >
            <View style={styles.metricCardHeader}>
              <View style={[styles.metricCardIconCircle, { backgroundColor: colors.caloriesBg }]}>
                <AppIcon name="flame-outline" size={16} color={colors.calories} />
              </View>
              <Text style={[styles.metricCardTitle, { color: colors.text }]}>Calories burned</Text>
            </View>

            <View style={styles.metricCardValueRow}>
              <Text style={[styles.metricLargeNumber, { color: colors.text }]}>
                {calories.toLocaleString()}{' '}
                <Text style={[styles.metricUnitInline, { color: colors.textMuted }]}>kcal</Text>
              </Text>
            </View>
            <Text style={[styles.metricGoalSubtext, { color: colors.textMuted }]}>
              of {dailyGoal.calories.toLocaleString()} kcal
            </Text>

            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarTrack, { backgroundColor: colors.stepRingTrack }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: caloriesBarWidth,
                      backgroundColor: colors.calories,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressPercentText, { color: colors.textMuted }]}>
                {caloriesPercent}%
              </Text>
            </View>
          </View>
        </View>

        {/* Add / Update Record Button */}
        <CommonButton
          title={actionButtonTitle}
          iconName={activeRecord ? 'create-outline' : 'add-outline'}
          onPress={handleAddOrUpdateRecord}
          style={styles.primaryActionButton}
        />

        {/* Local Storage Footnote */}
        <View style={styles.footnoteContainer}>
          <View style={styles.footnoteHeader}>
            <AppIcon name="shield-checkmark-outline" size={15} color={colors.primary} />
            <Text style={[styles.footnoteTitle, { color: colors.textMuted }]}>
              Saved on this device
            </Text>
          </View>
          <Text style={[styles.footnoteDaysText, { color: colors.textSubtle }]}>
            {recordedDaysCount} day{recordedDaysCount === 1 ? '' : 's'} recorded
          </Text>
        </View>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 110,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pulseIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 16,
  },
  greetingTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  greetingHeading: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  dateChipWrapper: {
    alignItems: 'flex-end',
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  returnTodayBtn: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  returnTodayText: {
    fontSize: 11,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 8,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  statusBanner: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  statusInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  editGoalsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  editGoalsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  stepsCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  decorativeWaves: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  stepsCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepsInfoCol: {
    flex: 1,
  },
  stepsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  metricSmallBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepsMetaLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  stepsValueText: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  stepsUnitText: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: -2,
  },
  stepsGoalText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 10,
  },
  goalStatusPill: {
    marginTop: 4,
  },
  reachedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reachedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  stepsRingCol: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  ringPercentText: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  metricCard: {
    flex: 1,
    minWidth: 140,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  metricCardIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  metricCardValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  metricLargeNumber: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricUnitInline: {
    fontSize: 13,
    fontWeight: '600',
  },
  metricGoalSubtext: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 12,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  primaryActionButton: {
    height: 54,
    borderRadius: 18,
    marginBottom: 20,
  },
  footnoteContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  footnoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footnoteTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  footnoteDaysText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
});

