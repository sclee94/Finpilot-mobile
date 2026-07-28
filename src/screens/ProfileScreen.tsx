import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { authStorage } from '../utils/auth';
import { getUser, userUpdate } from '../api/userApi';
import { colors } from '../constants/colors';
import type { User } from '../types';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function EditProfileModal({
  visible, user, onClose, onSaved,
}: {
  visible: boolean;
  user: User | null;
  onClose: () => void;
  onSaved: (updated: Partial<User>) => void;
}) {
  const [kisAppKey, setKisAppKey]                 = useState('');
  const [kisAppSecret, setKisAppSecret]           = useState('');
  const [kisAccountNo, setKisAccountNo]           = useState('');
  const [kisAccountProduct, setKisAccountProduct] = useState('01');
  const [kisPaperAppKey, setKisPaperAppKey]                 = useState('');
  const [kisPaperAppSecret, setKisPaperAppSecret]           = useState('');
  const [kisPaperAccountNo, setKisPaperAccountNo]           = useState('');
  const [kisPaperAccountProduct, setKisPaperAccountProduct] = useState('01');
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [tradingIntervalMinutes, setTradingIntervalMinutes] = useState(15);
  const [intervalSaving, setIntervalSaving] = useState(false);

  React.useEffect(() => {
    if (!visible || !user) return;
    setKisAppKey(user.kisAppKey ?? '');
    setKisAppSecret(user.kisAppSecret ?? '');
    setKisAccountNo(user.kisAccountNo ?? '');
    setKisAccountProduct(user.kisAccountProduct ?? '01');
    setKisPaperAppKey(user.kisPaperAppKey ?? '');
    setKisPaperAppSecret(user.kisPaperAppSecret ?? '');
    setKisPaperAccountNo(user.kisPaperAccountNo ?? '');
    setKisPaperAccountProduct(user.kisPaperAccountProduct ?? '01');
    setTradingIntervalMinutes(user.tradingIntervalMinutes ?? 15);
    setNewPassword('');
    setConfirmPassword('');
  }, [visible, user?.userUid]);

  if (!user) return null;

  const handlePasswordChange = async () => {
    if (pwSaving) return;
    if (!newPassword || !confirmPassword) {
      Alert.alert('입력 오류', '새 비밀번호를 입력해주세요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('입력 오류', '비밀번호가 일치하지 않습니다.');
      return;
    }
    setPwSaving(true);
    try {
      const res = await userUpdate({ userUid: user.userUid, password: newPassword });
      if (res.status < 400) {
        Alert.alert('완료', '비밀번호가 변경되었습니다.');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        Alert.alert('오류', res.message || '변경에 실패했습니다.');
      }
    } catch {
      Alert.alert('오류', '서버 연결에 실패했습니다.');
    } finally {
      setPwSaving(false);
    }
  };

  const handleIntervalSave = async (value: number) => {
    if (intervalSaving) return;
    const previous = tradingIntervalMinutes;
    setTradingIntervalMinutes(value);
    setIntervalSaving(true);
    try {
      const res = await userUpdate({ userUid: user.userUid, tradingIntervalMinutes: value });
      if (res.status < 400) {
        onSaved({ tradingIntervalMinutes: value });
      } else {
        setTradingIntervalMinutes(previous);
        Alert.alert('오류', res.message || '저장에 실패했습니다.');
      }
    } catch {
      setTradingIntervalMinutes(previous);
      Alert.alert('오류', '서버 연결에 실패했습니다.');
    } finally {
      setIntervalSaving(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        userUid: user.userUid,
        kisAppKey, kisAppSecret, kisAccountNo, kisAccountProduct,
        kisPaperAppKey, kisPaperAppSecret, kisPaperAccountNo, kisPaperAccountProduct,
      };
      const res = await userUpdate(payload);
      if (res.status < 400) {
        onSaved(payload);
        Alert.alert('완료', 'KIS 연동 정보가 저장되었습니다.');
        onClose();
      } else {
        Alert.alert('오류', res.message || '저장에 실패했습니다.');
      }
    } catch {
      Alert.alert('오류', '서버 연결에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, value, onChangeText, placeholder }: {
    label: string; value: string; onChangeText: (t: string) => void; placeholder: string;
  }) => (
    <View style={modal.field}>
      <Text style={modal.label}>{label}</Text>
      <TextInput
        style={modal.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        secureTextEntry
        autoCapitalize="none"
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.container}>
        <View style={modal.handle} />
        <View style={modal.header}>
          <Text style={modal.title}>정보 수정</Text>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
            <Text style={modal.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={modal.scroll} keyboardShouldPersistTaps="handled">
          <View style={modal.readonlyField}>
            <Text style={modal.label}>이름</Text>
            <Text style={modal.readonlyValue}>{user.userName}</Text>
          </View>
          <View style={modal.readonlyField}>
            <Text style={modal.label}>이메일</Text>
            <Text style={modal.readonlyValue}>{user.email}</Text>
          </View>

          <Text style={modal.sectionTitle}>비밀번호 변경</Text>
          <View style={modal.field}>
            <Text style={modal.label}>새 비밀번호</Text>
            <TextInput
              style={modal.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="새 비밀번호를 입력하세요"
              placeholderTextColor={colors.textDim}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
          <View style={modal.field}>
            <Text style={modal.label}>비밀번호 확인</Text>
            <TextInput
              style={modal.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="비밀번호를 다시 입력하세요"
              placeholderTextColor={colors.textDim}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
          <TouchableOpacity style={[modal.submitBtn, { marginBottom: 8 }]} onPress={handlePasswordChange} disabled={pwSaving} activeOpacity={0.8}>
            {pwSaving
              ? <ActivityIndicator color={colors.bg} />
              : <Text style={modal.submitText}>비밀번호 변경</Text>}
          </TouchableOpacity>

          <Text style={modal.sectionTitle}>자동매매 판단 주기</Text>
          <Text style={modal.helperText}>이 주기마다 보유/후보 종목을 다시 판단합니다. 백테스트에도 동일하게 적용됩니다.</Text>
          <View style={modal.intervalRow}>
            {[5, 10, 15, 30].map((min) => (
              <TouchableOpacity
                key={min}
                disabled={intervalSaving}
                onPress={() => handleIntervalSave(min)}
                style={[modal.intervalBtn, tradingIntervalMinutes === min && modal.intervalBtnActive]}
                activeOpacity={0.8}
              >
                <Text style={[modal.intervalBtnText, tradingIntervalMinutes === min && modal.intervalBtnTextActive]}>
                  {min}분
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={modal.sectionTitle}>한국투자증권 연동 — 실전투자</Text>
          <Field label="앱키 (App Key)"       value={kisAppKey}     onChangeText={setKisAppKey}     placeholder="KIS 실전 앱키 입력" />
          <Field label="앱시크릿 (App Secret)" value={kisAppSecret}  onChangeText={setKisAppSecret}  placeholder="KIS 실전 앱시크릿 입력" />
          <Field label="계좌번호 (앞 8자리)"    value={kisAccountNo} onChangeText={setKisAccountNo}  placeholder="12345678" />
          <View style={modal.field}>
            <Text style={modal.label}>계좌상품코드</Text>
            <TextInput
              style={modal.input}
              value={kisAccountProduct}
              onChangeText={setKisAccountProduct}
              placeholder="01"
              placeholderTextColor={colors.textDim}
            />
          </View>

          <Text style={modal.sectionTitle}>한국투자증권 연동 — 모의투자</Text>
          <Field label="모의 앱키 (Paper App Key)"       value={kisPaperAppKey}     onChangeText={setKisPaperAppKey}     placeholder="KIS 모의 앱키 입력" />
          <Field label="모의 앱시크릿 (Paper App Secret)" value={kisPaperAppSecret}  onChangeText={setKisPaperAppSecret}  placeholder="KIS 모의 앱시크릿 입력" />
          <Field label="모의 계좌번호 (앞 8자리)"          value={kisPaperAccountNo} onChangeText={setKisPaperAccountNo}  placeholder="12345678" />
          <View style={[modal.field, { marginBottom: 24 }]}>
            <Text style={modal.label}>모의 계좌상품코드</Text>
            <TextInput
              style={modal.input}
              value={kisPaperAccountProduct}
              onChangeText={setKisPaperAccountProduct}
              placeholder="01"
              placeholderTextColor={colors.textDim}
            />
          </View>

          <TouchableOpacity style={modal.submitBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
            {saving
              ? <ActivityIndicator color={colors.bg} />
              : <Text style={modal.submitText}>저장</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function ProfileScreen({ navigation }: any) {
  const [user, setUser] = useState<User | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  useFocusEffect(useCallback(() => {
    authStorage.get().then(async (stored) => {
      if (!stored) return;
      setUser(stored);
      try {
        const res = await getUser({ userUid: stored.userUid });
        if (res.status === 200 && res.data) {
          setUser(res.data);
          await authStorage.save(res.data);
        }
      } catch {}
    });
  }, []));

  const handleLogout = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃', style: 'destructive',
        onPress: async () => {
          await authStorage.clear();
          navigation.replace('Login');
        },
      },
    ]);
  };

  const permLabel =
    (user?.permission ?? 0) >= 100 ? '최고 관리자' :
    (user?.permission ?? 0) >= 99  ? '관리자' : '일반 유저';

  const statusLabel =
    user?.status === 1  ? '활성' :
    user?.status === 0  ? '비활성' : '블랙리스트';
  const statusColor =
    user?.status === 1  ? colors.emerald :
    user?.status === 0  ? colors.textDim : colors.rose;

  const hasLiveKis  = !!(user?.kisAppKey && user?.kisAppSecret && user?.kisAccountNo && user?.kisAccountProduct);
  const hasPaperKis = !!(user?.kisPaperAppKey && user?.kisPaperAppSecret && user?.kisPaperAccountNo && user?.kisPaperAccountProduct);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 프로필 헤더 */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.userName?.charAt(0)?.toUpperCase() ?? 'U'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.userName ?? '—'}</Text>
        <Text style={styles.email}>{user?.email ?? '—'}</Text>
        <View style={styles.permBadge}>
          <Text style={styles.permText}>{permLabel}</Text>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={() => setShowEdit(true)} activeOpacity={0.8}>
          <Text style={styles.editBtnText}>정보수정하기</Text>
        </TouchableOpacity>
      </View>

      {/* 계정 정보 */}
      <Text style={styles.sectionTitle}>계정 정보</Text>
      <View style={styles.section}>
        <InfoRow label="이름"     value={user?.userName  ?? '—'} />
        <InfoRow label="이메일"   value={user?.email     ?? '—'} />
        <InfoRow label="전화번호" value={user?.userPhone ?? '—'} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>계정 상태</Text>
          <Text style={[styles.rowValue, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Text style={styles.rowLabel}>권한</Text>
          <Text style={[styles.rowValue, { color: colors.teal }]}>{permLabel}</Text>
        </View>
      </View>

      {/* KIS 연동 */}
      <Text style={styles.sectionTitle}>KIS 연동</Text>
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>실전 계좌</Text>
          <View style={[styles.kisBadge, { backgroundColor: hasLiveKis ? colors.amberDim : colors.surfaceAlt }]}>
            <Text style={[styles.kisBadgeText, { color: hasLiveKis ? colors.amber : colors.textDim }]}>
              {hasLiveKis ? `연동완료 · ${user!.kisAccountNo}` : '미설정'}
            </Text>
          </View>
        </View>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Text style={styles.rowLabel}>모의 계좌</Text>
          <View style={[styles.kisBadge, { backgroundColor: hasPaperKis ? colors.blueDim : colors.surfaceAlt }]}>
            <Text style={[styles.kisBadgeText, { color: hasPaperKis ? colors.blue : colors.textDim }]}>
              {hasPaperKis ? `연동완료 · ${user!.kisPaperAccountNo}` : '미설정'}
            </Text>
          </View>
        </View>
      </View>

      {/* 로그아웃 */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>

      <EditProfileModal
        visible={showEdit}
        user={user}
        onClose={() => setShowEdit(false)}
        onSaved={async (updated) => {
          const merged = user ? { ...user, ...updated } : null;
          setUser(merged);
          if (merged) await authStorage.save(merged);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  content:     { padding: 16, paddingBottom: 40 },
  profileCard: {
    backgroundColor: colors.surface, borderRadius: 20,
    borderWidth: 1, borderColor: colors.borderDim,
    alignItems: 'center', padding: 28, marginBottom: 24,
  },
  avatar:      {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.tealDim, borderWidth: 2, borderColor: colors.teal,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  avatarText:  { fontSize: 28, fontWeight: '800', color: colors.teal },
  name:        { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  email:       { fontSize: 13, color: colors.textDim, marginBottom: 12 },
  permBadge:   {
    backgroundColor: colors.tealDim, borderRadius: 20, borderWidth: 1,
    borderColor: colors.teal, paddingHorizontal: 14, paddingVertical: 4,
  },
  permText:    { fontSize: 12, color: colors.teal, fontWeight: '700' },
  editBtn:     {
    marginTop: 14, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  editBtnText: { fontSize: 13, color: colors.text, fontWeight: '700' },
  sectionTitle:{ fontSize: 13, color: colors.textDim, fontWeight: '700',
                 marginBottom: 8, marginLeft: 4, letterSpacing: 1 },
  section:     {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.borderDim, marginBottom: 24, overflow: 'hidden',
  },
  row:         {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.borderDim,
  },
  rowLabel:    { fontSize: 14, color: colors.textDim },
  rowValue:    { fontSize: 14, fontWeight: '600', color: colors.text },
  kisBadge:    {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  kisBadgeText:{ fontSize: 12, fontWeight: '600' },
  logoutBtn:   {
    backgroundColor: colors.roseDim, borderWidth: 1, borderColor: colors.rose,
    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
  },
  logoutText:  { fontSize: 15, fontWeight: '700', color: colors.rose },
});

const modal = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.surface },
  handle:         { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  header:         {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: colors.borderDim,
  },
  title:          { fontSize: 17, fontWeight: '700', color: colors.text },
  closeBtn:       { padding: 4 },
  closeText:      { fontSize: 16, color: colors.textDim },
  scroll:         { flex: 1, padding: 16 },
  sectionTitle:   {
    fontSize: 12, color: colors.textDim, fontWeight: '700',
    marginTop: 12, marginBottom: 12, letterSpacing: 0.5,
  },
  readonlyField:  { marginBottom: 16 },
  readonlyValue:  {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderDim,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, color: colors.textDim,
  },
  field:          { marginBottom: 16 },
  label:          { fontSize: 13, color: colors.textSub, fontWeight: '600', marginBottom: 8 },
  helperText:     { fontSize: 12, color: colors.textDim, marginBottom: 12, marginTop: -6 },
  intervalRow:    { flexDirection: 'row', gap: 8, marginBottom: 20 },
  intervalBtn:    {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderDim,
  },
  intervalBtnActive:     { backgroundColor: colors.tealDim, borderColor: colors.teal },
  intervalBtnText:       { fontSize: 14, fontWeight: '700', color: colors.textDim },
  intervalBtnTextActive: { color: colors.teal },
  input:          {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderDim,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, color: colors.text,
  },
  submitBtn:      {
    backgroundColor: colors.teal, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 8, marginBottom: 32,
  },
  submitText:     { color: colors.bg, fontSize: 15, fontWeight: '700' },
});
