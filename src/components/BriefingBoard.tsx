import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BRIEFING_CATEGORIES, briefingCategoryLabel, getBriefingList } from '../api/briefingApi';
import type { Briefing, BriefingCategory } from '../api/briefingApi';
import { colors } from '../constants/colors';
import { markdownToPlainPreview } from '../utils/markdownPreview';

const PAGE_SIZE = 5;

export const BRIEFING_CATEGORY_COLOR: Record<string, { fg: string; bg: string }> = {
  MORNING:     { fg: colors.amber,  bg: colors.amberDim },
  EVENING:     { fg: colors.indigo, bg: colors.indigoDim },
  AFTER_CLOSE: { fg: colors.teal,   bg: colors.tealDim },
};

export function BriefingCategoryBadge({ category }: { category: string }) {
  const c = BRIEFING_CATEGORY_COLOR[category] ?? { fg: colors.textDim, bg: colors.surfaceAlt };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{briefingCategoryLabel(category)}</Text>
    </View>
  );
}

/**
 * 홈 화면 하단 브리핑 게시판 (읽기 전용) — 카테고리 필터 + 이전/다음 페이징, 항목 탭 시 상세 화면으로.
 * 글은 외부 뉴스브리핑 자동화가 API로 등록한다. refreshKey가 바뀌면(홈 당겨서 새로고침) 다시 불러온다.
 */
export default function BriefingBoard({ refreshKey }: { refreshKey: number }) {
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const [category,  setCategory]  = useState<BriefingCategory | 'ALL'>('ALL');
  const [page,      setPage]      = useState(1);
  const [items,     setItems]     = useState<Briefing[]>([]);
  const [totalPage, setTotalPage] = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getBriefingList({ ...(category !== 'ALL' ? { category } : {}), page, size: PAGE_SIZE });
      if (res.status >= 400) { setError(true); return; }
      setItems(res.data?.content ?? []);
      setTotalPage(res.data?.totalPage || 1);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [category, page]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const changeCategory = (c: BriefingCategory | 'ALL') => {
    setCategory(c);
    setPage(1);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>브리핑</Text>
        {loading && <ActivityIndicator color={colors.teal} size="small" />}
      </View>

      <View style={styles.tabRow}>
        {([{ value: 'ALL', label: '전체' }, ...BRIEFING_CATEGORIES] as const).map(c => (
          <TouchableOpacity
            key={c.value}
            style={[styles.tab, category === c.value && styles.tabActive]}
            onPress={() => changeCategory(c.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, category === c.value && styles.tabTextActive]} numberOfLines={1}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <Text style={styles.emptyText}>브리핑을 불러오지 못했습니다.</Text>
      ) : !loading && items.length === 0 ? (
        <Text style={styles.emptyText}>등록된 브리핑이 없습니다.</Text>
      ) : (
        items.map((item, idx) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.item, idx > 0 && styles.itemBorder]}
            onPress={() => navigation.navigate('BriefingDetail', { id: item.id })}
            activeOpacity={0.7}
          >
            <View style={styles.itemTop}>
              <BriefingCategoryBadge category={item.category} />
              <Text style={styles.itemDate}>{item.briefingDate}</Text>
            </View>
            <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
            {!!item.preview && (
              <Text style={styles.itemPreview} numberOfLines={2}>{markdownToPlainPreview(item.preview)}</Text>
            )}
          </TouchableOpacity>
        ))
      )}

      {totalPage > 1 && (
        <View style={styles.pager}>
          <TouchableOpacity
            style={[styles.pagerBtn, (page <= 1 || loading) && styles.pagerBtnDisabled]}
            onPress={() => setPage(p => p - 1)}
            disabled={page <= 1 || loading}
            activeOpacity={0.7}
          >
            <Text style={styles.pagerBtnText}>‹ 이전</Text>
          </TouchableOpacity>
          <Text style={styles.pagerText}>{page} / {totalPage}</Text>
          <TouchableOpacity
            style={[styles.pagerBtn, (page >= totalPage || loading) && styles.pagerBtnDisabled]}
            onPress={() => setPage(p => p + 1)}
            disabled={page >= totalPage || loading}
            activeOpacity={0.7}
          >
            <Text style={styles.pagerBtnText}>다음 ›</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card:          {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.borderDim, padding: 14, gap: 10,
  },
  headerRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:         { fontSize: 16, fontWeight: '700', color: colors.text },
  tabRow:        { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 10, padding: 4, gap: 4 },
  tab:           { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive:     { backgroundColor: colors.teal },
  tabText:       { fontSize: 13, fontWeight: '600', color: colors.textDim },
  tabTextActive: { color: colors.bg },
  emptyText:     { fontSize: 13, color: colors.textDim, textAlign: 'center', paddingVertical: 20 },
  item:          { paddingVertical: 10, gap: 4 },
  itemBorder:    { borderTopWidth: 1, borderTopColor: colors.borderDim },
  itemTop:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemDate:      { fontSize: 12, color: colors.textDim },
  itemTitle:     { fontSize: 15, fontWeight: '600', color: colors.text },
  itemPreview:   { fontSize: 13, color: colors.textSub, lineHeight: 18 },
  badge:         { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText:     { fontSize: 11, fontWeight: '700' },
  pager:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  pagerBtn:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  pagerBtnDisabled: { opacity: 0.4 },
  pagerBtnText:  { fontSize: 13, fontWeight: '600', color: colors.text },
  pagerText:     { fontSize: 13, color: colors.textSub },
});
