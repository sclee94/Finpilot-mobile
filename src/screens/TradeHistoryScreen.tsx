import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, ScrollView,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getTradeHistoryList } from '../api/tradeApi';
import { authStorage } from '../utils/auth';
import { colors } from '../constants/colors';
import type { TradeHistory } from '../types';

const ACTION_COLOR: Record<string, string> = {
  BUY:         colors.teal,
  SELL:        colors.sky,
  ADD_LONG:    colors.emerald,
  SELL_SHORT:  colors.rose,
  CLOSE_LONG:  colors.sky,
  CLOSE_SHORT: colors.orange,
};
const ACTION_LABEL: Record<string, string> = {
  BUY:         '매수',
  SELL:        '매도',
  ADD_LONG:    '추가매수',
  SELL_SHORT:  '공매도',
  CLOSE_LONG:  '청산(롱)',
  CLOSE_SHORT: '청산(숏)',
};

const MODE_FILTERS  = ['전체', 'LIVE', 'PAPER'];
const ACTION_FILTERS = ['전체', 'BUY', 'SELL', 'ADD_LONG', 'SELL_SHORT', 'CLOSE_LONG', 'CLOSE_SHORT'];
const STATUS_FILTERS = ['전체', 'SUCCESS', 'FAILED'];

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function CalendarModal({
  visible, selectedDate, onSelect, onClose, title,
}: {
  visible: boolean; selectedDate: Date;
  onSelect: (d: Date) => void; onClose: () => void; title: string;
}) {
  const [viewYear,  setViewYear]  = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  useEffect(() => {
    if (visible) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
  }, [visible]);

  const todayStr    = toDateStr(new Date());
  const selectedStr = toDateStr(selectedDate);
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => viewMonth === 0  ? (setViewYear(y => y - 1), setViewMonth(11)) : setViewMonth(m => m - 1);
  const nextMonth = () => viewMonth === 11 ? (setViewYear(y => y + 1), setViewMonth(0))  : setViewMonth(m => m + 1);

  const MONTHS   = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const WEEKDAYS = ['일','월','화','수','목','금','토'];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={cal.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={cal.container} activeOpacity={1}>
          <Text style={cal.title}>{title}</Text>

          <View style={cal.monthRow}>
            <TouchableOpacity onPress={prevMonth} style={cal.navBtn}>
              <Text style={cal.navText}>‹</Text>
            </TouchableOpacity>
            <Text style={cal.monthLabel}>{viewYear}년 {MONTHS[viewMonth]}</Text>
            <TouchableOpacity onPress={nextMonth} style={cal.navBtn}>
              <Text style={cal.navText}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={cal.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={w} style={[cal.weekDay, i === 0 && { color: colors.rose }, i === 6 && { color: colors.blue }]}>
                {w}
              </Text>
            ))}
          </View>

          <View style={cal.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={i} style={cal.cell} />;
              const mm  = String(viewMonth + 1).padStart(2, '0');
              const dd  = String(day).padStart(2, '0');
              const str = `${viewYear}-${mm}-${dd}`;
              const isSelected = str === selectedStr;
              const isToday    = str === todayStr;
              const dow        = i % 7;
              return (
                <TouchableOpacity
                  key={i}
                  style={[cal.cell, isSelected && cal.cellSelected]}
                  onPress={() => { onSelect(new Date(viewYear, viewMonth, day)); onClose(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    cal.dayText,
                    dow === 0 && { color: colors.rose },
                    dow === 6 && { color: colors.blue },
                    isSelected && cal.dayTextSelected,
                  ]}>
                    {day}
                  </Text>
                  {isToday && !isSelected && <View style={cal.todayDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const PAGE_SIZE = 15;

function SummaryCards({ summaryList, totalCount }: { summaryList: TradeHistory[]; totalCount: number }) {
  const list = summaryList;
  const closes = list.filter(t => t.action === 'SELL' || t.action === 'CLOSE_LONG' || t.action === 'CLOSE_SHORT');
  const pnls   = closes.map(t => t.realizedPnl ?? 0);
  const totalPnl   = pnls.reduce((a, b) => a + b, 0);
  const winCount   = pnls.filter(p => p > 0).length;
  const winRate    = closes.length > 0 ? (winCount / closes.length) * 100 : 0;
  const successCnt = list.filter(t => t.orderStatus === 'SUCCESS').length;

  return (
    <View style={summary.row}>
      <View style={summary.card}>
        <Text style={summary.label}>총 거래</Text>
        <Text style={summary.value}>{totalCount}건</Text>
      </View>
      <View style={summary.card}>
        <Text style={summary.label}>청산 승률</Text>
        <Text style={[summary.value, { color: colors.teal }]}>{winRate.toFixed(1)}%</Text>
      </View>
      <View style={summary.card}>
        <Text style={summary.label}>실현손익</Text>
        <Text style={[summary.value, { color: totalPnl >= 0 ? colors.teal : colors.rose }]}>
          {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString()}
        </Text>
      </View>
      <View style={summary.card}>
        <Text style={summary.label}>성공</Text>
        <Text style={[summary.value, { color: colors.emerald }]}>{successCnt}</Text>
      </View>
    </View>
  );
}

function TradeCard({ item, onPress }: { item: TradeHistory; onPress: () => void }) {
  const actionColor  = ACTION_COLOR[item.action] ?? colors.textDim;
  const isClose      = item.action === 'SELL' || item.action === 'CLOSE_LONG' || item.action === 'CLOSE_SHORT';
  const pnl          = item.realizedPnl;
  const pnlColor     = pnl != null && pnl >= 0 ? colors.sky : colors.rose;
  const statusColor  = item.orderStatus === 'SUCCESS' ? colors.emerald : colors.rose;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <View style={styles.cardTopLeft}>
          <Text style={styles.symbol}>{item.symbolName ?? item.symbol}</Text>
          <Text style={styles.symbolCode}>{item.symbol}</Text>
        </View>
        <View style={styles.cardTopRight}>
          <View style={[styles.badge, { backgroundColor: actionColor + '25', borderColor: actionColor }]}>
            <Text style={[styles.badgeText, { color: actionColor }]}>{ACTION_LABEL[item.action]}</Text>
          </View>
          {item.orderStatus && (
            <View style={[styles.badge, { backgroundColor: statusColor + '20', borderColor: statusColor, marginTop: 4 }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>
                {item.orderStatus === 'SUCCESS' ? '성공' : '실패'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.cardMid}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>수량</Text>
          <Text style={styles.infoValue}>{item.shares.toLocaleString()}주</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>진입가</Text>
          <Text style={styles.infoValue}>
            {item.entryPrice != null ? `₩${item.entryPrice.toLocaleString()}` : '—'}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>모드</Text>
          <Text style={[styles.infoValue, { color: item.mode === 'LIVE' ? colors.amber : colors.blue }]}>
            {item.mode === 'LIVE' ? '실전' : '모의'}
          </Text>
        </View>
        {isClose && pnl != null && (
          <>
            <View style={styles.divider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>실현손익</Text>
              <Text style={[styles.infoValue, { color: pnlColor }]}>
                {pnl >= 0 ? '+' : ''}₩{pnl.toLocaleString()}
              </Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.dateText}>
          {item.createdAt ? item.createdAt.slice(0, 16).replace('T', ' ') : '—'}
        </Text>
        {item.userName && <Text style={styles.userText}>{item.userName}</Text>}
      </View>
    </TouchableOpacity>
  );
}

function DetailModal({ item, onClose }: { item: TradeHistory | null; onClose: () => void }) {
  if (!item) return null;
  const isClose  = item.action === 'SELL' || item.action === 'CLOSE_LONG' || item.action === 'CLOSE_SHORT';
  const pnl      = item.realizedPnl;
  const pnlColor = pnl != null && pnl >= 0 ? colors.sky : colors.rose;

  const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <View style={detail.row}>
      <Text style={detail.rowLabel}>{label}</Text>
      <Text style={[detail.rowValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={detail.container}>
        <View style={detail.handle} />
        <View style={detail.header}>
          <Text style={detail.title}>거래 상세</Text>
          <TouchableOpacity onPress={onClose} style={detail.closeBtn}>
            <Text style={detail.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={detail.scroll}>
          <View style={detail.section}>
            <Row label="종목" value={`${item.symbolName ?? item.symbol} (${item.symbol})`} />
            <Row label="모드"   value={item.mode === 'LIVE' ? '실전' : '모의'} color={item.mode === 'LIVE' ? colors.amber : colors.blue} />
            <Row label="액션"   value={ACTION_LABEL[item.action] ?? item.action} color={ACTION_COLOR[item.action]} />
            <Row label="수량"   value={`${item.shares.toLocaleString()}주`} />
            {item.orderStatus && (
              <Row label="상태" value={item.orderStatus === 'SUCCESS' ? '성공' : '실패'}
                   color={item.orderStatus === 'SUCCESS' ? colors.emerald : colors.rose} />
            )}
          </View>
          <View style={detail.section}>
            <Row label="진입가"   value={item.entryPrice != null ? `₩${item.entryPrice.toLocaleString()}` : '—'} />
            <Row label="진입시각" value={item.entryAt?.slice(0, 19).replace('T', ' ') ?? '—'} />
            <Row label="청산가"   value={item.exitPrice != null ? `₩${item.exitPrice.toLocaleString()}` : '—'} />
            <Row label="청산시각" value={item.exitAt?.slice(0, 19).replace('T', ' ') ?? '—'} />
          </View>
          {isClose && (
            <View style={detail.section}>
              <Row label="실현 손익" value={pnl != null ? `${pnl >= 0 ? '+' : ''}₩${pnl.toLocaleString()}` : '—'} color={pnl != null ? pnlColor : undefined} />
              <Row label="보유 봉 수" value={item.barsHeld != null ? `${item.barsHeld}봉` : '—'} />
            </View>
          )}
          <View style={detail.section}>
            <Row label="손절가 (Stop)" value={item.stopPrice != null ? `₩${item.stopPrice.toLocaleString()}` : '—'} />
            <Row label="익절가 (TP)"   value={item.tpPrice   != null ? `₩${item.tpPrice.toLocaleString()}`   : '—'} />
          </View>
          <View style={detail.section}>
            <Row label="생성 일시" value={item.createdAt?.slice(0, 19).replace('T', ' ') ?? '—'} />
            {item.menuGrade != null && <Row label="적용 전략" value={`${item.menuGrade}등급`} />}
            {item.userName && <Row label="유저" value={item.userName} />}
          </View>
          {item.orderStatus === 'FAILED' && item.errorMessage && (
            <View style={[detail.section, detail.errorSection]}>
              <Text style={detail.errorLabel}>오류 메시지</Text>
              <Text style={detail.errorText}>{item.errorMessage}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function TradeHistoryScreen() {
  const [list,        setList]        = useState<TradeHistory[]>([]);
  const [summaryList, setSummaryList] = useState<TradeHistory[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected,    setSelected]    = useState<TradeHistory | null>(null);
  const [modeF,       setModeF]       = useState('전체');
  const [actionF,     setActionF]     = useState('전체');
  const [statusF,     setStatusF]     = useState('전체');
  const [search,      setSearch]      = useState('');
  const [startDate,   setStartDate]   = useState(() => new Date());
  const [endDate,     setEndDate]     = useState(() => new Date());
  const [calTarget,   setCalTarget]   = useState<'start' | 'end' | null>(null);
  const [page,        setPage]        = useState(1);
  const [hasNext,     setHasNext]     = useState(false);
  const [totalCount,  setTotalCount]  = useState(0);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  type Filters = { mode: string; action: string; status: string; srch: string; sd: Date; ed: Date };

  const fetchSummary = async (filters: Filters) => {
    const u = await authStorage.get();
    const isAdmin = (u?.permission ?? 0) >= 99;
    try {
      const params: Parameters<typeof getTradeHistoryList>[0] = {
        ...(isAdmin ? {} : { userUid: u?.userUid }),
        dateFrom: toDateStr(filters.sd),
        dateTo:   toDateStr(filters.ed),
      };
      if (filters.mode   !== '전체') params.mode        = filters.mode;
      if (filters.action !== '전체') params.action      = filters.action;
      if (filters.status !== '전체') params.orderStatus = filters.status;
      if (filters.srch.trim())        params.symbolName  = filters.srch.trim();

      const res = await getTradeHistoryList(params);
      if (res.status === 200) {
        setSummaryList(res.data?.content ?? []);
      } else {
        setSummaryList([]);
      }
    } catch { setSummaryList([]); }
  };

  const fetchData = async (pageNum: number, append: boolean, filters: Filters) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    const u = await authStorage.get();
    const isAdmin = (u?.permission ?? 0) >= 99;
    try {
      const params: Parameters<typeof getTradeHistoryList>[0] = {
        ...(isAdmin ? {} : { userUid: u?.userUid }),
        dateFrom: toDateStr(filters.sd),
        dateTo:   toDateStr(filters.ed),
        page:     pageNum,
        size:     PAGE_SIZE,
      };
      if (filters.mode   !== '전체') params.mode        = filters.mode;
      if (filters.action !== '전체') params.action      = filters.action;
      if (filters.status !== '전체') params.orderStatus = filters.status;
      if (filters.srch.trim())        params.symbolName  = filters.srch.trim();

      const res = await getTradeHistoryList(params);
      if (res.status === 200) {
        const content = res.data?.content ?? [];
        setList(prev => append ? [...prev, ...content] : content);
        setHasNext(res.data?.hasNext ?? false);
        setTotalCount(res.data?.totalCount ?? 0);
        setPage(pageNum);
      } else if (!append) {
        setList([]); setHasNext(false); setTotalCount(0);
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false); setLoadingMore(false); }
    if (!append) fetchSummary(filters);
  };

  const currentFilters = (): Filters => ({
    mode: modeF, action: actionF, status: statusF, srch: search, sd: startDate, ed: endDate,
  });

  const filtersRef = useRef<Filters>(currentFilters());
  filtersRef.current = currentFilters();

  useFocusEffect(useCallback(() => {
    fetchData(1, false, filtersRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  const handleModeChange = (v: string) => {
    setModeF(v);
    fetchData(1, false, { ...currentFilters(), mode: v });
  };
  const handleActionChange = (v: string) => {
    setActionF(v);
    fetchData(1, false, { ...currentFilters(), action: v });
  };
  const handleStatusChange = (v: string) => {
    setStatusF(v);
    fetchData(1, false, { ...currentFilters(), status: v });
  };
  const handleSearchChange = (v: string) => {
    setSearch(v);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      fetchData(1, false, { ...filtersRef.current, srch: v });
    }, 400);
  };

  if (loading && list.length === 0) return (
    <View style={styles.center}><ActivityIndicator color={colors.teal} size="large" /></View>
  );

  return (
    <View style={styles.container}>
      {/* 검색 */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={handleSearchChange}
          placeholder="종목명, 종목코드 검색..."
          placeholderTextColor={colors.textDim}
        />
      </View>

      {/* 날짜 범위 */}
      <View style={styles.dateRangeRow}>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setCalTarget('start')} activeOpacity={0.7}>
          <Text style={styles.dateBtnLabel}>시작일</Text>
          <Text style={styles.dateBtnValue}>{toDateStr(startDate)}</Text>
        </TouchableOpacity>
        <Text style={styles.dateSep}>~</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setCalTarget('end')} activeOpacity={0.7}>
          <Text style={styles.dateBtnLabel}>종료일</Text>
          <Text style={styles.dateBtnValue}>{toDateStr(endDate)}</Text>
        </TouchableOpacity>
      </View>

      {/* 모드 필터 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {MODE_FILTERS.map(f => (
          <TouchableOpacity
            key={f} style={[styles.filterBtn, modeF === f && styles.filterBtnActive]}
            onPress={() => handleModeChange(f)} activeOpacity={0.7}
          >
            <Text style={[styles.filterText, modeF === f && styles.filterTextActive]}>
              {f === 'LIVE' ? '실전' : f === 'PAPER' ? '모의' : f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 액션 필터 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {ACTION_FILTERS.map(f => (
          <TouchableOpacity
            key={f} style={[styles.filterBtn, actionF === f && styles.filterBtnActive]}
            onPress={() => handleActionChange(f)} activeOpacity={0.7}
          >
            <Text style={[styles.filterText, actionF === f && styles.filterTextActive]}>
              {ACTION_LABEL[f] ?? f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 상태 필터 + 건수 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f} style={[styles.filterBtn, statusF === f && styles.filterBtnActive]}
            onPress={() => handleStatusChange(f)} activeOpacity={0.7}
          >
            <Text style={[styles.filterText, statusF === f && styles.filterTextActive]}>
              {f === 'SUCCESS' ? '성공' : f === 'FAILED' ? '실패' : f}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.countText}>총 {totalCount}건</Text>
      </ScrollView>

      <FlatList
        data={list}
        keyExtractor={item => item.id}
        ListHeaderComponent={<SummaryCards summaryList={summaryList} totalCount={totalCount} />}
        renderItem={({ item }) => <TradeCard item={item} onPress={() => setSelected(item)} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(1, false, currentFilters()); }}
            tintColor={colors.teal}
          />
        }
        ListFooterComponent={
          hasNext ? (
            loadingMore
              ? <ActivityIndicator color={colors.teal} style={{ paddingVertical: 16 }} />
              : <TouchableOpacity style={styles.loadMoreBtn} onPress={() => fetchData(page + 1, true, currentFilters())} activeOpacity={0.7}>
                  <Text style={styles.loadMoreText}>더보기</Text>
                </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>거래 내역이 없습니다</Text>
          </View>
        }
      />

      <DetailModal item={selected} onClose={() => setSelected(null)} />

      <CalendarModal
        visible={calTarget === 'start'}
        selectedDate={startDate}
        title="시작일 선택"
        onSelect={d => {
          const newEnd = toDateStr(d) > toDateStr(endDate) ? d : endDate;
          setStartDate(d);
          if (toDateStr(d) > toDateStr(endDate)) setEndDate(d);
          fetchData(1, false, { ...currentFilters(), sd: d, ed: newEnd });
        }}
        onClose={() => setCalTarget(null)}
      />
      <CalendarModal
        visible={calTarget === 'end'}
        selectedDate={endDate}
        title="종료일 선택"
        onSelect={d => {
          const newStart = toDateStr(d) < toDateStr(startDate) ? d : startDate;
          setEndDate(d);
          if (toDateStr(d) < toDateStr(startDate)) setStartDate(d);
          fetchData(1, false, { ...currentFilters(), ed: d, sd: newStart });
        }}
        onClose={() => setCalTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.bg },
  center:           { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  searchBar:        {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, margin: 12, marginBottom: 8, borderRadius: 12,
    borderWidth: 1, borderColor: colors.borderDim, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchIcon:       { fontSize: 14, marginRight: 8 },
  searchInput:      { flex: 1, fontSize: 14, color: colors.text },
  dateRangeRow:     {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, marginBottom: 6, gap: 10,
  },
  dateBtn:          {
    flex: 1, backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.borderDim,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  dateBtnLabel:     { fontSize: 10, color: colors.textDim, marginBottom: 3 },
  dateBtnValue:     { fontSize: 14, fontWeight: '700', color: colors.teal },
  dateSep:          { fontSize: 16, color: colors.textDim, fontWeight: '700' },
  filterRow:        { height: 44, flexShrink: 0 },
  filterContent:    { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  filterBtn:        {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDim,
  },
  filterBtnActive:  { backgroundColor: colors.tealDim, borderColor: colors.teal },
  filterText:       { fontSize: 12, color: colors.textDim, fontWeight: '600' },
  filterTextActive: { color: colors.teal },
  countText:        { fontSize: 12, color: colors.textDim, paddingHorizontal: 8 },
  list:             { padding: 12, paddingTop: 8, paddingBottom: 32 },
  card:             {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.borderDim, padding: 14, marginBottom: 10,
  },
  cardTop:          { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cardTopLeft:      { flex: 1 },
  cardTopRight:     { alignItems: 'flex-end' },
  symbol:           { fontSize: 16, fontWeight: '700', color: colors.text },
  symbolCode:       { fontSize: 12, color: colors.textDim, marginTop: 2 },
  badge:            { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  badgeText:        { fontSize: 11, fontWeight: '700' },
  cardMid:          {
    flexDirection: 'row', backgroundColor: colors.bg,
    borderRadius: 10, padding: 12, marginBottom: 10, flexWrap: 'wrap', gap: 4,
  },
  infoItem:         { alignItems: 'center', flex: 1 },
  infoLabel:        { fontSize: 10, color: colors.textDim, marginBottom: 3 },
  infoValue:        { fontSize: 13, fontWeight: '700', color: colors.text },
  divider:          { width: 1, backgroundColor: colors.borderDim },
  cardBottom:       { flexDirection: 'row', justifyContent: 'space-between' },
  dateText:         { fontSize: 11, color: colors.textDim },
  userText:         { fontSize: 11, color: colors.textDim },
  empty:            { alignItems: 'center', paddingVertical: 60 },
  emptyText:        { color: colors.textDim, fontSize: 14 },
  loadMoreBtn:      {
    margin: 12, marginTop: 4, borderRadius: 12,
    borderWidth: 1, borderColor: colors.borderDim,
    paddingVertical: 14, alignItems: 'center' as const,
    backgroundColor: colors.surface,
  },
  loadMoreText:     { fontSize: 14, color: colors.textDim, fontWeight: '600' as const },
});

const summary = StyleSheet.create({
  row:   { flexDirection: 'row', gap: 8, marginBottom: 12 },
  card:  {
    flex: 1, backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.borderDim, padding: 10, alignItems: 'center',
  },
  label: { fontSize: 10, color: colors.textDim, marginBottom: 4 },
  value: { fontSize: 14, fontWeight: '800', color: colors.text },
});

const cal = StyleSheet.create({
  overlay:      {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  container:    {
    backgroundColor: colors.surface, borderRadius: 20,
    borderWidth: 1, borderColor: colors.borderDim,
    padding: 20, width: 320,
  },
  title:        { fontSize: 14, fontWeight: '700', color: colors.textDim, textAlign: 'center', marginBottom: 14 },
  monthRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn:       { padding: 8 },
  navText:      { fontSize: 22, color: colors.teal, fontWeight: '300', lineHeight: 24 },
  monthLabel:   { fontSize: 16, fontWeight: '700', color: colors.text },
  weekRow:      { flexDirection: 'row', marginBottom: 8 },
  weekDay:      { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.textDim },
  grid:         { flexDirection: 'row', flexWrap: 'wrap' },
  cell:         { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellSelected: { backgroundColor: colors.teal, borderRadius: 100 },
  dayText:      { fontSize: 14, color: colors.text },
  dayTextSelected: { color: colors.bg, fontWeight: '700' },
  todayDot:     {
    position: 'absolute', bottom: 4,
    width: 4, height: 4, borderRadius: 2, backgroundColor: colors.teal,
  },
});

const detail = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.surface },
  handle:       { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  header:       {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: colors.borderDim,
  },
  title:        { fontSize: 17, fontWeight: '700', color: colors.text },
  closeBtn:     { padding: 4 },
  closeText:    { fontSize: 16, color: colors.textDim },
  scroll:       { flex: 1 },
  section:      {
    backgroundColor: colors.bg, borderRadius: 14, margin: 12, marginBottom: 0,
    borderWidth: 1, borderColor: colors.borderDim, overflow: 'hidden',
  },
  row:          {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: colors.borderDim,
  },
  rowLabel:     { fontSize: 13, color: colors.textDim },
  rowValue:     { fontSize: 13, fontWeight: '600', color: colors.text },
  errorSection: { borderColor: colors.rose + '50', backgroundColor: colors.roseDim },
  errorLabel:   { fontSize: 12, color: colors.rose, padding: 12, paddingBottom: 4 },
  errorText:    { fontSize: 13, color: colors.rose, padding: 12, paddingTop: 4 },
});
