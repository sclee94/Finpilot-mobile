import type { ApiResponse, PageResponse, StrategyConfig } from '../types';
import { apiClient } from './apiClient';

export const getStrategyConfigList = (params: Partial<{ userUid: string | null; userName: string; email: string; permission: number; status: number; page: number; size: number }>) =>
  apiClient.post<ApiResponse<PageResponse<StrategyConfig>>>('/strategy/getStrategyConfigList', params);

export const updateStrategyConfig = (params: { id: number; userUid: string; isUse: number }) =>
  apiClient.put<ApiResponse<StrategyConfig>>('/strategy/updateStrategyConfig', params);

export const deleteStrategyConfig = (id: number, userUid: string) =>
  apiClient.delete<ApiResponse<StrategyConfig>>('/strategy/deleteStrategyConfig', { id, userUid });
