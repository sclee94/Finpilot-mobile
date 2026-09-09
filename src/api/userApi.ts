import type { ApiResponse, User } from '../types';
import { apiClient } from './apiClient';

export const getUser = (params: Partial<User>) =>
  apiClient.post<ApiResponse<User>>('/user/getUser', params);

export const userUpdate = (userData: Partial<User>) =>
  apiClient.put<ApiResponse<User>>('/user/userUpdate', userData);

export const updateFcmToken = (userUid: string, fcmToken: string) =>
  apiClient.put<ApiResponse<void>>('/user/updateFcmToken', { userUid, fcmToken });
