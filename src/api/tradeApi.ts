import type { ApiResponse, TradingSession, TradeHistory } from '../types';
import { apiClient } from './apiClient';

export const getTradingSessionList = (params: { userUid?: string | null }) =>
  apiClient.post<ApiResponse<TradingSession[]>>('/trade/getTradingSessionList', params);

export const getTradeHistoryList = (params: { userUid?: string | null }) =>
  apiClient.post<ApiResponse<TradeHistory[]>>('/tradeHistory/getTradeHistoryList', params);

export const getExecuteOnOff = () =>
  apiClient.post<ApiResponse<{ isEnabled: number }>>('/trade/getExecuteOnOFF');

export const setExecuteOnOff = (isEnabled: number) =>
  apiClient.put<ApiResponse<{ isEnabled: number }>>('/trade/set/executeOnOff', { isEnabled });
