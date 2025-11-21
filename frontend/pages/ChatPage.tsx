import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../App';
import { api, getAccessToken, getUserFromToken } from '../services/api';
import { ChatMessage } from '../types';

// --- Mock WebSocket for Preview ---
class MockWebSocket {
    onopen: () => void = () => {};
    onmessage: (event: any) => void = () => {};
    onclose: () => void = () => {};
    private url: string;
    
    constructor(url: string) {
        this.url = url;
        setTimeout(() => {
            this.onopen();
            console.log('[MockWS] Connected to ' + url);
            
            setTimeout(() => {
               this.receiveMockMessage({
                   id: 999,
                   sender_id: 1, // Owner
                   recipient_id: 2,
                   content: "This is a demo chat. I will echo your messages!",
                   timestamp: new Date().toISOString()
               });
            }, 800);
        }, 500);
    }

    send(data: string) {
        const parsed = JSON.parse(data);
        console.log('[MockWS] Sent:', parsed);
        const user = getUserFromToken();
        const myId = user?.id || 0;

        // Echo my message
        setTimeout(() => {
            this.receiveMockMessage({
                id: Date.now(),
                sender_id: myId, 
                recipient_id: parsed.recipient_id,
                content: parsed.content,
                timestamp: new Date().toISOString()
            });
        }, 100);

        // Mock Reply
        setTimeout(() => {
             this.receiveMockMessage({
                 id: Date.now() + 1,
                 sender_id: parsed.recipient_id,
                 recipient_id: myId,
                 content: `Echo: "${parsed.content}"`,
                 timestamp: new Date().toISOString()
             });
        }, 1500);
    }

    close() {
        this.onclose();
    }

    private receiveMockMessage(msg: any) {
        this.onmessage({ data: JSON.stringify(msg) });
    }
}

export default function ChatPage() {
    const { user } = useApp();
    const location = useLocation();
    const [chatPartners, setChatPartners] = useState<any[]>([]);
    const [selectedPartner, setSelectedPartner] = useState<number | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
    const [complaintId, setComplaintId] = useState<number | null>(null);
    const [uploading, setUploading] = useState(false);
    
    const wsRef = useRef<any>(null); 
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle navigation state (from complaint "Reply in Chat" button)
    useEffect(() => {
        const state = location.state as any;
        if (state?.selectedUserId) {
            setSelectedPartner(state.selectedUserId);
            if (state.complaintText) {
                setInput(state.complaintText);
            }
            if (state.complaintId) {
                setComplaintId(state.complaintId);
                // Auto-assign complaint to current user (Sales Rep)
                if (user?.role === 'SUPPLIER_SALES') {
                    api.complaint.assignToMe(state.complaintId).catch(console.error);
                }
            }
        }
    }, [location.state, user]);

    // Global WebSocket connection
    useEffect(() => {
        if (!user) return;

        const token = getAccessToken();
        const wsUrl = `ws://localhost:8000/chat/ws?token=${token}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => setIsConnected(true);
        ws.onmessage = (event: any) => {
            try {
                const msg = JSON.parse(event.data);
                
                // Handle real-time updates for complaints and orders
                if (msg.type === 'complaint_update' || msg.type === 'order_update') {
                    // Dispatch custom event for dashboards to listen to
                    window.dispatchEvent(new CustomEvent(msg.type, { detail: msg }));
                    return;
                }
                
                // Handle both "message" and "sent" types (sent is echo back to sender)
                if (msg.type === 'message' || msg.type === 'sent') {
                    // If message is for currently selected chat, add it
                    if (selectedPartner && (
                        (msg.sender_id === selectedPartner && msg.recipient_id === user.id) ||
                        (msg.sender_id === user.id && msg.recipient_id === selectedPartner)
                    )) {
                        setMessages(prev => {
                            if (prev.some(m => m.id === msg.id)) return prev;
                            return [...prev, msg];
                        });
                        if (msg.sender_id === selectedPartner) {
                            setUnreadCounts(prev => ({ ...prev, [selectedPartner]: 0 }));
                        }
                    } else if (msg.recipient_id === user.id) {
                        // Message for different chat - update unread count
                        setUnreadCounts(prev => ({
                            ...prev,
                            [msg.sender_id]: (prev[msg.sender_id] || 0) + 1
                        }));
                    }
                }
            } catch (e) {
                console.error('WS Parse Error', e);
            }
        };
        ws.onclose = () => setIsConnected(false);
        wsRef.current = ws;

        return () => ws.close();
    }, [user, selectedPartner]);

    useEffect(() => {
        // Load available chat partners (Sales Reps for Consumers, Consumers for Sales Reps)
        api.auth.getChatPartners().then(partners => {
            setChatPartners(partners);
        }).catch(err => {
            console.error('Failed to load chat partners:', err);
        });
        
        // Fetch unread counts initially and every 5 seconds
        const fetchUnreadCounts = () => {
            api.getUnreadCounts().then(counts => {
                setUnreadCounts(prev => {
                    // Don't override count for currently selected partner if it's 0
                    if (selectedPartner !== null && prev[selectedPartner] === 0) {
                        return { ...counts, [selectedPartner]: 0 };
                    }
                    return counts;
                });
            }).catch(console.error);
        };
        fetchUnreadCounts();
        const interval = setInterval(fetchUnreadCounts, 5000);
        return () => clearInterval(interval);
    }, [selectedPartner]);

    useEffect(() => {
        if (!selectedPartner || !user) return;

        // Load chat history and mark as read
        api.getChatHistory(selectedPartner).then(history => {
            setMessages(history); // Backend already returns in chronological order
            // Clear unread count for this partner
            setUnreadCounts(prev => ({ ...prev, [selectedPartner]: 0 }));
        });
    }, [selectedPartner, user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = () => {
        if (!input.trim() || !wsRef.current || !selectedPartner) return;
        const payload = { recipient_id: selectedPartner, content: input, attachment_url: null };
        wsRef.current.send(JSON.stringify(payload));
        setInput('');
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedPartner) return;

        // Validate file type
        const allowedTypes = ['application/pdf', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a'];
        if (!allowedTypes.includes(file.type)) {
            alert('Only PDF and audio files (MP3, WAV, M4A) are supported');
            return;
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            alert('File size must be less than 10MB');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`http://localhost:8000/chat/upload-file?recipient_id=${selectedPartner}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAccessToken()}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Upload failed');
            }

            const result = await response.json();
            console.log('File uploaded successfully:', result);

            // Immediately add the message to the chat for better UX
            // (it will also come via WebSocket but this is faster)
            if (result.data) {
                setMessages(prev => {
                    if (prev.some(m => m.id === result.data.id)) return prev;
                    return [...prev, result.data];
                });
            }

            // Message will also be added via WebSocket when it arrives
        } catch (error: any) {
            console.error('File upload error:', error);
            alert(`Upload failed: ${error.message}`);
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const openFileDialog = () => {
        fileInputRef.current?.click();
    };

    const renderMessageContent = (msg: ChatMessage) => {
        const token = getAccessToken();
        
        switch (msg.message_type) {
            case 'PDF':
                return (
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">📄</span>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium">{msg.file_name}</div>
                            {msg.file_size && (
                                <div className="text-xs opacity-70">
                                    {(msg.file_size / 1024 / 1024).toFixed(1)} MB
                                </div>
                            )}
                        </div>
                        {msg.attachment_url && (
                            <a 
                                href={`http://localhost:8000${msg.attachment_url}?token=${token}`} 
                                download={msg.file_name}
                                className="text-xs bg-white/20 px-2 py-1 rounded hover:bg-white/30"
                            >
                                Download
                            </a>
                        )}
                    </div>
                );
            case 'AUDIO':
                return (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">🎵</span>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium">{msg.file_name}</div>
                                {msg.file_size && (
                                    <div className="text-xs opacity-70">
                                        {(msg.file_size / 1024 / 1024).toFixed(1)} MB
                                    </div>
                                )}
                            </div>
                        </div>
                        {msg.attachment_url && (
                            <audio controls className="w-full max-w-xs">
                                <source src={`http://localhost:8000${msg.attachment_url}?token=${token}`} />
                                Your browser does not support the audio element.
                            </audio>
                        )}
                    </div>
                );
            default:
                return msg.content;
        }
    };

    return (
        <div className="h-[80vh] flex bg-white rounded-3xl shadow-card border border-system-border/50 overflow-hidden animate-in fade-in">
            {/* Sidebar */}
            <div className="w-1/3 border-r border-system-border bg-system-bg/50 flex flex-col">
                <div className="p-6 border-b border-system-border">
                    <h2 className="font-bold text-2xl text-system-text tracking-tight">Messages</h2>
                </div>
                <div className="overflow-y-auto flex-grow p-3 space-y-1">
                    {chatPartners.length === 0 ? (
                        <div className="p-4 text-xs text-system-textSec text-center">
                            {user?.role === 'CONSUMER' ? 'No Sales Reps available. Connect with suppliers first.' : 'No Consumers available. Await approved connections.'}
                        </div>
                    ) : (
                        chatPartners.map(partner => {
                            const partnerId = partner.id;
                            const active = selectedPartner === partnerId;
                            const unreadCount = unreadCounts[partnerId] || 0;
                            return (
                                <button
                                    key={partner.id}
                                    onClick={() => setSelectedPartner(partnerId)}
                                    className={`w-full text-left p-4 rounded-xl transition-colors flex items-center gap-3 relative ${active ? 'bg-system-blue text-white shadow-md' : 'hover:bg-white text-system-text'}`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                        {partner.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-grow">
                                        <div className={`font-semibold text-sm ${active ? 'text-white' : 'text-system-text'}`}>
                                            {partner.email}
                                        </div>
                                        <div className={`text-xs ${active ? 'text-white/80' : 'text-system-textSec'}`}>
                                            {partner.role === 'SUPPLIER_SALES' ? 'Sales Rep' : 'Consumer'}
                                        </div>
                                    </div>
                                    {unreadCount > 0 && (
                                        <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </div>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className="w-2/3 flex flex-col bg-white">
                {!selectedPartner ? (
                    <div className="flex-grow flex items-center justify-center flex-col p-6 text-center">
                        <div className="w-16 h-16 bg-system-bg rounded-full flex items-center justify-center mb-4 text-2xl">💬</div>
                        <p className="text-system-text font-medium">Select a conversation</p>
                        <p className="text-xs mt-1 text-system-textSec">Messaging is only available for approved connections.</p>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="px-6 py-4 border-b border-system-border flex justify-between items-center bg-white/80 backdrop-blur sticky top-0 z-10">
                            <div>
                                <div className="font-semibold text-system-text">
                                    {chatPartners.find(p => p.id === selectedPartner)?.email || `User #${selectedPartner}`}
                                </div>
                                <div className={`text-xs ${isConnected ? 'text-system-green' : 'text-system-textSec'}`}>
                                    {isConnected ? 'Active Now' : 'Connecting...'}
                                </div>
                            </div>
                        </div>

                        {/* Messages List */}
                        <div className="flex-grow overflow-y-auto p-6 space-y-2 bg-white">
                            {messages.map((msg, idx) => {
                                const isMe = msg.sender_id === user?.id;
                                // Group logic would go here for spacing
                                return (
                                    <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                                            isMe 
                                            ? 'bg-system-blue text-white rounded-br-sm' 
                                            : 'bg-[#e9e9eb] text-black rounded-bl-sm'
                                        }`}>
                                            {renderMessageContent(msg)}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-system-border">
                            <div className="flex gap-3 items-center">
                                <button
                                    onClick={openFileDialog}
                                    disabled={uploading || !isConnected}
                                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition-colors"
                                    title="Upload PDF or audio file"
                                >
                                    {uploading ? (
                                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-gray-600">
                                            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                                        </svg>
                                    )}
                                </button>
                                <input 
                                    type="text" 
                                    className="flex-grow px-4 py-2 bg-white border border-system-border rounded-full focus:ring-2 focus:ring-system-blue focus:border-transparent outline-none transition-shadow placeholder-gray-400"
                                    placeholder="iMessage..."
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                    disabled={uploading}
                                />
                                <button 
                                    onClick={sendMessage}
                                    disabled={!input.trim() || !isConnected || uploading}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${input.trim() && !uploading ? 'bg-system-blue text-white' : 'bg-gray-200 text-gray-400'}`}
                                >
                                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                                </button>
                            </div>
                            {/* Hidden file input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".pdf,.mp3,.wav,.m4a,audio/*"
                                style={{ display: 'none' }}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}