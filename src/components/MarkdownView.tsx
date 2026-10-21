import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import type { ASTNode, RenderRules } from 'react-native-markdown-display';
import { colors } from '../constants/colors';

// 브리핑 본문(외부 자동화가 보내는 마크다운: 제목/표/굵게/인용/구분선/목록) 렌더링.
// 표는 열이 많아(최대 9열) 폰 폭에 그대로 그리면 읽을 수 없으므로, 본문 행 하나를 카드 하나로 바꿔
// 첫 칸은 카드 제목, 나머지 칸은 "열이름 / 값" 쌍으로 세로 배치한다. 헤더 행 자체는 그리지 않는다.

/** 노드 아래 텍스트를 마크업 없이 이어붙임 (헤더 셀 → 열이름) */
function nodeText(node: ASTNode | undefined): string {
  if (!node) return '';
  if (!node.children || node.children.length === 0) return node.content ?? '';
  return node.children.map(nodeText).join('');
}

/** td의 열 번호에 해당하는 헤더(th) 텍스트 — parent: [tr, tbody, table, ...] */
function headerLabel(node: ASTNode, parent: ASTNode[]): string {
  const table = parent.find(p => p.type === 'table');
  const thead = table?.children?.find(c => c.type === 'thead');
  const headerRow = thead?.children?.[0];
  return nodeText(headerRow?.children?.[node.index]).trim();
}

const rules: RenderRules = {
  table: (node, children) => (
    <View key={node.key} style={styles.table}>{children}</View>
  ),
  thead: () => null,
  tbody: (node, children) => (
    <View key={node.key} style={styles.tbody}>{children}</View>
  ),
  tr: (node, children) => (
    <View key={node.key} style={styles.card}>{children}</View>
  ),
  th: () => null,
  td: (node, children, parent) => {
    if (node.index === 0) {
      return <View key={node.key} style={styles.cardTitle}>{children}</View>;
    }
    const label = headerLabel(node, parent);
    return (
      <View key={node.key} style={styles.cardRow}>
        {!!label && <Text style={styles.cardLabel}>{label}</Text>}
        <View style={styles.cardValue}>{children}</View>
      </View>
    );
  },
};

export default function MarkdownView({ content }: { content: string }) {
  return (
    <Markdown style={mdStyles} rules={rules}>
      {content}
    </Markdown>
  );
}

const styles = StyleSheet.create({
  table:     { marginVertical: 8 },
  tbody:     { gap: 10 },
  card:      {
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.borderDim,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  cardTitle: { paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.borderDim },
  cardRow:   { gap: 2 },
  cardLabel: { fontSize: 11, fontWeight: '700', color: colors.textDim },
  cardValue: {},
});

// react-native-markdown-display 태그별 스타일 (다크 테마)
const mdStyles = StyleSheet.create({
  body:         { color: colors.textSub, fontSize: 15, lineHeight: 24 },
  heading1:     { color: colors.text, fontSize: 21, fontWeight: '800', lineHeight: 29, marginTop: 4, marginBottom: 12 },
  heading2:     {
    color: colors.text, fontSize: 18, fontWeight: '700', lineHeight: 26,
    marginTop: 28, marginBottom: 10, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: colors.borderDim,
  },
  heading3:     { color: colors.teal, fontSize: 16, fontWeight: '700', lineHeight: 23, marginTop: 20, marginBottom: 8 },
  heading4:     { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  paragraph:    { marginTop: 6, marginBottom: 6 },
  strong:       { color: colors.text, fontWeight: '700' },
  em:           { fontStyle: 'italic' },
  link:         { color: colors.teal, textDecorationLine: 'underline' },
  bullet_list:  { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item:    { marginVertical: 3 },
  bullet_list_icon:  { color: colors.textDim, marginLeft: 2, marginRight: 8 },
  ordered_list_icon: { color: colors.textDim, marginLeft: 2, marginRight: 8 },
  blockquote:   {
    backgroundColor: colors.amberDim, borderLeftWidth: 4, borderLeftColor: colors.amber,
    borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4, marginVertical: 10, marginLeft: 0,
  },
  hr:           { backgroundColor: colors.borderDim, height: 1, marginVertical: 20 },
  code_inline:  {
    backgroundColor: colors.surfaceAlt, color: colors.amber, borderRadius: 4,
    paddingHorizontal: 4, fontSize: 13, borderWidth: 0,
  },
});
