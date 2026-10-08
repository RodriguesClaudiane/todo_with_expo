import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { createCategory, deleteCategory, updateCategory } from '@/db/categories';
import { CATEGORY_NAME_MAX_LENGTH, type CategoryWithCount } from '@/db/models';
import { CATEGORY_COLORS } from '@/db/schema';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';
import { showError } from '@/lib/errors';

export default function CategoriesScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { categories, error, reload } = useCategories();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(CATEGORY_COLORS[0]);

  const add = async () => {
    try {
      await createCategory(db, newName, newColor);
      setNewName('');
      reload();
    } catch (e) {
      showError(e, 'Could not create the category.');
    }
  };

  const startEditing = (category: CategoryWithCount) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditColor(category.color);
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    try {
      await updateCategory(db, editingId, editName, editColor);
      setEditingId(null);
      reload();
    } catch (e) {
      showError(e, 'Could not rename the category.');
    }
  };

  const confirmDelete = (category: CategoryWithCount) => {
    const message =
      category.taskCount > 0
        ? `${category.taskCount} task${category.taskCount === 1 ? '' : 's'} will become uncategorized. The tasks themselves are kept.`
        : 'No tasks use this category.';
    Alert.alert(`Delete “${category.name}”?`, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory(db, category.id);
            if (editingId === category.id) setEditingId(null);
            reload();
          } catch (e) {
            showError(e, 'Could not delete the category.');
          }
        },
      },
    ]);
  };

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <FlatList
        data={categories}
        keyExtractor={(c) => String(c.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}
        ListHeaderComponent={
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.label, { color: theme.text }]}>New category</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Health"
              placeholderTextColor={theme.textSecondary}
              maxLength={CATEGORY_NAME_MAX_LENGTH}
              returnKeyType="done"
              onSubmitEditing={add}
              style={[inputStyle, { backgroundColor: theme.background }]}
            />
            <ColorPicker value={newColor} onChange={setNewColor} />
            <Button title="Add category" onPress={add} disabled={!newName.trim()} />
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.textSecondary }]}>
            {error ? `Could not load categories: ${error.message}` : 'No categories yet.'}
          </Text>
        }
        renderItem={({ item }) =>
          editingId === item.id ? (
            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                maxLength={CATEGORY_NAME_MAX_LENGTH}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={saveEdit}
                style={[inputStyle, { backgroundColor: theme.background }]}
              />
              <ColorPicker value={editColor} onChange={setEditColor} />
              <View style={styles.rowButtons}>
                <Button title="Save" onPress={saveEdit} disabled={!editName.trim()} style={styles.flex} />
                <Button title="Cancel" variant="secondary" onPress={() => setEditingId(null)} style={styles.flex} />
              </View>
            </View>
          ) : (
            <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <View style={styles.flex}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.count, { color: theme.textSecondary }]}>
                  {item.taskCount} task{item.taskCount === 1 ? '' : 's'}
                </Text>
              </View>
              <Button title="Rename" variant="secondary" onPress={() => startEditing(item)} />
              <Button title="Delete" variant="danger" onPress={() => confirmDelete(item)} />
            </View>
          )
        }
      />
    </View>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.colors}>
      {CATEGORY_COLORS.map((color) => (
        <Pressable
          key={color}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === color }}
          accessibilityLabel={`Color ${color}`}
          onPress={() => onChange(color)}
          style={[
            styles.swatch,
            { backgroundColor: color, borderColor: value === color ? theme.text : 'transparent' },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: Spacing.two,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 12,
    marginBottom: Spacing.two,
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
    fontSize: 16,
  },
  colors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 12,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  count: {
    fontSize: 13,
  },
  rowButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.four,
  },
});
