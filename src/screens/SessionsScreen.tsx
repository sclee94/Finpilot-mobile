import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal,
  ScrollView, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getTradingSessionList,
  updateTradingSession,
  deleteTradingSession,
  resetTradingSession,
  insertTradingSession,
  toggleStrategyUpdate,
} from '../api/tradeApi';
import { authStorage } from '../utils/auth';
import { colors } from '../constants/colors';
import { getSymbolName } from '../constants/symbolNames';
import type { TradingSession } from '../types';

function SessionCard({
  session,
  onToggle,
  onReset,
  onDelete,
  onToggleStrategyUpdate,
}: {
  session: TradingSession;
  onToggle: () => void;
  onReset: () => void;
  onDelete: () => void;
  onToggleStrategyUpdate: () => void;
}) {
  const isActive = session.active === 1;
  const posColor =
    session.currentPosition === 'LONG'  ? colors.teal :
    session.currentPosition === 'SHORT' ? colors.rose : colors.textDim;
  const posLabel =
    session.currentPosition === 'LONG'  ? '롱' :
    session.currentPosition === 'SHORT' ? '숏' : 'NONE';

  return (
    <View style={[styles.card, (session.sharesHeld ?? 0) >= 1 && styles.cardHolding]}>
      <View style={styles.cardTop}>
        <View style={styles.topLeft}>
          <View style={[styles.activeDot, { backgroundColor: isActive ? colors.emerald : colors.textDim }]} />
          <Text style={styles.symbol}>{getSymbolName(session.symbol)}</Text>
          <View style={[styles.modeBadge, session.mode === 'LIVE' ? styles.modeLive : styles.modePaper]}>
            <Text style={[styles.modeText, { color: session.mode === 'LIVE' ? colors.amber : colors.blue }]}>
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

      {(session.sharesHeld ?? 0) >= 1 && session.avgEntryPrice != null && (
        <View style={styles.entryPriceRow}>
          <Text style={styles.entryPriceLabel}>평균 진입가</Text>
          <Text style={[styles.entryPriceValue, { color: posColor }]}>
            {session.avgEntryPrice.toLocaleString()}원
          </Text>
        </View>
      )}

      <View style={styles.cardStrategy}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={styles.strategyText}>
            {session.isStrategyUpdate === 1 ? '전략 메뉴판' : '4등급 고정'}
          </Text>
          <TouchableOpacity
            style={[
              styles.autoUpdateBadge,
              session.isStrategyUpdate === 1 ? styles.autoUpdateOn : styles.autoUpdateOff,
            ]}
            onPress={onToggleStrategyUpdate}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={[
              styles.autoUpdateText,
              { color: session.isStrategyUpdate === 1 ? colors.teal : colors.textDim },
            ]}>
              메뉴판 {session.isStrategyUpdate === 1 ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>
        {session.userDTO?.userName && (
          <Text style={styles.userText}>{session.userDTO.userName}</Text>
        )}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, isActive ? styles.actionBtnStop : styles.actionBtnStart]}
          onPress={onToggle}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionBtnText, { color: isActive ? colors.rose : colors.emerald }]}>
            {isActive ? '중지' : '시작'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnReset]} onPress={onReset} activeOpacity={0.7}>
          <Text style={[styles.actionBtnText, { color: colors.amber }]}>초기화</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDelete]} onPress={onDelete} activeOpacity={0.7}>
          <Text style={[styles.actionBtnText, { color: colors.rose }]}>삭제</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CreateSessionModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { symbol: string; mode: 'LIVE' | 'PAPER'; currentEquity: number }) => void;
}) {
  const [symbol, setSymbol] = useState('');
  const [mode, setMode]     = useState<'LIVE' | 'PAPER'>('PAPER');
  const [equity, setEquity] = useState('');

  const reset = () => { setSymbol(''); setMode('PAPER'); setEquity(''); };

  const handleSubmit = () => {
    if (!symbol.trim()) { Alert.alert('입력 오류', '종목 코드를 입력해주세요.'); return; }
    const eq = parseFloat(equity);
    if (isNaN(eq) || eq <= 0) { Alert.alert('입력 오류', '자본금을 입력해주세요.'); return; }
    onSubmit({ symbol: symbol.trim().toUpperCase(), mode, currentEquity: eq });
    reset();
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={modal.container}>
        <View style={modal.handle} />
        <View style={modal.header}>
          <Text style={modal.title}>세션 생성</Text>
          <TouchableOpacity onPress={handleClose} style={modal.closeBtn}>
            <Text style={modal.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={modal.scroll} keyboardShouldPersistTaps="handled">
          <View style={modal.field}>
            <Text style={modal.label}>종목 코드</Text>
            <TextInput
              style={modal.input}
              value={symbol}
              onChangeText={setSymbol}
              placeholder="예: 005930.KS, AAPL, NQ=F"
              placeholderTextColor={colors.textDim}
              autoCapitalize="characters"
            />
          </View>

          <View style={modal.field}>
            <Text style={modal.label}>거래 모드</Text>
            <View style={modal.modeRow}>
              {(['PAPER', 'LIVE'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[modal.modeBtn, mode === m && (m === 'LIVE' ? modal.modeBtnLive : modal.modeBtnPaper)]}
                  onPress={() => setMode(m)}
                  activeOpacity={0.7}
                >
                  <Text style={[modal.modeBtnText, {
                    color: mode === m ? (m === 'LIVE' ? colors.amber : colors.blue) : colors.textDim,
                  }]}>
                    {m === 'LIVE' ? '실전' : '모의'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={modal.field}>
            <Text style={modal.label}>초기 자본금 (원)</Text>
            <TextInput
              style={modal.input}
              value={equity}
              onChangeText={setEquity}
              placeholder="예: 10000000"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
            />
          </View>

          <Text style={modal.hint}>전략은 시장 상황에 따라 자동으로 적용됩니다.</Text>

          <TouchableOpacity style={modal.submitBtn} onPress={handleSubmit} activeOpacity={0.8}>
            <Text style={modal.submitText}>세션 생성</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function SessionsScreen() {
  const [sessions,   setSessions]   = useState<TradingSession[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modeTab,    setModeTab]    = useState<'live' | 'paper'>('live');
  const [filter,     setFilter]     = useState<'all' | 'active' | 'stopped'>('all');
  const [showCreate, setShowCreate] = useState(false);

  const load = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    const u = await authStorage.get();
    const isAdmin = (u?.permission ?? 0) >= 99;
    const userParams = isAdmin ? {} : { userUid: u?.userUid };
    try {
      const sessionRes = await getTradingSessionList(userParams);
      if (sessionRes.status === 200) setSessions(sessionRes.data ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleToggle = (session: TradingSession) => {
    const next = session.active === 1 ? 0 : 1;
    const label = next === 1 ? '시작' : '중지';
    Alert.alert(`세션 ${label}`, `${getSymbolName(session.symbol)} 세션을 ${label}하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: label, onPress: async () => {
          try {
            await updateTradingSession({ id: session.id, active: next });
            setSessions(prev => prev.map(s => s.id === session.id ? { ...s, active: next } : s));
          } catch { Alert.alert('오류', '요청에 실패했습니다.'); }
        },
      },
    ]);
  };

  const handleReset = (session: TradingSession) => {
    Alert.alert('세션 초기화', `${getSymbolName(session.symbol)} 세션을 초기화하시겠습니까?\n포지션 및 통계가 초기화됩니다.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '초기화', style: 'destructive',
        onPress: async () => {
          try {
            const res = await resetTradingSession(session.id);
            if (res.data) setSessions(prev => prev.map(s => s.id === session.id ? res.data : s));
          } catch { Alert.alert('오류', '요청에 실패했습니다.'); }
        },
      },
    ]);
  };

  const handleToggleStrategyUpdate = (session: TradingSession) => {
    const next = session.isStrategyUpdate === 1 ? 'OFF' : 'ON';
    Alert.alert(
      '전략 메뉴판',
      `${getSymbolName(session.symbol)} 세션의 전략 메뉴판을 ${next}으로 변경하시겠습니까?\n` +
      (next === 'OFF' ? 'OFF 시 4등급 전략을 고정 사용합니다.' : 'ON 시 시장 등급에 따라 전략을 자동 배정합니다.'),
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          onPress: async () => {
            try {
              await toggleStrategyUpdate(session.id);
              setSessions(prev => prev.map(s =>
                s.id === session.id
                  ? { ...s, isStrategyUpdate: s.isStrategyUpdate === 1 ? 0 : 1 }
                  : s
              ));
            } catch { Alert.alert('오류', '요청에 실패했습니다.'); }
          },
        },
      ],
    );
  };

  const handleDelete = (session: TradingSession) => {
    Alert.alert('세션 삭제', `${getSymbolName(session.symbol)} 세션을 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            await deleteTradingSession(session.id);
            setSessions(prev => prev.filter(s => s.id !== session.id));
          } catch { Alert.alert('오류', '요청에 실패했습니다.'); }
        },
      },
    ]);
  };

  const handleCreate = async (data: { symbol: string; mode: 'LIVE' | 'PAPER'; currentEquity: number }) => {
    const u = await authStorage.get();
    if (!u?.userUid) return;
    try {
      const res = await insertTradingSession({
        userUid: u.userUid,
        symbol: data.symbol,
        mode: data.mode,
        cooldownBarsLeft: 0,
        consecSlCount: 0,
        currentEquity: data.currentEquity,
        peakEquity: data.currentEquity,
      });
      if (res.data) {
        setSessions(prev => [res.data, ...prev]);
        setShowCreate(false);
      } else {
        Alert.alert('오류', res.message || '세션 생성에 실패했습니다.');
      }
    } catch { Alert.alert('오류', '서버 연결에 실패했습니다.'); }
  };

  const modeFiltered = sessions.filter(s => modeTab === 'live' ? s.mode === 'LIVE' : s.mode !== 'LIVE');

  const filtered = (
    filter === 'active'  ? modeFiltered.filter(s => s.active === 1) :
    filter === 'stopped' ? modeFiltered.filter(s => s.active === 0) : modeFiltered
  ).sort((a, b) => {
    const aHolding = (a.sharesHeld ?? 0) >= 1 ? 0 : 1;
    const bHolding = (b.sharesHeld ?? 0) >= 1 ? 0 : 1;
    return aHolding - bHolding;
  });

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={colors.teal} size="large" /></View>
  );

  return (
    <View style={styles.container}>
      {/* 실전/모의 탭 */}
      <View style={styles.modeTabRow}>
        {(['live', 'paper'] as const).map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.modeTab, modeTab === m && (m === 'live' ? styles.modeTabLive : styles.modeTabPaper)]}
            onPress={() => { setModeTab(m); setFilter('all'); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.modeTabText, modeTab === m && (m === 'live' ? styles.modeTabTextLive : styles.modeTabTextPaper)]}>
              {m === 'live'
                ? `실전  ${sessions.filter(s => s.mode === 'LIVE').length}`
                : `모의  ${sessions.filter(s => s.mode !== 'LIVE').length}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 상태 필터 */}
      <View style={styles.filterRow}>
        {(['all', 'active', 'stopped'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all'     ? `전체 ${modeFiltered.length}` :
               f === 'active'  ? `실행 중 ${modeFiltered.filter(s => s.active === 1).length}` :
                                 `중지 ${modeFiltered.filter(s => s.active === 0).length}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <SessionCard
            session={item}
            onToggle={() => handleToggle(item)}
            onReset={() => handleReset(item)}
            onDelete={() => handleDelete(item)}
            onToggleStrategyUpdate={() => handleToggleStrategyUpdate(item)}
          />
        )}
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

      {/* FAB - 세션 생성 */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <CreateSessionModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.bg },
  center:          { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  modeTabRow:          { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderDim },
  modeTab:             { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  modeTabLive:         { borderBottomColor: colors.amber },
  modeTabPaper:        { borderBottomColor: colors.blue },
  modeTabText:         { fontSize: 14, fontWeight: '700', color: colors.textDim },
  modeTabTextLive:     { color: colors.amber },
  modeTabTextPaper:    { color: colors.blue },
  filterRow:       { flexDirection: 'row', padding: 12, gap: 8 },
  filterBtn:       {
    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDim,
  },
  filterBtnActive: { backgroundColor: colors.tealDim, borderColor: colors.teal },
  filterText:      { fontSize: 12, color: colors.textDim, fontWeight: '700' },
  filterTextActive:{ color: colors.teal },
  list:            { padding: 12, paddingTop: 0, paddingBottom: 100 },
  card:            {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.borderDim, padding: 14, marginBottom: 10,
  },
  cardHolding:     { borderColor: '#a855f7', borderWidth: 1.5 },
  cardTop:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  topLeft:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeDot:       { width: 8, height: 8, borderRadius: 4 },
  symbol:          { fontSize: 16, fontWeight: '700', color: colors.text },
  modeBadge:       { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  modeLive:        { backgroundColor: colors.amberDim, borderColor: colors.amber },
  modePaper:       { backgroundColor: colors.blueDim,  borderColor: colors.blue },
  modeText:        { fontSize: 11, fontWeight: '700' },
  statusBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText:      { fontSize: 12, fontWeight: '600' },
  cardMid:         {
    flexDirection: 'row', backgroundColor: colors.bg,
    borderRadius: 10, padding: 12, marginBottom: 10,
  },
  metaItem:        { flex: 1, alignItems: 'center' },
  metaLabel:       { fontSize: 10, color: colors.textDim, marginBottom: 4 },
  metaValue:       { fontSize: 13, fontWeight: '700', color: colors.text },
  entryPriceRow:   {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
    marginBottom: 10,
  },
  entryPriceLabel: { fontSize: 12, color: colors.textDim },
  entryPriceValue: { fontSize: 13, fontWeight: '700' },
  cardStrategy:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  strategyText:       { fontSize: 12, color: colors.textDim },
  userText:           { fontSize: 12, color: colors.textDim },
  autoUpdateBadge:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  autoUpdateOn:       { backgroundColor: colors.tealDim, borderColor: colors.teal },
  autoUpdateOff:      { backgroundColor: colors.surfaceAlt, borderColor: colors.borderDim },
  autoUpdateText:     { fontSize: 10, fontWeight: '700' as const },
  cardActions:     { flexDirection: 'row', gap: 8 },
  actionBtn:       { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  actionBtnStart:  { backgroundColor: colors.emeraldDim, borderColor: colors.emerald },
  actionBtnStop:   { backgroundColor: colors.roseDim, borderColor: colors.rose },
  actionBtnReset:  { backgroundColor: colors.amberDim, borderColor: colors.amber },
  actionBtnDelete: { backgroundColor: colors.surfaceAlt, borderColor: colors.borderDim },
  actionBtnText:   { fontSize: 12, fontWeight: '700' },
  empty:           { alignItems: 'center', paddingVertical: 60 },
  emptyText:       { color: colors.textDim, fontSize: 14 },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.teal, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
    elevation: 8,
  },
  fabText: { fontSize: 28, color: colors.bg, fontWeight: '300', marginTop: -2 },
});

const modal = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.surface },
  handle:           { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  header:           {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: colors.borderDim,
  },
  title:            { fontSize: 17, fontWeight: '700', color: colors.text },
  closeBtn:         { padding: 4 },
  closeText:        { fontSize: 16, color: colors.textDim },
  scroll:           { flex: 1, padding: 16 },
  field:            { marginBottom: 20 },
  label:            { fontSize: 13, color: colors.textSub, fontWeight: '600', marginBottom: 8 },
  input:            {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderDim,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, color: colors.text,
  },
  modeRow:          { flexDirection: 'row', gap: 10 },
  modeBtn:          {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderDim,
  },
  modeBtnLive:      { backgroundColor: colors.amberDim, borderColor: colors.amber },
  modeBtnPaper:     { backgroundColor: colors.blueDim, borderColor: colors.blue },
  modeBtnText:      { fontSize: 14, fontWeight: '700', color: colors.textDim },
  hint:             { fontSize: 12, color: colors.textDim, textAlign: 'center', marginBottom: 8 },
  submitBtn:        {
    backgroundColor: colors.teal, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 8, marginBottom: 32,
  },
  submitText:       { color: colors.bg, fontSize: 15, fontWeight: '700' },
});
