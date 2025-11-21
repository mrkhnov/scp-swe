import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { GiftedChat } from 'react-native-gifted-chat';

export default function ChatScreen() {
  const [messages, setMessages] = useState([]);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    // Set initial welcome message
    setMessages([
      {
        _id: 1,
        text: 'Welcome to the chat! This is where you can communicate with your business partners.',
        createdAt: new Date(),
        system: true,
      },
    ]);

    // Establish WebSocket connection
    // Using placeholder URL - replace with actual backend WebSocket endpoint
    const websocket = new WebSocket('ws://localhost:8000/ws/chat/');

    websocket.onopen = () => {
      console.log('WebSocket connected');
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const newMessage = {
        _id: data.id || Math.random().toString(),
        text: data.message || data.text,
        createdAt: new Date(data.timestamp || Date.now()),
        user: {
          _id: data.user_id || 2,
          name: data.user_name || 'Partner',
        },
      };
      setMessages((previousMessages) =>
        GiftedChat.append(previousMessages, [newMessage])
      );
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
    };

    setWs(websocket);

    // Cleanup on unmount
    return () => {
      if (websocket) {
        websocket.close();
      }
    };
  }, []);

  const onSend = useCallback((newMessages = []) => {
    setMessages((previousMessages) =>
      GiftedChat.append(previousMessages, newMessages)
    );

    // Send message through WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = newMessages[0];
      ws.send(
        JSON.stringify({
          message: message.text,
          timestamp: message.createdAt.toISOString(),
          user_id: message.user._id,
        })
      );
    }
  }, [ws]);

  return (
    <View style={styles.container}>
      <GiftedChat
        messages={messages}
        onSend={(messages) => onSend(messages)}
        user={{
          _id: 1,
          name: 'You',
        }}
        placeholder="Type a message..."
        alwaysShowSend
        scrollToBottom
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
