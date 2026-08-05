import type { ApiResponse, SymbolUniverse } from '../types';
import { apiClient } from './apiClient';

/** 실전투자 탭 종목 선택 카테고리 (하드코딩 대신 DB 기반) */
export const SYMBOL_CATEGORIES = [
  { value: 'KOSPI200',  label: '코스피200' },
  { value: 'NASDAQ100', label: '나스닥100' },
  { value: 'INDEX',     label: '지수' },
] as const;

export type SymbolCategory = typeof SYMBOL_CATEGORIES[number]['value'];

/** 카테고리별 종목 목록 (현재가 내림차순) - GET /api/symbols/list?category=... */
export const getSymbolsByCategory = (category: SymbolCategory) =>
  apiClient.get<ApiResponse<SymbolUniverse[]>>(`/symbols/list?category=${category}`);
