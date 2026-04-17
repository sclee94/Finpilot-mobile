import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { authStorage } from '../utils/auth';
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

export default function ProfileScreen({ navigation }: any) {
  const [user, setUser] = useState<User | null>(null);

  useFocusEffect(useCallback(() => {
    authStorage.get().then(setUser);
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
      </View>

      {/* 계정 정보 */}
      <Text style={styles.sectionTitle}>계정 정보</Text>
      <View style={styles.section}>
        <InfoRow label="이름"   value={user?.userName ?? '—'} />
        <InfoRow label="이메일" value={user?.email    ?? '—'} />
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

      {/* 로그아웃 */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>
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
  logoutBtn:   {
    backgroundColor: colors.roseDim, borderWidth: 1, borderColor: colors.rose,
    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
  },
  logoutText:  { fontSize: 15, fontWeight: '700', color: colors.rose },
});
