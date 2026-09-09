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
  'buyingVolumeRatio' | 'stopLossVolumeRatio' | 'pullbackVolumeRatio' |
  'rsiOversold' | 'rsiOverbought' | 'rsiExitMinGainPct' |
  'scoreTakeProfitThreshold' | 'scoreStopLossThreshold' |
  'volBaselineCv' | 'volMultMin' | 'volMultMax' | 'stopLossCooldownMinutes' |
  'adxPeriod' | 'adxThreshold' | 'pullbackTrendMaDays' | 'riskPerTradePct' |
  'gradeCutoffBullish' | 'gradeCutoffPullback' | 'dayLowBufferPct'>;

// 4단계 파이프라인: 1차 필터(후보 자격 자체를 거름) → 2차 필터(스코어링 전 추세강도 게이트)
// → 매수·매도 전략 1단계(즉시 판단) → 매수·매도 전략 2단계(패턴/RSI 정밀 스코어링)
// → 당일 저점 매수(기존 불타기/눌림목과 완전히 별개로 병행 동작하는 독립 신호, ON/OFF 토글)
const STAGE_ORDER = ['1차 필터', '2차 필터', '매수·매도 전략 1단계', '매수·매도 전략 2단계', '당일 저점 매수'] as const;
type Stage = typeof STAGE_ORDER[number];

// 각 파라미터가 실제 전략 로직(kospi_strategy.py / api.py)의 매수 판단, 매도 판단,
// 혹은 둘 다에 쓰이는지 구분 — 값을 고칠 때 어느 쪽에 영향을 주는지 색으로 한눈에 알 수 있게.
type FieldCategory = 'buy' | 'sell' | 'common';

const CATEGORY_STYLE: Record<FieldCategory, { label: string; color: string; dim: string }> = {
  buy:    { label: '매수', color: colors.emerald, dim: colors.emeraldDim },
  sell:   { label: '매도', color: colors.rose,    dim: colors.roseDim },
  common: { label: '공통', color: colors.amber,   dim: colors.amberDim },
};

const CONFIG_FIELDS: { key: NumField; label: string; format: (v: number) => string; stage: Stage; disabled?: boolean; category: FieldCategory }[] = [
  // ── 1차 필터 ──────────────────────────────────────────
  { key: 'buyingVolumeRatio',   stage: '1차 필터', label: '불타기 거래량 급증 확인 (현재 ≥ 평균 × 비율)', format: v => `${v}%`, category: 'buy' },
  { key: 'pullbackMinPct',      stage: '1차 필터', label: '눌림목 최소 하락폭 (당일 고가 대비)', format: v => `${v}%`, category: 'buy' },
  { key: 'pullbackMaxPct',      stage: '1차 필터', label: '눌림목 최대 하락폭 (당일 고가 대비)', format: v => `${v}%`, category: 'buy' },
  { key: 'stopLossCooldownMinutes', stage: '1차 필터', label: '손절 후 재진입 쿨다운', format: v => `${v}분`, category: 'buy' },
  { key: 'pullbackVolumeRatio', stage: '1차 필터', label: '눌림목 거래량 (미사용 — 값을 바꿔도 매매에 영향 없음)', format: v => `${v}%`, disabled: true, category: 'buy' },
  // ── 2차 필터 ──────────────────────────────────────────
  { key: 'adxPeriod',           stage: '2차 필터', label: 'ADX 계산 기간',            format: v => `${v}봉`, category: 'buy' },
  { key: 'adxThreshold',        stage: '2차 필터', label: 'ADX 진입 게이트 문턱값',   format: v => `${v}`, category: 'buy' },
  { key: 'pullbackTrendMaDays', stage: '2차 필터', label: '눌림목 일봉 추세 게이트 (N일 이평)', format: v => `${v}일`, category: 'buy' },
  { key: 'gradeCutoffBullish',  stage: '2차 필터', label: '시장+종목 상대강도 컷오프 (불타기, 낮을수록 엄격)', format: v => `${v}`, category: 'buy' },
  { key: 'gradeCutoffPullback', stage: '2차 필터', label: '시장+종목 상대강도 컷오프 (눌림목, 낮을수록 엄격)', format: v => `${v}`, category: 'buy' },
  // ── 매수·매도 전략 1단계 (즉시 판단) ─────────────────
  { key: 'takeProfitPct', stage: '매수·매도 전략 1단계', label: '즉시 익절 / 추격매수 방지 기준', format: v => `+${v}%`, category: 'common' },
  { key: 'stopLossPct',   stage: '매수·매도 전략 1단계', label: '즉시 손절 기준 (매도)', format: v => `-${v}%`, category: 'sell' },
  { key: 'riskPerTradePct', stage: '매수·매도 전략 1단계', label: '트레이드당 리스크 상한 (계좌 대비, 0=미적용)', format: v => `${v}%`, category: 'buy' },
  { key: 'volBaselineCv', stage: '매수·매도 전략 1단계', label: '변동성 기준값 (ATR%)', format: v => `${v}`, category: 'common' },
  { key: 'volMultMin',    stage: '매수·매도 전략 1단계', label: '변동성 배수 하한',    format: v => `${v}배`, category: 'common' },
  { key: 'volMultMax',    stage: '매수·매도 전략 1단계', label: '변동성 배수 상한',    format: v => `${v}배`, category: 'common' },
  // ── 매수·매도 전략 2단계 (정밀 스코어링) ─────────────
  { key: 'rsiOversold',              stage: '매수·매도 전략 2단계', label: '눌림목 과매도 기준 (RSI 14, 매수)', format: v => `${v}`, category: 'buy' },
  { key: 'stopLossVolumeRatio',      stage: '매수·매도 전략 2단계', label: '손절 거래량 확인 (매도)', format: v => `${v}%`, category: 'sell' },
  { key: 'rsiOverbought',            stage: '매수·매도 전략 2단계', label: 'RSI 과매수 기준 (매도)',  format: v => `${v}`, category: 'sell' },
  { key: 'rsiExitMinGainPct',        stage: '매수·매도 전략 2단계', label: 'RSI 조기청산 최소 수익률 (매도)', format: v => `${v}%`, category: 'sell' },
  { key: 'scoreTakeProfitThreshold', stage: '매수·매도 전략 2단계', label: '익절 스코어링 문턱값 (매도)', format: v => `${v}점`, category: 'sell' },
  { key: 'scoreStopLossThreshold',   stage: '매수·매도 전략 2단계', label: '손절 스코어링 문턱값 (매도)', format: v => `${v}점`, category: 'sell' },
  // ── 당일 저점 매수 (독립 전략, ON일 때만 의미 있음) ──
  { key: 'dayLowBufferPct', stage: '당일 저점 매수', label: '당일 저가 대비 허용 오차 (0=정확히 같을 때만)', format: v => `${v}%`, category: 'buy' },
];

function CategoryBadge({ category }: { category: FieldCategory }) {
  const s = CATEGORY_STYLE[category];
  return (
    <View style={[badgeStyles.badge, { backgroundColor: s.dim }]}>
      <Text style={[badgeStyles.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

function CategoryLegend() {
  return (
    <View style={badgeStyles.legend}>
      <Text style={badgeStyles.legendLabel}>색상 안내</Text>
      {(Object.keys(CATEGORY_STYLE) as FieldCategory[]).map(cat => (
        <View key={cat} style={badgeStyles.legendItem}>
          <CategoryBadge category={cat} />
          <Text style={badgeStyles.legendDesc}>
            {cat === 'buy' ? '매수만' : cat === 'sell' ? '매도만' : '매수+매도'}
          </Text>
        </View>
      ))}
    </View>
  );
}

const MENU_TYPE_LABEL: Record<StrategyMenu['menuType'], string> = {
  BULLISH: '불타기 (상승 추세)',
  PULLBACK: '눌림목 (하락 후 반등)',
  DAYLOW: '당일 저점 매수',
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
    Object.fromEntries(CONFIG_FIELDS.map(f => [f.key, String(initial?.[f.key] ?? (f.key === 'dayLowBufferPct' ? 0 : ''))])) as Record<NumField, string>);
  const [enableDayLowBuy, setEnableDayLowBuy] = useState(initial?.enableDayLowBuy === 1);
  const [dayLowRequireRsiOversold, setDayLowRequireRsiOversold] = useState(initial?.dayLowRequireRsiOversold === 1);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    if (!name.trim()) { Alert.alert('입력 오류', '전략 이름을 입력해주세요.'); return; }
    const payload: Record<string, number> = {
      enableDayLowBuy: enableDayLowBuy ? 1 : 0,
      dayLowRequireRsiOversold: dayLowRequireRsiOversold ? 1 : 0,
    };
    for (const f of CONFIG_FIELDS) {
      const n = parseFloat(form[f.key]);
      if (f.disabled) {
        // 미사용 필드 — 값 검증 없이 기존 값(없으면 기본값) 그대로 전송
        payload[f.key] = isNaN(n) ? 80 : n;
        continue;
      }
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
          <View style={{ marginHorizontal: 12, marginTop: 12 }}>
            <CategoryLegend />
          </View>
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
          {STAGE_ORDER.map(stage => (
            <View key={stage} style={detail.section}>
              <Text style={detail.sectionHeading}>{stage}</Text>
              {stage === '당일 저점 매수' && (
                <View style={detail.editRow}>
                  <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: 8 }}>
                    ON이면 기존 불타기/눌림목과 함께 평가됩니다. 같은 틱에 불타기/눌림목이 먼저 진입하면 당일저점은
                    취소됩니다(우선순위: 불타기&gt;눌림목&gt;당일저점). 13:00 이전이거나 시장 전체가 나쁜 날엔 자동 차단됩니다.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setEnableDayLowBuy(v => !v)}
                    style={[toggleStyles.pill, enableDayLowBuy ? toggleStyles.pillOn : toggleStyles.pillOff, { marginBottom: 8 }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[toggleStyles.pillText, { color: enableDayLowBuy ? colors.teal : colors.textDim }]}>
                      당일 저점 매수 {enableDayLowBuy ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setDayLowRequireRsiOversold(v => !v)}
                    style={[toggleStyles.pill, dayLowRequireRsiOversold ? toggleStyles.pillOn : toggleStyles.pillOff]}
                    activeOpacity={0.7}
                  >
                    <Text style={[toggleStyles.pillText, { color: dayLowRequireRsiOversold ? colors.teal : colors.textDim }]}>
                      RSI 과매도 조건 추가 요구 {dayLowRequireRsiOversold ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {CONFIG_FIELDS.filter(f => f.stage === stage).map(f => (
                <View key={f.key} style={detail.editRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Text style={[detail.rowLabel, { marginBottom: 0 }]}>{f.label}</Text>
                    <CategoryBadge category={f.category} />
                  </View>
                  <TextInput
                    style={[detail.input, f.disabled && detail.inputDisabled]}
                    value={form[f.key]}
                    onChangeText={t => setForm(prev => ({ ...prev, [f.key]: t }))}
                    editable={!f.disabled}
                    keyboardType="numeric"
                    placeholderTextColor={colors.textDim}
                  />
                </View>
              ))}
            </View>
          ))}
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

        <View style={styles.chipList}>
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
                <View style={styles.chipTopRow}>
                  <View style={[styles.chipBadge, s.isPublic === 1 ? styles.chipBadgePublic : styles.chipBadgeMine]}>
                    <Text style={[styles.chipBadgeText, { color: s.isPublic === 1 ? colors.amber : colors.textDim }]}>
                      {s.isPublic === 1 ? '추천' : mine ? '내 전략' : '전략'}
                    </Text>
                  </View>
                  <Text style={[styles.chipTitle, active && { color: colors.teal }]} numberOfLines={1}>{s.name || `전략 #${s.id}`}</Text>
                </View>
                <Text style={styles.chipSub}>익절 +{s.takeProfitPct}% · 손절 -{s.stopLossPct}%</Text>
              </TouchableOpacity>
            );
          })}
          {strategies.length === 0 && (
            <Text style={{ color: colors.textDim, fontSize: 13, paddingVertical: 12 }}>전략이 없습니다</Text>
          )}
        </View>

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
          <>
            <CategoryLegend />
            {STAGE_ORDER.map(stage => (
              <View key={stage} style={styles.card}>
                <Text style={styles.cardHeading}>{stage}</Text>
                {stage === '당일 저점 매수' && (
                  <>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>ON/OFF</Text>
                      <Text style={[styles.rowValue, { color: selected.enableDayLowBuy === 1 ? colors.teal : colors.textDim }]}>
                        {selected.enableDayLowBuy === 1 ? 'ON' : 'OFF'}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>RSI 과매도 조건 추가 요구</Text>
                      <Text style={[styles.rowValue, { color: selected.dayLowRequireRsiOversold === 1 ? colors.teal : colors.textDim }]}>
                        {selected.dayLowRequireRsiOversold === 1 ? 'ON' : 'OFF'}
                      </Text>
                    </View>
                  </>
                )}
                {CONFIG_FIELDS.filter(f => f.stage === stage).map(f => {
                  const v = selected[f.key];
                  return (
                    <View key={f.key} style={styles.row}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
                        <Text style={[styles.rowLabel, f.disabled && { opacity: 0.6 }, { marginRight: 0, flex: undefined }]}>{f.label}</Text>
                        <CategoryBadge category={f.category} />
                      </View>
                      <Text style={[styles.rowValue, f.disabled && { opacity: 0.6 }]}>{v != null ? f.format(v) : '—'}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </>
        ) : (
          <View style={styles.empty}><Text style={styles.emptyText}>전략 설정이 없습니다</Text></View>
        )}

        {/* 전략 메뉴판 */}
        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>전략 메뉴판</Text>
        </View>
        <Text style={styles.sectionDesc}>매수 판단 등급별 매수 비율(투자금 대비 %)입니다.</Text>

        {(['BULLISH', 'PULLBACK', 'DAYLOW', 'TAKE_PROFIT', 'STOP_LOSS'] as const).map(type => {
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
  chipList:     { gap: 6, paddingHorizontal: 4, paddingBottom: 4 },
  chip:         {
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.borderDim, paddingHorizontal: 10, paddingVertical: 8,
  },
  chipActive:   { borderColor: colors.teal, backgroundColor: colors.tealDim },
  chipTopRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  chipBadge:    { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1 },
  chipBadgePublic: { backgroundColor: 'rgba(251,191,36,0.15)', borderColor: colors.amber },
  chipBadgeMine:   { backgroundColor: colors.surfaceAlt, borderColor: colors.borderDim },
  chipBadgeText:{ fontSize: 9, fontWeight: '700' },
  chipTitle:    { fontSize: 13, fontWeight: '700', color: colors.text, flexShrink: 1 },
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
  inputDisabled: { opacity: 0.5 },
  sectionHeading: {
    fontSize: 13, fontWeight: '700', color: colors.teal,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  footer:     { padding: 16, borderTopWidth: 1, borderTopColor: colors.borderDim },
  applyBtn:   { backgroundColor: colors.teal, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  applyText:  { color: '#0a1f1e', fontSize: 15, fontWeight: '700' },
});

const toggleStyles = StyleSheet.create({
  pill:     { borderRadius: 10, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  pillOn:   { backgroundColor: colors.tealDim, borderColor: colors.teal },
  pillOff:  { backgroundColor: colors.surfaceAlt, borderColor: colors.borderDim },
  pillText: { fontSize: 13, fontWeight: '700' },
});

const badgeStyles = StyleSheet.create({
  badge:      { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText:  { fontSize: 10, fontWeight: '700' },
  legend:     {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.borderDim,
  },
  legendLabel: { fontSize: 11, color: colors.textDim, marginRight: 2 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDesc:  { fontSize: 11, color: colors.textSub },
});
