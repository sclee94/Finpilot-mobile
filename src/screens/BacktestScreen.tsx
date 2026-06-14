import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getBacktestList, getBacktest, deleteBacktest, runBacktest } from '../api/backtestApi';
import { getStrategyConfigList } from '../api/strategyApi';
import { authStorage } from '../utils/auth';
import { colors } from '../constants/colors';
import { getSymbolName } from '../constants/symbolNames';
import type { BacktestResult, BacktestTrade, StrategyConfig } from '../types';

function BacktestDetailModal({
  result,
  loading,
  onClose,
}: {
  result: BacktestResult;
  loading: boolean;
  onClose: () => void;
}) {
  const trades: BacktestTrade[] = result.trades ?? [];

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={detail.container}>
        <View style={detail.handle} />
        <View style={detail.header}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={detail.title}>
              {getSymbolName(result.symbol)} ({result.symbol})
            </Text>
            <Text style={detail.subtitle}>{result.strategyTitle ?? '-'}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={detail.closeBtn}>
            <Text style={detail.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.teal} size="large" />
          </View>
        ) : (
          <ScrollView style={detail.scroll}>
            {/* 기간 */}
            <View style={detail.periodBox}>
              <Text style={detail.periodText}>
                {result.periodStart} ~ {result.periodEnd} ({result.periodDays}일)
              </Text>
              <Text style={detail.periodDate}>{result.createdAt}</Text>
            </View>

            {/* 요약 */}
            <View style={detail.summaryGrid}>
              {[
                { label: '총 거래',  value: `${result.totalTrades}건`,                          color: colors.text },
                { label: '승률',    value: `${Number(result.winRate).toFixed(1)}%`,             color: colors.teal },
                { label: '수익률',  value: `${Number(result.returnPct) >= 0 ? '+' : ''}${Number(result.returnPct).toFixed(2)}%`, color: Number(result.returnPct) >= 0 ? colors.teal : colors.rose },
                { label: '최대 낙폭',value: `-${Number(result.mddPct).toFixed(2)}%`,            color: colors.rose },
                ...(result.sharpe != null ? [{ label: '샤프 지수', value: Number(result.sharpe).toFixed(3), color: colors.text }] : []),
              ].map(({ label, value, color }) => (
                <View key={label} style={detail.summaryItem}>
                  <Text style={detail.summaryLabel}>{label}</Text>
                  <Text style={[detail.summaryValue, { color }]}>{value}</Text>
                </View>
              ))}
            </View>

            {/* 개별 거래 */}
            {trades.length > 0 && (
              <View style={detail.tradesSection}>
                <Text style={detail.tradesTitle}>개별 거래 ({trades.length}건)</Text>
                {trades.map(t => {
                  const retColor = Number(t.returnPct) >= 0 ? colors.teal : colors.rose;
                  const dirLabel =
                    t.direction === 'BUY' || t.direction === 'LONG' ? '매수' :
                    t.direction === 'SHORT' ? '매도' :
                    t.direction === 'ADD_LONG' ? '추가매수' : t.direction;
                  const resultLabel =
                    t.result === 'SL' ? 'SL 손절' :
                    t.result === 'TP' ? 'TP 익절' : t.result;
                  return (
                    <View key={t.id ?? t.tradeNo} style={detail.tradeRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <Text style={detail.tradeNo}>#{t.tradeNo}</Text>
                          <Text style={detail.tradeDir}>{dirLabel}</Text>
                          <Text style={[detail.tradeResult, {
                            color: t.result === 'SL' ? colors.rose : t.result === 'TP' ? colors.teal : colors.textDim,
                          }]}>{resultLabel}</Text>
                        </View>
                        <Text style={detail.tradeTime}>{t.entryTime} → {t.exitTime}</Text>
                        <Text style={detail.tradePrice}>
                          진입 {Number(t.entryPrice).toLocaleString()} → 청산 {Number(t.exitPrice).toLocaleString()}
                        </Text>
                      </View>
                      <Text style={[detail.tradeRet, { color: retColor }]}>
                        {Number(t.returnPct) >= 0 ? '+' : ''}{Number(t.returnPct).toFixed(3)}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const PAGE_SIZE = 15;

export default function BacktestScreen() {
  const [results,         setResults]         = useState<BacktestResult[]>([]);
  const [appliedStrategy, setAppliedStrategy] = useState<StrategyConfig | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [selected,        setSelected]        = useState<BacktestResult | null>(null);
  const [detailLoading,   setDetailLoading]   = useState(false);
  const [running,         setRunning]         = useState(false);
  const [elapsed,         setElapsed]         = useState(0);
  const [resultsPage,     setResultsPage]     = useState(1);
  const [resultsHasNext,  setResultsHasNext]  = useState(false);
  const [loadingMore,     setLoadingMore]     = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    const u = await authStorage.get();
    const isAdmin = (u?.permission ?? 0) >= 99;
    const adminParams = { userUid: null, userName: '', email: '', permission: 0, status: 0 };
    const userParams  = { userUid: u?.userUid ?? null };
    try {
      const [resultsRes, stratRes] = await Promise.all([
        getBacktestList({ ...(isAdmin ? adminParams : userParams), page: 1, size: PAGE_SIZE }),
        getStrategyConfigList(isAdmin ? adminParams : userParams),
      ]);
      if (resultsRes.status === 200) {
        setResults(resultsRes.data?.content ?? []);
        setResultsHasNext(resultsRes.data?.hasNext ?? false);
        setResultsPage(1);
      }
      if (stratRes.status === 200) {
        setAppliedStrategy((stratRes.data?.content ?? []).find(s => s.isUse === 1) ?? null);
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  const loadMore = async () => {
    if (!resultsHasNext || loadingMore) return;
    setLoadingMore(true);
    const u = await authStorage.get();
    const isAdmin = (u?.permission ?? 0) >= 99;
    const adminParams = { userUid: null, userName: '', email: '', permission: 0, status: 0 };
    const userParams  = { userUid: u?.userUid ?? null };
    try {
      const nextPage = resultsPage + 1;
      const res = await getBacktestList({ ...(isAdmin ? adminParams : userParams), page: nextPage, size: PAGE_SIZE });
      if (res.status === 200) {
        setResults(prev => [...prev, ...(res.data?.content ?? [])]);
        setResultsHasNext(res.data?.hasNext ?? false);
        setResultsPage(nextPage);
      }
    } catch {}
    finally { setLoadingMore(false); }
  };

  useFocusEffect(useCallback(() => {
    load();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []));

  const handleRun = async () => {
    if (!appliedStrategy || running) return;
    const u = await authStorage.get();
    if (!u?.userUid) return;
    setRunning(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
    try {
      const s = appliedStrategy;
      const res = await runBacktest({
        userUid:         u.userUid,
        id:              s.id,
        title:           s.title,
        symbol:          s.symbol,
        adxThreshold:    s.adxThreshold,
        adxSidewaysFloor: s.adxSidewaysFloor,
        adxPersist:      s.adxPersist,
        diGapMin:        s.diGapMin,
        rsiLongEntry:    s.rsiLongEntry,
        rsiLongFloor:    s.rsiLongFloor,
        rsiShortEntry:   s.rsiShortEntry,
        rsiOversoldEntry: s.rsiOversoldEntry,
        maxAddCount:     s.maxAddCount,
        atrSlMult:       s.atrSlMult,
        atrTpMult:       s.atrTpMult,
        minHoldBars:     s.minHoldBars,
        slCooldownBars:  s.slCooldownBars,
        consecSlLimit:   s.consecSlLimit,
        maxDdStop:       s.maxDdStop,
        commission:      s.commission,
        slippage:        s.slippage,
        riskPerTrade:    s.riskPerTrade,
        usePrevBarSignal:s.usePrevBarSignal,
        initialCapital:  s.initialCapital,
        indicatorWindow: s.indicatorWindow,
        tradingDaysPerYear: s.tradingDaysPerYear,
      });
      if (res.data) {
        setResults(prev => [res.data, ...prev]);
      } else {
        Alert.alert('실패', res.message || '백테스트 실행에 실패했습니다.');
      }
    } catch {
      Alert.alert('오류', '서버 연결에 실패했습니다.');
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setRunning(false);
    }
  };

  const handleResultPress = async (result: BacktestResult) => {
    const u = await authStorage.get();
    setDetailLoading(true);
    setSelected(result);
    try {
      const res = await getBacktest(result.id, u?.userUid ?? '');
      if (res.data) setSelected(res.data);
    } catch {}
    finally { setDetailLoading(false); }
  };

  const handleDelete = (result: BacktestResult) => {
    Alert.alert('결과 삭제', '거래 내역도 함께 삭제됩니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          const u = await authStorage.get();
          try {
            await deleteBacktest(result.id, u?.userUid ?? '');
            setResults(prev => prev.filter(r => r.id !== result.id));
            if (selected?.id === result.id) setSelected(null);
          } catch { Alert.alert('오류', '요청에 실패했습니다.'); }
        },
      },
    ]);
  };

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}분 ${s % 60}초` : `${s}초`;
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={colors.teal} size="large" /></View>
  );

  return (
    <View style={styles.container}>
      {/* 적용된 전략 + 실행 */}
      <View style={styles.runBox}>
        {appliedStrategy ? (
          <View style={styles.runBoxInner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.appliedTitle}>{appliedStrategy.title}</Text>
              <Text style={styles.appliedSub}>
                {getSymbolName(appliedStrategy.symbol)} ({appliedStrategy.symbol})
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.runBtn, running && styles.runBtnDisabled]}
              onPress={handleRun}
              disabled={running}
              activeOpacity={0.8}
            >
              {running ? (
                <View style={{ alignItems: 'center' }}>
                  <ActivityIndicator color={colors.bg} size="small" />
                  <Text style={[styles.runBtnText, { fontSize: 10, marginTop: 2 }]}>
                    {formatElapsed(elapsed)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.runBtnText}>실행</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.noStrategyText}>전략 탭에서 적용할 전략을 선택하세요</Text>
        )}
      </View>

      <FlatList
        data={results}
        keyExtractor={item => String(item.id)}
        renderItem={({ item, index }) => {
          const retPct  = Number(item.returnPct);
          const retColor = retPct >= 0 ? colors.teal : colors.rose;
          return (
            <TouchableOpacity style={styles.card} onPress={() => handleResultPress(item)} activeOpacity={0.75}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardNo}>#{results.length - index}</Text>
                  <Text style={styles.cardTitle}>{item.strategyTitle ?? '-'}</Text>
                  <Text style={styles.cardSymbol}>
                    {getSymbolName(item.symbol)} ({item.symbol})
                  </Text>
                  {item.userName && <Text style={styles.cardUser}>{item.userName}</Text>}
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteBtnText}>제거</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>거래수</Text>
                  <Text style={styles.statValue}>{item.totalTrades}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>승률</Text>
                  <Text style={[styles.statValue, { color: colors.teal }]}>
                    {Number(item.winRate).toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>수익률</Text>
                  <Text style={[styles.statValue, { color: retColor }]}>
                    {retPct >= 0 ? '+' : ''}{retPct.toFixed(2)}%
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>MDD</Text>
                  <Text style={[styles.statValue, { color: colors.rose }]}>
                    -{Number(item.mddPct).toFixed(2)}%
                  </Text>
                </View>
                {item.sharpe != null && (
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>샤프</Text>
                    <Text style={styles.statValue}>{Number(item.sharpe).toFixed(2)}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.cardPeriod}>
                {item.periodStart} ~ {item.periodEnd} ({item.periodDays}일) · {item.createdAt}
              </Text>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} tintColor={colors.teal} />
        }
        ListFooterComponent={
          resultsHasNext ? (
            loadingMore
              ? <ActivityIndicator color={colors.teal} style={{ paddingVertical: 16 }} />
              : <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} activeOpacity={0.7}>
                  <Text style={styles.loadMoreText}>더보기</Text>
                </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>백테스트 결과가 없습니다</Text>
          </View>
        }
      />

      {selected && (
        <BacktestDetailModal
          result={selected}
          loading={detailLoading}
          onClose={() => setSelected(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },
  center:         { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  runBox:         {
    backgroundColor: colors.surface, borderBottomWidth: 1,
    borderBottomColor: colors.borderDim, padding: 14,
  },
  runBoxInner:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  appliedTitle:   { fontSize: 14, fontWeight: '700', color: colors.text },
  appliedSub:     { fontSize: 12, color: colors.textDim, marginTop: 2 },
  noStrategyText: { fontSize: 13, color: colors.textDim, textAlign: 'center', paddingVertical: 4 },
  runBtn:         {
    backgroundColor: colors.teal, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 10, minWidth: 70, alignItems: 'center',
  },
  runBtnDisabled: { backgroundColor: colors.surfaceAlt },
  runBtnText:     { color: colors.bg, fontSize: 14, fontWeight: '700' },
  list:           { padding: 12, paddingBottom: 32 },
  card:           {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.borderDim, padding: 14, marginBottom: 10,
  },
  cardTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardNo:         { fontSize: 11, color: colors.textDim, marginBottom: 2 },
  cardTitle:      { fontSize: 14, fontWeight: '700', color: colors.text },
  cardSymbol:     { fontSize: 12, color: colors.textDim, marginTop: 2 },
  cardUser:       { fontSize: 11, color: colors.textDim, marginTop: 2 },
  deleteBtn:      {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: colors.roseDim, borderWidth: 1, borderColor: colors.rose,
  },
  deleteBtnText:  { fontSize: 11, color: colors.rose, fontWeight: '600' },
  statsRow:       {
    flexDirection: 'row', backgroundColor: colors.bg,
    borderRadius: 10, padding: 10, marginBottom: 8,
  },
  stat:           { flex: 1, alignItems: 'center' },
  statLabel:      { fontSize: 10, color: colors.textDim, marginBottom: 3 },
  statValue:      { fontSize: 12, fontWeight: '700', color: colors.text },
  cardPeriod:     { fontSize: 11, color: colors.textDim },
  empty:          { alignItems: 'center', paddingVertical: 60 },
  emptyText:      { color: colors.textDim, fontSize: 14 },
  loadMoreBtn:    {
    margin: 12, marginTop: 4, borderRadius: 12,
    borderWidth: 1, borderColor: colors.borderDim,
    paddingVertical: 14, alignItems: 'center' as const,
    backgroundColor: colors.surface,
  },
  loadMoreText:   { fontSize: 14, color: colors.textDim, fontWeight: '600' as const },
});

const detail = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.surface },
  handle:       { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  header:       {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 20, borderBottomWidth: 1, borderBottomColor: colors.borderDim,
  },
  title:        { fontSize: 17, fontWeight: '700', color: colors.text },
  subtitle:     { fontSize: 13, color: colors.textDim, marginTop: 4 },
  closeBtn:     { padding: 4 },
  closeText:    { fontSize: 16, color: colors.textDim },
  scroll:       { flex: 1 },
  periodBox:    {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: colors.surfaceAlt, borderBottomWidth: 1, borderBottomColor: colors.borderDim,
  },
  periodText:   { fontSize: 12, color: colors.text },
  periodDate:   { fontSize: 11, color: colors.textDim },
  summaryGrid:  { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  summaryItem:  {
    backgroundColor: colors.bg, borderRadius: 12, borderWidth: 1,
    borderColor: colors.borderDim, padding: 12, width: '47%', alignItems: 'center',
  },
  summaryLabel: { fontSize: 11, color: colors.textDim, marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  tradesSection:{ margin: 12 },
  tradesTitle:  { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
  tradeRow:     {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bg, borderRadius: 10, borderWidth: 1,
    borderColor: colors.borderDim, padding: 12, marginBottom: 6,
  },
  tradeNo:      { fontSize: 11, color: colors.textDim },
  tradeDir:     { fontSize: 13, fontWeight: '600', color: colors.text },
  tradeResult:  { fontSize: 11, fontWeight: '600' },
  tradeTime:    { fontSize: 11, color: colors.textDim, marginTop: 3 },
  tradePrice:   { fontSize: 11, color: colors.textDim, marginTop: 2 },
  tradeRet:     { fontSize: 14, fontWeight: '700' },
});
