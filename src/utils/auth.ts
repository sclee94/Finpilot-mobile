import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../types';

const USER_KEY = 'loginUser';
const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 2주 (웹과 동일)

interface StoredSession {
  user: User;
  expiresAt: number;
}

export const authStorage = {
  /** 로그인 시 호출 — 저장 시점으로부터 2주간 세션 유지 */
  save: async (user: User) => {
    const session: StoredSession = { user, expiresAt: Date.now() + SESSION_DURATION_MS };
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(session));
  },
  /** 만료된 세션은 자동으로 지우고 null 반환 */
  get: async (): Promise<User | null> => {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      const session = JSON.parse(raw) as Partial<StoredSession>;
      if (!session.user || !session.expiresAt || Date.now() > session.expiresAt) {
        await AsyncStorage.removeItem(USER_KEY);
        return null;
      }
      return session.user;
    } catch {
      return null;
    }
  },
  clear: async () => {
    await AsyncStorage.removeItem(USER_KEY);
  },
};
