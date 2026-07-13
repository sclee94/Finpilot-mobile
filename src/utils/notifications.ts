import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { authStorage } from './auth';
import { updateFcmToken } from '../api/userApi';

// 포그라운드 알림 표시 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[FCM] 실제 기기에서만 푸시 알림을 사용할 수 있습니다.');
    return null;
  }

  // 권한 확인
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[FCM] 푸시 알림 권한 거부. status:', finalStatus);
    return null;
  }

  console.log('[FCM] 권한 허용됨');

  // Android 알림 채널 설정
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Finpilot 알림',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2dd4bf',
    });
  }

  // 네이티브 FCM 디바이스 토큰 발급 (Firebase Admin SDK 직접 전송용)
  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const expoPushToken = tokenData.data as string;

    console.log('[FCM] 토큰:', expoPushToken);

    // 서버에 FCM 토큰 저장
    const user = await authStorage.get();
    if (!user?.userUid) {
      console.warn('[FCM] userUid 없음 — 토큰 저장 생략');
      return null;
    }

    const res = await updateFcmToken(user.userUid, expoPushToken);
    console.log('[FCM] 서버 저장 결과:', res);

    return expoPushToken;
  } catch (e) {
    console.error('[FCM] 토큰 발급/저장 실패:', e);
    return null;
  }
}

// 알림 탭 시 이동할 화면 결정
export function getScreenFromNotification(
  notification: Notifications.Notification,
): { screen: string; params?: object } | null {
  const data = notification.request.content.data as Record<string, unknown>;
  if (!data) return null;

  switch (data.type) {
    case 'trade':
      return { screen: 'Trade' };
    case 'session':
      return { screen: 'Sessions' };
    case 'backtest':
      return { screen: 'Backtest' };
    default:
      return { screen: 'Home' };
  }
}
