import type { ApiResponse, User } from '../types';
import { apiClient } from './apiClient';

export const login = (email: string, password: string) =>
  apiClient.post<ApiResponse<User>>('/user/login', { email, password });
