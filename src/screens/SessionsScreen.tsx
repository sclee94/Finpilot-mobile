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
  syncPosition,
  adjustCapital,
  toggleForceCloseEnabled,
  updateSessionStrategyConfigId,
} from '../api/tradeApi';
import { getStrategyConfigList } from '../api/strategyApi';
import { authStorage } from '../utils/auth';
import { colors } from '../constants/colors';
import { getSymbolName } from '../constants/symbolNames';
import type { TradingSession, StrategyConfig } from '../types';

function SessionCard({
  session,
  syncing,
  onToggle,
  onReset,
  onDelete,
  onSync,
  onAdjustCapital,
  onToggleForceClose,
  onChangeStrategy,
}: {
  session: TradingSession;
  syncing: boolean;
  onToggle: () => void;
  onReset: () => void;
  onDelete: () => void;
  onSync: () => void;
  onAdjustCapital: () => void;
  onToggleForceClose: () => void;
  onChangeStrategy: () => void;
}) {
  const isActive = session.active === 1;
  const forceCloseOn = session.isForceCloseEnabled !== 0;
  const posColor = session.currentPosition === 'LONG' ? colors.teal : colors.textDim;
  const posLabel = session.currentPosition === 'LONG' ? '롱' : 'NONE';
  const returnPct = session.currentEquity != null ? (session.currentEquity - 1) * 100 : null;

  return (
    <View style={[styles.card, (session.sharesHeld ?? 0) >= 1 && styles.cardHolding]}>
      <View style={styles.cardTop}>
        <View style={styles.topLeft}>
          <View style={[styles.activeDot, { backgroundColor: isActive ? colors.emerald : colors.textDim }]} />
          <Text style={styles.symbol}>{session.symbolName ?? getSymbolName(session.symbol)}</Text>
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

      <View style={styles.strategyRow}>
        {session.strategyConfig ? (
          <TouchableOpacity style={styles.strategyBadge} onPress={onChangeStrategy} activeOpacity={0.7}>
            <Text style={styles.strategyText}>
              {session.strategyConfig.name || `전략 #${session.strategyConfigId}`} · 익절 +{session.strategyConfig.takeProfitPct}% · 손절 -{session.strategyConfig.stopLossPct}% (변경)
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.strategyBadge, styles.strategyBadgeNone]} onPress={onChangeStrategy} activeOpacity={0.7}>
            <Text style={[styles.strategyText, { color: colors.textDim }]}>전략 미지정 (탭해서 선택)</Text>
          </TouchableOpacity>
        )}
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
          <Text style={styles.metaLabel}>평균진입가</Text>
          <Text style={styles.metaValue}>
            {session.avgEntryPrice != null ? session.avgEntryPrice.toLocaleString() : '—'}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>수익률</Text>
          <Text style={[styles.metaValue, { color: returnPct != null && returnPct < 0 ? colors.rose : colors.teal }]}>
            {returnPct != null ? `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%` : '—'}
          </Text>
        </View>
      </View>

      {session.userDTO?.userName && (
        <Text style={styles.userText}>{session.userDTO.userName}</Text>
      )}

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
      <View style={[styles.cardActions, { marginTop: 8 }]}>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSync]} onPress={onSync} disabled={syncing} activeOpacity={0.7}>
          <Text style={[styles.actionBtnText, { color: '#a855f7' }]}>{syncing ? '동기화 중…' : '동기화'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnCapital]} onPress={onAdjustCapital} activeOpacity={0.7}>
          <Text style={[styles.actionBtnText, { color: colors.emerald }]}>자본금 조정</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.cardActions, { marginTop: 8 }]}>
        <TouchableOpacity
          style={[styles.actionBtn, forceCloseOn ? styles.actionBtnForceCloseOn : styles.actionBtnForceCloseOff]}
          onPress={onToggleForceClose}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionBtnText, { color: forceCloseOn ? colors.teal : colors.textDim }]}>
            15:18 강제청산 {forceCloseOn ? 'ON' : 'OFF'}
          </Text>
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
  onSubmit: (data: { symbol: string; mode: 'LIVE' | 'PAPER' }) => void;
}) {
  const [symbol, setSymbol] = useState('');
  const [mode, setMode]     = useState<'LIVE' | 'PAPER'>('PAPER');

  const reset = () => { setSymbol(''); setMode('PAPER'); };

  const handleSubmit = () => {
    if (!symbol.trim()) { Alert.alert('입력 오류', '종목 코드를 입력해주세요.'); return; }
    onSubmit({ symbol: symbol.trim().toUpperCase(), mode });
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
              placeholder="예: 005930"
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

          <Text style={modal.hint}>투자금은 KIS 실계좌/모의계좌 잔고를 기준으로 자동 반영됩니다.</Text>

          <TouchableOpacity style={modal.submitBtn} onPress={handleSubmit} activeOpacity={0.8}>
            <Text style={modal.submitText}>세션 생성</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function AdjustCapitalModal({
  visible,
  submitting,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => void;
}) {
  const [amount, setAmount] = useState('');

  const handleClose = () => { setAmount(''); onClose(); };
  const handleSubmit = () => {
    const n = parseFloat(amount);
    if (isNaN(n) || n === 0) { Alert.alert('입력 오류', '올바른 금액을 입력해주세요.'); return; }
    onSubmit(n);
    setAmount('');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={modal.container}>
        <View style={modal.handle} />
        <View style={modal.header}>
          <Text style={modal.title}>자본금 조정</Text>
          <TouchableOpacity onPress={handleClose} style={modal.closeBtn}>
            <Text style={modal.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={modal.scroll} keyboardShouldPersistTaps="handled">
          <Text style={modal.hint}>입금은 양수, 출금은 음수로 입력하세요.{'\n'}보유 포지션과 지금까지의 수익 이력은 그대로 유지되고, 수익률 계산 기준점만 조정됩니다.</Text>
          <View style={modal.field}>
            <TextInput
              style={modal.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="예: 5000000 (입금) / -2000000 (출금)"
              placeholderTextColor={colors.textDim}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <TouchableOpacity style={modal.submitBtn} onPress={handleSubmit} disabled={submitting} activeOpacity={0.8}>
            {submitting
              ? <ActivityIndicator color={colors.bg} />
              : <Text style={modal.submitText}>조정하기</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function StrategyChangeModal({
  visible,
  currentStrategyId,
  currentStrategyName,
  strategyList,
  loading,
  onClose,
  onSelect,
}: {
  visible: boolean;
  currentStrategyId: number | null;
  currentStrategyName: string;
  strategyList: StrategyConfig[];
  loading: boolean;
  onClose: () => void;
  onSelect: (strategy: StrategyConfig) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.container}>
        <View style={modal.handle} />
        <View style={modal.header}>
          <View style={{ flex: 1 }}>
            <Text style={modal.title}>전략 변경</Text>
            <Text style={{ fontSize: 12, color: colors.textDim, marginTop: 4 }}>현재: {currentStrategyName}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
            <Text style={modal.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.teal} size="large" />
          </View>
        ) : (
          <ScrollView style={modal.scroll}>
            {strategyList.length === 0 ? (
              <Text style={modal.hint}>등록된 전략이 없습니다</Text>
            ) : (
              strategyList.map(s => {
                const isCurrent = s.id === currentStrategyId;
                return (
                  <TouchableOpacity
                    key={s.id}
                    disabled={isCurrent}
                    onPress={() => onSelect(s)}
                    style={[modal.field, strategyPicker.row, isCurrent && strategyPicker.rowCurrent]}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={strategyPicker.name}>{s.name || `전략 #${s.id}`}</Text>
                      {isCurrent && <Text style={strategyPicker.currentTag}>적용중</Text>}
                    </View>
                    <Text style={strategyPicker.detail}>
                      익절 +{s.takeProfitPct}% · 손절 -{s.stopLossPct}%
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const strategyPicker = StyleSheet.create({
  row:         { borderWidth: 1, borderColor: colors.borderDim, borderRadius: 12, backgroundColor: colors.bg },
  rowCurrent:  { opacity: 0.5, borderColor: colors.amber },
  name:        { fontSize: 14, fontWeight: '700', color: colors.text },
  currentTag:  { fontSize: 11, color: colors.amber, fontWeight: '700' },
  detail:      { fontSize: 12, color: colors.textDim, marginTop: 4 },
});

export default function SessionsScreen() {
  const [sessions,   setSessions]   = useState<TradingSession[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modeTab,    setModeTab]    = useState<'live' | 'paper'>('live');
  const [filter,     setFilter]     = useState<'all' | 'active' | 'stopped'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [syncingId,  setSyncingId]  = useState<string | null>(null);
  const [capitalTarget, setCapitalTarget] = useState<TradingSession | null>(null);
  const [capitalSubmitting, setCapitalSubmitting] = useState(false);
  const [strategyChangeTarget, setStrategyChangeTarget] = useState<TradingSession | null>(null);
  const [strategyList, setStrategyList] = useState<StrategyConfig[]>([]);
  const [strategyListLoading, setStrategyListLoading] = useState(false);

  const load = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    const u = await authStorage.get();
    const isAdmin = (u?.permission ?? 0) >= 99;
    const userParams = isAdmin ? { userUid: u?.userUid, viewAll: true } : { userUid: u?.userUid };
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
    Alert.alert('세션 초기화', `${getSymbolName(session.symbol)} 세션을 초기화하시겠습니까?\n포지션 및 수익률 기준점이 초기화됩니다.`, [
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

  const handleSync = async (session: TradingSession) => {
    setSyncingId(session.id);
    try {
      const res = await syncPosition(session.id);
      if (res.data) setSessions(prev => prev.map(s => s.id === session.id ? res.data : s));
    } catch { Alert.alert('오류', '실잔고 동기화에 실패했습니다.'); }
    finally { setSyncingId(null); }
  };

  const handleToggleForceClose = async (session: TradingSession) => {
    const next = session.isForceCloseEnabled === 0 ? 1 : 0;
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, isForceCloseEnabled: next } : s));
    try {
      await toggleForceCloseEnabled(session.id);
    } catch {
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, isForceCloseEnabled: session.isForceCloseEnabled } : s));
      Alert.alert('오류', '요청에 실패했습니다.');
    }
  };

  const handleAdjustCapital = async (amount: number) => {
    if (!capitalTarget) return;
    setCapitalSubmitting(true);
    try {
      const res = await adjustCapital(capitalTarget.id, amount);
      if (res.data) setSessions(prev => prev.map(s => s.id === capitalTarget.id ? res.data : s));
      setCapitalTarget(null);
    } catch { Alert.alert('오류', '자본금 조정에 실패했습니다.'); }
    finally { setCapitalSubmitting(false); }
  };

  const openStrategyChange = async (session: TradingSession) => {
    setStrategyChangeTarget(session);
    setStrategyListLoading(true);
    try {
      const u = await authStorage.get();
      const res = await getStrategyConfigList({ userUid: u?.userUid });
      setStrategyList(res.data?.content ?? []);
    } catch { /* silent */ }
    finally { setStrategyListLoading(false); }
  };

  const handleSelectStrategy = async (strategy: StrategyConfig) => {
    if (!strategyChangeTarget || !strategy.id) return;
    const sessionId = strategyChangeTarget.id;
    try {
      await updateSessionStrategyConfigId({ id: sessionId, strategyConfigId: strategy.id });
      // API가 갱신된 세션을 돌려주지 않아서, 이미 들고 있는 선택된 전략 객체로 즉시 반영
      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s,
        strategyConfigId: strategy.id!,
        strategyConfig: {
          id:                  strategy.id!,
          name:                strategy.name,
          takeProfitPct:       strategy.takeProfitPct,
          stopLossPct:         strategy.stopLossPct,
          pullbackMinPct:      strategy.pullbackMinPct,
          pullbackMaxPct:      strategy.pullbackMaxPct,
          buyingVolumeRatio:   strategy.buyingVolumeRatio,
          stopLossVolumeRatio: strategy.stopLossVolumeRatio,
          pullbackVolumeRatio: strategy.pullbackVolumeRatio,
        },
      } : s));
      setStrategyChangeTarget(null);
    } catch {
      Alert.alert('오류', '전략 변경에 실패했습니다.');
    }
  };

  const handleCreate = async (data: { symbol: string; mode: 'LIVE' | 'PAPER' }) => {
    const u = await authStorage.get();
    if (!u?.userUid) return;
    try {
      const strategyRes = await getStrategyConfigList();
      const strategyConfigId = strategyRes.data?.content?.[0]?.id ?? null;

      const res = await insertTradingSession({
        userUid: u.userUid,
        symbol: data.symbol,
        mode: data.mode,
        strategyConfigId,
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
            syncing={syncingId === item.id}
            onToggle={() => handleToggle(item)}
            onReset={() => handleReset(item)}
            onDelete={() => handleDelete(item)}
            onSync={() => handleSync(item)}
            onAdjustCapital={() => setCapitalTarget(item)}
            onToggleForceClose={() => handleToggleForceClose(item)}
            onChangeStrategy={() => openStrategyChange(item)}
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

      <AdjustCapitalModal
        visible={capitalTarget != null}
        submitting={capitalSubmitting}
        onClose={() => setCapitalTarget(null)}
        onSubmit={handleAdjustCapital}
      />

      <StrategyChangeModal
        visible={strategyChangeTarget != null}
        currentStrategyId={strategyChangeTarget?.strategyConfigId ?? null}
        currentStrategyName={strategyChangeTarget?.strategyConfig?.name || `전략 #${strategyChangeTarget?.strategyConfigId ?? '-'}`}
        strategyList={strategyList}
        loading={strategyListLoading}
        onClose={() => setStrategyChangeTarget(null)}
        onSelect={handleSelectStrategy}
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
  cardTop:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  topLeft:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  strategyRow:     { flexDirection: 'row', marginBottom: 10 },
  strategyBadge:   { backgroundColor: colors.tealDim, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  strategyBadgeNone: { backgroundColor: colors.surfaceAlt },
  strategyText:    { fontSize: 11, fontWeight: '600', color: colors.teal },
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
  userText:        { fontSize: 12, color: colors.textDim, marginBottom: 10 },
  cardActions:     { flexDirection: 'row', gap: 8 },
  actionBtn:       { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  actionBtnStart:  { backgroundColor: colors.emeraldDim, borderColor: colors.emerald },
  actionBtnStop:   { backgroundColor: colors.roseDim, borderColor: colors.rose },
  actionBtnReset:  { backgroundColor: colors.amberDim, borderColor: colors.amber },
  actionBtnDelete: { backgroundColor: colors.surfaceAlt, borderColor: colors.borderDim },
  actionBtnSync:   { backgroundColor: 'rgba(168,85,247,0.15)', borderColor: '#a855f7' },
  actionBtnCapital:{ backgroundColor: colors.emeraldDim, borderColor: colors.emerald },
  actionBtnForceCloseOn:  { backgroundColor: colors.tealDim, borderColor: colors.teal },
  actionBtnForceCloseOff: { backgroundColor: colors.surfaceAlt, borderColor: colors.borderDim },
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
  hint:             { fontSize: 12, color: colors.textDim, textAlign: 'center', marginBottom: 16 },
  submitBtn:        {
    backgroundColor: colors.teal, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 8, marginBottom: 32,
  },
  submitText:       { color: colors.bg, fontSize: 15, fontWeight: '700' },
});
