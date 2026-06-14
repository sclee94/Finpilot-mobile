import type { ApiResponse, PageResponse, BacktestResult } from '../types';
import { apiClient } from './apiClient';

export const getBacktestList = (params: Partial<{ userUid: string | null; userName: string; email: string; permission: number; status: number; page: number; size: number }>) =>
  apiClient.post<ApiResponse<PageResponse<BacktestResult>>>('/backtest/getBacktestList', params);

export const getBacktest = (id: number, userUid: string) =>
  apiClient.post<ApiResponse<BacktestResult>>('/backtest/getBacktest', { id, userUid });

export const deleteBacktest = (id: number, userUid: string) =>
  apiClient.delete<ApiResponse<BacktestResult>>('/backtest/deleteBacktest', { id, userUid });

export const runBacktest = (params: {
  userUid: string;
  id: number;
  title: string;
  symbol: string;
  adxThreshold?: number;
  adxSidewaysFloor?: number;
  adxPersist?: number;
  diGapMin?: number;
  rsiLongEntry?: number;
  rsiLongFloor?: number;
  rsiShortEntry?: number;
  rsiOversoldEntry?: number;
  maxAddCount?: number;
  atrSlMult?: number;
  atrTpMult?: number;
  minHoldBars?: number;
  slCooldownBars?: number;
  consecSlLimit?: number;
  maxDdStop?: number;
  commission?: number;
  slippage?: number;
  riskPerTrade: number;
  usePrevBarSignal?: boolean;
  initialCapital: number;
  indicatorWindow?: number;
  tradingDaysPerYear?: number;
}) =>
  apiClient.post<ApiResponse<BacktestResult>>('/finpilot/backtest/run', params);
