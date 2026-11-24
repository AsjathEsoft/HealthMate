// Main navigation setup with Login/Register screens, Bottom Tabs, and Stack screens

import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { HealthRecord } from '../database/healthDb';
import { formatIsoDate } from '../utils/dateHelper';
import FloatingTabBar from '../components/FloatingTabBar';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AddRecordScreen from '../screens/AddRecordScreen';
import HistoryScreen from '../screens/HistoryScreen';
import GoalsScreen from '../screens/GoalsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RemindersScreen from '../screens/RemindersScreen';
import SettingsScreen from '../screens/SettingsScreen';
import HelpScreen from '../screens/HelpScreen';

// Screen parameter types for Stack and Bottom Tab navigation
type MainTabParamList = {
  Dashboard: undefined;
  History: undefined;
  Goals: undefined;
  Profile: undefined;
};

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  AddRecord: { record?: HealthRecord; initialDate?: string } | undefined;
  Settings: undefined;
  Profile: undefined;
  Goals: undefined;
  Reminders: undefined;
  Help: undefined;
};

const navigationRef = createNavigationContainerRef<RootStackParamList>();

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Goals" component={GoalsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { colors } = useTheme();
  const { currentUser, isLoading } = useAuth();

  // Open the AddRecord screen for today when a reminder notification is tapped
  function openAddRecordFromNotification(data?: Record<string, unknown>) {
    const targetScreen = data?.screen;
    if (targetScreen === 'AddRecord' && navigationRef.isReady() && currentUser) {
      const todayIso = formatIsoDate(new Date());
      navigationRef.navigate('AddRecord', { initialDate: todayIso });
    }
  }

  // Listen for notification taps while the app is open or in the background
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      openAddRecordFromNotification(data);
    });

    return () => {
      subscription.remove();
    };
  }, [currentUser]);

  // Check if the app was opened from a notification tap when closed
  async function handleNavigationReady() {
    try {
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (lastResponse) {
        const data = lastResponse.notification.request.content.data;
        openAddRecordFromNotification(data);
      }
    } catch {
      // Ignore if launch notification inspection is unsupported
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const stackHeaderOptions = {
    headerShown: true,
    headerStyle: {
      backgroundColor: colors.background,
    },
    headerShadowVisible: false,
    headerTintColor: colors.primary,
    headerTitleStyle: {
      fontWeight: '700' as const,
      fontSize: 18,
      color: colors.text,
    },
    headerBackTitle: 'Back',
  };

  return (
    <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {!currentUser ? (
          // Screens shown before logging in
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          // Screens shown after logging in
          <>
            <Stack.Screen name="MainTabs" component={MainTabNavigator} />

            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                ...stackHeaderOptions,
                title: 'Settings',
              }}
            />

            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{
                ...stackHeaderOptions,
                title: 'My Profile',
              }}
            />

            <Stack.Screen
              name="Goals"
              component={GoalsScreen}
              options={{
                ...stackHeaderOptions,
                title: 'Daily Goals',
              }}
            />

            <Stack.Screen
              name="Reminders"
              component={RemindersScreen}
              options={{
                ...stackHeaderOptions,
                title: 'Reminders',
              }}
            />

            <Stack.Screen
              name="Help"
              component={HelpScreen}
              options={{
                ...stackHeaderOptions,
                title: 'Help & About',
              }}
            />

            <Stack.Screen
              name="AddRecord"
              component={AddRecordScreen}
              options={{
                ...stackHeaderOptions,
                title: 'Health Record Entry',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
