import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/LoginScreen';
import ConsumerHomeScreen from '../screens/ConsumerHomeScreen';
import SalesHomeScreen from '../screens/SalesHomeScreen';
import ChatScreen from '../screens/ChatScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
        options={{ title: 'SCP Login' }}
      />
      <Stack.Screen 
        name="ConsumerHome" 
        component={ConsumerHomeScreen}
        options={{ title: 'Consumer Dashboard' }}
      />
      <Stack.Screen 
        name="SalesHome" 
        component={SalesHomeScreen}
        options={{ title: 'Sales Representative Dashboard' }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
    </Stack.Navigator>
  );
}
