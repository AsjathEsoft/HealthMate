// Settings screen linking to Profile, Daily Goals, Reminders, Theme, Help, and Logout

import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth, getUserInitials } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DailyGoals, getDailyGoals } from '../database/healthDb';
import { getReminderSettings } from '../database/userDb';
import { cancelScheduledNotifications } from '../utils/notifications';
import AppIcon from '../components/AppIcon';

export default function SettingsScreen({ navigation }: any) {
  const { currentUser, logout } = useAuth();
  const { themeMode, setThemeMode, colors, isDark } = useTheme();

  const [dailyGoal, setDailyGoal] = useState<DailyGoals | null>(null);
  const [isAnyReminderOn, setIsAnyReminderOn] = useState<boolean>(false);

  async function loadSettingsSummary() {
    if (!currentUser) {
      return;
    }

    try {
      const goals = await getDailyGoals(currentUser.id);
      const reminders = await getReminderSettings(currentUser.id);

      setDailyGoal(goals);
      setIsAnyReminderOn(reminders.waterEnabled || reminders.dailyEnabled);
    } catch {
      // Keep default summary labels if background summary query fails
    }
  }

  useEffect(() => {
    loadSettingsSummary();

    const unsubscribe = navigation.addListener('focus', () => {
      loadSettingsSummary();
    });

    return unsubscribe;
  }, [navigation, currentUser?.id]);

  function handleLogout() {
    const accountLabel = currentUser?.name || 'HealthMate';

    Alert.alert('Log Out', `Are you sure you want to log out of ${accountLabel}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          if (currentUser) {
            try {
              const reminders = await getReminderSettings(currentUser.id);
              await cancelScheduledNotifications(reminders.scheduledIds);
            } catch {
              // Proceed with logout even if scheduled notification cleanup fails
            }
          }
          await logout();
        },
      },
    ]);
  }

  const avatarInitials = getUserInitials(currentUser?.name);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Manage profile, daily targets, reminders, and appearance.
          </Text>
        </View>

        {/* 1. Profile */}
        <TouchableOpacity
          style={[
            styles.menuCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.7}
          accessibilityLabel="Open profile settings"
        >
          <View style={styles.profileRow}>
            {currentUser?.photoUri ? (
              <Image source={{ uri: currentUser.photoUri }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>
                  {avatarInitials}
                </Text>
              </View>
            )}
            <View style={styles.menuMeta}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>
                {currentUser?.name || 'My Profile'}
              </Text>
              <Text style={[styles.menuSubtitle, { color: colors.textMuted }]}>
                {currentUser?.email || 'Set your name and avatar photo'}
              </Text>
            </View>
            <AppIcon name="chevron-forward-outline" size={20} color={colors.textSubtle} />
          </View>
        </TouchableOpacity>

        {/* 2. Daily Goals */}
        <TouchableOpacity
          style={[
            styles.menuCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
          onPress={() => navigation.navigate('Goals')}
          activeOpacity={0.7}
          accessibilityLabel="Configure daily activity goals"
        >
          <View style={styles.menuRow}>
            <View style={[styles.menuIconBox, { backgroundColor: colors.primaryLight }]}>
              <AppIcon name="flag-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.menuMeta}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Daily Goals</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textMuted }]}>
                {dailyGoal
                  ? `${dailyGoal.steps.toLocaleString()} steps · ${dailyGoal.calories} kcal · ${dailyGoal.water} ml`
                  : 'Configure daily steps, calories & water targets'}
              </Text>
            </View>
            <AppIcon name="chevron-forward-outline" size={20} color={colors.textSubtle} />
          </View>
        </TouchableOpacity>

        {/* 3. Reminders */}
        <TouchableOpacity
          style={[
            styles.menuCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
          onPress={() => navigation.navigate('Reminders')}
          activeOpacity={0.7}
          accessibilityLabel="Configure reminders and notification alerts"
        >
          <View style={styles.menuRow}>
            <View style={[styles.menuIconBox, { backgroundColor: colors.caloriesBg }]}>
              <AppIcon name="notifications-outline" size={20} color={colors.calories} />
            </View>
            <View style={styles.menuMeta}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Reminders</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textMuted }]}>
                {isAnyReminderOn
                  ? 'Water & daily logging alerts active'
                  : 'Scheduled local notifications'}
              </Text>
            </View>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: isAnyReminderOn
                    ? colors.statusSuccessBg
                    : colors.surfaceSecondary,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: isAnyReminderOn ? colors.statusSuccessText : colors.textSubtle },
                ]}
              >
                {isAnyReminderOn ? 'Active' : 'Off'}
              </Text>
            </View>
            <AppIcon name="chevron-forward-outline" size={20} color={colors.textSubtle} />
          </View>
        </TouchableOpacity>

        {/* 4. Appearance Theme */}
        <View
          style={[
            styles.appearanceCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.appearanceHeader}>
            <View style={[styles.menuIconBox, { backgroundColor: colors.primaryLight }]}>
              <AppIcon name="color-palette-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.menuMeta}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Appearance</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textMuted }]}>
                Choose your preferred app theme
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.segmentContainer,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.surfaceBorder },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.segmentButton,
                themeMode === 'system' && [styles.segmentActive, { backgroundColor: colors.card }],
              ]}
              onPress={() => setThemeMode('system')}
              activeOpacity={0.8}
              accessibilityLabel="Select system appearance theme"
            >
              <AppIcon
                name="phone-portrait-outline"
                size={16}
                color={themeMode === 'system' ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.segmentText,
                  { color: themeMode === 'system' ? colors.primary : colors.textMuted },
                  themeMode === 'system' && styles.segmentTextActive,
                ]}
              >
                System
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentButton,
                themeMode === 'light' && [styles.segmentActive, { backgroundColor: colors.card }],
              ]}
              onPress={() => setThemeMode('light')}
              activeOpacity={0.8}
              accessibilityLabel="Select light appearance theme"
            >
              <AppIcon
                name="sunny-outline"
                size={16}
                color={themeMode === 'light' ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.segmentText,
                  { color: themeMode === 'light' ? colors.primary : colors.textMuted },
                  themeMode === 'light' && styles.segmentTextActive,
                ]}
              >
                Light
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentButton,
                themeMode === 'dark' && [styles.segmentActive, { backgroundColor: colors.card }],
              ]}
              onPress={() => setThemeMode('dark')}
              activeOpacity={0.8}
              accessibilityLabel="Select dark appearance theme"
            >
              <AppIcon
                name="moon-outline"
                size={16}
                color={themeMode === 'dark' ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.segmentText,
                  { color: themeMode === 'dark' ? colors.primary : colors.textMuted },
                  themeMode === 'dark' && styles.segmentTextActive,
                ]}
              >
                Dark
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. Help & About */}
        <TouchableOpacity
          style={[
            styles.menuCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
          onPress={() => navigation.navigate('Help')}
          activeOpacity={0.7}
          accessibilityLabel="Open help and about screen"
        >
          <View style={styles.menuRow}>
            <View style={[styles.menuIconBox, { backgroundColor: colors.statusSuccessBg }]}>
              <AppIcon
                name="information-circle-outline"
                size={20}
                color={colors.statusSuccessText}
              />
            </View>
            <View style={styles.menuMeta}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Help & About</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textMuted }]}>
                User guide, privacy guarantees & app version
              </Text>
            </View>
            <AppIcon name="chevron-forward-outline" size={20} color={colors.textSubtle} />
          </View>
        </TouchableOpacity>

        {/* 6. Log Out */}
        <TouchableOpacity
          style={[
            styles.logoutCard,
            { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
          ]}
          onPress={handleLogout}
          activeOpacity={0.7}
          accessibilityLabel="Log out of HealthMate"
        >
          <View style={styles.logoutRow}>
            <View style={[styles.menuIconBox, { backgroundColor: colors.errorBg }]}>
              <AppIcon name="log-out-outline" size={20} color={colors.error} />
            </View>
            <View style={styles.menuMeta}>
              <Text style={[styles.menuTitle, { color: colors.error }]}>Log Out</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textMuted }]}>
                {currentUser?.email
                  ? `Signed in as ${currentUser.email}`
                  : 'End active local session'}
              </Text>
            </View>
            <AppIcon name="chevron-forward-outline" size={20} color={colors.error} />
          </View>
        </TouchableOpacity>
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
    marginBottom: 20,
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
  menuCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuMeta: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  menuSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  appearanceCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  appearanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  segmentActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    fontWeight: '700',
  },
  logoutCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 12,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
});
