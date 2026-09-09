import { authStorage } from '../utils/auth';
import { navigationRef } from '../../App';

const BASE_URL = 'http://www.finpilot.me/api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function request<T>(method: HttpMethod, endpoint: string, body?: unknown, timeoutMs?: number, externalSignal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;

  // 호출부(예: 백테스트 취소 버튼)가 넘긴 signal이 abort되면 내부 controller도 같이 abort —
  // fetch는 signal을 하나만 받을 수 있어서 타임아웃용 controller에 연결해준다.
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort);
  }

  // 로그인 응답의 loginToken(JWT)을 이후 모든 요청에 실어 보낸다 — 백엔드
  // JwtAuthenticationFilter가 이 헤더 없이는 로그인 등 공개 경로를 제외한 전부를 401로 거부한다.
  const user = await authStorage.get();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (user?.loginToken) headers.Authorization = `Bearer ${user.loginToken}`;

  const options: RequestInit = {
    method,
    headers,
    signal: controller.signal,
  };

  if (body !== undefined && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);

    // 토큰 만료/무효 - 세션을 지우고 로그인 화면으로 스택을 리셋
    if (response.status === 401) {
      await authStorage.clear();
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: 'Login' as never }] });
      }
    }

    const data = await response.json().catch(() => {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    });

    return data as T;
  } catch (err) {
    // React Native(Hermes)는 abort 시 DOMException이 아닌 일반 Error를 던질 수 있어 name만 확인
    if (err instanceof Error && err.name === 'AbortError') {
      // 사용자가 명시적으로 취소한 경우(externalSignal)와 타임아웃을 구분해서 호출부가
      // 정확한 메시지를 보여줄 수 있게 한다.
      if (externalSignal?.aborted) {
        const cancelErr = new Error('요청이 취소되었습니다.');
        cancelErr.name = 'AbortError';
        throw cancelErr;
      }
      throw new Error('요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
  }
}

export const apiClient = {
  get:    <T>(endpoint: string) => request<T>('GET', endpoint),
  post:   <T>(endpoint: string, body?: unknown, timeoutMs?: number, signal?: AbortSignal) => request<T>('POST', endpoint, body, timeoutMs, signal),
  put:    <T>(endpoint: string, body?: unknown) => request<T>('PUT', endpoint, body),
  delete: <T>(endpoint: string, body?: unknown) => request<T>('DELETE', endpoint, body),
};
