// Entry component that initializes SQLite and sets up Authentication, Theme, and Navigation

import { useEffect, useState } from 'react';
import { StyleSheet, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from './src/database/db';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Initialize the local SQLite database when the app starts
  async function setupDatabase() {
    try {
      setDbError(null);
      setIsDbReady(false);
      await initDatabase();
      setIsDbReady(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      setDbError(`Failed to initialize local database: ${message}`);
    }
  }

  useEffect(() => {
    setupDatabase();
  }, []);

  if (dbError) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centerContainer}>
          <StatusBar style="dark" />
          <Text style={styles.errorTitle}>Database Initialization Failed</Text>
          <Text style={styles.errorMessage}>{dbError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={setupDatabase} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!isDbReady) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centerContainer}>
          <StatusBar style="dark" />
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Loading HealthMate database...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <AppNavigator />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
