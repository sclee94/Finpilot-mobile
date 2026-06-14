import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AssetData {
  liveBalance: number | null;
  liveHolding: number | null;
  liveOrderableCash: number | null;
  paperBalance: number | null;
  paperHolding: number | null;
  paperOrderableCash: number | null;
}

const key = (userUid: string) => `asset_${userUid}`;

export const assetStorage = {
  save: async (userUid: string, data: AssetData): Promise<void> => {
    await AsyncStorage.setItem(key(userUid), JSON.stringify(data));
  },
  get: async (userUid: string): Promise<AssetData | null> => {
    const raw = await AsyncStorage.getItem(key(userUid));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AssetData;
    } catch {
      return null;
    }
  },
};
