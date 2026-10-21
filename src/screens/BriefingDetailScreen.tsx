import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { getBriefing } from '../api/briefingApi';
import type { Briefing } from '../api/briefingApi';
import { BriefingCategoryBadge } from '../components/BriefingBoard';
import MarkdownView from '../components/MarkdownView';
import { colors } from '../constants/colors';

// 브리핑 상세 (읽기 전용) — 본문은 외부 자동화가 보낸 마크다운을 렌더링해서 보여준다.
export default function BriefingDetailScreen() {
  const route = useRoute<RouteProp<{ BriefingDetail: { id: number } }, 'BriefingDetail'>>();
  const id = route.params?.id;
  const [item,    setItem]    = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!id) {
      setError('잘못된 게시글입니다.');
      setLoading(false);
      return;
    }
    getBriefing(id)
      .then(res => {
        if (res.status >= 400 || !res.data) setError(res.message || '브리핑을 불러오지 못했습니다.');
        else setItem(res.data);
      })
      .catch(() => setError('서버 연결에 실패했습니다.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={colors.teal} size="large" /></View>
  );

  if (error || !item) return (
    <View style={styles.center}><Text style={styles.errorText}>{error || '브리핑을 불러오지 못했습니다.'}</Text></View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.metaRow}>
        <BriefingCategoryBadge category={item.category} />
        <Text style={styles.date}>{item.briefingDate}</Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.createdAt}>등록 {item.createdAt}</Text>
      <View style={styles.divider} />
      <MarkdownView content={item.content ?? ''} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { padding: 16, paddingBottom: 40 },
  center:    { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, color: colors.rose, textAlign: 'center' },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  date:      { fontSize: 12, color: colors.textDim },
  title:     { fontSize: 20, fontWeight: '700', color: colors.text, lineHeight: 28 },
  createdAt: { fontSize: 12, color: colors.textDim, marginTop: 6 },
  divider:   { height: 1, backgroundColor: colors.borderDim, marginVertical: 16 },
});
