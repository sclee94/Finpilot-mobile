import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

const CATEGORY_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  KOSPI200:  { bg: colors.indigoDim,  border: colors.indigo,  text: colors.indigo },
  KOSDAQ150: { bg: colors.fuchsiaDim, border: colors.fuchsia, text: colors.fuchsia },
  NASDAQ100: { bg: colors.cyanDim,    border: colors.cyan,    text: colors.cyan },
};
const CATEGORY_LABEL: Record<string, string> = {
  KOSPI200:  '코스피',
  KOSDAQ150: '코스닥',
  NASDAQ100: '나스닥',
};

export function categoryLabel(category?: string | null): string {
  if (!category) return '—';
  return CATEGORY_LABEL[category] ?? category;
}

/** 세션/거래내역 카테고리(코스피200/코스닥150/나스닥100) 표시 배지 — category 없으면 아무것도 안 그림 */
export default function CategoryBadge({ category }: { category?: string | null }) {
  if (!category) return null;
  const c = CATEGORY_COLOR[category] ?? { bg: colors.surfaceAlt, border: colors.border, text: colors.textDim };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.text, { color: c.text }]}>{CATEGORY_LABEL[category] ?? category}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  text:  { fontSize: 11, fontWeight: '700' },
});
