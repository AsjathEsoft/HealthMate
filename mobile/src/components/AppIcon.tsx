// Simple icon wrapper component using Ionicons

import { StyleProp, TextStyle } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';

interface AppIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export default function AppIcon({
  name,
  size = 20,
  color = '#0f172a',
  style,
}: AppIconProps) {
  return <Ionicons name={name as any} size={size} color={color} style={style} />;
}
