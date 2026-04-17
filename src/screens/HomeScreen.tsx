import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getTradingSessionList, getExecuteOnOff, setExecuteOnOff } from '../api/tradeApi';
import { authStorage } from '../utils/auth';
import { colors } from '../constants/colors';
import type { User, TradingSession } from '../types';

function StatCard({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg, borderColor: bg }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SessionCard({ session }: { session: TradingSession }) {
  const isActive = session.active === 1;
  const posColor =
    session.currentPosition === 'LONG'  ? colors.teal :
    session.currentPosition === 'SHORT' ? colors.rose : colors.textDim;
  const posLabel =
    session.currentPosition === 'LONG'  ? '롱 포지션' :
    session.currentPosition === 'SHORT' ? '숏 포지션' : '포지션 없음';

  return (
    <View style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <View style={styles.sessionLeft}>
          <Text style={styles.sessionSymbol}>{session.symbol}</Text>
          <View style={[styles.modeBadge, session.mode === 'LIVE' ? styles.modeLive : styles.modePaper]}>
            <Text style={[styles.modeBadgeText, session.mode === 'LIVE' ? styles.modeLiveText : styles.modePaperText]}>
              {session.mode === 'LIVE' ? '실전' : '모의'}
            </Text>
          </View>
        </View>
        <View style={[styles.activeDot, { backgroundColor: isActive ? colors.emerald : colors.textDim }]} />
      </View>

      <View style={styles.sessionRow}>
        <Text style={[styles.positionText, { color: posColor }]}>{posLabel}</Text>
        <Text style={styles.sessionSub}>
          {session.strategyConfig?.title ?? `전략 #${session.strategyConfigId}`}
        </Text>
      </View>

      {session.currentEquity != null && (
        <Text style={styles.equityText}>
          자본금 {session.currentEquity.toLocaleString()}
        </Text>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const [user,       setUser]       = useState<User | null>(null);
  const [sessions,   setSessions]   = useState<TradingSession[]>([]);
  const [execOn,     setExecOn]     = useState<boolean>(false);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    const u = await authStorage.get();
    setUser(u);
    const isAdmin = (u?.permission ?? 0) >= 99;
    try {
      const [sessionRes, execRes] = await Promise.all([
        getTradingSessionList(isAdmin ? {} : { userUid: u?.userUid }),
        getExecuteOnOff(),
      ]);
      if (sessionRes.status === 200) setSessions(sessionRes.data ?? []);
      if (execRes.status === 200)    setExecOn(execRes.data?.isEnabled === 1);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = () => { setRefreshing(true); load(false); };

  const toggleExec = async () => {
    const next = execOn ? 0 : 1;
    await setExecuteOnOff(next);
    setExecOn(!execOn);
  };

  const active   = sessions.filter(s => s.active === 1).length;
  const stopped  = sessions.filter(s => s.active === 0).length;
  const longPos  = sessions.filter(s => s.currentPosition === 'LONG').length;
  const shortPos = sessions.filter(s => s.currentPosition === 'SHORT').length;

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.teal} size="large" />
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>안녕하세요 👋</Text>
          <Text style={styles.userName}>{user?.userName ?? '사용자'}</Text>
        </View>
        <TouchableOpacity
          style={[styles.execButton, execOn ? styles.execOn : styles.execOff]}
          onPress={toggleExec}
          activeOpacity={0.8}
        >
          <Text style={[styles.execButtonText, execOn ? styles.execOnText : styles.execOffText]}>
            {execOn ? '실행 중' : '중지됨'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 통계 카드 */}
      <View style={styles.statsGrid}>
        <StatCard label="전체 세션"  value={`${sessions.length}`} color={colors.text}    bg={colors.surfaceAlt} />
        <StatCard label="실행 중"    value={`${active}`}          color={colors.emerald} bg={colors.emeraldDim} />
        <StatCard label="중지됨"     value={`${stopped}`}         color={colors.textDim} bg={colors.surfaceAlt} />
        <StatCard label="롱 포지션"  value={`${longPos}`}         color={colors.teal}    bg={colors.tealDim} />
        <StatCard label="숏 포지션"  value={`${shortPos}`}        color={colors.rose}    bg={colors.roseDim} />
        <StatCard label="대기 중"    value={`${sessions.filter(s => s.currentPosition === 'NONE' && s.active === 1).length}`}
                                                                   color={colors.amber}   bg={colors.amberDim} />
      </View>

      {/* 세션 목록 */}
      <Text style={styles.sectionTitle}>활성 세션</Text>
      {sessions.filter(s => s.active === 1).length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>활성 세션이 없습니다</Text>
        </View>
      ) : (
        sessions.filter(s => s.active === 1).map(s => <SessionCard key={s.id} session={s} />)
      )}

      {stopped > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>중지된 세션</Text>
          {sessions.filter(s => s.active === 0).map(s => <SessionCard key={s.id} session={s} />)}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },
  content:        { padding: 16, paddingBottom: 32 },
  center:         { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting:       { fontSize: 13, color: colors.textDim },
  userName:       { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 2 },
  execButton:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  execOn:         { backgroundColor: colors.emeraldDim, borderColor: colors.emerald },
  execOff:        { backgroundColor: colors.surfaceAlt, borderColor: colors.borderDim },
  execButtonText: { fontSize: 13, fontWeight: '700' },
  execOnText:     { color: colors.emerald },
  execOffText:    { color: colors.textDim },
  statsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard:       {
    width: '30.5%', borderRadius: 14, padding: 14,
    borderWidth: 1, alignItems: 'center',
  },
  statValue:      { fontSize: 22, fontWeight: '800' },
  statLabel:      { fontSize: 11, color: colors.textDim, marginTop: 4 },
  sectionTitle:   { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  sessionCard:    {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.borderDim,
    padding: 16, marginBottom: 10,
  },
  sessionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sessionLeft:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sessionSymbol:  { fontSize: 16, fontWeight: '700', color: colors.text },
  modeBadge:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  modeLive:       { backgroundColor: colors.amberDim, borderColor: colors.amber },
  modePaper:      { backgroundColor: colors.blueDim,  borderColor: colors.blue },
  modeBadgeText:  { fontSize: 11, fontWeight: '700' },
  modeLiveText:   { color: colors.amber },
  modePaperText:  { color: colors.blue },
  activeDot:      { width: 10, height: 10, borderRadius: 5 },
  sessionRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  positionText:   { fontSize: 13, fontWeight: '600' },
  sessionSub:     { fontSize: 12, color: colors.textDim },
  equityText:     { fontSize: 12, color: colors.textDim, marginTop: 8 },
  emptyCard:      {
    backgroundColor: colors.surface, borderRadius: 16, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: colors.borderDim,
  },
  emptyText:      { color: colors.textDim, fontSize: 14 },
});
