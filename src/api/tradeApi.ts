import type { ApiResponse, PageResponse, TradingSession, TradeHistory } from '../types';
import { apiClient } from './apiClient';

export const getExecuteOnOff = () =>
  apiClient.post<ApiResponse<{ isEnabled: number }>>('/trade/getExecuteOnOFF');

export const setExecuteOnOff = (isEnabled: number) =>
  apiClient.put<ApiResponse<{ isEnabled: number }>>('/trade/set/executeOnOff', { isEnabled });

export const getTradingSessionList = (params: Partial<{ userUid: string | null; userName: string; email: string; permission: number; status: number }>) =>
  apiClient.post<ApiResponse<TradingSession[]>>('/trade/getTradingSessionList', params);

export const insertTradingSession = (params: {
  userUid:           string;
  strategyConfigId?: number | null;
  symbol:            string;
  mode:              'LIVE' | 'PAPER';
  cooldownBarsLeft:  number;
  consecSlCount:     number;
  currentEquity:     number;
  peakEquity:        number;
}) =>
  apiClient.post<ApiResponse<TradingSession>>('/trade/insertTradingSession', params);

export const updateTradingSession = (params: { id: string; active: number }) =>
  apiClient.put<ApiResponse<TradingSession>>('/trade/updateTradingSession', params);

export const deleteTradingSession = (id: string) =>
  apiClient.delete<ApiResponse<TradingSession>>('/trade/deleteTradingSession', { id });

export const resetTradingSession = (id: string) =>
  apiClient.put<ApiResponse<TradingSession>>('/trade/resetTradingSession', { id });

export const updateSessionStrategyConfigId = (params: { id: string; strategyConfigId: number }) =>
  apiClient.put<ApiResponse<TradingSession>>('/trade/updateStrategyConfigId', params);

export const toggleStrategyUpdate = (id: string) =>
  apiClient.put<ApiResponse<null>>('/trade/toggleStrategyUpdate', { id });

export const getTradeHistoryList = (params: {
  userUid?: string | null;
  mode?: string;
  action?: string;
  orderStatus?: string;
  symbolName?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  size?: number;
}) =>
  apiClient.post<ApiResponse<PageResponse<TradeHistory>>>('/tradeHistory/getTradeHistoryList', params);

export const getBalance = (userUid: string, mode: 'LIVE' | 'PAPER', accountNo?: string) =>
  apiClient.post<ApiResponse<{ totalBalance: number; holdingBalance: number; orderableCash: number }>>('/finpilot/balance', {
    userUid, mode, ...(accountNo ? { accountNo } : {}),
  });
