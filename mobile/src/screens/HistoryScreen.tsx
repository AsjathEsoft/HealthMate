// History screen displaying past health records with date filtering, edit, and delete

import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  HealthRecord,
  getHealthRecords,
  deleteHealthRecord,
} from '../database/healthDb';
import { syncFromPushedDatabase } from '../database/db';
import { formatDisplayDate, formatIsoDate, parseLocalDate } from '../utils/dateHelper';
import AppIcon from '../components/AppIcon';

export default function HistoryScreen({ navigation }: any) {
  const { currentUser } = useAuth();
  const { colors, isDark } = useTheme();

  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  const rootNav = navigation.getParent() || navigation;

  async function loadRecords() {
    if (!currentUser) {
      setRecords([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await getHealthRecords(currentUser.id);
      setRecords(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load health records.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    await syncFromPushedDatabase();
    await loadRecords();
  }

  useEffect(() => {
    loadRecords();

    const unsubscribe = navigation.addListener('focus', () => {
      loadRecords();
    });

    return unsubscribe;
  }, [navigation, currentUser?.id]);

  // Filter records if a specific date is selected
  let displayedRecords = records;
  if (filterDate) {
    displayedRecords = records.filter((item) => item.date === filterDate);
  }

  function handleFilterDateChange(event: DateTimePickerEvent, chosenDate?: Date) {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'set' && chosenDate) {
      setFilterDate(formatIsoDate(chosenDate));
    }
  }

  function confirmDeleteRecord(record: HealthRecord) {
    if (!currentUser) {
      return;
    }

    const readableDate = formatDisplayDate(parseLocalDate(record.date));

    Alert.alert(
      'Delete Health Record',
      `Are you sure you want to delete the record for ${readableDate} (${record.date})? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHealthRecord(record.id, currentUser.id);
              await loadRecords();
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Could not delete record.';
              Alert.alert('Error', message);
            }
          },
        },
      ]
    );
  }

  function renderRecordItem({ item }: { item: HealthRecord }) {
    const displayDate = formatDisplayDate(parseLocalDate(item.date));

    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeader}>
          <View style={styles.dateInfo}>
            <Text style={[styles.cardDate, { color: colors.text }]}>{displayDate}</Text>
            <Text style={[styles.cardDateIso, { color: colors.textMuted }]}>{item.date}</Text>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[
                styles.editButton,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.surfaceBorder },
              ]}
              onPress={() => rootNav.navigate('AddRecord', { record: item })}
              activeOpacity={0.7}
              accessibilityLabel={`Edit record for ${item.date}`}
            >
              <View style={styles.btnContentRow}>
                <AppIcon name="create-outline" size={14} color={colors.primary} />
                <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteButton, { borderColor: colors.errorBorder }]}
              onPress={() => confirmDeleteRecord(item)}
              activeOpacity={0.7}
              accessibilityLabel={`Delete record for ${item.date}`}
            >
              <View style={styles.btnContentRow}>
                <AppIcon name="trash-outline" size={14} color={colors.error} />
                <Text style={[styles.deleteButtonText, { color: colors.error }]}>Delete</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={[styles.metricBadge, { backgroundColor: isDark ? '#0c2b38' : '#e0f7fa' }]}>
            <AppIcon
              name="walk-outline"
              size={16}
              color={colors.stepRing}
              style={styles.metricIcon}
            />
            <Text style={[styles.metricNumber, { color: colors.text }]}>
              {item.steps.toLocaleString()}
            </Text>
            <Text style={[styles.metricUnit, { color: colors.textMuted }]}>steps</Text>
          </View>

          <View style={[styles.metricBadge, { backgroundColor: colors.caloriesBg }]}>
            <AppIcon
              name="flame-outline"
              size={16}
              color={colors.calories}
              style={styles.metricIcon}
            />
            <Text style={[styles.metricNumber, { color: colors.text }]}>
              {item.calories.toLocaleString()}
            </Text>
            <Text style={[styles.metricUnit, { color: colors.textMuted }]}>kcal</Text>
          </View>

          <View style={[styles.metricBadge, { backgroundColor: colors.waterBg }]}>
            <AppIcon
              name="water-outline"
              size={16}
              color={colors.water}
              style={styles.metricIcon}
            />
            <Text style={[styles.metricNumber, { color: colors.text }]}>
              {item.water.toLocaleString()}
            </Text>
            <Text style={[styles.metricUnit, { color: colors.textMuted }]}>ml</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]}>History & Records</Text>
          <TouchableOpacity
            style={[styles.addRecordButton, { backgroundColor: colors.primary }]}
            onPress={() => rootNav.navigate('AddRecord')}
            activeOpacity={0.8}
            accessibilityLabel="Add new health record"
          >
            <View style={styles.btnContentRow}>
              <AppIcon name="add-outline" size={16} color={colors.actionText} />
              <Text style={[styles.addRecordButtonText, { color: colors.actionText }]}>
                New Record
              </Text>
            </View>
          </TouchableOpacity>
        </View>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          View, filter, and manage your daily logged activity.
        </Text>
      </View>

      {/* Date Filter Bar */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
          accessibilityLabel="Filter records by date"
        >
          <View style={styles.btnContentRow}>
            <AppIcon name="calendar-outline" size={16} color={colors.primary} />
            <Text style={[styles.filterButtonText, { color: colors.primary }]}>
              {filterDate ? `Filter: ${filterDate}` : 'Filter by Date'}
            </Text>
          </View>
        </TouchableOpacity>

        {filterDate ? (
          <TouchableOpacity
            style={[styles.clearFilterButton, { borderColor: colors.errorBorder }]}
            onPress={() => setFilterDate(null)}
            accessibilityLabel="Clear date filter"
          >
            <View style={styles.btnContentRow}>
              <AppIcon name="close-outline" size={15} color={colors.error} />
              <Text style={[styles.clearFilterText, { color: colors.error }]}>Clear Filter</Text>
            </View>
          </TouchableOpacity>
        ) : null}
      </View>

      {showDatePicker ? (
        <DateTimePicker
          value={filterDate ? parseLocalDate(filterDate) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleFilterDateChange}
        />
      ) : null}

      {errorMessage ? (
        <View
          style={[
            styles.errorBox,
            { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
          ]}
        >
          <AppIcon name="alert-circle-outline" size={18} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadRecords}>
            <Text style={[styles.retryButtonText, { color: colors.error }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && records.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading health records...
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedRecords}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRecordItem}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View
              style={[
                styles.emptyContainer,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <AppIcon name="calendar-outline" size={36} color={colors.textSubtle} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No records found</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                {filterDate
                  ? `No health record exists for ${filterDate}. Try clearing the date filter.`
                  : 'Start tracking your journey by recording your daily metrics.'}
              </Text>
              {!filterDate ? (
                <TouchableOpacity
                  style={[styles.emptyAddButton, { backgroundColor: colors.primary }]}
                  onPress={() => rootNav.navigate('AddRecord')}
                >
                  <View style={styles.btnContentRow}>
                    <AppIcon name="add-outline" size={16} color={colors.actionText} />
                    <Text style={[styles.emptyAddButtonText, { color: colors.actionText }]}>
                      Add First Record
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  addRecordButton: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addRecordButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearFilterButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  clearFilterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 110,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#0b192c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dateInfo: {
    flex: 1,
  },
  cardDate: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardDateIso: {
    fontSize: 12,
    marginTop: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricBadge: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  metricIcon: {
    marginBottom: 2,
  },
  metricNumber: {
    fontSize: 13,
    fontWeight: '700',
  },
  metricUnit: {
    fontSize: 10,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  emptyAddButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  emptyAddButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  errorBox: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  retryButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

