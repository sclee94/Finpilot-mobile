import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getStrategyConfigList, insertStrategyConfig, updateStrategyConfig, deleteStrategyConfig,
  getStrategyMenuList,
} from '../api/strategyApi';
import { authStorage } from '../utils/auth';
import { colors } from '../constants/colors';
import type { StrategyConfig, StrategyMenu } from '../types';

// ─── Field definitions ─────────────────────────────────────────────────────

type NumField = keyof Pick<StrategyConfig,
  'takeProfitPct' | 'stopLossPct' | 'pullbackMinPct' | 'pullbackMaxPct' |
  'buyingVolumeRatio' | 'stopLossVolumeRatio' | 'pullbackVolumeRatio'>;

const CONFIG_FIELDS: { key: NumField; label: string; format: (v: number) => string }[] = [
  { key: 'takeProfitPct',       label: '즉시 익절 기준 (당일 시가 대비)', format: v => `+${v}%` },
  { key: 'stopLossPct',         label: '즉시 손절 기준 (매수가 대비)',   format: v => `-${v}%` },
  { key: 'pullbackMinPct',      label: '눌림목 최소 하락폭 (당일 고가 대비)', format: v => `${v}%` },
  { key: 'pullbackMaxPct',      label: '눌림목 최대 하락폭 (당일 고가 대비)', format: v => `${v}%` },
  { key: 'buyingVolumeRatio',   label: '불타기 — 거래량 급증 확인 (현재 ≥ 평균 × 비율)',  format: v => `${v}%` },
  { key: 'stopLossVolumeRatio', label: '손절 — 패닉 매도 확인 (현재 ≥ 평균 × 비율)',      format: v => `${v}%` },
  { key: 'pullbackVolumeRatio', label: '눌림목 — 거래량 감소 확인 (현재 ≤ 평균 × 비율)',  format: v => `${v}%` },
];

const MENU_TYPE_LABEL: Record<StrategyMenu['menuType'], string> = {
  BULLISH: '불타기 (상승 추세)',
  PULLBACK: '눌림목 (하락 후 반등)',
  TAKE_PROFIT: '익절 (매도 판단)',
  STOP_LOSS: '손절 (매도 판단)',
};

function menuLabel(menu: StrategyMenu): string {
  if (menu.menuType === 'TAKE_PROFIT' || menu.menuType === 'STOP_LOSS') {
    return menu.menuGrade === 1 ? '즉시 전량매도' : '매도 제외';
  }
  return menu.buyRatio != null ? `자산의 ${menu.buyRatio}% 매수` : '전략에서 제외';
}

function menuExcluded(menu: StrategyMenu): boolean {
  if (menu.menuType === 'TAKE_PROFIT' || menu.menuType === 'STOP_LOSS') return menu.menuGrade !== 1;
  return menu.buyRatio == null;
}

// ─── 생성/수정 폼 모달 ────────────────────────────────────────────────────────

function StrategyFormModal({
  initial, myUid, onClose, onSaved,
}: {
  initial: StrategyConfig | null; // null = 새로 만들기
  myUid: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [form, setForm] = useState<Record<NumField, string>>(() =>
    Object.fromEntries(CONFIG_FIELDS.map(f => [f.key, String(initial?.[f.key] ?? '')])) as Record<NumField, string>);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    if (!name.trim()) { Alert.alert('입력 오류', '전략 이름을 입력해주세요.'); return; }
    const payload: Record<string, number> = {};
    for (const f of CONFIG_FIELDS) {
      const n = parseFloat(form[f.key]);
      if (isNaN(n)) { Alert.alert('입력 오류', '모든 값을 입력해주세요.'); return; }
      payload[f.key] = n;
    }
    setSaving(true);
    try {
      const res = initial?.id
        ? await updateStrategyConfig({ id: initial.id, userUid: myUid, name: name.trim(), ...payload })
        : await insertStrategyConfig({ userUid: myUid, name: name.trim(), ...payload });
      if (res.status < 400) {
        onSaved();
        onClose();
      } else {
        Alert.alert('오류', res.message || '저장에 실패했습니다.');
      }
    } catch {
      Alert.alert('오류', '요청에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={detail.container}>
        <View style={detail.handle} />
        <View style={detail.header}>
          <Text style={detail.title}>{initial ? '전략 설정 수정' : '새 전략 만들기'}</Text>
          <TouchableOpacity onPress={onClose} style={detail.closeBtn}>
            <Text style={detail.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={detail.scroll}>
          <View style={detail.section}>
            <View style={detail.editRow}>
              <Text style={detail.rowLabel}>전략 이름</Text>
              <TextInput
                style={detail.input}
                value={name}
                onChangeText={setName}
                placeholder="예: 공격형 눌림목 전략"
                placeholderTextColor={colors.textDim}
                maxLength={100}
              />
            </View>
          </View>
          <View style={detail.section}>
            {CONFIG_FIELDS.map(f => (
              <View key={f.key} style={detail.editRow}>
                <Text style={detail.rowLabel}>{f.label}</Text>
                <TextInput
                  style={detail.input}
                  value={form[f.key]}
                  onChangeText={t => setForm(prev => ({ ...prev, [f.key]: t }))}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textDim}
                />
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={detail.footer}>
          <TouchableOpacity style={detail.applyBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
            {saving
              ? <ActivityIndicator color="#0a1f1e" />
              : <Text style={detail.applyText}>{initial ? '저장' : '생성'}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function StrategyScreen() {
  const [strategies, setStrategies] = useState<StrategyConfig[]>([]);
  const [selectedId,  setSelectedId]  = useState<number | null>(null);
  const [menus,      setMenus]      = useState<StrategyMenu[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin,    setIsAdmin]    = useState(false);
  const [myUid,      setMyUid]      = useState('');
  const [formTarget, setFormTarget] = useState<StrategyConfig | 'new' | null>(null);

  const load = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    const u = await authStorage.get();
    const uid = u?.userUid ?? '';
    setIsAdmin((u?.permission ?? 0) >= 99);
    setMyUid(uid);
    try {
      const [configRes, menuRes] = await Promise.all([
        getStrategyConfigList({ userUid: uid || undefined }),
        getStrategyMenuList(),
      ]);
      if (configRes.status === 200) {
        const list = configRes.data?.content ?? [];
        setStrategies(list);
        setSelectedId(prev => (prev != null && list.some(s => s.id === prev)) ? prev : (list[0]?.id ?? null));
      }
      if (menuRes.status === 200) setMenus(menuRes.data ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const selected  = strategies.find(s => s.id === selectedId) ?? null;
  const isOwner   = !!selected && !!myUid && selected.userUid === myUid;
  const canEdit   = !!selected && (isOwner || isAdmin);
  const canDelete = !!selected && (isOwner || (isAdmin && selected.userUid != null));

  const handleDelete = () => {
    if (!selected?.id) return;
    Alert.alert('전략 삭제', `전략 #${selected.id}를 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            const res = await deleteStrategyConfig(selected.id!, myUid);
            if (res.status < 400) {
              setSelectedId(null);
              await load(false);
            } else {
              Alert.alert('오류', res.message || '삭제에 실패했습니다.');
            }
          } catch { Alert.alert('오류', '요청에 실패했습니다.'); }
        },
      },
    ]);
  };

  const byType = (type: StrategyMenu['menuType']) =>
    menus.filter(m => m.menuType === type).sort((a, b) => a.menuGrade - b.menuGrade);

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={colors.teal} size="large" /></View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} tintColor={colors.teal} />
        }
      >
        {/* 전략 목록 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>전략 목록</Text>
          <TouchableOpacity style={styles.editBtn} onPress={() => setFormTarget('new')}>
            <Text style={styles.editBtnText}>+ 새 전략</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
          {strategies.map(s => {
            const active = s.id === selectedId;
            const mine   = !!myUid && s.userUid === myUid;
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => setSelectedId(s.id!)}
                style={[styles.chip, active && styles.chipActive]}
                activeOpacity={0.8}
              >
                <View style={[styles.chipBadge, s.isPublic === 1 ? styles.chipBadgePublic : styles.chipBadgeMine]}>
                  <Text style={[styles.chipBadgeText, { color: s.isPublic === 1 ? colors.amber : colors.textDim }]}>
                    {s.isPublic === 1 ? '추천' : mine ? '내 전략' : '전략'}
                  </Text>
                </View>
                <Text style={[styles.chipTitle, active && { color: colors.teal }]} numberOfLines={1}>{s.name || `전략 #${s.id}`}</Text>
                <Text style={styles.chipSub}>익절 +{s.takeProfitPct}% · 손절 -{s.stopLossPct}%</Text>
              </TouchableOpacity>
            );
          })}
          {strategies.length === 0 && (
            <Text style={{ color: colors.textDim, fontSize: 13, paddingVertical: 12 }}>전략이 없습니다</Text>
          )}
        </ScrollView>

        {/* 선택된 전략 상세 */}
        <View style={[styles.sectionHeader, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>전략 설정</Text>
          {canEdit && selected && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {canDelete && (
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                  <Text style={styles.deleteBtnText}>삭제</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.editBtn} onPress={() => setFormTarget(selected)}>
                <Text style={styles.editBtnText}>수정</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {selected ? (
          <View style={styles.card}>
            {CONFIG_FIELDS.map(f => {
              const v = selected[f.key];
              return (
                <View key={f.key} style={styles.row}>
                  <Text style={styles.rowLabel}>{f.label}</Text>
                  <Text style={styles.rowValue}>{v != null ? f.format(v) : '—'}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.empty}><Text style={styles.emptyText}>전략 설정이 없습니다</Text></View>
        )}

        {/* 전략 메뉴판 */}
        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>전략 메뉴판</Text>
        </View>
        <Text style={styles.sectionDesc}>매수 판단 등급별 매수 비율(투자금 대비 %)입니다.</Text>

        {(['BULLISH', 'PULLBACK', 'TAKE_PROFIT', 'STOP_LOSS'] as const).map(type => {
          const items = byType(type);
          if (items.length === 0) return null;
          return (
            <View key={type} style={styles.card}>
              <Text style={styles.cardHeading}>{MENU_TYPE_LABEL[type]}</Text>
              {items.map(m => (
                <View key={m.id} style={styles.row}>
                  <Text style={styles.rowLabel}>{m.name}</Text>
                  <Text style={[styles.rowValue, menuExcluded(m) && { color: colors.textDim }]}>{menuLabel(m)}</Text>
                </View>
              ))}
            </View>
          );
        })}
        {menus.length === 0 && (
          <View style={styles.empty}><Text style={styles.emptyText}>전략 메뉴판이 비어있습니다</Text></View>
        )}
      </ScrollView>

      {formTarget && (
        <StrategyFormModal
          initial={formTarget === 'new' ? null : formTarget}
          myUid={myUid}
          onClose={() => setFormTarget(null)}
          onSaved={() => load(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  center:       { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll:       { padding: 12, paddingBottom: 32 },
  sectionHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 8, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  sectionDesc:  { fontSize: 12, color: colors.textDim, marginBottom: 8, paddingHorizontal: 4 },
  editBtn:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.tealDim, borderWidth: 1, borderColor: colors.teal },
  editBtnText:  { fontSize: 12, color: colors.teal, fontWeight: '700' },
  deleteBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.roseDim, borderWidth: 1, borderColor: colors.rose },
  deleteBtnText:{ fontSize: 12, color: colors.rose, fontWeight: '700' },
  chipRow:      { flexShrink: 0 },
  chipRowContent: { gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
  chip:         {
    width: 160, backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.borderDim, padding: 12,
  },
  chipActive:   { borderColor: colors.teal, backgroundColor: colors.tealDim },
  chipBadge:    { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6, borderWidth: 1 },
  chipBadgePublic: { backgroundColor: 'rgba(251,191,36,0.15)', borderColor: colors.amber },
  chipBadgeMine:   { backgroundColor: colors.surfaceAlt, borderColor: colors.borderDim },
  chipBadgeText:{ fontSize: 10, fontWeight: '700' },
  chipTitle:    { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 3 },
  chipSub:      { fontSize: 11, color: colors.textDim },
  card:         {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.borderDim, padding: 4, marginBottom: 12,
  },
  cardHeading:  { fontSize: 13, fontWeight: '700', color: colors.teal, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  row:          {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.borderDim,
  },
  rowLabel:     { fontSize: 12, color: colors.textDim, flex: 1, marginRight: 8 },
  rowValue:     { fontSize: 13, fontWeight: '700', color: colors.text },
  empty:        { alignItems: 'center', paddingVertical: 40 },
  emptyText:    { color: colors.textDim, fontSize: 13 },
});

const detail = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.surface },
  handle:     { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  header:     {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 20, borderBottomWidth: 1, borderBottomColor: colors.borderDim,
  },
  title:      { fontSize: 17, fontWeight: '700', color: colors.text },
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
  editRow:    {
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.borderDim,
  },
  rowLabel:   { fontSize: 12, color: colors.textDim, marginBottom: 6 },
  input:      {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 14,
    backgroundColor: colors.surface,
  },
  footer:     { padding: 16, borderTopWidth: 1, borderTopColor: colors.borderDim },
  applyBtn:   { backgroundColor: colors.teal, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  applyText:  { color: '#0a1f1e', fontSize: 15, fontWeight: '700' },
});
