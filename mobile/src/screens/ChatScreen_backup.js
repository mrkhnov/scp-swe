import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GiftedChat, Bubble } from 'react-native-gifted-chat';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { COLORS } from '../constants/colors';

export default function ChatScreen() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Use refs to avoid dependency issues
  const wsRef = useRef(null);
  const selectedConversationRef = useRef(null);
  const isLoadingConversationsRef = useRef(false);

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

  // Update refs when values change
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  const loadConversations = useCallback(async () => {
    if (isLoadingConversationsRef.current) {
      console.log('Already loading conversations, skipping...');
      return;
    }
    
    try {
      console.log('Loading conversations...');
      isLoadingConversationsRef.current = true;
      const data = await api.getConversations();
      console.log('Conversations loaded:', data?.length || 0);
      setConversations(data || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      Alert.alert('Error', 'Failed to load conversations');
    } finally {
      setLoading(false);
      isLoadingConversationsRef.current = false;
    }
  }, []);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // WebSocket setup
  useEffect(() => {
    if (!api.accessToken || !user) {
      console.log('No access token or user, skipping WebSocket connection');
      return;
    }

    const wsUrl = `ws://192.168.0.174:8000/chat/ws?token=${api.accessToken}`;
    console.log('Connecting to WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected successfully');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        // Only handle messages if we're in the correct conversation
        const currentConversation = selectedConversationRef.current;
        const isRelevantMessage = currentConversation && (
          (data.sender_id === currentConversation.id && data.recipient_id === user.id) ||
          (data.sender_id === user.id && data.recipient_id === currentConversation.id)
        );

        if (data.type === 'message' && isRelevantMessage) {
          const newMessage = {
            _id: data.id ? data.id.toString() : Math.random().toString(),
            text: data.content,
            createdAt: new Date(data.timestamp),
            user: {
              _id: data.sender_id,
              name: data.sender_id === user.id ? user.email : currentConversation.name,
            },
          };

          // Only add if message doesn't already exist
          setMessages(previousMessages => {
            const messageExists = previousMessages.some(msg => msg._id === newMessage._id);
            if (messageExists) {
              return previousMessages;
            }
            return GiftedChat.append(previousMessages, [newMessage]);
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [api.accessToken, user]);

  // Load messages when conversation changes
  useEffect(() => {
    if (selectedConversation && user?.id) {
      loadMessages(selectedConversation.id, selectedConversation.name);
    } else if (!selectedConversation) {
      setMessages([]);
      setLoadingMessages(false);
    }
  }, [selectedConversation?.id, user?.id]);

  // Define loadMessages function separately to avoid dependency issues
  const loadMessages = useCallback(async (userId, conversationName) => {
    console.log('Loading messages for user:', userId);
    setLoadingMessages(true);
    setMessages([]); // Clear messages immediately
    
    try {
      const data = await api.getMessages(userId);
      console.log('Messages loaded:', data?.length || 0);
      
      const formattedMessages = (data || []).map(msg => ({
        _id: msg.id.toString(), // Ensure _id is always a string
        text: msg.content,
        createdAt: new Date(msg.timestamp),
        user: {
          _id: msg.sender_id,
          name: msg.sender_id === user.id ? user.email : conversationName,
        },
      }));

      // Sort messages by createdAt (newest first, which is what GiftedChat expects)
      formattedMessages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  }, [user?.id, user?.email]);



  const onSend = useCallback(async (newMessages = []) => {
    const message = newMessages[0];
    if (!message?.text?.trim() || !selectedConversation) {
      return;
    }

    // Create message with unique temp ID
    const messageWithId = {
      ...message,
      _id: `temp_${Date.now()}_${Math.random()}`,
    };

    try {
      // Add message to UI immediately (optimistic update)
      setMessages(previousMessages => GiftedChat.append(previousMessages, [messageWithId]));

      // Send to backend
      await api.sendMessage(selectedConversation.id, message.text);
      console.log('Message sent successfully');
      
      // Remove the temporary message since the real one will come via WebSocket
      setMessages(previousMessages => 
        previousMessages.filter(msg => msg._id !== messageWithId._id)
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message');
      
      // Remove the message from UI on error
      setMessages(previousMessages => 
        previousMessages.filter(msg => msg._id !== messageWithId._id)
      );
    }
  }, [selectedConversation]);

  const renderBubble = (props) => {
    return (
      <Bubble
        {...props}
        wrapperStyle={{
          right: {
            backgroundColor: COLORS.primary,
          },
          left: {
            backgroundColor: '#f0f0f0',
          },
        }}
        textStyle={{
          right: {
            color: '#fff',
          },
          left: {
            color: COLORS.text.primary,
          },
        }}
      />
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Messages</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading conversations...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedConversation) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setSelectedConversation(null)}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{selectedConversation.name}</Text>
          </View>

          {loadingMessages ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : (
            <GiftedChat
              messages={messages}
              onSend={onSend}
              user={{
                _id: user.id,
              }}
              renderBubble={renderBubble}
              placeholder="Type a message..."
              alwaysShowSend
              scrollToBottom
              scrollToBottomStyle={styles.scrollToBottom}
              textInputProps={{
                autoFocus: false,
                blurOnSubmit: false,
                multiline: true,
                maxLength: 1000,
                editable: true,
              }}
              minInputToolbarHeight={60}
              bottomOffset={0}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        
        {conversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No conversations yet</Text>
          </View>
        ) : (
          <View style={styles.conversationsList}>
            {conversations.map((conversation) => (
              <TouchableOpacity
                key={conversation.id}
                style={styles.conversationItem}
                onPress={() => setSelectedConversation(conversation)}
              >
                <View style={styles.conversationInfo}>
                  <Text style={styles.conversationName}>{conversation.name}</Text>
                  <Text style={styles.conversationPreview}>
                    {conversation.last_message || 'No messages yet'}
                  </Text>
                </View>
                {conversation.unread_count > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadCount}>{conversation.unread_count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
  },
  conversationInfo: {
    flex: 1,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  conversationPreview: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  inputToolbar: {
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border,
    paddingHorizontal: 8,
    borderTopWidth: 1,
  },
  inputPrimary: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  inputAccessory: {
    height: 44,
  },
  composerContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 8,
  },
  scrollToBottom: {
    backgroundColor: COLORS.primary,
  },
});
