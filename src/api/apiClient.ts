const BASE_URL = 'http://www.finpilot.me/api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function request<T>(method: HttpMethod, endpoint: string, body?: unknown): Promise<T> {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body !== undefined && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();
  return data as T;
}

export const apiClient = {
  get:    <T>(endpoint: string) => request<T>('GET', endpoint),
  post:   <T>(endpoint: string, body?: unknown) => request<T>('POST', endpoint, body),
  put:    <T>(endpoint: string, body?: unknown) => request<T>('PUT', endpoint, body),
  delete: <T>(endpoint: string, body?: unknown) => request<T>('DELETE', endpoint, body),
};
