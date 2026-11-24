// Context for managing the logged-in user and saving session state + Java Bearer token securely

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  UserAccount,
  loginUser,
  registerUser,
  getUserById,
} from '../database/userDb';
import {
  apiCheckServerHealth,
  apiLogoutUser,
  clearAuthToken,
  getAuthToken,
} from '../services/api';

const SESSION_KEY = 'healthmate_active_user_id';

interface AuthContextType {
  currentUser: UserAccount | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateSessionUser: (name: string, email: string | null, photoUri: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Save the logged-in user's ID in encrypted device storage
async function saveSessionId(userId: number): Promise<void> {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, String(userId));
  } catch {
    // Session persistence is optional if device secure storage is unavailable
  }
}

// Read the saved user ID when the app opens
async function readSessionId(): Promise<number | null> {
  try {
    const saved = await SecureStore.getItemAsync(SESSION_KEY);
    if (!saved) {
      return null;
    }
    const parsedId = parseInt(saved, 10);
    return isNaN(parsedId) ? null : parsedId;
  } catch {
    return null;
  }
}

// Remove the saved user ID on logout
async function clearSessionId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // Ignore if session entry was already cleared
  }
}

// Helper to get 1 or 2 initials for the profile circle (e.g. "Alex Smith" -> "AS")
export function getUserInitials(name?: string | null): string {
  if (!name || name.trim() === '') {
    return 'HM';
  }

  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }

  const firstInitial = words[0][0];
  const lastInitial = words[words.length - 1][0];
  return (firstInitial + lastInitial).toUpperCase();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore saved login session when the app starts
  useEffect(() => {
    async function loadSavedSession() {
      try {
        const savedUserId = await readSessionId();
        if (savedUserId) {
          const savedToken = await getAuthToken();

          // If the Java backend is online and there is no Bearer token yet
          // (for example, an older local-only session), ask the user to log in once.
          if (!savedToken) {
            const serverOnline = await apiCheckServerHealth();
            if (serverOnline) {
              await clearSessionId();
              return;
            }
          }

          const user = await getUserById(savedUserId);
          if (user) {
            setCurrentUser(user);
          } else {
            await clearSessionId();
            await clearAuthToken();
          }
        }
      } catch {
        // Fall back to login screen if saved session cannot be restored
      } finally {
        setIsLoading(false);
      }
    }

    loadSavedSession();
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const user = await loginUser(email, password);
    await saveSessionId(user.id);
    setCurrentUser(user);
  }

  async function register(name: string, email: string, password: string): Promise<void> {
    const user = await registerUser(name, email, password);
    await saveSessionId(user.id);
    setCurrentUser(user);
  }

  async function logout(): Promise<void> {
    await apiLogoutUser();
    await clearSessionId();
    setCurrentUser(null);
  }

  // Update the user's name, email, or photo in memory so the Dashboard updates right away
  function updateSessionUser(
    name: string,
    email: string | null,
    photoUri: string | null
  ): void {
    if (!currentUser) {
      return;
    }

    setCurrentUser({
      ...currentUser,
      name: name.trim(),
      email: email ? email.trim().toLowerCase() : currentUser.email,
      photoUri,
    });
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        login,
        register,
        logout,
        updateSessionUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
