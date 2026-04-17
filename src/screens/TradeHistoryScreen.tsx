import React, { useState, useCallback } from 'react';
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
  SELL_SHORT:  colors.rose,
  CLOSE_LONG:  colors.sky,
  CLOSE_SHORT: colors.orange,
};
const ACTION_LABEL: Record<string, string> = {
  BUY:         '매수',
  SELL_SHORT:  '공매도',
  CLOSE_LONG:  '청산(롱)',
  CLOSE_SHORT: '청산(숏)',
};

function TradeCard({ item, onPress }: { item: TradeHistory; onPress: () => void }) {
  const actionColor  = ACTION_COLOR[item.action] ?? colors.textDim;
  const isClose      = item.action === 'CLOSE_LONG' || item.action === 'CLOSE_SHORT';
  const pnl          = item.realizedPnl;
  const pnlColor     = pnl != null && pnl >= 0 ? colors.sky : colors.rose;
  const statusColor  = item.orderStatus === 'SUCCESS' ? colors.emerald : colors.rose;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {/* 상단: 종목 + 액션 + 상태 */}
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

      {/* 중단: 수량 / 진입가 / 모드 */}
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

      {/* 하단: 생성일시 / 사용자 */}
      <View style={styles.cardBottom}>
        <Text style={styles.dateText}>
          {item.createdAt ? item.createdAt.slice(0, 16).replace('T', ' ') : '—'}
        </Text>
        {item.userName && (
          <Text style={styles.userText}>{item.userName}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function DetailModal({ item, onClose }: { item: TradeHistory | null; onClose: () => void }) {
  if (!item) return null;
  const isClose  = item.action === 'CLOSE_LONG' || item.action === 'CLOSE_SHORT';
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
            {item.strategyConfigId != null && <Row label="전략 ID" value={String(item.strategyConfigId)} />}
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

const FILTER_ACTIONS = ['전체', 'BUY', 'SELL_SHORT', 'CLOSE_LONG', 'CLOSE_SHORT'];
const FILTER_STATUS  = ['전체', 'SUCCESS', 'FAILED'];

export default function TradeHistoryScreen() {
  const [list,       setList]       = useState<TradeHistory[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState<TradeHistory | null>(null);
  const [actionF,    setActionF]    = useState('전체');
  const [statusF,    setStatusF]    = useState('전체');
  const [search,     setSearch]     = useState('');

  const load = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    const u = await authStorage.get();
    const isAdmin = (u?.permission ?? 0) >= 99;
    try {
      const res = await getTradeHistoryList(isAdmin ? {} : { userUid: u?.userUid });
      if (res.status === 200) setList(res.data ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const filtered = list.filter(t =>
    (actionF === '전체' || t.action      === actionF) &&
    (statusF === '전체' || t.orderStatus === statusF) &&
    (search === '' || t.symbol.toLowerCase().includes(search.toLowerCase()) ||
     (t.symbolName ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return (
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
          onChangeText={setSearch}
          placeholder="종목명, 종목코드 검색..."
          placeholderTextColor={colors.textDim}
        />
      </View>

      {/* 필터 - 액션 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {FILTER_ACTIONS.map(f => (
          <TouchableOpacity
            key={f} style={[styles.filterBtn, actionF === f && styles.filterBtnActive]}
            onPress={() => setActionF(f)} activeOpacity={0.7}
          >
            <Text style={[styles.filterText, actionF === f && styles.filterTextActive]}>
              {f === 'SELL_SHORT' ? '공매도' : f === 'CLOSE_LONG' ? '청산(롱)' : f === 'CLOSE_SHORT' ? '청산(숏)' : f === 'BUY' ? '매수' : f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 필터 - 상태 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {FILTER_STATUS.map(f => (
          <TouchableOpacity
            key={f} style={[styles.filterBtn, statusF === f && styles.filterBtnActive]}
            onPress={() => setStatusF(f)} activeOpacity={0.7}
          >
            <Text style={[styles.filterText, statusF === f && styles.filterTextActive]}>
              {f === 'SUCCESS' ? '성공' : f === 'FAILED' ? '실패' : f}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.countText}>총 {filtered.length}건</Text>
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <TradeCard item={item} onPress={() => setSelected(item)} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} tintColor={colors.teal} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>거래 내역이 없습니다</Text>
          </View>
        }
      />

      <DetailModal item={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.bg },
  center:          { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  searchBar:       {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, margin: 12, borderRadius: 12,
    borderWidth: 1, borderColor: colors.borderDim, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchIcon:      { fontSize: 14, marginRight: 8 },
  searchInput:     { flex: 1, fontSize: 14, color: colors.text },
  filterRow:       { maxHeight: 44 },
  filterContent:   { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  filterBtn:       {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDim,
  },
  filterBtnActive: { backgroundColor: colors.tealDim, borderColor: colors.teal },
  filterText:      { fontSize: 12, color: colors.textDim, fontWeight: '600' },
  filterTextActive:{ color: colors.teal },
  countText:       { fontSize: 12, color: colors.textDim, paddingHorizontal: 8 },
  list:            { padding: 12, paddingBottom: 32 },
  card:            {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.borderDim, padding: 14, marginBottom: 10,
  },
  cardTop:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cardTopLeft:     { flex: 1 },
  cardTopRight:    { alignItems: 'flex-end' },
  symbol:          { fontSize: 16, fontWeight: '700', color: colors.text },
  symbolCode:      { fontSize: 12, color: colors.textDim, marginTop: 2 },
  badge:           { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  badgeText:       { fontSize: 11, fontWeight: '700' },
  cardMid:         {
    flexDirection: 'row', backgroundColor: colors.bg,
    borderRadius: 10, padding: 12, marginBottom: 10, flexWrap: 'wrap', gap: 4,
  },
  infoItem:        { alignItems: 'center', flex: 1 },
  infoLabel:       { fontSize: 10, color: colors.textDim, marginBottom: 3 },
  infoValue:       { fontSize: 13, fontWeight: '700', color: colors.text },
  divider:         { width: 1, backgroundColor: colors.borderDim },
  cardBottom:      { flexDirection: 'row', justifyContent: 'space-between' },
  dateText:        { fontSize: 11, color: colors.textDim },
  userText:        { fontSize: 11, color: colors.textDim },
  empty:           { alignItems: 'center', paddingVertical: 60 },
  emptyText:       { color: colors.textDim, fontSize: 14 },
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
