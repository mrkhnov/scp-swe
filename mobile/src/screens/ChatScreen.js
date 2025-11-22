import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, Alert, Platform, KeyboardAvoidingView, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GiftedChat
} from 'react-native-gifted-chat';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import api from '../services/api';
import { COLORS } from '../constants/colors';

export default function ChatScreen() {
  const { user, loading: authLoading } = useAuth();
  const { isConnected: wsConnected, sendMessage: wsSendMessage, addMessageHandler } = useWebSocket();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState('');

  // Use refs to avoid dependency issues
  const selectedConversationRef = useRef(null);
  const isLoadingConversationsRef = useRef(false);
  const typingTimeoutRef = useRef(null);

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

  // Register WebSocket message handler
  useEffect(() => {
    if (!user) return;

    const handleMessage = (data) => {
      // Handle typing indicators
      if (data.type === 'typing') {
        const currentConversation = selectedConversationRef.current;
        if (currentConversation && data.sender_id === currentConversation.id) {
          setIsTyping(data.isTyping);
          if (data.isTyping) {
            setTypingText(`${currentConversation.name} is typing...`);
          } else {
            setTypingText('');
          }
        }
        return;
      }

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
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
              data.sender_id === user.id ? user.email : currentConversation.name
            )}&background=${data.sender_id === user.id ? '0084ff' : '666666'}&color=fff&size=40`,
          },
          sent: true,
          received: data.sender_id !== user.id,
          pending: false,
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
    };

    // Register the handler and get cleanup function
    const cleanup = addMessageHandler(handleMessage);

    return cleanup;
  }, [user, addMessageHandler]);

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
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
            msg.sender_id === user.id ? user.email : conversationName
          )}&background=${msg.sender_id === user.id ? '0084ff' : '666666'}&color=fff&size=40`,
        },
        sent: true,
        received: msg.sender_id !== user.id,
        pending: false,
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

  const insets = useSafeAreaInsets();

  const onSend = useCallback(async (newMessages = []) => {
    const message = newMessages[0];
    if (!message?.text?.trim() || !selectedConversation) {
      return;
    }

    // Ensure WebSocket is connected
    if (!wsConnected) {
      Alert.alert('Connection Error', 'WebSocket is not connected. Please wait a moment and try again.');
      return;
    }

    // Create message with unique temp ID
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const messageWithId = {
      ...message,
      _id: tempId,
      pending: true,
      sent: false,
      received: false,
      user: chatUser,
    };

    try {
      // Add message to UI immediately (optimistic update)
      setMessages(previousMessages => GiftedChat.append(previousMessages, [messageWithId]));

      // Send via WebSocket only
      console.log('Sending message via WebSocket');
      wsSendMessage(selectedConversation.id, message.text);

      // Mark as sent immediately (we'll get confirmation via WebSocket)
      setMessages(previousMessages =>
        previousMessages.map(msg =>
          msg._id === tempId
            ? { ...msg, pending: false, sent: true }
            : msg
        )
      );

    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message');

      // Remove the message from UI on error
      setMessages(previousMessages =>
        previousMessages.filter(msg => msg._id !== tempId)
      );
    }
  }, [selectedConversation, chatUser, wsConnected, wsSendMessage]);

  // Removed custom renderers to fix mobile input issues

  // Memoize user object for GiftedChat to prevent re-renders
  const chatUser = React.useMemo(() => ({
    _id: user?.id,
    name: user?.email,
  }), [user?.id, user?.email]);

  // Memoize textInputProps
  const textInputProps = React.useMemo(() => ({
    editable: true,
    multiline: false,
    returnKeyType: 'send',
    blurOnSubmit: true,
    enablesReturnKeyAutomatically: true,
    style: styles.textInput,
  }), []);

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
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setSelectedConversation(null)}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{selectedConversation.name}</Text>
              <Text style={styles.headerSubtitle}>
                {wsConnected ? (selectedConversation.company_name || 'Online') : 'Connecting...'}
              </Text>
            </View>
          </View>

          {loadingMessages ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : (
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 60 + insets.top : 0}
            >
              <GiftedChat
                messages={messages}
                onSend={onSend}
                user={chatUser}
                placeholder="Type a message..."
                alwaysShowSend={true}
                showUserAvatar={false}
                showAvatarForEveryMessage={false}
                textInputProps={textInputProps}
                minInputToolbarHeight={50}
                maxInputLength={1000}
                keyboardShouldPersistTaps="never"
                bottomOffset={insets.bottom}
                renderAvatar={null}
                isKeyboardInternallyHandled={false}
                shouldUpdateMessage={() => true} // Changed to true to ensure updates
                renderBubble={props => {
                  return (
                    <View style={{
                      backgroundColor: props.currentMessage.user._id === user.id ? '#0084ff' : '#fff',
                      borderRadius: 20,
                      padding: 12,
                      marginBottom: 4,
                      maxWidth: '80%',
                      alignSelf: props.currentMessage.user._id === user.id ? 'flex-end' : 'flex-start',
                      marginLeft: props.currentMessage.user._id === user.id ? 0 : 10,
                      marginRight: props.currentMessage.user._id === user.id ? 10 : 0,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 1,
                    }}>
                      <Text style={{
                        color: props.currentMessage.user._id === user.id ? '#fff' : '#1a1a1a',
                        fontSize: 16,
                        lineHeight: 22,
                      }}>
                        {props.currentMessage.text}
                      </Text>
                    </View>
                  );
                }}
                renderSend={props => (
                  <TouchableOpacity
                    onPress={() => props.onSend({ text: props.text }, true)}
                    style={{
                      justifyContent: 'center',
                      alignItems: 'center',
                      height: 50,
                      width: 50,
                      marginRight: 5,
                    }}
                  >
                    <Text style={{ color: '#0084ff', fontWeight: 'bold', fontSize: 16 }}>Send</Text>
                  </TouchableOpacity>
                )}
                renderInputToolbar={props => (
                  <View style={{
                    backgroundColor: '#fff',
                    paddingTop: 6,
                    paddingBottom: 6,
                    borderTopWidth: 1,
                    borderTopColor: '#f0f0f0',
                  }}>
                    {/* We don't use the default InputToolbar to have full control */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TextInput
                        {...props.textInputProps}
                        style={[styles.textInput, { flex: 1, maxHeight: 100 }]}
                        placeholder={props.placeholder}
                        value={props.text}
                        onChangeText={props.onTextChanged}
                        multiline
                      />
                      {props.renderSend(props)}
                    </View>
                  </View>
                )}
              />
            </KeyboardAvoidingView>
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
            <Text style={styles.emptySubtext}>
              Start chatting with your business partners
            </Text>
          </View>
        ) : (
          <View style={styles.conversationsList}>
            {conversations.map((conversation) => (
              <TouchableOpacity
                key={conversation.id}
                style={styles.conversationItem}
                onPress={() => setSelectedConversation(conversation)}
              >
                <View style={styles.conversationAvatar}>
                  <Text style={styles.conversationAvatarText}>
                    {conversation.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.conversationInfo}>
                  <Text style={styles.conversationName}>{conversation.name}</Text>
                  <Text style={styles.conversationCompany}>
                    {conversation.company_name || 'Unknown Company'}
                  </Text>
                  <Text style={styles.conversationPreview}>
                    {conversation.last_message || 'No messages yet'}
                  </Text>
                </View>
                <View style={styles.conversationMeta}>
                  {conversation.unread_count > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadCount}>
                        {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                      </Text>
                    </View>
                  )}
                </View>
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
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
    letterSpacing: -0.3,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
    fontWeight: '500',
  },
  backButton: {
    marginRight: 16,
    padding: 8,
    marginLeft: -8,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#718096',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 22,
  },
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
    alignItems: 'center',
  },
  conversationAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  conversationAvatarText: {
    color: '#4a5568',
    fontSize: 22,
    fontWeight: '700',
  },
  conversationInfo: {
    flex: 1,
  },
  conversationName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  conversationCompany: {
    fontSize: 13,
    color: '#718096',
    marginBottom: 4,
    fontWeight: '500',
  },
  conversationPreview: {
    fontSize: 15,
    color: '#4a5568',
    lineHeight: 20,
  },
  conversationMeta: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginTop: 8,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    marginHorizontal: 10,
    marginTop: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 16,
    lineHeight: 20,
  },
});