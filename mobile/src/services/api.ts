// Simple REST API helper using fetch() to communicate with the Java Spring Boot backend

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'healthmate_auth_token';
const REQUEST_TIMEOUT_MS = 6000;

// Determine the backend base URL based on environment and platform:
// - Uses EXPO_PUBLIC_API_URL if configured
// - Defaults to http://10.0.2.2:8085 on Android Emulator in local development
// - Defaults to http://localhost:8085 on iOS Simulator / Web in local development
function resolveApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configuredUrl) {
    const cleanUrl = configuredUrl.replace(/\/+$/, '');
    if (!__DEV__ && !cleanUrl.startsWith('https://')) {
      throw new Error('Production backend URL must use HTTPS.');
    }
    return cleanUrl;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8085';
  }
  return 'http://localhost:8085';
}

const API_BASE_URL = resolveApiBaseUrl();

let cachedAuthToken: string | null = null;

// Custom error class so database helpers know when the Java server is unreachable (offline)
// versus when the Java server returned a real validation or authentication error.
export class NetworkOfflineError extends Error {
  constructor(message = 'Java backend server is currently unreachable.') {
    super(message);
    this.name = 'NetworkOfflineError';
  }
}

export function isNetworkOfflineError(error: unknown): boolean {
  return error instanceof NetworkOfflineError;
}

// Save the signed Bearer token returned by Java in encrypted device storage
async function saveAuthToken(token: string): Promise<void> {
  cachedAuthToken = token;
  try {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  } catch {
    // Keep token in memory if SecureStore is unavailable
  }
}

// Load the saved Bearer token from memory or encrypted device storage
export async function getAuthToken(): Promise<string | null> {
  if (cachedAuthToken) {
    return cachedAuthToken;
  }
  try {
    const stored = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    cachedAuthToken = stored || null;
    return cachedAuthToken;
  } catch {
    return null;
  }
}

// Clear the saved Bearer token on logout
export async function clearAuthToken(): Promise<void> {
  cachedAuthToken = null;
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  } catch {
    // Ignore if already removed
  }
}

// Core beginner-friendly fetch() wrapper that attaches JSON headers and the Bearer token
async function sendApiRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown,
  requiresAuth: boolean = true
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const token = await getAuthToken();
    if (!token) {
      throw new NetworkOfflineError('No active backend token available.');
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new NetworkOfflineError('Could not connect to the HealthMate Java server.');
  } finally {
    clearTimeout(timeoutId);
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const serverMessage =
      data && typeof data.error === 'string'
        ? data.error
        : `Request failed with status ${response.status}`;
    const apiError = new Error(serverMessage) as Error & { status?: number };
    apiError.status = response.status;
    throw apiError;
  }

  return data as T;
}

// --- API Types ---

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  photoUri: string | null;
  createdAt: string;
}

export interface ApiAuthResponse {
  token: string;
  user: ApiUser;
}

export interface ApiHealthRecord {
  id: number;
  userId: number;
  date: string;
  steps: number;
  calories: number;
  water: number;
}

export interface ApiDailyGoals {
  steps: number;
  calories: number;
  water: number;
}

export interface ApiUserProfile {
  name: string;
  email: string | null;
  photoUri: string | null;
}

export interface ApiUserSettings {
  themeMode: 'system' | 'light' | 'dark';
  waterEnabled: boolean;
  waterTime1: string;
  waterTime2: string;
  waterTime3: string;
  dailyEnabled: boolean;
  dailyTime: string;
  scheduledIds: string[];
}

// --- Authentication & User Endpoints ---

export async function apiCheckServerHealth(): Promise<boolean> {
  try {
    const result = await sendApiRequest<{ status: string }>('/api/health', 'GET', undefined, false);
    return result.status === 'UP';
  } catch {
    return false;
  }
}

export async function apiRegisterUser(
  name: string,
  email: string,
  password: string
): Promise<ApiAuthResponse> {
  const result = await sendApiRequest<ApiAuthResponse>(
    '/api/auth/register',
    'POST',
    { name, email, password },
    false
  );
  await saveAuthToken(result.token);
  return result;
}

export async function apiLoginUser(email: string, password: string): Promise<ApiAuthResponse> {
  const result = await sendApiRequest<ApiAuthResponse>(
    '/api/auth/login',
    'POST',
    { email, password },
    false
  );
  await saveAuthToken(result.token);
  return result;
}

export async function apiLogoutUser(): Promise<void> {
  try {
    const token = await getAuthToken();
    if (token) {
      await sendApiRequest('/api/auth/logout', 'POST', {}, true);
    }
  } catch {
    // Proceed with local logout even if backend is offline
  } finally {
    await clearAuthToken();
  }
}

export async function apiGetCurrentUser(): Promise<ApiUser> {
  return await sendApiRequest<ApiUser>('/api/users/me', 'GET');
}

// --- Profile Endpoints ---

export async function apiGetUserProfile(): Promise<ApiUserProfile> {
  return await sendApiRequest<ApiUserProfile>('/api/users/me/profile', 'GET');
}

export async function apiUpdateUserProfile(
  name: string,
  email: string | null,
  photoUri: string | null
): Promise<ApiUserProfile> {
  return await sendApiRequest<ApiUserProfile>('/api/users/me/profile', 'PUT', {
    name,
    email,
    photoUri,
  });
}

export async function apiRemoveProfilePhoto(): Promise<void> {
  await sendApiRequest('/api/users/me/profile/photo', 'DELETE');
}

// --- Health Records & Daily Goals Endpoints ---

export async function apiGetHealthRecords(date?: string): Promise<ApiHealthRecord[]> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return await sendApiRequest<ApiHealthRecord[]>(`/api/health-records${query}`, 'GET');
}

export async function apiAddHealthRecord(
  date: string,
  steps: number,
  calories: number,
  water: number,
  upsert: boolean = false
): Promise<ApiHealthRecord> {
  const query = upsert ? '?upsert=true' : '';
  return await sendApiRequest<ApiHealthRecord>(`/api/health-records${query}`, 'POST', {
    date,
    steps,
    calories,
    water,
  });
}

export async function apiUpdateHealthRecord(
  recordId: number,
  date: string,
  steps: number,
  calories: number,
  water: number
): Promise<ApiHealthRecord> {
  return await sendApiRequest<ApiHealthRecord>(`/api/health-records/${recordId}`, 'PUT', {
    date,
    steps,
    calories,
    water,
  });
}

export async function apiDeleteHealthRecord(recordId: number): Promise<void> {
  await sendApiRequest(`/api/health-records/${recordId}`, 'DELETE');
}

export async function apiDeleteHealthRecordByDate(date: string): Promise<void> {
  await sendApiRequest(`/api/health-records/by-date/${encodeURIComponent(date)}`, 'DELETE');
}

export async function apiGetDailyGoals(): Promise<ApiDailyGoals> {
  return await sendApiRequest<ApiDailyGoals>('/api/goals', 'GET');
}

export async function apiUpdateDailyGoals(
  steps: number,
  calories: number,
  water: number
): Promise<ApiDailyGoals> {
  return await sendApiRequest<ApiDailyGoals>('/api/goals', 'PUT', {
    steps,
    calories,
    water,
  });
}

// --- Settings Endpoints (Theme & Reminders) ---

export async function apiGetUserSettings(): Promise<ApiUserSettings> {
  return await sendApiRequest<ApiUserSettings>('/api/settings', 'GET');
}

export async function apiUpdateThemeMode(
  themeMode: 'system' | 'light' | 'dark'
): Promise<void> {
  await sendApiRequest('/api/settings/theme', 'PUT', { themeMode });
}

export async function apiUpdateReminderSettings(settings: {
  waterEnabled: boolean;
  waterTime1: string;
  waterTime2: string;
  waterTime3: string;
  dailyEnabled: boolean;
  dailyTime: string;
  scheduledIds: string[];
}): Promise<void> {
  await sendApiRequest('/api/settings/reminders', 'PUT', settings);
}
