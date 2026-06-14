import type { ApiResponse, User } from '../types';
import { apiClient } from './apiClient';

export const getUser = (params: Partial<User>) =>
  apiClient.post<ApiResponse<User>>('/user/getUser', params);

export const getUserList = (params?: Partial<User>) =>
  apiClient.post<ApiResponse<User[]>>('/user/getUserList', params ?? {});

export const login = (credentials: { email: string; password: string }) =>
  apiClient.post<ApiResponse<User>>('/user/login', credentials);

export const userUpdate = (userData: Partial<User>) =>
  apiClient.put<ApiResponse<User>>('/user/userUpdate', userData);

export const deleteUser = (params: Partial<User>) =>
  apiClient.delete<ApiResponse<User>>('/user/deleteUser', params);

export const updateFcmToken = (userUid: string, fcmToken: string) =>
  apiClient.put<ApiResponse<void>>('/user/updateFcmToken', { userUid, fcmToken });
