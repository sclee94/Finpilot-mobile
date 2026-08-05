import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { colors } from '../constants/colors';
import { getSymbolsByCategory, SYMBOL_CATEGORIES, type SymbolCategory } from '../api/symbolApi';
import type { SymbolUniverse } from '../types';

/** 종목 선택 필드 — 탭하면 카테고리(코스피200/나스닥100/지수) → 종목 2단계 선택 모달이 뜸. DB 기반, 현재가 내림차순 정렬 */
export default function SymbolPickerModal({
  value,
  onChange,
}: {
  value: string;
  onChange: (symbol: string, symbolName: string) => void;
}) {
  const [visible, setVisible]   = useState(false);
  const [category, setCategory] = useState<SymbolCategory>('KOSPI200');
  const [symbols, setSymbols]   = useState<SymbolUniverse[]>([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    getSymbolsByCategory(category)
      .then(res => { if (!cancelled) setSymbols(res.data ?? []); })
      .catch(() => { if (!cancelled) setSymbols([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, category]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return symbols;
    return symbols.filter(s => s.symbolName.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q));
  }, [symbols, search]);

  const selected = symbols.find(s => s.symbol === value);

  const handleClose = () => { setVisible(false); setSearch(''); };
  const handleSelect = (s: SymbolUniverse) => {
    onChange(s.symbol, s.symbolName);
    handleClose();
  };

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={() => setVisible(true)} activeOpacity={0.7}>
        <Text style={value ? styles.fieldValue : styles.fieldPlaceholder}>
          {value ? `${selected?.symbolName ?? ''} (${value})` : '종목을 선택하세요'}
        </Text>
        <Text style={styles.fieldChevron}>›</Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
        <View style={styles.container}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>종목 선택</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.categoryRow}>
            {SYMBOL_CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.value}
                style={[styles.categoryBtn, category === c.value && styles.categoryBtnActive]}
                onPress={() => { setCategory(c.value); setSearch(''); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryText, category === c.value && styles.categoryTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="종목명 또는 코드 검색"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
            />
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.teal} size="large" />
            </View>
          ) : (
            <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <Text style={styles.empty}>종목이 없습니다</Text>
              ) : (
                filtered.map(s => (
                  <TouchableOpacity
                    key={s.symbol}
                    style={[styles.row, s.symbol === value && styles.rowSelected]}
                    onPress={() => handleSelect(s)}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={styles.rowName}>{s.symbolName}</Text>
                      <Text style={styles.rowCode}>{s.symbol}</Text>
                    </View>
                    <Text style={styles.rowPrice}>
                      {s.lastPrice != null ? s.lastPrice.toLocaleString() : '—'}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderDim,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  fieldValue:       { fontSize: 14, color: colors.text },
  fieldPlaceholder: { fontSize: 14, color: colors.textDim },
  fieldChevron:     { fontSize: 16, color: colors.textDim },

  container:  { flex: 1, backgroundColor: colors.surface },
  handle:     { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  header:     {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: colors.borderDim,
  },
  title:      { fontSize: 17, fontWeight: '700', color: colors.text },
  closeBtn:   { padding: 4 },
  closeText:  { fontSize: 16, color: colors.textDim },

  categoryRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 0 },
  categoryBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderDim,
  },
  categoryBtnActive: { backgroundColor: colors.tealDim, borderColor: colors.teal },
  categoryText:       { fontSize: 13, fontWeight: '700', color: colors.textDim },
  categoryTextActive: { color: colors.teal },

  searchWrap:  { padding: 16, paddingBottom: 8 },
  searchInput: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderDim,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 13, color: colors.text,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, paddingHorizontal: 16 },
  empty:  { color: colors.textDim, fontSize: 14, textAlign: 'center', marginTop: 40 },

  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderDim, borderRadius: 12,
    backgroundColor: colors.bg, padding: 14, marginBottom: 8,
  },
  rowSelected: { borderColor: colors.teal },
  rowName:  { fontSize: 14, fontWeight: '700', color: colors.text },
  rowCode:  { fontSize: 12, color: colors.textDim, marginTop: 2 },
  rowPrice: { fontSize: 13, fontWeight: '600', color: colors.textSub },
});
