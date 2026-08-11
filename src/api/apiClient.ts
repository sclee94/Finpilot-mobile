import { authStorage } from '../utils/auth';
import { navigationRef } from '../../App';

const BASE_URL = 'http://www.finpilot.me/api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function request<T>(method: HttpMethod, endpoint: string, body?: unknown): Promise<T> {
  // 로그인 응답의 loginToken(JWT)을 이후 모든 요청에 실어 보낸다 — 백엔드
  // JwtAuthenticationFilter가 이 헤더 없이는 로그인 등 공개 경로를 제외한 전부를 401로 거부한다.
  const user = await authStorage.get();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (user?.loginToken) headers.Authorization = `Bearer ${user.loginToken}`;

  const options: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);

  // 토큰 만료/무효 - 세션을 지우고 로그인 화면으로 스택을 리셋
  if (response.status === 401) {
    await authStorage.clear();
    if (navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Login' as never }] });
    }
  }

  const data = await response.json();
  return data as T;
}

export const apiClient = {
  get:    <T>(endpoint: string) => request<T>('GET', endpoint),
  post:   <T>(endpoint: string, body?: unknown) => request<T>('POST', endpoint, body),
  put:    <T>(endpoint: string, body?: unknown) => request<T>('PUT', endpoint, body),
  delete: <T>(endpoint: string, body?: unknown) => request<T>('DELETE', endpoint, body),
};
