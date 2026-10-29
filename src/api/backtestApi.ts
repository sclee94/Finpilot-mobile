import type { ApiResponse, PageResponse, BacktestResult } from '../types';
import { apiClient } from './apiClient';

export const getBacktestList = (params: Partial<{ userUid: string | null; viewAll: boolean; page: number; size: number }>) =>
  apiClient.post<ApiResponse<PageResponse<BacktestResult>>>('/backtest/getBacktestList', params);

export const getBacktest = (id: number, userUid: string) =>
  apiClient.post<ApiResponse<BacktestResult>>('/backtest/getBacktest', { id, userUid });

export const deleteBacktest = (id: number, userUid: string) =>
  apiClient.delete<ApiResponse<BacktestResult>>('/backtest/deleteBacktest', { id, userUid });

/** 백테스트 실행 — 실전투자와 동일한 전략 로직으로 선택한 종목/전략을 검증 */
export const runBacktest = (params: {
  userUid: string;
  symbol: string;
  strategyConfigId: number;
  applyForceClose: boolean;
}, signal?: AbortSignal) =>
  apiClient.post<ApiResponse<BacktestResult>>('/finpilot/backtest/run', params, undefined, signal);

/** 포트폴리오 백테스트 실행 — 유저의 트레이딩 세션 목록 전체를 실전/모의투자와 동일하게 동시 시뮬레이션 */
export const runPortfolioBacktest = (params: {
  userUid: string;
  mode: 'LIVE' | 'PAPER';
  activeOnly: boolean;
}, signal?: AbortSignal) =>
  apiClient.post<ApiResponse<BacktestResult>>('/finpilot/backtest/portfolio/run', params, undefined, signal);

/** 랜덤 종목 백테스트 실행 — 카테고리(코스피200/나스닥100) 안에서 무작위 20종목에 단일 전략 일괄적용 */
export const runRandomBacktest = (params: {
  userUid: string;
  category: 'KOSPI200' | 'NASDAQ100';
  strategyConfigId: number;
  applyForceClose: boolean;
}, signal?: AbortSignal) =>
  apiClient.post<ApiResponse<BacktestResult>>('/finpilot/backtest/random/run', params, undefined, signal);

/** 추천 종목 백테스트 실행 — 오늘 브리핑 추천종목(상승 예상)에 단일 전략 일괄적용, 오늘 하루만 시뮬레이션 */
export const runRecommendBacktest = (params: {
  userUid: string;
  strategyConfigId: number;
  applyForceClose: boolean;
  startDate: string;   // "YYYY-MM-DD"
  endDate: string;     // "YYYY-MM-DD"
}, signal?: AbortSignal) =>
  apiClient.post<ApiResponse<BacktestResult>>('/finpilot/backtest/recommend/run', params, undefined, signal);
