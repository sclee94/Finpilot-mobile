import type { ApiResponse, PageResponse } from '../types';
import { apiClient } from './apiClient';

/** 브리핑 카테고리 — 서버 briefing_post.category 값과 동일 */
export const BRIEFING_CATEGORIES = [
  { value: 'MORNING',     label: '아침' },
  { value: 'EVENING',     label: '저녁' },
  { value: 'AFTER_CLOSE', label: '장마감후' },
] as const;

export type BriefingCategory = typeof BRIEFING_CATEGORIES[number]['value'];

/** 브리핑 게시글 (읽기 전용) — 목록에서는 content 대신 preview만 채워짐 */
export interface Briefing {
  id:           number;
  category:     BriefingCategory;
  title:        string;
  content?:     string;
  preview?:     string;
  briefingDate: string;   // yyyy-MM-dd
  createdAt:    string;   // yyyy-MM-dd HH:mm
}

/** 브리핑 목록 (최신순) - category 미지정 시 전체 */
export const getBriefingList = (params: { category?: BriefingCategory; page: number; size: number }) =>
  apiClient.post<ApiResponse<PageResponse<Briefing>>>('/briefing/getBriefingList', params);

/** 브리핑 상세 (본문 포함) */
export const getBriefing = (id: number) =>
  apiClient.post<ApiResponse<Briefing>>('/briefing/getBriefing', { id });

export const briefingCategoryLabel = (category: string | null | undefined) =>
  BRIEFING_CATEGORIES.find(c => c.value === category)?.label ?? category ?? '';
