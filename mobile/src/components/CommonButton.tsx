// Reusable primary action button used across forms and screens

import {
  TouchableOpacity,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import AppIcon from './AppIcon';

interface CommonButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  iconName?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export default function CommonButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  iconName,
  style,
  accessibilityLabel,
}: CommonButtonProps) {
  const { colors } = useTheme();
  const isButtonDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: colors.primary },
        isButtonDisabled && styles.disabledButton,
        style,
      ]}
      onPress={onPress}
      disabled={isButtonDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
    >
      {loading ? (
        <ActivityIndicator color={colors.actionText} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {iconName ? <AppIcon name={iconName} size={18} color={colors.actionText} /> : null}
          <Text style={[styles.buttonText, { color: colors.actionText }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.65,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

