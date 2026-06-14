import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getStrategyConfigList, deleteStrategyConfig } from '../api/strategyApi';
import { authStorage } from '../utils/auth';
import { colors } from '../constants/colors';
import { getSymbolName } from '../constants/symbolNames';
import type { StrategyConfig } from '../types';

const PARAM_LABELS: { key: keyof StrategyConfig; label: string; format?: (v: unknown) => string }[] = [
  { key: 'symbol',            label: '종목 코드',       format: v => `${getSymbolName(String(v))} (${v})` },
  { key: 'initialCapital',    label: '초기 자본',       format: v => `${Number(v).toLocaleString()} 원` },
  { key: 'riskPerTrade',      label: '위험 비율',       format: v => `${(Number(v) * 100).toFixed(1)}%` },
  { key: 'adxThreshold',      label: 'ADX 임계값' },
  { key: 'adxSidewaysFloor',  label: 'ADX 횡보 하한선' },
  { key: 'adxPersist',        label: 'ADX 지속 기간' },
  { key: 'diGapMin',          label: 'DI 격차 최소값' },
  { key: 'rsiLongFloor',      label: 'RSI 롱 진입 하한' },
  { key: 'rsiLongEntry',      label: 'RSI 롱 진입 상한' },
  { key: 'rsiShortEntry',     label: 'RSI 숏 진입' },
  { key: 'rsiOversoldEntry',  label: 'RSI 과매도 반등' },
  { key: 'atrSlMult',         label: 'ATR 손절 배수' },
  { key: 'atrTpMult',         label: 'ATR 익절 배수' },
  { key: 'minHoldBars',       label: '최소 보유 봉' },
  { key: 'slCooldownBars',    label: '손절 쿨다운' },
  { key: 'consecSlLimit',     label: '연속 손절 한도' },
  { key: 'maxDdStop',         label: '최대 낙폭 정지', format: v => Number(v) === 0 ? '비활성' : String(v) },
  { key: 'commission',        label: '수수료',          format: v => `${(Number(v) * 100).toFixed(3)}%` },
  { key: 'slippage',          label: '슬리피지',        format: v => `${(Number(v) * 100).toFixed(3)}%` },
  { key: 'usePrevBarSignal',  label: '이전 봉 신호',    format: v => v ? 'ON' : 'OFF' },
  { key: 'indicatorWindow',   label: '지표 룩백 기간' },
  { key: 'tradingDaysPerYear',label: '연간 거래일 수' },
  { key: 'maxAddCount',       label: '최대 추가 매수' },
];

function DetailModal({
  strategy,
  onClose,
}: {
  strategy: StrategyConfig;
  onClose: () => void;
}) {
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={detail.container}>
        <View style={detail.handle} />
        <View style={detail.header}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={detail.title}>{strategy.title}</Text>
            <Text style={detail.subtitle}>
              {getSymbolName(strategy.symbol)} ({strategy.symbol})
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={detail.closeBtn}>
            <Text style={detail.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={detail.scroll}>
          <View style={detail.section}>
            {PARAM_LABELS.map(({ key, label, format }) => {
              const val = strategy[key];
              if (val === undefined || val === null) return null;
              return (
                <View key={String(key)} style={detail.row}>
                  <Text style={detail.rowLabel}>{label}</Text>
                  <Text style={detail.rowValue}>{format ? format(val) : String(val)}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function gradeColors(grade: number) {
  if (grade <= 2)  return { badge: { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.4)' }, text: { color: '#f59e0b' } };
  if (grade <= 4)  return { badge: { backgroundColor: 'rgba(239,68,68,0.15)',  borderColor: 'rgba(239,68,68,0.4)'  }, text: { color: '#ef4444' } };
  if (grade <= 7)  return { badge: { backgroundColor: 'rgba(249,115,22,0.15)', borderColor: 'rgba(249,115,22,0.4)' }, text: { color: '#f97316' } };
  if (grade === 8) return { badge: { backgroundColor: 'rgba(132,204,22,0.15)', borderColor: 'rgba(132,204,22,0.4)' }, text: { color: '#84cc16' } };
  if (grade <= 11) return { badge: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.4)' }, text: { color: '#3b82f6' } };
  if (grade <= 13) return { badge: { backgroundColor: 'rgba(168,85,247,0.15)', borderColor: 'rgba(168,85,247,0.4)' }, text: { color: '#a855f7' } };
  return           { badge: { backgroundColor: 'rgba(113,113,122,0.15)',        borderColor: 'rgba(113,113,122,0.4)'}, text: { color: '#71717a' } };
}

const PAGE_SIZE = 15;

export default function StrategyScreen({ navigation }: any) {
  const [strategies,  setStrategies]  = useState<StrategyConfig[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [selected,    setSelected]    = useState<StrategyConfig | null>(null);
  const [isAdmin,     setIsAdmin]     = useState(false);
  const [page,        setPage]        = useState(1);
  const [hasNext,     setHasNext]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isAdmin ? '전략 설정' : '전략 메뉴판' });
  }, [isAdmin, navigation]);

  const load = async (pageNum = 1, showLoader = true) => {
    if (pageNum === 1 && showLoader) setLoading(true);
    if (pageNum > 1) setLoadingMore(true);
    const u = await authStorage.get();
    const admin = (u?.permission ?? 0) >= 99;
    if (pageNum === 1) setIsAdmin(admin);
    try {
      const params = {
        userUid: null, userName: '', email: '', permission: 0, status: 0,
        page: admin ? pageNum : 1,
        size: admin ? PAGE_SIZE : 50,
      };
      const res = await getStrategyConfigList(params);
      if (res.status === 200) {
        const all = res.data?.content ?? [];
        // 일반 유저는 전략 메뉴판(menuGrade 지정된 전략)만 표시, menuGrade 오름차순 정렬
        const content = admin
          ? all
          : all.filter(s => s.menuGrade != null)
               .sort((a, b) => (a.menuGrade ?? 99) - (b.menuGrade ?? 99));
        if (pageNum === 1) {
          setStrategies(content);
        } else {
          setStrategies(prev => [...prev, ...content]);
        }
        setHasNext(admin ? (res.data?.hasNext ?? false) : false);
        setPage(pageNum);
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false); setLoadingMore(false); }
  };

  useFocusEffect(useCallback(() => { load(1); }, []));

  const handleDelete = (strategy: StrategyConfig) => {
    Alert.alert('전략 삭제', `"${strategy.title}"을 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          const u = await authStorage.get();
          if (!u?.userUid) return;
          try {
            await deleteStrategyConfig(strategy.id, u.userUid);
            setStrategies(prev => prev.filter(s => s.id !== strategy.id));
            if (selected?.id === strategy.id) setSelected(null);
          } catch { Alert.alert('오류', '요청에 실패했습니다.'); }
        },
      },
    ]);
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={colors.teal} size="large" /></View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={strategies}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => {
          const isApplied = item.isUse === 1;
          return (
            <TouchableOpacity
              style={[styles.card, isApplied && styles.cardApplied]}
              onPress={() => setSelected(item)}
              activeOpacity={0.75}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    {item.menuGrade != null && (
                      <View style={[styles.gradeBadge, gradeColors(item.menuGrade).badge]}>
                        <Text style={[styles.gradeText, gradeColors(item.menuGrade).text]}>{item.menuGrade}등급</Text>
                      </View>
                    )}
                    <Text style={styles.cardTitle}>{item.title}</Text>
                  </View>
                  <Text style={styles.cardSymbol}>
                    {getSymbolName(item.symbol)} ({item.symbol})
                  </Text>
                  {item.userDTO?.userName && (
                    <Text style={styles.cardUser}>{item.userDTO.userName}</Text>
                  )}
                </View>
                {isAdmin && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.deleteBtnText}>삭제</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.cardBottom}>
                <Text style={styles.cardMeta}>
                  자본 {Number(item.initialCapital).toLocaleString()}원 · 위험 {(item.riskPerTrade * 100).toFixed(1)}%
                </Text>
                <Text style={styles.cardDate}>{item.createdAt?.slice(0, 10) ?? ''}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1, false); }} tintColor={colors.teal} />
        }
        ListFooterComponent={
          hasNext ? (
            loadingMore
              ? <ActivityIndicator color={colors.teal} style={{ paddingVertical: 16 }} />
              : <TouchableOpacity style={styles.loadMoreBtn} onPress={() => load(page + 1, false)} activeOpacity={0.7}>
                  <Text style={styles.loadMoreText}>더보기</Text>
                </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>전략 메뉴판이 비어있습니다</Text>
            <Text style={styles.emptySubText}>관리자가 등급별 전략을 설정하면 표시됩니다</Text>
          </View>
        }
      />

      {selected && (
        <DetailModal
          strategy={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  center:       { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  list:         { padding: 12, paddingBottom: 32 },
  card:         {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.borderDim, padding: 14, marginBottom: 10,
  },
  cardApplied:  { borderColor: colors.teal, backgroundColor: colors.tealDim },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardTitle:    { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 3 },
  cardSymbol:   { fontSize: 12, color: colors.textDim },
  cardUser:     { fontSize: 11, color: colors.textDim, marginTop: 2 },
  appliedBadge: {
    backgroundColor: colors.tealDim, borderRadius: 8, borderWidth: 1,
    borderColor: colors.teal, paddingHorizontal: 8, paddingVertical: 3,
  },
  appliedText:  { fontSize: 11, color: colors.teal, fontWeight: '700' },
  deleteBtn:    {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: colors.roseDim, borderWidth: 1, borderColor: colors.rose,
  },
  deleteBtnText:{ fontSize: 11, color: colors.rose, fontWeight: '600' },
  cardBottom:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMeta:     { fontSize: 12, color: colors.textDim },
  cardDate:     { fontSize: 11, color: colors.textDim },
  empty:        { alignItems: 'center', paddingVertical: 60 },
  emptyText:    { color: colors.textDim, fontSize: 15, fontWeight: '600' as const, marginBottom: 6 },
  emptySubText: { color: colors.textDim, fontSize: 12 },
  loadMoreBtn:  {
    margin: 12, marginTop: 4, borderRadius: 12,
    borderWidth: 1, borderColor: colors.borderDim,
    paddingVertical: 14, alignItems: 'center' as const,
    backgroundColor: colors.surface,
  },
  loadMoreText: { fontSize: 14, color: colors.textDim, fontWeight: '600' as const },
  gradeBadge:   { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  gradeText:    { fontSize: 10, fontWeight: '700' as const },
});

const detail = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.surface },
  handle:     { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  header:     {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 20, borderBottomWidth: 1, borderBottomColor: colors.borderDim,
  },
  title:      { fontSize: 17, fontWeight: '700', color: colors.text },
  subtitle:   { fontSize: 13, color: colors.textDim, marginTop: 4 },
  closeBtn:   { padding: 4 },
  closeText:  { fontSize: 16, color: colors.textDim },
  scroll:     { flex: 1 },
  section:    {
    backgroundColor: colors.bg, borderRadius: 14, margin: 12, marginBottom: 12,
    borderWidth: 1, borderColor: colors.borderDim, overflow: 'hidden',
  },
  row:        {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.borderDim,
  },
  rowLabel:   { fontSize: 13, color: colors.textDim },
  rowValue:   { fontSize: 13, fontWeight: '600', color: colors.text, flexShrink: 1, textAlign: 'right', marginLeft: 8 },
  footer:     { padding: 16, borderTopWidth: 1, borderTopColor: colors.borderDim },
  applyBtn:   { backgroundColor: colors.teal, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  unapplyBtn: { backgroundColor: colors.roseDim, borderWidth: 1, borderColor: colors.rose },
  applyText:  { color: '#0a1f1e', fontSize: 15, fontWeight: '700' },
  unapplyText:{ color: colors.rose },
});
