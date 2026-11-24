// Profile screen for updating the user's display name, email, and profile photo

import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth, getUserInitials } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  getUserProfile,
  updateUserProfile,
  removeUserProfilePhoto,
} from '../database/userDb';
import { isValidEmail } from '../utils/validation';
import AppIcon from '../components/AppIcon';
import CommonButton from '../components/CommonButton';

// Copy a chosen gallery image into permanent app storage so it persists after cache cleanup
async function savePhotoToAppFolder(sourceUri: string): Promise<string> {
  const docFolder = FileSystem.documentDirectory;
  if (!docFolder) {
    throw new Error('App storage folder is not available.');
  }

  const extension = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
  const destinationUri = `${docFolder}profile_${Date.now()}.${extension}`;

  await FileSystem.copyAsync({
    from: sourceUri,
    to: destinationUri,
  });

  return destinationUri;
}

// Safely remove an old profile photo file from app storage
async function deleteOldPhotoFile(fileUri: string | null): Promise<void> {
  if (!fileUri) {
    return;
  }

  try {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  } catch {
    // Ignore if file was already removed
  }
}

export default function ProfileScreen({ navigation }: any) {
  const { currentUser, updateSessionUser } = useAuth();
  const { colors, isDark } = useTheme();

  const [userName, setUserName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [savedPhotoUri, setSavedPhotoUri] = useState<string | null>(null);

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadProfile() {
    if (!currentUser) {
      return;
    }

    try {
      const profile = await getUserProfile(currentUser.id);
      if (profile) {
        setUserName(profile.name);
        setEmail(profile.email || '');
        setSelectedPhotoUri(profile.photoUri);
        setSavedPhotoUri(profile.photoUri);
      } else {
        setUserName(currentUser.name);
        setEmail(currentUser.email || '');
        setSelectedPhotoUri(currentUser.photoUri);
        setSavedPhotoUri(currentUser.photoUri);
      }
    } catch {
      setUserName(currentUser.name);
      setEmail(currentUser.email || '');
      setSelectedPhotoUri(currentUser.photoUri);
      setSavedPhotoUri(currentUser.photoUri);
    }
  }

  useEffect(() => {
    loadProfile();

    const unsubscribe = navigation.addListener('focus', () => {
      setErrorMessage(null);
      setSuccessMessage(null);
      loadProfile();
    });

    return unsubscribe;
  }, [navigation, currentUser?.id]);

  async function handlePickPhoto() {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage('Gallery permission is required to select a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setSelectedPhotoUri(result.assets[0].uri);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not select photo.';
      setErrorMessage(message);
    }
  }

  function handleRemovePhoto() {
    Alert.alert('Remove Photo', 'Are you sure you want to remove your profile photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSelectedPhotoUri(null);
          setSuccessMessage(null);

          if (currentUser && savedPhotoUri) {
            try {
              setSaving(true);
              await removeUserProfilePhoto(currentUser.id);
              await deleteOldPhotoFile(savedPhotoUri);
              setSavedPhotoUri(null);
              updateSessionUser(userName || currentUser.name, email || currentUser.email, null);
              setSuccessMessage('Profile photo removed.');
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Could not remove profile photo.';
              setErrorMessage(message);
            } finally {
              setSaving(false);
            }
          }
        },
      },
    ]);
  }

  async function handleSaveProfile() {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentUser) {
      setErrorMessage('You must be logged in to update your profile.');
      return;
    }

    const trimmedName = userName.trim();
    if (trimmedName === '') {
      setErrorMessage('Display name is required.');
      return;
    }

    if (trimmedName.length > 50) {
      setErrorMessage('Display name must be 50 characters or less.');
      return;
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail !== '' && !isValidEmail(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    let finalPhotoUri = savedPhotoUri;

    try {
      setSaving(true);

      // Copy newly chosen image into permanent app storage
      if (selectedPhotoUri && selectedPhotoUri !== savedPhotoUri) {
        finalPhotoUri = await savePhotoToAppFolder(selectedPhotoUri);
      } else if (selectedPhotoUri === null) {
        finalPhotoUri = null;
      }

      const updated = await updateUserProfile(
        currentUser.id,
        trimmedName,
        trimmedEmail || null,
        finalPhotoUri
      );

      // Clean up replaced photo file
      if (savedPhotoUri && savedPhotoUri !== finalPhotoUri) {
        await deleteOldPhotoFile(savedPhotoUri);
      }

      setSavedPhotoUri(updated.photoUri);
      setSelectedPhotoUri(updated.photoUri);

      // Immediately update AuthContext so the Dashboard greeting shows the new name right away
      updateSessionUser(updated.name, updated.email, updated.photoUri);

      setSuccessMessage('Profile saved! Dashboard greeting and avatar updated.');
    } catch (error) {
      if (finalPhotoUri && finalPhotoUri !== savedPhotoUri) {
        await deleteOldPhotoFile(finalPhotoUri);
      }
      const message = error instanceof Error ? error.message : 'Could not save profile.';
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  }

  const avatarInitials = getUserInitials(userName || currentUser?.name);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>My Profile</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Update your name and profile photo.
            </Text>
          </View>

          {/* Avatar Card */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View style={styles.avatarContainer}>
              <View style={[styles.avatarWrapper, { borderColor: colors.cardBorder }]}>
                {selectedPhotoUri ? (
                  <Image source={{ uri: selectedPhotoUri }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.avatarInitials, { color: colors.primary }]}>
                      {avatarInitials}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.avatarActions}>
                <TouchableOpacity
                  style={[
                    styles.photoButton,
                    { backgroundColor: colors.primaryLight, borderColor: colors.cardBorder },
                  ]}
                  onPress={handlePickPhoto}
                  activeOpacity={0.8}
                  accessibilityLabel="Choose profile photo from gallery"
                >
                  <AppIcon name="camera-outline" size={16} color={colors.primary} />
                  <Text style={[styles.photoButtonText, { color: colors.primary }]}>
                    {selectedPhotoUri ? 'Change Photo' : 'Choose Photo'}
                  </Text>
                </TouchableOpacity>

                {selectedPhotoUri ? (
                  <TouchableOpacity
                    style={[
                      styles.removePhotoButton,
                      { borderColor: colors.errorBorder, backgroundColor: colors.errorBg },
                    ]}
                    onPress={handleRemovePhoto}
                    activeOpacity={0.8}
                    accessibilityLabel="Remove profile photo"
                  >
                    <AppIcon name="trash-outline" size={16} color={colors.error} />
                    <Text style={[styles.removePhotoButtonText, { color: colors.error }]}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>

          {/* Details Form Card */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <Text style={[styles.sectionHeading, { color: colors.text }]}>Personal Details</Text>

            {errorMessage ? (
              <View
                style={[
                  styles.banner,
                  { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
                ]}
              >
                <AppIcon name="alert-circle-outline" size={18} color={colors.error} />
                <Text style={[styles.bannerText, { color: colors.error }]}>{errorMessage}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View
                style={[
                  styles.banner,
                  { backgroundColor: colors.statusSuccessBg, borderColor: colors.cardBorder },
                ]}
              >
                <AppIcon name="checkmark-circle" size={18} color={colors.statusSuccessText} />
                <Text style={[styles.bannerText, { color: colors.statusSuccessText }]}>
                  {successMessage}
                </Text>
              </View>
            ) : null}

            {/* Display Name */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <View style={[styles.iconPill, { backgroundColor: colors.primaryLight }]}>
                  <AppIcon name="person-outline" size={15} color={colors.primary} />
                </View>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                  DISPLAY NAME *
                </Text>
              </View>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  },
                ]}
                value={userName}
                onChangeText={(text) => {
                  setUserName(text);
                  setSuccessMessage(null);
                }}
                placeholder="e.g. Asjath"
                placeholderTextColor={colors.textSubtle}
                maxLength={50}
                editable={!saving}
              />
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <View style={[styles.iconPill, { backgroundColor: colors.surfaceSecondary }]}>
                  <AppIcon name="mail-outline" size={15} color={colors.textSubtle} />
                </View>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                  ACCOUNT EMAIL (OPTIONAL)
                </Text>
              </View>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  },
                ]}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setSuccessMessage(null);
                }}
                placeholder="e.g. asjath@example.com"
                placeholderTextColor={colors.textSubtle}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!saving}
              />
            </View>

            <CommonButton
              title="Save Profile"
              iconName="save-outline"
              onPress={handleSaveProfile}
              loading={saving}
              style={styles.saveButton}
            />
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
  keyboardContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
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
  avatarContainer: {
    alignItems: 'center',
    gap: 16,
  },
  avatarWrapper: {
    borderWidth: 2,
    borderRadius: 54,
    padding: 3,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  avatarActions: {
    flexDirection: 'row',
    gap: 10,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  photoButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  removePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  removePhotoButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  iconPill: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 8,
  },
});

