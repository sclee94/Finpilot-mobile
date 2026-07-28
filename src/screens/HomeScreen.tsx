import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getTradingSessionList, getExecuteOnOff, setExecuteOnOff, getBalance } from '../api/tradeApi';
import { authStorage } from '../utils/auth';
import { assetStorage } from '../utils/assetStorage';
import { colors } from '../constants/colors';
import type { User, TradingSession } from '../types';

function fmt(v: number | null): string {
  if (v === null) return '-';
  const a = Math.abs(v);
  if (a >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (a >= 10_000)      return `${Math.round(v / 10_000)}만원`;
  return `${v.toLocaleString()}원`;
}

function AssetTable({ liveBalance, liveHolding, liveOrderableCash, paperBalance, paperHolding, paperOrderableCash }: {
  liveBalance: number | null; liveHolding: number | null; liveOrderableCash: number | null;
  paperBalance: number | null; paperHolding: number | null; paperOrderableCash: number | null;
}) {
  const rows = [
    { label: '총 자산',           liveVal: liveBalance,       paperVal: paperBalance,       color: colors.text },
    { label: '보유 주식 평가금액', liveVal: liveHolding,       paperVal: paperHolding,       color: colors.teal },
    { label: '매수 가능 자산',     liveVal: liveOrderableCash, paperVal: paperOrderableCash, color: colors.emerald },
  ];
  return (
    <View style={styles.statsTable}>
      <View style={styles.statsHeaderRow}>
        <Text style={styles.statsHeaderLabel} />
        <Text style={[styles.assetHeaderCol, { color: colors.amber }]}>실전</Text>
        <Text style={[styles.assetHeaderCol, { color: colors.blue }]}>모의</Text>
      </View>
      {rows.map((row, i) => (
        <View key={i} style={[styles.statsRow, i % 2 === 1 && styles.statsRowAlt]}>
          <Text style={styles.statsRowLabel}>{row.label}</Text>
          <Text style={[styles.assetVal, { color: row.color }]}>{fmt(row.liveVal)}</Text>
          <Text style={[styles.assetVal, { color: row.color }]}>{fmt(row.paperVal)}</Text>
        </View>
      ))}
    </View>
  );
}

function StatsTable({ live, paper }: {
  live:  { total: number; active: number; stopped: number; long: number; waiting: number };
  paper: { total: number; active: number; stopped: number; long: number; waiting: number };
}) {
  const rows: { label: string; liveVal: number; paperVal: number; color: string }[] = [
    { label: '전체 세션',  liveVal: live.total,   paperVal: paper.total,   color: colors.text },
    { label: '실행 중',    liveVal: live.active,  paperVal: paper.active,  color: colors.emerald },
    { label: '중지됨',     liveVal: live.stopped, paperVal: paper.stopped, color: colors.textDim },
    { label: '보유 중',    liveVal: live.long,    paperVal: paper.long,    color: colors.teal },
    { label: '대기 중',    liveVal: live.waiting, paperVal: paper.waiting, color: colors.amber },
  ];
  return (
    <View style={styles.statsTable}>
      {/* 헤더 */}
      <View style={styles.statsHeaderRow}>
        <Text style={styles.statsHeaderLabel} />
        <Text style={[styles.statsHeaderCol, { color: colors.amber }]}>실전</Text>
        <Text style={[styles.statsHeaderCol, { color: colors.blue }]}>모의</Text>
      </View>
      {rows.map((row, i) => (
        <View key={i} style={[styles.statsRow, i % 2 === 1 && styles.statsRowAlt]}>
          <Text style={styles.statsRowLabel}>{row.label}</Text>
          <Text style={[styles.statsRowVal, { color: row.color }]}>{row.liveVal}</Text>
          <Text style={[styles.statsRowVal, { color: row.color }]}>{row.paperVal}</Text>
        </View>
      ))}
    </View>
  );
}


export default function HomeScreen() {
  const [user,       setUser]       = useState<User | null>(null);
  const [sessions,   setSessions]   = useState<TradingSession[]>([]);
  const [execOn,       setExecOn]       = useState<boolean>(false);
  const [liveBalance,        setLiveBalance]        = useState<number | null>(null);
  const [liveHolding,        setLiveHolding]        = useState<number | null>(null);
  const [liveOrderableCash,  setLiveOrderableCash]  = useState<number | null>(null);
  const [paperBalance,       setPaperBalance]       = useState<number | null>(null);
  const [paperHolding,       setPaperHolding]       = useState<number | null>(null);
  const [paperOrderableCash, setPaperOrderableCash] = useState<number | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    const u = await authStorage.get();
    setUser(u);
    const isAdmin   = (u?.permission ?? 0) >= 99;
    const userParam = isAdmin ? { userUid: u?.userUid, viewAll: true } : { userUid: u?.userUid };
    try {
      const [sessionRes, execRes] = await Promise.all([
        getTradingSessionList(userParam),
        getExecuteOnOff(),
      ]);
      if (sessionRes.status === 200) setSessions(sessionRes.data ?? []);
      if (execRes.status    === 200) setExecOn(execRes.data?.isEnabled === 1);

      // 자산은 로컬 DB에서 불러옴 (새로고침 전이면 null 유지 → '-' 표시)
      const uid = u?.userUid ?? '';
      if (uid) {
        const cached = await assetStorage.get(uid);
        if (cached) {
          setLiveBalance(cached.liveBalance);
          setLiveHolding(cached.liveHolding);
          setLiveOrderableCash(cached.liveOrderableCash);
          setPaperBalance(cached.paperBalance);
          setPaperHolding(cached.paperHolding);
          setPaperOrderableCash(cached.paperOrderableCash);
        }
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    const u = await authStorage.get();
    const uid = u?.userUid ?? '';
    const isAdmin   = (u?.permission ?? 0) >= 99;
    const userParam = isAdmin ? { userUid: u?.userUid, viewAll: true } : { userUid: u?.userUid };
    try {
      const balanceParams: Parameters<typeof getBalance>[] = uid
        ? [
            [uid, 'LIVE',  u?.kisAccountNo      ?? undefined],
            [uid, 'PAPER', u?.kisPaperAccountNo ?? undefined],
          ]
        : [];
      const calls: Promise<any>[] = [
        getTradingSessionList(userParam),
        getExecuteOnOff(),
        ...balanceParams.map(p => getBalance(...p)),
      ];
      const [sessionRes, execRes, liveBalRes, paperBalRes] = await Promise.all(calls);
      if (sessionRes.status === 200) setSessions(sessionRes.data ?? []);
      if (execRes.status    === 200) setExecOn(execRes.data?.isEnabled === 1);

      // KIS API로 자산 조회 후 로컬 DB에 저장
      if (uid && balanceParams.length > 0) {
        const existing: Partial<import('../utils/assetStorage').AssetData> = (await assetStorage.get(uid)) ?? {};
        const liveData  = liveBalRes?.status  === 200 ? liveBalRes.data  : null;
        const paperData = paperBalRes?.status === 200 ? paperBalRes.data : null;
        const newLiveBalance        = liveData?.totalBalance    ?? existing.liveBalance        ?? null;
        const newLiveHolding        = liveData?.holdingBalance  ?? existing.liveHolding        ?? null;
        const newLiveOrderableCash  = liveData?.orderableCash   ?? existing.liveOrderableCash  ?? null;
        const newPaperBalance       = paperData?.totalBalance   ?? existing.paperBalance       ?? null;
        const newPaperHolding       = paperData?.holdingBalance ?? existing.paperHolding       ?? null;
        const newPaperOrderableCash = paperData?.orderableCash  ?? existing.paperOrderableCash ?? null;
        setLiveBalance(newLiveBalance);
        setLiveHolding(newLiveHolding);
        setLiveOrderableCash(newLiveOrderableCash);
        setPaperBalance(newPaperBalance);
        setPaperHolding(newPaperHolding);
        setPaperOrderableCash(newPaperOrderableCash);
        await assetStorage.save(uid, {
          liveBalance: newLiveBalance, liveHolding: newLiveHolding, liveOrderableCash: newLiveOrderableCash,
          paperBalance: newPaperBalance, paperHolding: newPaperHolding, paperOrderableCash: newPaperOrderableCash,
        });
      }
    } catch {}
    finally { setRefreshing(false); }
  };

  const toggleExec = () => {
    const next = execOn ? 0 : 1;
    Alert.alert(
      execOn ? '실전매매 전체 중지' : '실전매매 전체 실행',
      execOn
        ? '전체 유저의 실전매매 실행을 중지합니다. 계속하시겠습니까?'
        : '전체 유저의 실전매매 실행을 시작합니다. 계속하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          style: execOn ? 'destructive' : 'default',
          onPress: async () => {
            if (!myUid) return;
            await setExecuteOnOff(next, myUid);
            setExecOn(!execOn);
          },
        },
      ],
    );
  };

  const isAdmin        = (user?.permission ?? 0) >= 99;
  const myUid         = user?.userUid;
  const liveSessions  = sessions.filter(s => s.mode === 'LIVE'  && (!myUid || s.userUid === myUid));
  const paperSessions = sessions.filter(s => s.mode !== 'LIVE'  && (!myUid || s.userUid === myUid));

  const calcStats = (list: TradingSession[]) => ({
    total:   list.length,
    active:  list.filter(s => s.active === 1).length,
    stopped: list.filter(s => s.active === 0).length,
    long:    list.filter(s => s.currentPosition === 'LONG').length,
    waiting: list.filter(s => s.currentPosition === 'NONE' && s.active === 1).length,
  });

  const liveStats  = calcStats(liveSessions);
  const paperStats = calcStats(paperSessions);

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
        {isAdmin && (
          <TouchableOpacity
            style={[styles.execButton, execOn ? styles.execOn : styles.execOff]}
            onPress={toggleExec}
            activeOpacity={0.8}
          >
            <Text style={[styles.execButtonText, execOn ? styles.execOnText : styles.execOffText]}>
              {execOn ? '실행 중' : '중지됨'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 자산 현황 */}
      <AssetTable
        liveBalance={liveBalance}
        liveHolding={liveHolding}
        liveOrderableCash={liveOrderableCash}
        paperBalance={paperBalance}
        paperHolding={paperHolding}
        paperOrderableCash={paperOrderableCash}
      />

      {/* 통계 테이블 */}
      <StatsTable live={liveStats} paper={paperStats} />
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
  statsTable:     {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.borderDim,
    marginBottom: 24, overflow: 'hidden',
  },
  statsHeaderRow: {
    flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.borderDim,
    backgroundColor: colors.surfaceAlt,
  },
  statsHeaderLabel: { flex: 1, fontSize: 12 },
  statsHeaderCol:   { width: 56, textAlign: 'center', fontSize: 13, fontWeight: '700' },
  statsRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  statsRowAlt:    { backgroundColor: colors.surfaceAlt },
  statsRowLabel:  { flex: 1, fontSize: 13, color: colors.textDim },
  statsRowVal:    { width: 56, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  assetHeaderCol: { width: 72, textAlign: 'right', fontSize: 13, fontWeight: '700' },
  assetVal:       { width: 72, textAlign: 'right', fontSize: 13, fontWeight: '700' },
});

