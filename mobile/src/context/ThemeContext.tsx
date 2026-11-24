// Context for switching between Light, Dark, and System theme modes

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { ThemeColors, lightColors, darkColors } from '../utils/colors';
import { getUserTheme, saveUserTheme } from '../database/userDb';
import { useAuth } from './AuthContext';

type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const deviceScheme = useColorScheme();
  const { currentUser } = useAuth();
  const userId = currentUser?.id;

  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  // Load the user's saved theme preference when they log in or out
  useEffect(() => {
    async function loadTheme() {
      if (!userId) {
        setThemeModeState('system');
        return;
      }

      try {
        const savedMode = await getUserTheme(userId);
        setThemeModeState(savedMode);
      } catch {
        setThemeModeState('system');
      }
    }

    loadTheme();
  }, [userId]);

  // Update theme in state and save it in SQLite
  async function setThemeMode(mode: ThemeMode): Promise<void> {
    setThemeModeState(mode);
    if (!userId) {
      return;
    }

    try {
      await saveUserTheme(userId, mode);
    } catch {
      // Keep the selected theme active in memory even if SQLite write fails
    }
  }

  const isDark = themeMode === 'dark' || (themeMode === 'system' && deviceScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, colors, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}

