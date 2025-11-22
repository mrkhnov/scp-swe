import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  TextInput,
  Linking,
  LogBox,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { COLORS } from '../constants/colors';

// Ignore deprecation warning for now as we need expo-av for this version
LogBox.ignoreLogs(['Expo AV has been deprecated']);

// Constants
const PRIMARY_COLOR = COLORS.primary || '#007AFF';
const BG_COLOR = '#f8f9fa';

const VoiceMessage = ({ uri, isMe }) => {
  const [sound, setSound] = useState();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function playSound() {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        setIsLoading(true);
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true }
        );
        setSound(newSound);
        setIsPlaying(true);
        setIsLoading(false);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            setIsPlaying(false);
            newSound.setPositionAsync(0);
          }
        });
      }
    } catch (error) {
      console.error('Error playing sound:', error);
      setIsLoading(false);
      Alert.alert('Error', 'Could not play audio');
    }
  }

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  return (
    <View style={styles.voiceMessageContainer}>
      <TouchableOpacity onPress={playSound} disabled={isLoading}>
        {isLoading ? (
           <ActivityIndicator size="small" color={isMe ? '#fff' : '#333'} />
        ) : (
           <Ionicons 
             name={isPlaying ? "pause-circle" : "play-circle"} 
             size={36} 
             color={isMe ? '#fff' : '#333'} 
           />
        )}
      </TouchableOpacity>
      <View style={styles.voiceMessageInfo}>
        <Text style={[styles.voiceMessageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
          {isPlaying ? 'Playing...' : 'Voice Message'}
        </Text>
      </View>
    </View>
  );
};

export default function ChatScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // State
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [inputText, setInputText] = useState('');
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Refs
  const wsRef = useRef(null);
  const selectedConversationRef = useRef(null);

  // Keep ref in sync with state for WebSocket callbacks
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // 1. Load Conversations
  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getConversations();
      setConversations(data || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 2. WebSocket Connection
  useEffect(() => {
    if (!user || !api.accessToken) return;

    const connectWebSocket = () => {
      const apiUrl = api.getApiUrl();
      // Handle both http/https to ws/wss conversion
      const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
      const wsBaseUrl = apiUrl.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}://${wsBaseUrl}/chat/ws?token=${api.accessToken}`;

      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
      };

      ws.onerror = (e) => {
        console.error('WebSocket error:', e);
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user]);

  // 3. Handle Incoming Messages
  const handleWebSocketMessage = (data) => {
    if (data.type === 'message' || data.type === 'sent') {
      const currentConv = selectedConversationRef.current;

      // Check if message belongs to current conversation
      const isRelevant = currentConv && (
        (data.sender_id === currentConv.id) ||
        (data.recipient_id === currentConv.id)
      );

      if (isRelevant) {
        const newMessage = {
          _id: data.id,
          text: data.content,
          createdAt: new Date(data.timestamp),
          user: {
            _id: data.sender_id,
            name: data.sender_id === user.id ? 'Me' : currentConv.name,
          },
          message_type: data.message_type,
          file_name: data.file_name,
          file_size: data.file_size,
          attachment_url: data.attachment_url,
        };

        setMessages(previousMessages => {
          if (previousMessages.some(m => m._id === newMessage._id)) {
            return previousMessages;
          }
          return [newMessage, ...previousMessages];
        });
      }

      // Refresh list for unread counts
      loadConversations();
    }
  };

  // 4. Load Chat History
  const loadMessages = async (partnerId) => {
    setMessages([]);
    try {
      const history = await api.getMessages(partnerId);
      const formattedMessages = history.map(msg => ({
        _id: msg.id,
        text: msg.content,
        createdAt: new Date(msg.timestamp),
        user: {
          _id: msg.sender_id,
          name: msg.sender_id === user.id ? 'Me' : 'Partner',
        },
        message_type: msg.message_type,
        file_name: msg.file_name,
        file_size: msg.file_size,
        attachment_url: msg.attachment_url,
      }));
      setMessages(formattedMessages.reverse());
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  // 5. Select Conversation
  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    loadMessages(conv.id);
  };

  // 6. File & Audio Handling
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (file.size > 10 * 1024 * 1024) {
        Alert.alert('Error', 'File size must be less than 10MB');
        return;
      }

      uploadFile(file);
    } catch (err) {
      console.error('Document picker error:', err);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Audio recording permission is required');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      // Create file object for upload
      const file = {
        uri,
        type: 'audio/m4a',
        name: 'voice_message.m4a',
      };

      uploadFile(file);
      setRecording(null);
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  };

  const uploadFile = async (file) => {
    if (!selectedConversation) return;

    setUploading(true);
    try {
      const response = await api.uploadFile(selectedConversation.id, file);
      // Message will be received via WebSocket
      console.log('File uploaded:', response);
    } catch (error) {
      console.error('Upload failed:', error);
      Alert.alert('Error', 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  // 7. Send Message
  const handleSend = () => {
    if (!inputText.trim()) return;
    
    if (!wsRef.current || !isConnected) {
      Alert.alert('Offline', 'Chat server not connected');
      return;
    }

    const payload = {
      recipient_id: selectedConversation.id,
      content: inputText.trim(),
    };
    wsRef.current.send(JSON.stringify(payload));
    setInputText('');
  };

  const renderConversationItem = ({ item }) => (
    <TouchableOpacity
      style={styles.conversationCard}
      onPress={() => handleSelectConversation(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatarContainer, { backgroundColor: PRIMARY_COLOR + '20' }]}>
        <Text style={[styles.avatarText, { color: PRIMARY_COLOR }]}>
          {item.name ? item.name[0].toUpperCase() : '?'}
        </Text>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          {item.last_message_time && (
            <Text style={styles.cardTime}>
              {new Date(item.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.cardCompany} numberOfLines={1}>{item.company_name}</Text>
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#ccc" style={{ marginLeft: 8 }} />
    </TouchableOpacity>
  );

  const openAttachment = async (url) => {
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `${api.getApiUrl()}${url}?token=${api.accessToken}`;
    try {
      const supported = await Linking.canOpenURL(fullUrl);
      if (supported) {
        await Linking.openURL(fullUrl);
      } else {
        Alert.alert('Error', 'Cannot open this file');
      }
    } catch (err) {
      console.error('Failed to open URL:', err);
    }
  };

  const renderMessageContent = (item, isMe) => {
    const textColor = isMe ? styles.myMessageText : styles.theirMessageText;

    if (item.message_type === 'PDF') {
      return (
        <TouchableOpacity 
          style={styles.attachmentContainer}
          onPress={() => openAttachment(item.attachment_url)}
        >
          <Ionicons name="document-text" size={24} color={isMe ? '#fff' : '#333'} />
          <View style={styles.attachmentInfo}>
            <Text style={[styles.attachmentName, textColor]} numberOfLines={1}>
              {item.file_name ? decodeURIComponent(item.file_name) : 'Document.pdf'}
            </Text>
            {item.file_size && (
              <Text style={[styles.attachmentSize, textColor, { opacity: 0.7 }]}>
                {(item.file_size / 1024 / 1024).toFixed(1)} MB
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    if (item.message_type === 'AUDIO') {
      const fullUrl = item.attachment_url.startsWith('http') 
        ? item.attachment_url 
        : `${api.getApiUrl()}${item.attachment_url}?token=${api.accessToken}`;

      return (
        <VoiceMessage 
          uri={fullUrl} 
          isMe={isMe} 
        />
      );
    }

    return <Text style={[styles.messageText, textColor]}>{item.text}</Text>;
  };

  const renderMessageItem = ({ item }) => {
    const isMe = item.user._id === user.id;
    return (
        <View style={[
            styles.messageRow,
            isMe ? styles.myMessageRow : styles.theirMessageRow
        ]}>
            <View style={[
                styles.messageBubble,
                isMe ? styles.myMessage : styles.theirMessage
            ]}>
                {renderMessageContent(item, isMe)}
                <Text style={[
                    styles.timeText,
                    isMe ? { color: 'rgba(255,255,255,0.7)' } : { color: '#999' }
                ]}>
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        </View>
    );
  };

  // --- RENDER ---

  // 1. List View
  if (!selectedConversation) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={styles.connectionStatus}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? '#4CAF50' : '#ff9800' }]} />
            <Text style={styles.statusText}>{isConnected ? 'Online' : 'Connecting'}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          </View>
        ) : (
          <FlatList
            data={conversations}
            renderItem={renderConversationItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No conversations yet.</Text>
              </View>
            }
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        )}
      </SafeAreaView>
    );
  }

  // 2. Chat View
  return (
    <SafeAreaView style={styles.chatContainer} edges={['top']}>
      <View style={styles.chatHeaderContainer}>
        <View style={styles.chatHeaderContent}>
          <TouchableOpacity
            onPress={() => setSelectedConversation(null)}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.chatTitle}>{selectedConversation.name}</Text>
            <Text style={styles.chatSubtitle}>
              {isConnected ? 'Active now' : 'Reconnecting...'}
            </Text>
          </View>

          <View style={{ width: 24 }} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={item => item._id.toString()}
            inverted
            contentContainerStyle={{ padding: 16 }}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        />
        
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TouchableOpacity 
                onPress={handlePickDocument}
                style={styles.attachButton}
                disabled={uploading}
            >
                <Ionicons name="attach" size={24} color="#666" />
            </TouchableOpacity>

            <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder={isRecording ? "Recording..." : "Type a message..."}
                placeholderTextColor="#999"
                multiline
                maxLength={500}
                editable={!isRecording}
            />
            
            {inputText.trim() ? (
                <TouchableOpacity 
                    onPress={handleSend} 
                    style={styles.sendButton}
                >
                    <Ionicons name="send" size={20} color="#fff" style={{ marginLeft: 2 }} />
                </TouchableOpacity>
            ) : (
                <TouchableOpacity 
                    onPress={isRecording ? stopRecording : startRecording}
                    style={[styles.sendButton, isRecording && styles.recordingButton]}
                >
                    <Ionicons 
                        name={isRecording ? "stop" : "mic"} 
                        size={20} 
                        color="#fff" 
                    />
                </TouchableOpacity>
            )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // --- List Header ---
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  // --- Conversation List ---
  listContent: {
    padding: 16,
  },
  conversationCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    // Soft Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  cardTime: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardCompany: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: PRIMARY_COLOR,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  // --- Chat Screen Header ---
  chatHeaderContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    zIndex: 10,
  },
  chatHeaderContent: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    alignItems: 'center',
  },
  chatTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  chatSubtitle: {
    fontSize: 11,
    color: '#4CAF50',
    marginTop: 1,
  },
  // --- Message Styles ---
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  theirMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  myMessage: {
    backgroundColor: PRIMARY_COLOR,
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#333',
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  // --- Input Styles ---
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    maxHeight: 100,
    marginRight: 10,
    fontSize: 16,
    color: '#333',
  },
  attachButton: {
    padding: 10,
    marginRight: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingButton: {
    backgroundColor: '#ff4444',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  // --- Attachment Styles ---
  attachmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  attachmentInfo: {
    marginLeft: 8,
    flex: 1,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '600',
  },
  attachmentSize: {
    fontSize: 11,
    marginTop: 2,
  },
  // --- Voice Message Styles ---
  voiceMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120,
  },
  voiceMessageInfo: {
    marginLeft: 10,
    justifyContent: 'center',
  },
  voiceMessageText: {
    fontSize: 14,
    fontWeight: '600',
  },
});