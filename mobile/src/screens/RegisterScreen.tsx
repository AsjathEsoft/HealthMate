// Registration screen for creating a new HealthMate user account

import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isValidEmail } from '../utils/validation';
import AppIcon from '../components/AppIcon';
import CommonButton from '../components/CommonButton';

export default function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const { colors, isDark } = useTheme();

  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleRegister() {
    setErrorMessage(null);

    const trimmedName = userName.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      setErrorMessage('Please enter a display name with at least 2 characters.');
      return;
    }

    if (trimmedName.length > 50) {
      setErrorMessage('Display name cannot exceed 50 characters.');
      return;
    }

    if (trimmedEmail === '') {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address (e.g., alex@example.com).');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    try {
      setIsSubmitting(true);
      await register(trimmedName, trimmedEmail, password);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Registration failed. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleGoToLogin() {
    setErrorMessage(null);
    navigation.navigate('Login');
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.brandContainer}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <AppIcon name="pulse" size={36} color={colors.primary} />
            </View>
            <Text style={[styles.brandTitle, { color: colors.text }]}>Create Account</Text>
            <Text style={[styles.brandSubtitle, { color: colors.textMuted }]}>
              Start tracking your health journey with HealthMate
            </Text>
          </View>

          {/* Form Card */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            {errorMessage ? (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
                ]}
              >
                <AppIcon name="alert-circle-outline" size={18} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Display Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>DISPLAY NAME</Text>
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                ]}
              >
                <AppIcon name="person-outline" size={18} color={colors.textSubtle} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="e.g. Asjath"
                  placeholderTextColor={colors.textSubtle}
                  value={userName}
                  onChangeText={(text) => {
                    setUserName(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!isSubmitting}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>EMAIL ADDRESS</Text>
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                ]}
              >
                <AppIcon name="mail-outline" size={18} color={colors.textSubtle} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="name@example.com"
                  placeholderTextColor={colors.textSubtle}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>PASSWORD</Text>
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                ]}
              >
                <AppIcon name="lock-closed-outline" size={18} color={colors.textSubtle} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.textSubtle}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!isSubmitting}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <AppIcon
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textSubtle}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>CONFIRM PASSWORD</Text>
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                ]}
              >
                <AppIcon name="shield-checkmark-outline" size={18} color={colors.textSubtle} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Re-enter your password"
                  placeholderTextColor={colors.textSubtle}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  editable={!isSubmitting}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <AppIcon
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textSubtle}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <CommonButton
              title="Create Account"
              onPress={handleRegister}
              loading={isSubmitting}
              style={styles.submitButton}
              accessibilityLabel="Create account button"
            />

            <View style={styles.switchAuthRow}>
              <Text style={[styles.switchAuthPrompt, { color: colors.textMuted }]}>
                Already have an account?{' '}
              </Text>
              <TouchableOpacity
                onPress={handleGoToLogin}
                disabled={isSubmitting}
                accessibilityLabel="Navigate to login"
              >
                <Text style={[styles.switchAuthLink, { color: colors.primary }]}>Log In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 8,
  },
  switchAuthRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  switchAuthPrompt: {
    fontSize: 14,
  },
  switchAuthLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});

