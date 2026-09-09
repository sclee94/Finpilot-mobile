import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

import LoginScreen        from './src/screens/LoginScreen';
import HomeScreen         from './src/screens/HomeScreen';
import TradeHistoryScreen from './src/screens/TradeHistoryScreen';
import SessionsScreen     from './src/screens/SessionsScreen';
import ProfileScreen      from './src/screens/ProfileScreen';
import StrategyScreen     from './src/screens/StrategyScreen';
import BacktestScreen     from './src/screens/BacktestScreen';

import { authStorage } from './src/utils/auth';
import { colors }      from './src/constants/colors';
import {
  registerForPushNotificationsAsync,
  getScreenFromNotification,
} from './src/utils/notifications';

export const navigationRef = createNavigationContainerRef();

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function SplashScreen() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 1, friction: 6,   useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={splash.container}>
      <Animated.View style={[splash.content, { opacity, transform: [{ scale }] }]}>
        <Image
          source={require('./assets/finpilot-logo.png')}
          style={splash.logo}
          resizeMode="contain"
        />
        <Text style={splash.title}>FINPILOT</Text>
        <Text style={splash.sub}>자동 매매 관리 시스템</Text>
      </Animated.View>
    </View>
  );
}

const splash = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content:   { alignItems: 'center' },
  logo:      { width: 110, height: 110, marginBottom: 24 },
  title:     { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: 5 },
  sub:       { fontSize: 13, color: colors.textDim, marginTop: 8, letterSpacing: 1 },
});

const homeHeader = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo:      { width: 32, height: 32 },
  title:     { fontWeight: '700', fontSize: 17, color: colors.text },
});

function TabIcon({ name, color }: { name: React.ComponentProps<typeof Feather>['name']; color: string }) {
  return <Feather name={name} size={22} color={color} />;
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle:         { backgroundColor: colors.surface },
        headerTintColor:     colors.text,
        headerTitleStyle:    { fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor:  colors.borderDim,
          borderTopWidth:  1,
          paddingBottom:   insets.bottom + 6,
          height:          62 + insets.bottom,
        },
        tabBarActiveTintColor:   colors.teal,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: () => (
            <View style={homeHeader.container}>
              <Image
                source={require('./assets/finpilot-logo.png')}
                style={homeHeader.logo}
                resizeMode="contain"
              />
              <Text style={homeHeader.title}>FINPILOT</Text>
            </View>
          ),
          tabBarLabel: '홈',
          tabBarIcon:  ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tab.Screen
        name="Sessions"
        component={SessionsScreen}
        options={{
          headerTitle: '세션 관리',
          tabBarLabel: '세션',
          tabBarIcon:  ({ color }) => <TabIcon name="activity" color={color} />,
        }}
      />
      <Tab.Screen
        name="Trade"
        component={TradeHistoryScreen}
        options={{
          headerTitle: '거래현황',
          tabBarLabel: '거래',
          tabBarIcon:  ({ color }) => <TabIcon name="trending-up" color={color} />,
        }}
      />
      <Tab.Screen
        name="Strategy"
        component={StrategyScreen}
        options={{
          headerTitle: '전략 설정',
          tabBarLabel: '전략',
          tabBarIcon:  ({ color }) => <TabIcon name="target" color={color} />,
        }}
      />
      <Tab.Screen
        name="Backtest"
        component={BacktestScreen}
        options={{
          headerTitle: '백테스트',
          tabBarLabel: '백테스트',
          tabBarIcon:  ({ color }) => <TabIcon name="clock" color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: '프로필',
          tabBarLabel: '프로필',
          tabBarIcon:  ({ color }) => <TabIcon name="user" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener     = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    authStorage.get().then(async user => {
      setInitialRoute(user ? 'Main' : 'Login');
      if (user) registerForPushNotificationsAsync();

      // 앱 종료 상태에서 알림 탭으로 실행된 경우
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (lastResponse) {
        const target = getScreenFromNotification(lastResponse.notification);
        if (target) {
          // navigationRef가 준비될 때까지 대기 후 이동
          const wait = setInterval(() => {
            if (navigationRef.isReady()) {
              clearInterval(wait);
              navigationRef.navigate(target.screen as never);
            }
          }, 100);
        }
      }
    });

    // 포그라운드 알림 수신
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[FCM] 알림 수신:', notification.request.content.title);
    });

    // 알림 탭 → 화면 이동
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const target = getScreenFromNotification(response.notification);
      if (target && navigationRef.isReady()) {
        navigationRef.navigate(target.screen as never);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  if (!initialRoute) {
    return <SplashScreen />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Main"  component={MainTabs}   />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
