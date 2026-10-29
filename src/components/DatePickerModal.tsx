import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { colors } from '../constants/colors';

// 외부 라이브러리 없이 쓰는 월 달력 선택 모달 — 값은 "YYYY-MM-DD" 문자열(KST 날짜 그대로, 시간대 변환 없음)
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const pad = (n: number) => String(n).padStart(2, '0');
const toYmd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function DatePickerModal({
  visible,
  title,
  value,
  minDate,
  maxDate,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  value: string;          // "YYYY-MM-DD"
  minDate?: string;       // 이 날짜 이전은 선택 불가
  maxDate?: string;       // 이 날짜 이후는 선택 불가
  onSelect: (ymd: string) => void;
  onClose: () => void;
}) {
  const [year, setYear] = useState(() => Number(value.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(value.slice(5, 7)) - 1);

  // 열 때마다 현재 선택값의 달로 이동
  useEffect(() => {
    if (!visible) return;
    setYear(Number(value.slice(0, 4)));
    setMonth(Number(value.slice(5, 7)) - 1);
  }, [visible, value]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const moveMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => moveMonth(-1)} style={styles.navBtn}>
              <Text style={styles.navText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthText}>{year}년 {month + 1}월</Text>
            <TouchableOpacity onPress={() => moveMonth(1)} style={styles.navBtn}>
              <Text style={styles.navText}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.row}>
            {WEEKDAYS.map((w, i) => (
              <Text key={w} style={[styles.weekday, i === 0 && { color: colors.rose }, i === 6 && { color: colors.sky }]}>{w}</Text>
            ))}
          </View>
          {Array.from({ length: cells.length / 7 }, (_, r) => (
            <View key={r} style={styles.row}>
              {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
                if (d == null) return <View key={i} style={styles.cell} />;
                const ymd = toYmd(year, month, d);
                const disabled = (minDate != null && ymd < minDate) || (maxDate != null && ymd > maxDate);
                const selected = ymd === value;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.cell, selected && styles.cellSelected]}
                    disabled={disabled}
                    onPress={() => { onSelect(ymd); onClose(); }}
                  >
                    <Text style={[styles.dayText, disabled && styles.dayDisabled, selected && styles.daySelected]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>닫기</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
  sheet:        { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  title:        { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 10 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navBtn:       { paddingHorizontal: 14, paddingVertical: 4 },
  navText:      { fontSize: 22, color: colors.textSub },
  monthText:    { fontSize: 15, fontWeight: '600', color: colors.text },
  row:          { flexDirection: 'row' },
  weekday:      { flex: 1, textAlign: 'center', fontSize: 12, color: colors.textDim, paddingVertical: 6 },
  cell:         { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  cellSelected: { backgroundColor: colors.teal },
  dayText:      { fontSize: 14, color: colors.text },
  dayDisabled:  { color: colors.border },
  daySelected:  { color: colors.bg, fontWeight: '700' },
  closeBtn:     { marginTop: 10, alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 6 },
  closeText:    { fontSize: 14, color: colors.textSub },
});
