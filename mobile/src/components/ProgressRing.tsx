// Circular SVG progress ring used on the Dashboard steps card

import { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  progressColor: string;
  trackColor: string;
  children?: ReactNode;
}

// Build an SVG arc path from a start angle to an end angle
function createArcPath(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((endAngle - 90) * Math.PI) / 180;

  const startX = centerX + radius * Math.cos(endRad);
  const startY = centerY + radius * Math.sin(endRad);
  const endX = centerX + radius * Math.cos(startRad);
  const endY = centerY + radius * Math.sin(startRad);

  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${endX} ${endY}`;
}

export default function ProgressRing({
  progress,
  size = 100,
  strokeWidth = 10,
  progressColor,
  trackColor,
  children,
}: ProgressRingProps) {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;

  const startAngle = 135;
  const sweepAngle = 270;
  const endAngle = startAngle + sweepAngle;

  const arcLength = (sweepAngle / 360) * (2 * Math.PI * radius);
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const strokeOffset = arcLength * (1 - clampedProgress);

  const arcPath = createArcPath(center, center, radius, startAngle, endAngle);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Path
          d={arcPath}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />

        {clampedProgress > 0 && (
          <Path
            d={arcPath}
            stroke={progressColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${arcLength} ${arcLength}`}
            strokeDashoffset={strokeOffset}
          />
        )}
      </Svg>

      {children ? <View style={styles.centerContent}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
