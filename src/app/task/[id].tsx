import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DueDateField } from '@/components/due-date-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { TITLE_MAX_LENGTH, type TaskInput } from '@/db/models';
import { getTask } from '@/db/tasks';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';
import { explainReminderOutcome, showError } from '@/lib/errors';
import { removeTask, saveTask } from '@/services/task-service';

const EMPTY_FORM: TaskInput = {
  title: '',
  description: '',
  completed: false,
  dueDateTime: null,
  categoryId: null,
};

/**
 * Create (`/task/new`) and edit (`/task/<id>`) screen.
 * Only the id travels through navigation; the task is read from SQLite here,
 * so the form always shows the persisted values.
 */
export default function TaskEditorScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const taskId = params.id === 'new' ? null : Number(params.id);
  const isNew = taskId === null;
  const invalidId = taskId !== null && !Number.isInteger(taskId);

  const { categories } = useCategories();
  const [form, setForm] = useState<TaskInput>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<TaskInput>(EMPTY_FORM);
  const [loading, setLoading] = useState(!isNew && !invalidId);
  const [missing, setMissing] = useState(false);
  const notFound = invalidId || missing;
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  useEffect(() => {
    if (taskId === null || !Number.isInteger(taskId)) return;
    let cancelled = false;
    getTask(db, taskId)
      .then((task) => {
        if (cancelled) return;
        if (!task) {
          setMissing(true);
          return;
        }
        const values: TaskInput = {
          title: task.title,
          description: task.description,
          completed: task.completed,
          dueDateTime: task.dueDateTime,
          categoryId: task.categoryId,
        };
        setForm(values);
        setInitialForm(values);
      })
      .catch((e) => showError(e, 'Could not load the task.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [db, taskId]);

  const update = (changes: Partial<TaskInput>) => setForm((current) => ({ ...current, ...changes }));
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const save = async () => {
    if (!form.title.trim()) {
      setTitleError('Title is required.');
      return;
    }
    setSaving(true);
    try {
      const { reminder } = await saveTask(db, taskId, form);
      explainReminderOutcome(reminder);
      router.back();
    } catch (e) {
      showError(e, 'Could not save the task. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (!isDirty) {
      router.back();
      return;
    }
    Alert.alert('Discard changes?', 'Your changes to this task will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const confirmDelete = () => {
    if (taskId === null) return;
    Alert.alert('Delete task?', `“${form.title || 'This task'}” will be deleted permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeTask(db, taskId);
            router.back();
          } catch (e) {
            showError(e, 'Could not delete the task.');
          }
        },
      },
    ]);
  };

  const title = isNew ? 'New task' : 'Edit task';

  if (loading || notFound) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title }} />
        {loading ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text style={[styles.label, { color: theme.text }]}>This task no longer exists.</Text>
            <Button title="Back to tasks" onPress={() => router.back()} />
          </>
        )}
      </View>
    );
  }

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.text }]}>Title *</Text>
          <TextInput
            value={form.title}
            onChangeText={(text) => {
              update({ title: text });
              if (titleError && text.trim()) setTitleError(null);
            }}
            placeholder="What needs to be done?"
            placeholderTextColor={theme.textSecondary}
            maxLength={TITLE_MAX_LENGTH}
            autoFocus={isNew}
            returnKeyType="next"
            style={[inputStyle, titleError ? { borderColor: theme.danger } : null]}
          />
          {titleError ? <Text style={[styles.error, { color: theme.danger }]}>{titleError}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.text }]}>Description</Text>
          <TextInput
            value={form.description}
            onChangeText={(text) => update({ description: text })}
            placeholder="Optional details"
            placeholderTextColor={theme.textSecondary}
            multiline
            textAlignVertical="top"
            style={[inputStyle, styles.multiline]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.text }]}>Category</Text>
          <View style={styles.chips}>
            <Chip label="None" selected={form.categoryId === null} onPress={() => update({ categoryId: null })} />
            {categories.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                color={c.color}
                selected={form.categoryId === c.id}
                onPress={() => update({ categoryId: c.id })}
              />
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.text }]}>Due date and time</Text>
          <DueDateField value={form.dueDateTime} onChange={(dueDateTime) => update({ dueDateTime })} />
        </View>

        <View style={[styles.switchRow, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.label, { color: theme.text }]}>Completed</Text>
          <Switch
            value={form.completed}
            onValueChange={(completed) => update({ completed })}
            accessibilityLabel="Completed"
          />
        </View>

        <View style={styles.actions}>
          <Button title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />
          <Button title="Cancel" variant="secondary" onPress={cancel} disabled={saving} />
          {!isNew ? <Button title="Delete task" variant="danger" onPress={confirmDelete} disabled={saving} /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  content: {
    gap: Spacing.four,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  field: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  multiline: {
    minHeight: 96,
  },
  error: {
    fontSize: 13,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  actions: {
    gap: Spacing.two,
  },
});
