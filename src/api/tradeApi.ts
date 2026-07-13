import type { ApiResponse, PageResponse, TradingSession, TradeHistory } from '../types';
import { apiClient } from './apiClient';

export const getExecuteOnOff = () =>
  apiClient.post<ApiResponse<{ isEnabled: number }>>('/trade/getExecuteOnOFF');

export const setExecuteOnOff = (isEnabled: number) =>
  apiClient.put<ApiResponse<{ isEnabled: number }>>('/trade/set/executeOnOff', { isEnabled });

export const getTradingSessionList = (params: Partial<{ userUid: string | null; userName: string; email: string; permission: number; status: number }>) =>
  apiClient.post<ApiResponse<TradingSession[]>>('/trade/getTradingSessionList', params);

/** 세션 생성 — initialBalance는 서버가 KIS 실잔고를 자동 캡처하므로 클라이언트에서 보내지 않음 */
export const insertTradingSession = (params: {
  userUid:           string;
  strategyConfigId?: number | null;
  symbol:            string;
  mode:              'LIVE' | 'PAPER';
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

/** 15:18 강제청산 적용 여부 토글 */
export const toggleForceCloseEnabled = (id: string) =>
  apiClient.put<ApiResponse<null>>('/trade/toggleForceCloseEnabled', { id });

/** KIS 실잔고 동기화 — 보유 수량/평균단가/포지션 갱신 */
export const syncPosition = (id: string) =>
  apiClient.put<ApiResponse<TradingSession>>('/trade/syncPosition', { id });

/** 자본금 조정 (입금/출금, 포지션·수익 이력 유지) */
export const adjustCapital = (id: string, depositAmount: number) =>
  apiClient.put<ApiResponse<TradingSession>>('/trade/adjustCapital', { id, depositAmount });

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
