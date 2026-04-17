import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getTradingSessionList } from '../api/tradeApi';
import { authStorage } from '../utils/auth';
import { colors } from '../constants/colors';
import type { TradingSession } from '../types';

function SessionCard({ session }: { session: TradingSession }) {
  const isActive = session.active === 1;
  const posColor =
    session.currentPosition === 'LONG'  ? colors.teal :
    session.currentPosition === 'SHORT' ? colors.rose : colors.textDim;
  const posLabel =
    session.currentPosition === 'LONG'  ? '롱' :
    session.currentPosition === 'SHORT' ? '숏' : 'NONE';

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.topLeft}>
          <View style={[styles.activeDot, { backgroundColor: isActive ? colors.emerald : colors.textDim }]} />
          <Text style={styles.symbol}>{session.symbol}</Text>
          <View style={[styles.modeBadge, session.mode === 'LIVE' ? styles.modeLive : styles.modePaper]}>
            <Text style={[styles.modeText, session.mode === 'LIVE' ? { color: colors.amber } : { color: colors.blue }]}>
              {session.mode === 'LIVE' ? '실전' : '모의'}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: isActive ? colors.emeraldDim : colors.surfaceAlt }]}>
          <Text style={[styles.statusText, { color: isActive ? colors.emerald : colors.textDim }]}>
            {isActive ? '실행 중' : '중지'}
          </Text>
        </View>
      </View>

      <View style={styles.cardMid}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>포지션</Text>
          <Text style={[styles.metaValue, { color: posColor }]}>{posLabel}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>보유수량</Text>
          <Text style={styles.metaValue}>{session.sharesHeld ?? 0}주</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>보유봉수</Text>
          <Text style={styles.metaValue}>{session.barsHeld}봉</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>자본금</Text>
          <Text style={styles.metaValue}>
            {session.currentEquity != null ? session.currentEquity.toLocaleString() : '—'}
          </Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.strategyText}>
          {session.strategyConfig?.title ?? `전략 #${session.strategyConfigId}`}
        </Text>
        {session.userDTO?.userName && (
          <Text style={styles.userText}>{session.userDTO.userName}</Text>
        )}
      </View>
    </View>
  );
}

export default function SessionsScreen() {
  const [sessions,   setSessions]   = useState<TradingSession[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState<'all' | 'active' | 'stopped'>('all');

  const load = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    const u = await authStorage.get();
    const isAdmin = (u?.permission ?? 0) >= 99;
    try {
      const res = await getTradingSessionList(isAdmin ? {} : { userUid: u?.userUid });
      if (res.status === 200) setSessions(res.data ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const filtered =
    filter === 'active'  ? sessions.filter(s => s.active === 1) :
    filter === 'stopped' ? sessions.filter(s => s.active === 0) : sessions;

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={colors.teal} size="large" /></View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {(['all', 'active', 'stopped'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? `전체 ${sessions.length}` : f === 'active' ? `실행 중 ${sessions.filter(s => s.active === 1).length}` : `중지 ${sessions.filter(s => s.active === 0).length}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <SessionCard session={item} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} tintColor={colors.teal} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>세션이 없습니다</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },
  center:         { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  filterRow:      { flexDirection: 'row', padding: 12, gap: 8 },
  filterBtn:      {
    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDim,
  },
  filterBtnActive:{ backgroundColor: colors.tealDim, borderColor: colors.teal },
  filterText:     { fontSize: 12, color: colors.textDim, fontWeight: '700' },
  filterTextActive:{ color: colors.teal },
  list:           { padding: 12, paddingTop: 0, paddingBottom: 32 },
  card:           {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.borderDim, padding: 14, marginBottom: 10,
  },
  cardTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  topLeft:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeDot:      { width: 8, height: 8, borderRadius: 4 },
  symbol:         { fontSize: 16, fontWeight: '700', color: colors.text },
  modeBadge:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  modeLive:       { backgroundColor: colors.amberDim, borderColor: colors.amber },
  modePaper:      { backgroundColor: colors.blueDim,  borderColor: colors.blue },
  modeText:       { fontSize: 11, fontWeight: '700' },
  statusBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText:     { fontSize: 12, fontWeight: '600' },
  cardMid:        {
    flexDirection: 'row', backgroundColor: colors.bg,
    borderRadius: 10, padding: 12, marginBottom: 10,
  },
  metaItem:       { flex: 1, alignItems: 'center' },
  metaLabel:      { fontSize: 10, color: colors.textDim, marginBottom: 4 },
  metaValue:      { fontSize: 13, fontWeight: '700', color: colors.text },
  cardBottom:     { flexDirection: 'row', justifyContent: 'space-between' },
  strategyText:   { fontSize: 12, color: colors.textDim },
  userText:       { fontSize: 12, color: colors.textDim },
  empty:          { alignItems: 'center', paddingVertical: 60 },
  emptyText:      { color: colors.textDim, fontSize: 14 },
});
