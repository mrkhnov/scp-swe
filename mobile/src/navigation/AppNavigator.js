import React from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ConsumerHomeScreen from '../screens/ConsumerHomeScreen';
import ProductCatalogScreen from '../screens/ProductCatalogScreen';
import OrdersScreen from '../screens/OrdersScreen';
import ComplaintsScreen from '../screens/ComplaintsScreen';
import ChatScreen from '../screens/ChatScreen';
import SalesHomeScreen from '../screens/SalesHomeScreen';
import SuppliersScreen from '../screens/SuppliersScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function ConsumerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={ConsumerHomeScreen}
        options={{ tabBarLabel: 'Home', tabBarIcon: () => <Text>🏠</Text> }}
      />
      <Tab.Screen 
        name="Catalog" 
        component={ProductCatalogScreen}
        options={{ tabBarLabel: 'Catalog', tabBarIcon: () => <Text>📦</Text> }}
      />
      <Tab.Screen 
        name="Orders" 
        component={OrdersScreen}
        options={{ tabBarLabel: 'Orders', tabBarIcon: () => <Text>🛒</Text> }}
      />
      <Tab.Screen 
        name="Complaints" 
        component={ComplaintsScreen}
        options={{ tabBarLabel: 'Complaints', tabBarIcon: () => <Text>⚠️</Text> }}
      />
      <Tab.Screen 
        name="Suppliers" 
        component={SuppliersScreen}
        options={{ tabBarLabel: 'Suppliers', tabBarIcon: () => <Text>🏢</Text> }}
      />
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen}
        options={{ tabBarLabel: 'Messages', tabBarIcon: () => <Text>💬</Text> }}
      />
    </Tab.Navigator>
  );
}

function SalesTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={SalesHomeScreen}
        options={{ tabBarLabel: 'Home', tabBarIcon: () => <Text>🏠</Text> }}
      />
      <Tab.Screen 
        name="Orders" 
        component={OrdersScreen}
        options={{ tabBarLabel: 'Orders', tabBarIcon: () => <Text>📋</Text> }}
      />
      <Tab.Screen 
        name="Complaints" 
        component={ComplaintsScreen}
        options={{ tabBarLabel: 'Complaints', tabBarIcon: () => <Text>⚠️</Text> }}
      />
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen}
        options={{ tabBarLabel: 'Messages', tabBarIcon: () => <Text>💬</Text> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      {!user ? (
        <>
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ title: 'SCP Login', headerShown: false }}
          />
          <Stack.Screen 
            name="Register" 
            component={RegisterScreen} 
            options={{ title: 'Create Account' }}
          />
        </>
      ) : user.role === 'CONSUMER' ? (
        <>
          <Stack.Screen 
            name="ConsumerTabs" 
            component={ConsumerTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="ChatDetail" 
            component={ChatScreen}
            options={{ title: 'Chat' }}
          />
        </>
      ) : (
        <>
          <Stack.Screen 
            name="SalesTabs" 
            component={SalesTabs}
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
