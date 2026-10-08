import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  selected?: boolean;
  /** Category colour shown as a dot before the label. */
  color?: string | null;
  onPress?: () => void;
};

export function Chip({ label, selected, color, onPress }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.primary : theme.backgroundElement,
          borderColor: selected ? theme.primary : theme.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text
        numberOfLines={1}
        style={[styles.label, { color: selected ? theme.onPrimary : theme.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Small read-only badge used inside task rows. */
export function CategoryBadge({ name, color }: { name: string; color: string | null }) {
  const theme = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.dot, { backgroundColor: color ?? theme.textSecondary }]} />
      <Text numberOfLines={1} style={[styles.badgeLabel, { color: theme.textSecondary }]}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 10,
    maxWidth: 160,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});
