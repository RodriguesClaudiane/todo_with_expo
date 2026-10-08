import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Button } from '@/components/button';
import { Spacing } from '@/constants/theme';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { configureNotifications } from '@/services/notifications';

configureNotifications();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      {/* Opens the database and runs migrations before any screen renders. */}
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
        <Stack>
          <Stack.Screen name="index" options={{ title: 'Tasks' }} />
          <Stack.Screen name="task/[id]" options={{ title: 'Task' }} />
          <Stack.Screen name="categories" options={{ title: 'Categories' }} />
        </Stack>
      </SQLiteProvider>
    </ThemeProvider>
  );
}

/** Shown if the database cannot be opened or any screen throws while rendering. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();
  return (
    <View style={[styles.error, { backgroundColor: theme.background }]}>
      <Text style={[styles.errorTitle, { color: theme.text }]}>Something went wrong</Text>
      <Text style={[styles.errorMessage, { color: theme.textSecondary }]}>{error.message}</Text>
      <Button title="Try again" onPress={retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  errorMessage: {
    fontSize: 14,
  },
});
