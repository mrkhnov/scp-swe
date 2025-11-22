import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet, FlatList, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GiftedChat } from 'react-native-gifted-chat';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { COLORS } from '../constants/colors';

export default function ChatScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [ws, setWs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const loadConversationsRef = useRef(null);
  const selectedConversationRef = useRef(null);
  const loadMessagesTimeoutRef = useRef(null);

  // Update ref when selectedConversation changes
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.getConversations();
      setConversations(data || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Store ref for WebSocket handler - only update when the function changes
  useEffect(() => {
    loadConversationsRef.current = loadConversations;
  }, [loadConversations]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    // Don't try to reconnect if we don't have a token
    if (!api.accessToken || !user) {
      console.log('No access token or user, skipping WebSocket connection');
      return;
    }

    // Backend expects token as query parameter: ws://host/chat/ws?token=JWT
    const baseWsUrl = Platform.OS === 'web' ? 'ws://localhost:8000/chat/ws' : 'ws://192.168.0.174:8000/chat/ws';
    const wsUrl = `${baseWsUrl}?token=${api.accessToken}`;
    console.log('Connecting to WebSocket');
    
    let websocket;
    let reconnectTimeout;

    const connect = () => {
      try {
        websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
          console.log('WebSocket connected successfully');
        };

        websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data.type);
            
            // Handle incoming messages (type: 'message' or 'sent')
            if ((data.type === 'message' || data.type === 'sent')) {
              const newMessage = {
                _id: data.id || Math.random().toString(),
                text: data.content,
                createdAt: new Date(data.timestamp || Date.now()),
                user: {
                  _id: data.sender_id,
                  name: data.sender_id,
                },
              };
              setMessages(prev => GiftedChat.append(prev, [newMessage]));
              
              // Only refresh conversations list if we're currently viewing the conversation list
              // and not in a specific conversation
              if (!selectedConversationRef.current && loadConversationsRef.current) {
                // Use a timeout to debounce the call
                clearTimeout(reconnectTimeout);
                reconnectTimeout = setTimeout(() => {
                  loadConversationsRef.current();
                }, 1000);
              }
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        websocket.onerror = (error) => {
          console.log('WebSocket connection error (backend may not be running)');
        };

        websocket.onclose = () => {
          console.log('WebSocket disconnected, will retry in 5 seconds');
          // Only retry if we still have a token
          if (api.accessToken) {
            reconnectTimeout = setTimeout(connect, 5000);
          }
        };

        setWs(websocket);
      } catch (error) {
        console.log('Failed to create WebSocket connection:', error.message);
      }
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (websocket) websocket.close();
    };
  }, [api.accessToken, user]);

  useEffect(() => {
    if (selectedConversation && user?.id) {
      // Clear messages immediately to prevent showing old messages
      setMessages([]);
      
      // Clear any pending timeout
      if (loadMessagesTimeoutRef.current) {
        clearTimeout(loadMessagesTimeoutRef.current);
      }
      
      // Debounce the loadMessages call
      loadMessagesTimeoutRef.current = setTimeout(() => {
        loadMessages(selectedConversation.id, selectedConversation.name);
      }, 100);
    } else if (!selectedConversation) {
      // Clear messages when going back to conversation list
      setMessages([]);
    }
    
    return () => {
      if (loadMessagesTimeoutRef.current) {
        clearTimeout(loadMessagesTimeoutRef.current);
      }
    };
  }, [selectedConversation, user?.id]);

  const loadMessages = async (userId, conversationName) => {
    if (loadingMessages) return; // Prevent concurrent calls
    
    setLoadingMessages(true);
    try {
      const data = await api.getMessages(userId);
      const currentUserId = user?.id;
      if (!data) {
        setMessages([]);
        return;
      }
      
      const formattedMessages = data.map(msg => ({
        _id: msg.id,
        text: msg.content,
        createdAt: new Date(msg.timestamp),
        user: {
          _id: msg.sender_id,
          name: msg.sender_id === currentUserId ? user?.email : conversationName,
        },
      })).reverse();
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const chatUser = useMemo(() => ({
    _id: user?.id,
    name: user?.email,
  }), [user?.id, user?.email]);

  const memoizedMessages = useMemo(() => messages, [messages]);

  const onSend = useCallback((newMessages = []) => {
    const message = newMessages[0];
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Backend expects: { recipient_id, content }
      ws.send(JSON.stringify({
        recipient_id: selectedConversation.id,
        content: message.text,
      }));
      
      // Optimistically add to UI
      setMessages(previousMessages => GiftedChat.append(previousMessages, newMessages));
    } else {
      console.log('WebSocket not connected, cannot send message');
    }
  }, [ws, selectedConversation]);

  if (!selectedConversation) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Messages</Text>
          </View>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.conversationItem}
                onPress={() => setSelectedConversation(item)}
              >
                <View style={styles.conversationHeader}>
                  <Text style={styles.conversationName}>{item.name}</Text>
                  <Text style={styles.conversationTime}>
                    {item.last_message_at ? new Date(item.last_message_at).toLocaleDateString() : ''}
                  </Text>
                </View>
                {item.last_message && (
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {item.last_message}
                  </Text>
                )}
                {item.unread_count > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unread_count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No conversations yet. Connect with suppliers or start chatting with customers!</Text>
            }
          />
        )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setSelectedConversation(null)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.chatHeaderTitle}>{selectedConversation.name}</Text>
        </View>
        <GiftedChat
          key={selectedConversation?.id || 'no-conversation'}
          messages={memoizedMessages}
          onSend={onSend}
          user={chatUser}
          renderUsernameOnMessage
          scrollToBottom
          showUserAvatar={false}
          placeholder="Type a message..."
          alwaysShowSend
          isLoadingEarlier={loadingMessages}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: 20,
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  conversationItem: {
    backgroundColor: COLORS.surface,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  conversationTime: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  lastMessage: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  unreadBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.text.secondary,
    fontSize: 16,
    marginTop: 40,
    paddingHorizontal: 40,
  },
  chatHeader: {
    backgroundColor: COLORS.primary,
    padding: 16,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 16,
  },
  chatHeaderTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  chatHeaderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
