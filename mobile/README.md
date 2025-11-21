# SCP Mobile Application

React Native mobile application for the Supplier Consumer Platform (SCP), built with Expo.

## Overview

This mobile app provides interfaces for:
- **Consumers**: Browse products, place orders, and communicate with sales representatives
- **Sales Representatives**: Manage customer relationships and handle orders

## Features

- Role-based navigation (Consumer and Sales Representative)
- Real-time chat functionality using WebSocket
- Product catalog browsing (Consumer)
- Order management
- Customer communication (Sales Rep)

## Prerequisites

- Node.js 16+ 
- npm or yarn
- Expo CLI (install globally: `npm install -g expo-cli`)
- Expo Go app on your mobile device (for testing)

## Installation

```bash
cd mobile
npm install
```

## Running the App

Start the development server:

```bash
npm start
```

This will open Expo DevTools in your browser. From there you can:
- Scan the QR code with Expo Go app (iOS/Android)
- Press `a` to open in Android emulator
- Press `i` to open in iOS simulator (macOS only)
- Press `w` to open in web browser

## Project Structure

```
mobile/
├── App.js                          # Main entry point
├── package.json                    # Dependencies
├── app.json                        # Expo configuration
├── src/
│   ├── navigation/
│   │   └── AppNavigator.js        # Stack navigation setup
│   └── screens/
│       ├── LoginScreen.js         # Role selection screen
│       ├── ConsumerHomeScreen.js  # Consumer dashboard
│       ├── SalesHomeScreen.js     # Sales Rep dashboard
│       └── ChatScreen.js          # Chat interface with WebSocket
```

## Screens

### LoginScreen
Simple role selection to simulate login. Choose between:
- Consumer
- Sales Representative

### ConsumerHomeScreen
Dashboard for consumers with quick actions:
- View Product Catalog
- My Orders
- Chat with Sales Rep
- My Suppliers

### SalesHomeScreen
Dashboard for sales representatives with quick actions:
- Chat with Customers
- View Orders
- My Customers
- Product Catalog

### ChatScreen
Real-time chat interface using `react-native-gifted-chat` with WebSocket connection to `ws://localhost:8000/ws/chat/`.

**Note**: Update the WebSocket URL in `src/screens/ChatScreen.js` to point to your actual backend WebSocket endpoint.

## WebSocket Integration

The chat functionality uses WebSocket for real-time communication. The connection is established in the `ChatScreen` component's `useEffect` hook.

Current placeholder URL: `ws://localhost:8000/ws/chat/`

To connect to the actual backend:
1. Update the WebSocket URL in `src/screens/ChatScreen.js`
2. Ensure the backend WebSocket endpoint is running
3. Handle authentication/authorization as needed

## Next Steps

- Add authentication/login functionality
- Connect to actual backend APIs
- Implement product catalog browsing
- Add order placement workflow
- Enhance chat with user avatars and timestamps
- Add push notifications
- Implement offline support

## Technologies Used

- **React Native**: Mobile framework
- **Expo**: Development platform
- **React Navigation**: Navigation library
- **React Native Gifted Chat**: Chat UI components
- **WebSocket**: Real-time communication
