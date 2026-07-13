import type { ApiResponse, PageResponse, StrategyConfig, StrategyMenu } from '../types';
import { apiClient } from './apiClient';

/** 전략 설정 조회 — 공용 전략 전체 + 본인 소유 전략 */
export const getStrategyConfigList = (params: Partial<{ userUid: string; page: number; size: number }> = {}) =>
  apiClient.post<ApiResponse<PageResponse<StrategyConfig>>>('/strategy/getStrategyConfigList', params);

/** 전략 설정 신규 등록 (요청자 본인 소유로 생성됨) */
export const insertStrategyConfig = (params: StrategyConfig & { userUid: string }) =>
  apiClient.post<ApiResponse<StrategyConfig>>('/strategy/insertStrategyConfig', params);

/** 전략 설정 수정 (본인 소유 또는 관리자만 가능) */
export const updateStrategyConfig = (params: StrategyConfig & { id: number; userUid: string }) =>
  apiClient.put<ApiResponse<StrategyConfig>>('/strategy/updateStrategyConfig', params);

/** 전략 설정 삭제 (본인 소유 또는 관리자만 가능) */
export const deleteStrategyConfig = (id: number, userUid: string) =>
  apiClient.delete<ApiResponse<StrategyConfig>>('/strategy/deleteStrategyConfig', { id, userUid });

/** 전략 메뉴판 전체 조회 (등급별 매수 비율) */
export const getStrategyMenuList = () =>
  apiClient.post<ApiResponse<StrategyMenu[]>>('/strategy/getStrategyMenuList', {});
