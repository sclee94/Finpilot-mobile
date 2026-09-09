import React, { useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getBacktestList, getBacktest, deleteBacktest, runBacktest, runPortfolioBacktest, runRandomBacktest } from '../api/backtestApi';
import { getStrategyConfigList } from '../api/strategyApi';
import { authStorage } from '../utils/auth';
import { colors } from '../constants/colors';
import { getSymbolName } from '../constants/symbolNames';
import SymbolPickerModal from '../components/SymbolPickerModal';
import type { BacktestResult, BacktestTrade, StrategyConfig } from '../types';

const RESULT_LABELS: Record<string, string> = {
  TP_THRESHOLD:    '즉시 익절',
  SL_THRESHOLD:    '즉시 손절',
  SCORE_TP:        '익절(스코어)',
  SCORE_SL:        '손절(스코어)',
  RSI_OVERBOUGHT:  '익절(RSI 과매수)',
  EOD_FORCE_CLOSE: '강제청산',
};

function resultLabelOf(result: string): string {
  return RESULT_LABELS[result] ?? result;
}

function resultColorOf(result: string): string {
  if (result === 'TP_THRESHOLD' || result === 'SCORE_TP' || result === 'RSI_OVERBOUGHT') return colors.teal;
  if (result === 'SL_THRESHOLD' || result === 'SCORE_SL') return colors.rose;
  return colors.textDim;
}

// 포트폴리오(세션 목록)/랜덤종목 백테스트 결과는 symbol 컬럼에 "PORTFOLIO(N종목)"/"RANDOM(카테고리,N종목)"
// 요약 라벨이 저장됨 — 개별 종목이 아니므로 getSymbolName()으로 풀어쓰지 않고 그대로 보여준다.
function isAggregateResult(symbol: string): boolean {
  return symbol.startsWith('PORTFOLIO(') || symbol.startsWith('RANDOM(');
}

function symbolLabelOf(symbol: string): string {
  return isAggregateResult(symbol) ? symbol : `${getSymbolName(symbol)} (${symbol})`;
}

// 거래 기록의 symbol 필드는 백테스트 엔진이 "코드(종목명)" 형태로 이미 조합해서 저장함
// (예: "005930.KS(삼성전자)") — 종목명만 뽑아서 보여준다.
function symbolNameOnly(symbol: string): string {
  if (isAggregateResult(symbol)) return symbol;
  const m = symbol.match(/\(([^()]+)\)\s*$/);
  return m ? m[1] : getSymbolName(symbol);
}

interface BuyEvent {
  time: string;
  price: number;
  shares: number;
  action: 'BUY' | 'ADD_LONG';
}

function parseBuyEvents(t: BacktestTrade): BuyEvent[] {
  if (!t.buyEvents) return [];
  try {
    const events = JSON.parse(t.buyEvents);
    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  }
}

// 추가매수가 있던 거래는 매수/추가매수/청산을 각각 별도 카드로 쪼개서 보여준다.
// 없는 거래는 기존처럼 카드 1개(진입~청산)로 표시.
function renderTradeCards(t: BacktestTrade, showSymbol: boolean): ReactNode[] {
  const events = (t.addCount ?? 0) > 0 ? parseBuyEvents(t) : [];

  if (events.length === 0) {
    const retColor = Number(t.returnPct) >= 0 ? colors.teal : colors.rose;
    const dirLabel = t.direction === 'BULLISH' ? '불타기' : t.direction === 'PULLBACK' ? '눌림목' : t.direction;
    return [
      <View key={t.id ?? t.tradeNo} style={detail.tradeRow}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <Text style={detail.tradeNo}>#{t.tradeNo}</Text>
            {showSymbol && <Text style={detail.tradeSymbol} numberOfLines={1}>{symbolNameOnly(t.symbol)}</Text>}
            <Text style={detail.tradeDir}>{dirLabel}</Text>
            <Text style={[detail.tradeResult, { color: resultColorOf(t.result) }]}>{resultLabelOf(t.result)}</Text>
          </View>
          <Text style={detail.tradeTime}>{t.entryTime} → {t.exitTime}</Text>
          <Text style={detail.tradePrice}>
            진입 {Number(t.entryPrice).toLocaleString()} → 청산 {Number(t.exitPrice).toLocaleString()}
          </Text>
        </View>
        <Text style={[detail.tradeRet, { color: retColor }]}>
          {Number(t.returnPct) >= 0 ? '+' : ''}{Number(t.returnPct).toFixed(3)}%
        </Text>
      </View>,
    ];
  }

  const cards: ReactNode[] = [];
  events.forEach((ev, idx) => {
    cards.push(
      <View key={`${t.id ?? t.tradeNo}-buy-${idx}`} style={[detail.tradeRow, detail.tradeRowGrouped]}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <Text style={detail.tradeNo}>#{t.tradeNo}</Text>
            {showSymbol && <Text style={detail.tradeSymbol} numberOfLines={1}>{symbolNameOnly(t.symbol)}</Text>}
            <Text style={[detail.tradeResult, { color: ev.action === 'BUY' ? colors.teal : colors.amber }]}>
              {ev.action === 'BUY' ? '매수' : '추가매수'}
            </Text>
          </View>
          <Text style={detail.tradeTime}>{ev.time}</Text>
          <Text style={detail.tradePrice}>{Number(ev.price).toLocaleString()}원 · +{ev.shares}주</Text>
        </View>
      </View>
    );
  });
  cards.push(
    <View key={`${t.id ?? t.tradeNo}-exit`} style={[detail.tradeRow, detail.tradeRowGrouped, detail.tradeRowGroupEnd]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <Text style={detail.tradeNo}>#{t.tradeNo}</Text>
          {showSymbol && <Text style={detail.tradeSymbol} numberOfLines={1}>{symbolNameOnly(t.symbol)}</Text>}
          <Text style={[detail.tradeResult, { color: colors.rose }]}>청산</Text>
          <Text style={[detail.tradeResult, { color: resultColorOf(t.result) }]}>{resultLabelOf(t.result)}</Text>
        </View>
        <Text style={detail.tradeTime}>{t.exitTime}</Text>
        <Text style={detail.tradePrice}>{Number(t.exitPrice).toLocaleString()}원 · 합계 {t.shares}주</Text>
      </View>
      <Text style={[detail.tradeRet, { color: Number(t.returnPct) >= 0 ? colors.teal : colors.rose }]}>
        {Number(t.returnPct) >= 0 ? '+' : ''}{Number(t.returnPct).toFixed(3)}%
      </Text>
    </View>
  );
  return cards;
}

function BacktestDetailModal({
  result,
  loading,
  onClose,
}: {
  result: BacktestResult;
  loading: boolean;
  onClose: () => void;
}) {
  const allTrades: BacktestTrade[] = result.trades ?? [];
  const [symbolFilter, setSymbolFilter] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // 기본 날짜 내림차순(최신순)

  // 종목별 요약 (여러 종목 거래가 섞인 포트폴리오 백테스트 결과에서 종목별로 묶어서 봄)
  const symbolStats = (() => {
    const map = new Map<string, { count: number; wins: number; sumRet: number }>();
    for (const t of allTrades) {
      const s = map.get(t.symbol) ?? { count: 0, wins: 0, sumRet: 0 };
      s.count += 1;
      if (Number(t.returnPct) > 0) s.wins += 1;
      s.sumRet += Number(t.returnPct);
      map.set(t.symbol, s);
    }
    return Array.from(map.entries())
      .map(([symbol, s]) => ({ symbol, ...s, winRate: (s.wins / s.count) * 100 }))
      .sort((a, b) => b.sumRet - a.sumRet);
  })();

  const trades = (symbolFilter ? allTrades.filter(t => t.symbol === symbolFilter) : allTrades)
    .slice()
    .sort((a, b) => sortOrder === 'desc' ? b.exitTime.localeCompare(a.exitTime) : a.exitTime.localeCompare(b.exitTime));

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={detail.container}>
        <View style={detail.handle} />
        <View style={detail.header}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={detail.title}>
              {symbolLabelOf(result.symbol)}
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

            {/* 종목별 요약 — 종목이 2개 이상 섞인 결과(포트폴리오 백테스트)에서만 표시 */}
            {symbolStats.length > 1 && (
              <View style={detail.symbolSection}>
                <Text style={detail.tradesTitle}>종목별 요약 ({symbolStats.length}종목)</Text>
                <View style={detail.symbolList}>
                  <TouchableOpacity
                    onPress={() => setSymbolFilter(null)}
                    style={[detail.symbolBox, symbolFilter === null && detail.symbolBoxActive]}
                    activeOpacity={0.7}
                  >
                    <Text style={[detail.symbolBoxName, symbolFilter === null && { color: colors.teal }]}>전체</Text>
                    <Text style={detail.symbolBoxStat}>{allTrades.length}건</Text>
                  </TouchableOpacity>
                  {symbolStats.map(s => (
                    <TouchableOpacity
                      key={s.symbol}
                      onPress={() => setSymbolFilter(prev => prev === s.symbol ? null : s.symbol)}
                      style={[detail.symbolBox, symbolFilter === s.symbol && detail.symbolBoxActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[detail.symbolBoxName, symbolFilter === s.symbol && { color: colors.teal }]} numberOfLines={1}>
                        {symbolNameOnly(s.symbol)}
                      </Text>
                      <View style={detail.symbolBoxStats}>
                        <Text style={detail.symbolBoxStat}>{s.count}건</Text>
                        <Text style={detail.symbolBoxStat}>승률 {s.winRate.toFixed(0)}%</Text>
                        <Text style={[detail.symbolBoxStat, { color: s.sumRet >= 0 ? colors.teal : colors.rose, fontWeight: '700' }]}>
                          {s.sumRet >= 0 ? '+' : ''}{s.sumRet.toFixed(1)}%
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* 개별 거래 */}
            {trades.length > 0 && (
              <View style={detail.tradesSection}>
                <View style={detail.tradesTitleRow}>
                  <Text style={detail.tradesTitle}>
                    개별 거래 ({trades.length}건{symbolFilter ? ` · ${symbolFilter}` : ''})
                  </Text>
                  <TouchableOpacity
                    onPress={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    style={detail.sortBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={detail.sortBtnText}>
                      {sortOrder === 'desc' ? '최신순 ↓' : '오래된순 ↑'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {trades.flatMap(t => renderTradeCards(t, symbolStats.length > 1))}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function StrategyPickerModal({
  visible, strategies, selectedId, onClose, onSelect,
}: {
  visible: boolean;
  strategies: StrategyConfig[];
  selectedId: number | null;
  onClose: () => void;
  onSelect: (id: number) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={detail.container}>
        <View style={detail.handle} />
        <View style={detail.header}>
          <Text style={detail.title}>전략 선택</Text>
          <TouchableOpacity onPress={onClose} style={detail.closeBtn}>
            <Text style={detail.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={detail.scroll}>
          {strategies.map(s => {
            const active = s.id === selectedId;
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => { onSelect(s.id!); onClose(); }}
                style={[picker.row, active && picker.rowActive]}
                activeOpacity={0.7}
              >
                <Text style={[picker.name, active && { color: colors.teal }]} numberOfLines={1}>
                  {s.name || `전략 #${s.id}`}
                </Text>
                <Text style={picker.detail}>익절 +{s.takeProfitPct}% · 손절 -{s.stopLossPct}%</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const picker = StyleSheet.create({
  row:      {
    marginHorizontal: 12, marginTop: 10, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: colors.borderDim, backgroundColor: colors.bg,
  },
  rowActive:{ borderColor: colors.teal, backgroundColor: colors.tealDim },
  name:     { fontSize: 14, fontWeight: '700', color: colors.text },
  detail:   { fontSize: 12, color: colors.textDim, marginTop: 4 },
});

const PAGE_SIZE = 15;

export default function BacktestScreen() {
  const [results,         setResults]         = useState<BacktestResult[]>([]);
  const [strategies,      setStrategies]      = useState<StrategyConfig[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [runSymbol,       setRunSymbol]       = useState('');
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [selected,        setSelected]        = useState<BacktestResult | null>(null);
  const [detailLoading,   setDetailLoading]   = useState(false);
  const [running,         setRunning]         = useState(false);
  const [elapsed,         setElapsed]         = useState(0);
  const [showStrategyPicker, setShowStrategyPicker] = useState(false);
  const [backtestType,     setBacktestType]     = useState<'SYMBOL' | 'PORTFOLIO' | 'RANDOM'>('SYMBOL');
  const [portfolioRunMode, setPortfolioRunMode] = useState<'LIVE' | 'PAPER'>('PAPER');
  const [activeOnly,       setActiveOnly]       = useState(true);
  const [randomCategory,         setRandomCategory]         = useState<'KOSPI200' | 'NASDAQ100'>('KOSPI200');
  const [randomApplyForceClose,  setRandomApplyForceClose]  = useState(false);
  const [runApplyForceClose,     setRunApplyForceClose]     = useState(false);
  const [resultsPage,     setResultsPage]     = useState(1);
  const [resultsHasNext,  setResultsHasNext]  = useState(false);
  const [loadingMore,     setLoadingMore]     = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const load = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    const u = await authStorage.get();
    const isAdmin = (u?.permission ?? 0) >= 99;
    const adminParams = { userUid: u?.userUid ?? null, viewAll: true };
    const userParams  = { userUid: u?.userUid ?? null };
    try {
      const [resultsRes, stratRes] = await Promise.all([
        getBacktestList({ ...(isAdmin ? adminParams : userParams), page: 1, size: PAGE_SIZE }),
        getStrategyConfigList({ userUid: u?.userUid }),
      ]);
      if (resultsRes.status === 200) {
        setResults(resultsRes.data?.content ?? []);
        setResultsHasNext(resultsRes.data?.hasNext ?? false);
        setResultsPage(1);
      }
      if (stratRes.status === 200) {
        const list = stratRes.data?.content ?? [];
        setStrategies(list);
        setSelectedStrategyId(prev => (prev != null && list.some(s => s.id === prev)) ? prev : (list[0]?.id ?? null));
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  const loadMore = async () => {
    if (!resultsHasNext || loadingMore) return;
    setLoadingMore(true);
    const u = await authStorage.get();
    const isAdmin = (u?.permission ?? 0) >= 99;
    const adminParams = { userUid: u?.userUid ?? null, viewAll: true };
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
    if (!runSymbol || !selectedStrategyId || running) return;
    const u = await authStorage.get();
    if (!u?.userUid) return;
    setRunning(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await runBacktest({
        userUid:          u.userUid,
        symbol:           runSymbol,
        strategyConfigId: selectedStrategyId,
        applyForceClose:  runApplyForceClose,
      }, controller.signal);
      if (res.data) {
        setResults(prev => [res.data, ...prev]);
      } else {
        Alert.alert('실패', res.message || '백테스트 실행에 실패했습니다.');
      }
    } catch {
      if (!controller.signal.aborted) Alert.alert('오류', '서버 연결에 실패했습니다.');
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      abortRef.current = null;
      setRunning(false);
    }
  };

  const handleRunPortfolio = async () => {
    if (running) return;
    const u = await authStorage.get();
    if (!u?.userUid) return;
    setRunning(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await runPortfolioBacktest({
        userUid:    u.userUid,
        mode:       portfolioRunMode,
        activeOnly,
      }, controller.signal);
      if (res.data) {
        setResults(prev => [res.data, ...prev]);
      } else {
        Alert.alert('실패', res.message || '백테스트 실행에 실패했습니다.');
      }
    } catch {
      if (!controller.signal.aborted) Alert.alert('오류', '서버 연결에 실패했습니다.');
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      abortRef.current = null;
      setRunning(false);
    }
  };

  const handleRunRandom = async () => {
    if (!selectedStrategyId || running) return;
    const u = await authStorage.get();
    if (!u?.userUid) return;
    setRunning(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await runRandomBacktest({
        userUid:           u.userUid,
        category:          randomCategory,
        strategyConfigId:  selectedStrategyId,
        applyForceClose:   randomApplyForceClose,
      }, controller.signal);
      if (res.data) {
        setResults(prev => [res.data, ...prev]);
      } else {
        Alert.alert('실패', res.message || '백테스트 실행에 실패했습니다.');
      }
    } catch {
      if (!controller.signal.aborted) Alert.alert('오류', '서버 연결에 실패했습니다.');
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      abortRef.current = null;
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

  const selectedStrategy = strategies.find(s => s.id === selectedStrategyId) ?? null;

  const strategyChips = strategies.length === 0 ? (
    <Text style={styles.noStrategyText}>전략 탭에서 전략 설정을 먼저 등록하세요</Text>
  ) : (
    <TouchableOpacity
      style={styles.stratPickerBtn}
      onPress={() => setShowStrategyPicker(true)}
      activeOpacity={0.7}
    >
      <Text style={styles.stratPickerLabel}>적용 전략</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={styles.stratPickerValue} numberOfLines={1}>
          {selectedStrategy?.name || `전략 #${selectedStrategyId}`}
        </Text>
        <Text style={styles.stratPickerChevron}>▾</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* 종목/전략 선택 + 실행 */}
      <View style={styles.runBox}>
        <Text style={styles.runBoxLabel}>실전투자와 동일한 전략 로직으로 최근 60일치 데이터를 검증합니다</Text>

        {/* 백테스트 방식: 특정 종목 1개 vs 세션 목록 전체(포트폴리오) vs 카테고리 내 랜덤 20종목 */}
        <View style={styles.typeTabRow}>
          {(['SYMBOL', 'PORTFOLIO', 'RANDOM'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.typeTab, backtestType === t && styles.typeTabActive]}
              onPress={() => setBacktestType(t)}
              activeOpacity={0.7}
            >
              <Text style={[styles.typeTabText, backtestType === t && styles.typeTabTextActive]} numberOfLines={1}>
                {t === 'SYMBOL' ? '특정 종목' : t === 'PORTFOLIO' ? '세션 종목' : '랜덤 종목'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {backtestType === 'SYMBOL' ? (
          <>
            <SymbolPickerModal value={runSymbol} onChange={(s) => setRunSymbol(s)} />
            <TouchableOpacity
              style={styles.activeOnlyRow}
              onPress={() => setRunApplyForceClose(v => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.activeOnlyText}>15:18 강제청산 {runApplyForceClose ? '적용함' : '적용 안 함(이월)'}</Text>
              <View style={[styles.switchTrack, runApplyForceClose && styles.switchTrackOn]}>
                <View style={[styles.switchThumb, runApplyForceClose && styles.switchThumbOn]} />
              </View>
            </TouchableOpacity>
            {strategyChips}
          </>
        ) : backtestType === 'PORTFOLIO' ? (
          <>
            <Text style={styles.noStrategyText}>
              보유 세션 종목 전체를 실전/모의투자와 동일하게(Top2 필터, 세션별 전략, KIS 실잔고 시드머니) 동시 시뮬레이션합니다
            </Text>
            <View style={styles.modeRow}>
              {(['LIVE', 'PAPER'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeBtn, portfolioRunMode === m && (m === 'LIVE' ? styles.modeBtnLive : styles.modeBtnPaper)]}
                  onPress={() => setPortfolioRunMode(m)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modeBtnText, { color: portfolioRunMode === m ? (m === 'LIVE' ? colors.amber : colors.blue) : colors.textDim }]}>
                    {m === 'LIVE' ? '실전' : '모의'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.activeOnlyRow}
              onPress={() => setActiveOnly(v => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.activeOnlyText}>{activeOnly ? '활성(active) 세션만' : '전체 세션'}</Text>
              <View style={[styles.switchTrack, activeOnly && styles.switchTrackOn]}>
                <View style={[styles.switchThumb, activeOnly && styles.switchThumbOn]} />
              </View>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.noStrategyText}>
              선택한 카테고리 안에서 무작위 20종목에 한 전략을 일괄 적용해 포트폴리오처럼 동시 시뮬레이션합니다
            </Text>
            <View style={styles.modeRow}>
              {([{ id: 'KOSPI200', label: '코스피200' }, { id: 'NASDAQ100', label: '나스닥100' }] as const).map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.modeBtn, randomCategory === c.id && styles.modeBtnLive]}
                  onPress={() => setRandomCategory(c.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modeBtnText, { color: randomCategory === c.id ? colors.amber : colors.textDim }]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.activeOnlyRow}
              onPress={() => setRandomApplyForceClose(v => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.activeOnlyText}>15:18 강제청산 {randomApplyForceClose ? '적용함' : '적용 안 함(이월)'}</Text>
              <View style={[styles.switchTrack, randomApplyForceClose && styles.switchTrackOn]}>
                <View style={[styles.switchThumb, randomApplyForceClose && styles.switchThumbOn]} />
              </View>
            </TouchableOpacity>
            {strategyChips}
          </>
        )}

        <TouchableOpacity
          style={[
            styles.runBtnFull,
            (backtestType === 'SYMBOL' ? (!runSymbol || !selectedStrategyId || running) :
             backtestType === 'RANDOM' ? (!selectedStrategyId || running) :
             running) && styles.runBtnDisabled,
          ]}
          onPress={backtestType === 'SYMBOL' ? handleRun : backtestType === 'PORTFOLIO' ? handleRunPortfolio : handleRunRandom}
          disabled={
            backtestType === 'SYMBOL' ? (!runSymbol || !selectedStrategyId || running) :
            backtestType === 'RANDOM' ? (!selectedStrategyId || running) :
            running
          }
          activeOpacity={0.8}
        >
          {running ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color={colors.bg} size="small" />
              <Text style={styles.runBtnText}>실행 중 ({formatElapsed(elapsed)})</Text>
            </View>
          ) : (
            <Text style={styles.runBtnText}>실행하기</Text>
          )}
        </TouchableOpacity>

        {running && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
            <Text style={styles.cancelBtnText}>취소</Text>
          </TouchableOpacity>
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
                    {symbolLabelOf(item.symbol)}
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

      <StrategyPickerModal
        visible={showStrategyPicker}
        strategies={strategies}
        selectedId={selectedStrategyId}
        onClose={() => setShowStrategyPicker(false)}
        onSelect={(id) => setSelectedStrategyId(id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },
  center:         { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  runBox:         {
    backgroundColor: colors.surface, borderBottomWidth: 1,
    borderBottomColor: colors.borderDim, padding: 14, gap: 10,
  },
  runBoxLabel:    { fontSize: 12, color: colors.textDim },
  noStrategyText: { fontSize: 13, color: colors.textDim, textAlign: 'center', paddingVertical: 4 },
  typeTabRow:     { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 10, padding: 4, gap: 4 },
  typeTab:        { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  typeTabActive:  { backgroundColor: colors.teal },
  typeTabText:    { fontSize: 13, fontWeight: '600', color: colors.textDim },
  typeTabTextActive: { color: colors.bg },
  modeRow:        { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 10, padding: 4, gap: 4 },
  modeBtn:        { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  modeBtnLive:    { backgroundColor: colors.amberDim },
  modeBtnPaper:   { backgroundColor: colors.blueDim },
  modeBtnText:    { fontSize: 14, fontWeight: '700' },
  activeOnlyRow:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderDim,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
  },
  activeOnlyText: { fontSize: 14, color: colors.text },
  switchTrack:    { width: 44, height: 24, borderRadius: 12, backgroundColor: colors.surfaceAlt, padding: 2 },
  switchTrackOn:  { backgroundColor: colors.teal },
  switchThumb:    { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  switchThumbOn:  { transform: [{ translateX: 20 }] },
  stratPickerBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderDim,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
  },
  stratPickerLabel: { fontSize: 13, color: colors.textDim },
  stratPickerValue: { fontSize: 14, fontWeight: '700', color: colors.teal, maxWidth: 200 },
  stratPickerChevron: { fontSize: 12, color: colors.textDim },
  runBtnFull:     {
    backgroundColor: colors.teal, borderRadius: 10,
    paddingVertical: 13, alignItems: 'center',
  },
  runBtnDisabled: { backgroundColor: colors.surfaceAlt },
  runBtnText:     { color: colors.bg, fontSize: 14, fontWeight: '700' },
  cancelBtn:      {
    marginTop: 8, borderRadius: 10, paddingVertical: 11, alignItems: 'center',
    backgroundColor: colors.roseDim, borderWidth: 1, borderColor: colors.rose,
  },
  cancelBtnText:  { color: colors.rose, fontSize: 13, fontWeight: '700' },
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
  symbolSection:{ marginHorizontal: 12, marginTop: 12 },
  symbolList:   { gap: 6 },
  symbolBox:    {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderDim,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  symbolBoxActive: { borderColor: colors.teal, backgroundColor: colors.tealDim },
  symbolBoxName:  { fontSize: 13, fontWeight: '700', color: colors.text, flexShrink: 1, marginRight: 8 },
  symbolBoxStats: { flexDirection: 'row', gap: 10 },
  symbolBoxStat:  { fontSize: 12, color: colors.textDim },
  tradesSection:{ margin: 12 },
  tradesTitleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  tradesTitle:  { fontSize: 14, fontWeight: '700', color: colors.text },
  sortBtn:      {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderDim,
  },
  sortBtnText:  { fontSize: 11, fontWeight: '600', color: colors.textSub },
  tradeRow:     {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bg, borderRadius: 10, borderWidth: 1,
    borderColor: colors.borderDim, padding: 12, marginBottom: 6,
  },
  tradeNo:      { fontSize: 11, color: colors.textDim },
  tradeSymbol:  { fontSize: 11, fontWeight: '600', color: colors.sky, maxWidth: 110 },
  tradeDir:     { fontSize: 13, fontWeight: '600', color: colors.text },
  tradeResult:  { fontSize: 11, fontWeight: '600' },
  tradeRowGrouped: {
    backgroundColor: colors.amberDim, borderColor: colors.amber, marginBottom: 2,
  },
  tradeRowGroupEnd: { marginBottom: 6 },
  tradeTime:    { fontSize: 11, color: colors.textDim, marginTop: 3 },
  tradePrice:   { fontSize: 11, color: colors.textDim, marginTop: 2 },
  tradeRet:     { fontSize: 14, fontWeight: '700' },
});
