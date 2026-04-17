import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView, Image,
} from 'react-native';
import { login } from '../api/authApi';
import { authStorage } from '../utils/auth';
import { colors } from '../constants/colors';

export default function LoginScreen({ navigation }: any) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.status === 200 && res.data) {
        await authStorage.save(res.data);
        navigation.replace('Main');
      } else {
        Alert.alert('로그인 실패', res.message || '이메일 또는 비밀번호를 확인해주세요.');
      }
    } catch (e) {
      Alert.alert('오류', '서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* 로고 */}
        <View style={styles.logoArea}>
          <Image
            source={require('../../assets/finpilot-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoTitle}>FINPILOT</Text>
          <Text style={styles.logoSub}>자동 매매 관리 시스템</Text>
        </View>

        {/* 카드 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>로그인</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>이메일</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="이메일 주소 입력"
              placeholderTextColor={colors.textDim}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>비밀번호</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="비밀번호 입력"
              placeholderTextColor={colors.textDim}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>로그인</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  scroll:      { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoArea:    { alignItems: 'center', marginBottom: 40 },
  logoImage:   { width: 90, height: 90, marginBottom: 16 },
  logoTitle:   { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: 4 },
  logoSub:     { fontSize: 13, color: colors.textDim, marginTop: 6 },
  card:        {
    backgroundColor: colors.surface, borderRadius: 20,
    borderWidth: 1, borderColor: colors.borderDim, padding: 24,
  },
  cardTitle:   { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 24 },
  fieldGroup:  { marginBottom: 16 },
  label:       { fontSize: 12, color: colors.textSub, marginBottom: 8, fontWeight: '600' },
  input:       {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderDim,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: colors.text,
  },
  button:      {
    backgroundColor: colors.teal, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText:  { color: '#0a1f1e', fontSize: 16, fontWeight: '700' },
});
