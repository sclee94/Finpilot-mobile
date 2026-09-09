import { apiClient } from './apiClient';
import type { ApiResponse, ScreenerResult } from '../types';

/** 온디맨드 종목 추천(스크리너) — POST /api/screener/recommend
 * 자동매매와 분리된 읽기전용 기능(trading_session 미생성). 종목별로 KIS를 순차 조회하므로
 * limit이 크면 응답까지 수십 초~수 분 걸릴 수 있다. */
export const getScreenerRecommendations = (params: {
  userUid: string;
  category: 'KOSPI200';
  strategyConfigId: number | null;
  isLive: boolean;
  limit?: number;
}) =>
  apiClient.post<ApiResponse<ScreenerResult>>('/screener/recommend', params, 180000);
