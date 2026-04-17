import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';

import LoginScreen        from './src/screens/LoginScreen';
import HomeScreen         from './src/screens/HomeScreen';
import TradeHistoryScreen from './src/screens/TradeHistoryScreen';
import SessionsScreen     from './src/screens/SessionsScreen';
import ProfileScreen      from './src/screens/ProfileScreen';

import { authStorage } from './src/utils/auth';
import { colors }      from './src/constants/colors';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return (
    <Text style={{ fontSize: 20, opacity: color === colors.teal ? 1 : 0.4 }}>
      {emoji}
    </Text>
  );
}

function MainTabs() {
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
          paddingBottom:   6,
          height:          62,
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
          headerTitle:  'FINPILOT',
          tabBarLabel:  '홈',
          tabBarIcon:   ({ color }) => <TabIcon emoji="🏠" color={color} />,
        }}
      />
      <Tab.Screen
        name="Sessions"
        component={SessionsScreen}
        options={{
          headerTitle:  '세션 관리',
          tabBarLabel:  '세션',
          tabBarIcon:   ({ color }) => <TabIcon emoji="⚡" color={color} />,
        }}
      />
      <Tab.Screen
        name="Trade"
        component={TradeHistoryScreen}
        options={{
          headerTitle:  '거래현황',
          tabBarLabel:  '거래',
          tabBarIcon:   ({ color }) => <TabIcon emoji="📊" color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle:  '프로필',
          tabBarLabel:  '프로필',
          tabBarIcon:   ({ color }) => <TabIcon emoji="👤" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    authStorage.get().then(user => {
      setInitialRoute(user ? 'Main' : 'Login');
    });
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main"  component={MainTabs}   />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
