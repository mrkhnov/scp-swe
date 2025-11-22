import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet, FlatList, Text, TouchableOpacity, ActivityIndicator, Platform, TextInput, KeyboardAvoidingView, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { COLORS } from '../constants/colors';

export default function ChatScreen() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [ws, setWs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const loadConversationsRef = useRef(null);
  const selectedConversationRef = useRef(null);
  const loadMessagesTimeoutRef = useRef(null);
  const isLoadingConversations = useRef(false);
  const flatListRef = useRef(null);

  // Early return if still loading auth or no user
  if (authLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Messages</Text>
          </View>
          <Text style={styles.emptyText}>Please log in to access chat</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Update ref when selectedConversation changes
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  const loadConversations = useCallback(async () => {
    if (isLoadingConversations.current) {
      console.log('Already loading conversations, skipping...');
      return;
    }
    
    try {
      console.log('Loading conversations...');
      isLoadingConversations.current = true;
      const data = await api.getConversations();
      console.log('Conversations loaded:', data?.length || 0);
      setConversations(data || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
      isLoadingConversations.current = false;
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
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3; // Limit reconnection attempts

    const connect = () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.log('Max reconnection attempts reached, stopping...');
        return;
      }
      
      try {
        websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
          console.log('WebSocket connected successfully');
          reconnectAttempts = 0; // Reset on successful connection
        };

        websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data.type, 'for conversation:', data.sender_id);
            
            // Only handle messages if we're in the correct conversation
            const currentConversationId = selectedConversationRef.current?.id;
            
            // Handle incoming messages (type: 'message' or 'sent')
            if (data.type === 'message') {
              // Only handle messages if we're in the correct conversation
              if (currentConversationId && 
                  (data.sender_id === currentConversationId || data.recipient_id === currentConversationId)) {
                const newMessage = {
                  id: data.id || Math.random().toString(),
                  content: data.content,
                  timestamp: data.timestamp || new Date().toISOString(),
                  sender_id: data.sender_id,
                  recipient_id: data.recipient_id,
                };
                
                // Use functional update to prevent race conditions
                setMessages(prevMessages => {
                  // Check if message already exists to prevent duplicates
                  const exists = prevMessages.some(msg => msg.id === newMessage.id);
                  if (exists) {
                    return prevMessages;
                  }
                  // Add new message to the end of the array (newest at bottom)
                  const newMessages = [...prevMessages, newMessage];
                  // Auto-scroll to new message after a short delay
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                  return newMessages;
                });
              }
            }
            // Handle sent confirmations (update temporary messages with real IDs)
            else if (data.type === 'sent') {
              console.log('Message sent successfully:', data.id);
              setMessages(prevMessages => {
                return prevMessages.map(msg => {
                  // Find the temp message and replace it
                  if (typeof msg.id === 'string' && msg.id.startsWith('temp-') && 
                      msg.content === data.content &&
                      msg.sender_id === user?.id) {
                    return {
                      ...msg,
                      id: data.id,
                      timestamp: data.timestamp || msg.timestamp,
                      isTemporary: false,
                    };
                  }
                  return msg;
                });
              });
            }
            
            // Only refresh conversations list if we're currently viewing the conversation list
            // and limit the frequency of updates
            if (!selectedConversationRef.current && loadConversationsRef.current) {
              // Use a longer timeout to prevent excessive calls
              clearTimeout(reconnectTimeout);
              reconnectTimeout = setTimeout(() => {
                if (loadConversationsRef.current && !selectedConversationRef.current) {
                  loadConversationsRef.current();
                }
              }, 5000); // Much longer debounce time
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        websocket.onerror = (error) => {
          console.log('WebSocket connection error (backend may not be running)');
          reconnectAttempts++;
        };

        websocket.onclose = () => {
          console.log(`WebSocket disconnected, attempt ${reconnectAttempts + 1}/${maxReconnectAttempts}`);
          reconnectAttempts++;
          // Only retry if we still have a token and haven't exceeded max attempts
          if (api.accessToken && reconnectAttempts < maxReconnectAttempts) {
            reconnectTimeout = setTimeout(connect, 10000); // Increased retry delay
          }
        };

        setWs(websocket);
      } catch (error) {
        console.log('Failed to create WebSocket connection:', error.message);
        reconnectAttempts++;
      }
    };

    connect();

    return () => {
      reconnectAttempts = maxReconnectAttempts; // Stop reconnection attempts
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (websocket) {
        websocket.close();
        setWs(null);
      }
    };
  }, [api.accessToken, user]);

  useEffect(() => {
    if (selectedConversation && user?.id) {
      // Clear messages immediately
      setMessages([]);
      setLoadingMessages(true);
      
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
      setLoadingMessages(false);
    }
    
    return () => {
      if (loadMessagesTimeoutRef.current) {
        clearTimeout(loadMessagesTimeoutRef.current);
      }
    };
  }, [selectedConversation?.id, user?.id]);

  // Keyboard event listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  const loadMessages = async (userId, conversationName) => {
    if (loadingMessages) return;
    
    console.log('Loading messages for user:', userId);
    setLoadingMessages(true);
    try {
      const data = await api.getMessages(userId);
      console.log('Messages loaded:', data?.length || 0);
      const currentUserId = user?.id;
      
      let formattedMessages = [];
      if (data && data.length > 0) {
        formattedMessages = data.map((msg) => ({
          id: msg.id,
          content: msg.content,
          timestamp: msg.timestamp,
          sender_id: msg.sender_id,
          recipient_id: msg.recipient_id || userId, // Fallback for recipient
        }));
      }
      
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !selectedConversation) return;
    
    const messageText = inputText.trim();
    setInputText(''); // Clear input immediately
    
    // Create temporary message for immediate display
    const tempMessage = {
      id: `temp-${Date.now()}-${Math.random()}`, // More unique temp ID
      content: messageText,
      timestamp: new Date().toISOString(),
      sender_id: user?.id,
      recipient_id: selectedConversation.id,
      isTemporary: true, // Mark as temporary
    };
    
    // Add to messages immediately for responsive UI
    setMessages(prevMessages => {
      const newMessages = [...prevMessages, tempMessage];
      // Auto-scroll to new message
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return newMessages;
    });
    
    // Send via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('Sending message via WebSocket:');
      console.log('- From:', user?.id);
      console.log('- To:', selectedConversation.id);
      console.log('- Content:', messageText);
      
      ws.send(JSON.stringify({
        recipient_id: selectedConversation.id,
        content: messageText,
      }));
    } else {
      console.log('WebSocket not connected, cannot send message. State:', ws?.readyState);
      // Remove temp message if WebSocket is not connected
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg.id !== tempMessage.id)
      );
    }
  }, [inputText, selectedConversation, user?.id, ws]);

  const renderMessage = useCallback(({ item }) => {
    const isOwnMessage = item.sender_id === user?.id;
    const isTemporary = item.isTemporary || (typeof item.id === 'string' && item.id.startsWith('temp-'));
    
    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage,
        isTemporary && styles.temporaryMessage
      ]}>
        <Text style={[
          styles.messageText,
          isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
          isTemporary && styles.temporaryMessageText
        ]}>
          {item.content}
        </Text>
        <Text style={[
          styles.messageTime,
          isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
        ]}>
          {new Date(item.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
          {isTemporary && ' (sending...)'}
        </Text>
      </View>
    );
  }, [user?.id]);

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
          <TouchableOpacity onPress={() => {
            console.log('Back button pressed');
            setSelectedConversation(null);
          }}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.chatHeaderTitle}>{selectedConversation.name}</Text>
          <View style={[styles.connectionIndicator, { 
            backgroundColor: ws && ws.readyState === WebSocket.OPEN ? '#34C759' : '#FF3B30' 
          }]} />
        </View>
        
        {loadingMessages ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <KeyboardAvoidingView 
            style={[styles.chatContainer, keyboardVisible && styles.chatContainerKeyboard]} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderMessage}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesContainer}
              onContentSizeChange={() => {
                if (messages.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }
              }}
              onLayout={() => {
                if (messages.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
                </View>
              }
            />
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type a message..."
                placeholderTextColor={COLORS.text.secondary}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={() => {
                  if (inputText.trim()) {
                    sendMessage();
                  }
                }}
                blurOnSubmit={false}
              />
              <TouchableOpacity 
                style={[styles.sendButton, { opacity: inputText.trim() ? 1 : 0.5 }]}
                onPress={sendMessage}
                disabled={!inputText.trim()}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
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
  loadingText: {
    textAlign: 'center',
    color: COLORS.text.secondary,
    fontSize: 16,
    marginTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  chatHeader: {
    backgroundColor: COLORS.primary,
    padding: 16,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  connectionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 8,
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
  chatContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  chatContainerKeyboard: {
    marginBottom: Platform.OS === 'android' ? 20 : 0,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContainer: {
    paddingVertical: 16,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: COLORS.text.primary,
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: COLORS.text.secondary,
    textAlign: 'left',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'flex-end',
    minHeight: 60,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    backgroundColor: COLORS.background,
    color: COLORS.text.primary,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  temporaryMessage: {
    opacity: 0.7,
  },
  temporaryMessageText: {
    fontStyle: 'italic',
  },
});
