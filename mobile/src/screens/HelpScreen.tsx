// Help & About screen explaining how to use HealthMate and how local data is stored

import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../context/ThemeContext';
import AppIcon from '../components/AppIcon';
import packageJson from '../../package.json';

export default function HelpScreen() {
  const { colors, isDark } = useTheme();
  const appVersion = packageJson.version || '1.0.0';

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['bottom', 'left', 'right']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Help & About</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Learn how HealthMate keeps your health data private, offline, and organized.
          </Text>
        </View>

        {/* App Info Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.appBannerRow}>
            <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
              <AppIcon name="pulse" size={28} color={colors.primary} />
            </View>
            <View style={styles.appMeta}>
              <Text style={[styles.appName, { color: colors.text }]}>HealthMate</Text>
              <Text style={[styles.appVersion, { color: colors.textMuted }]}>
                Version {appVersion} · Offline Edition
              </Text>
            </View>
          </View>
        </View>

        {/* User Guide Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            How to Use HealthMate
          </Text>

          <View style={styles.guideItem}>
            <View style={styles.guideHeader}>
              <View style={[styles.iconPill, { backgroundColor: colors.primaryLight }]}>
                <AppIcon name="document-text-outline" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.guideTitle, { color: colors.text }]}>
                Managing Health Records
              </Text>
            </View>
            <Text style={[styles.guideBody, { color: colors.textMuted }]}>
              • <Text style={styles.bold}>Add a Record:</Text> Tap the Add/Update button on the
              Dashboard or the center "+" Log button. Only one record is saved per calendar date.
              {'\n'}• <Text style={styles.bold}>Edit:</Text> Tap "Edit" on any record card in
              History to update steps, calories, or water values.
              {'\n'}• <Text style={styles.bold}>Filter:</Text> Tap "Filter by Date" in History to
              check activity for a specific day.
              {'\n'}• <Text style={styles.bold}>Delete:</Text> Tap "Delete" on a record card in
              History to permanently remove it.
            </Text>
          </View>

          <View style={styles.guideItem}>
            <View style={styles.guideHeader}>
              <View style={[styles.iconPill, { backgroundColor: colors.caloriesBg }]}>
                <AppIcon name="flag-outline" size={16} color={colors.calories} />
              </View>
              <Text style={[styles.guideTitle, { color: colors.text }]}>
                Daily Goals & Reminders
              </Text>
            </View>
            <Text style={[styles.guideBody, { color: colors.textMuted }]}>
              • <Text style={styles.bold}>Daily Targets:</Text> Set daily goals for steps, calories
              burned, and water intake. Progress rings and bars update automatically.
              {'\n'}• <Text style={styles.bold}>Hydration Reminders:</Text> Turn on Water Reminders
              with 3 customizable daily alarm times (default 09:00, 13:00, and 17:00).
              {'\n'}• <Text style={styles.bold}>Evening Log Alert:</Text> Enable the daily record
              reminder (default 20:30) so you never forget to log your metrics.
            </Text>
          </View>

          <View style={[styles.guideItem, { marginBottom: 0 }]}>
            <View style={styles.guideHeader}>
              <View style={[styles.iconPill, { backgroundColor: colors.statusSuccessBg }]}>
                <AppIcon
                  name="shield-checkmark-outline"
                  size={16}
                  color={colors.statusSuccessText}
                />
              </View>
              <Text style={[styles.guideTitle, { color: colors.text }]}>
                Offline Storage & Privacy
              </Text>
            </View>
            <Text style={[styles.guideBody, { color: colors.textMuted }]}>
              • <Text style={styles.bold}>On-Device SQLite:</Text> All health metrics and logs are
              stored locally in SQLite inside the Android app's private storage.
              {'\n'}• <Text style={styles.bold}>Zero Cloud Tracking:</Text> No personal health
              metrics, photos, or passwords ever leave your device.
              {'\n'}• <Text style={styles.bold}>Isolated Accounts:</Text> Each registered user gets
              separate records, daily goals, and profile settings.
            </Text>
          </View>
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
  appBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appMeta: {
    flex: 1,
  },
  appName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  appVersion: {
    fontSize: 13,
    marginTop: 3,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  guideItem: {
    marginBottom: 20,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  iconPill: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  guideBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
  },
});

