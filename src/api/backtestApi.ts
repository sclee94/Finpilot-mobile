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
}) =>
  apiClient.post<ApiResponse<BacktestResult>>('/finpilot/backtest/run', params);

/** 포트폴리오 백테스트 실행 — 유저의 트레이딩 세션 목록 전체를 실전/모의투자와 동일하게 동시 시뮬레이션 */
export const runPortfolioBacktest = (params: {
  userUid: string;
  mode: 'LIVE' | 'PAPER';
  activeOnly: boolean;
}) =>
  apiClient.post<ApiResponse<BacktestResult>>('/finpilot/backtest/portfolio/run', params);
