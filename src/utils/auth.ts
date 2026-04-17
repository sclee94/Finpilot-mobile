import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../types';

const USER_KEY = 'loginUser';

export const authStorage = {
  save: async (user: User) => {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  get: async (): Promise<User | null> => {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },
  clear: async () => {
    await AsyncStorage.removeItem(USER_KEY);
  },
};
