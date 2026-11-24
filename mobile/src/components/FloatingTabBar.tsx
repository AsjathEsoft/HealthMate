// Custom floating bottom tab bar for Dashboard, History, + Log, Goals, and Profile

import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { formatIsoDate } from '../utils/dateHelper';
import AppIcon from './AppIcon';

export default function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const bottomMargin = Math.max(insets.bottom, 12);

  function handleCenterLogPress() {
    const todayDate = formatIsoDate(new Date());
    navigation.navigate('AddRecord', { initialDate: todayDate });
  }

  // Return label and icon name for each tab
  function getTabInfo(routeName: string, isFocused: boolean) {
    if (routeName === 'Dashboard') {
      return {
        label: 'Today',
        icon: isFocused ? 'home' : 'home-outline',
      };
    }
    if (routeName === 'History') {
      return {
        label: 'History',
        icon: isFocused ? 'calendar' : 'calendar-outline',
      };
    }
    if (routeName === 'Goals') {
      return {
        label: 'Goals',
        icon: isFocused ? 'disc' : 'disc-outline',
      };
    }
    if (routeName === 'Profile') {
      return {
        label: 'Profile',
        icon: isFocused ? 'person' : 'person-outline',
      };
    }
    return {
      label: routeName,
      icon: 'home-outline',
    };
  }

  const leftTabs = state.routes.slice(0, 2);
  const rightTabs = state.routes.slice(2, 4);

  function renderTabButton(route: (typeof state.routes)[0], routeIndex: number) {
    const isFocused = state.index === routeIndex;
    const { options } = descriptors[route.key];
    const info = getTabInfo(route.name, isFocused);

    function handleTabPress() {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    }

    return (
      <TouchableOpacity
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel || `${info.label} tab`}
        onPress={handleTabPress}
        style={styles.tabItem}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.iconWrapper,
            isFocused && { backgroundColor: colors.tabBarActivePill },
          ]}
        >
          <AppIcon
            name={info.icon}
            size={22}
            color={isFocused ? colors.tabBarActive : colors.tabBarInactive}
          />
        </View>
        <Text
          style={[
            styles.tabLabel,
            { color: isFocused ? colors.tabBarActive : colors.tabBarInactive },
            isFocused && styles.tabLabelActive,
          ]}
        >
          {info.label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View pointerEvents="box-none" style={[styles.outerContainer, { bottom: bottomMargin }]}>
      <View
        style={[
          styles.barContainer,
          {
            backgroundColor: colors.tabBarBg,
            borderColor: colors.tabBarBorder,
            shadowColor: isDark ? '#000000' : '#0b192c',
          },
        ]}
      >
        {leftTabs.map((route, index) => renderTabButton(route, index))}

        <View style={styles.centerActionWrapper}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Log new health record"
            onPress={handleCenterLogPress}
            style={[
              styles.centerButton,
              {
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
              },
            ]}
            activeOpacity={0.85}
          >
            <AppIcon name="add" size={28} color={isDark ? '#060d1a' : '#ffffff'} />
          </TouchableOpacity>
          <Text style={[styles.tabLabel, styles.centerLabel, { color: colors.tabBarActive }]}>
            Log
          </Text>
        </View>

        {rightTabs.map((route, index) => renderTabButton(route, index + 2))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barContainer: {
    width: '100%',
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minHeight: 52,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  centerActionWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
    marginTop: -16,
  },
  centerButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  centerLabel: {
    fontWeight: '700',
    marginTop: 3,
  },
});

