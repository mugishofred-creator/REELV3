import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../lib/theme';
import { Checkbox } from './Checkbox';

interface Props {
  items: string[];
  checked?: boolean[];
  onChange: (items: string[]) => void;
  onToggle?: (index: number) => void;
  placeholder?: string;
  hideToggle?: boolean;
  disabled?: boolean;
}

export function ListEditor({
  items,
  checked = [],
  onChange,
  onToggle,
  placeholder = 'Ajouter...',
  hideToggle = false,
  disabled = false,
}: Props) {
  const [draft, setDraft] = useState('');

  function add() {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft('');
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <View>
      {items.map((item, i) => {
        if (hideToggle) {
          return (
            <View key={i} style={styles.row}>
              <View style={styles.bullet} />
              <Text style={styles.itemText}>{item}</Text>
              {!disabled && (
                <TouchableOpacity onPress={() => remove(i)} style={styles.del}>
                  <Text style={styles.delText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }
        return (
          <View key={i} style={styles.checkRow}>
            <View style={{ flex: 1 }}>
              <Checkbox
                label={item}
                checked={checked[i] ?? false}
                onToggle={() => onToggle?.(i)}
                disabled={disabled}
              />
            </View>
            {!disabled && (
              <TouchableOpacity onPress={() => remove(i)} style={styles.del}>
                <Text style={styles.delText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
      {!disabled && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            placeholderTextColor={COLORS.creamMuted}
            onSubmitEditing={add}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addBtn} onPress={add}>
            <Text style={styles.addText}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: SPACING.sm,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORS.amberDim,
    marginHorizontal: 6,
  },
  itemText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.cream,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  del: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  delText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
    color: COLORS.ember,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    marginTop: SPACING.xs,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.inkMid,
    borderWidth: 1,
    borderColor: COLORS.inkBorder,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.cream,
  },
  addBtn: {
    backgroundColor: COLORS.amberGlow,
    borderWidth: 1,
    borderColor: COLORS.amberDim,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 20,
    color: COLORS.amber,
    lineHeight: 22,
  },
});
