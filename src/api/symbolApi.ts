import type { ApiResponse, RecommendSymbol, SymbolUniverse } from '../types';
import { apiClient } from './apiClient';

/** 실전투자 탭 종목 선택 카테고리 (하드코딩 대신 DB 기반) */
export const SYMBOL_CATEGORIES = [
  { value: 'KOSPI200',  label: '코스피200' },
  { value: 'KOSDAQ150', label: '코스닥' },
  { value: 'NASDAQ100', label: '나스닥100' },
] as const;

export type SymbolCategory = typeof SYMBOL_CATEGORIES[number]['value'];

/** 카테고리별 종목 목록 (현재가 내림차순) - GET /api/symbols/list?category=... */
export const getSymbolsByCategory = (category: SymbolCategory) =>
  apiClient.get<ApiResponse<SymbolUniverse[]>>(`/symbols/list?category=${category}`);

/** 추천 예상 강도 → 표시 라벨 + 추천세션 매수조건 완화율(서버 RecommendBuyRelaxer와 동일, 미전송=약) */
const STRENGTH_INFO: Record<string, { label: string; relaxPct: number }> = {
  WEAK:        { label: '약',     relaxPct: 0 },
  MEDIUM:      { label: '중',     relaxPct: 25 },
  STRONG:      { label: '강',     relaxPct: 50 },
  VERY_STRONG: { label: '매우강', relaxPct: 75 },
};
export const recommendStrengthInfo = (strength: string | null | undefined) =>
  STRENGTH_INFO[strength ?? 'WEAK'] ?? STRENGTH_INFO.WEAK;

/** 오늘(KST) 뉴스브리핑 추천 종목 - GET /api/recommend/symbols (없으면 빈 배열, 토글 여부 무관) */
export const getTodayRecommendSymbols = () =>
  apiClient.get<ApiResponse<RecommendSymbol[]>>('/recommend/symbols');