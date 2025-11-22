import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const WebSocketContext = createContext();

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within WebSocketProvider');
    }
    return context;
};

export const WebSocketProvider = ({ children }) => {
    const { user } = useAuth();
    const wsRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const messageHandlersRef = useRef([]);

    // Connect WebSocket when user logs in
    useEffect(() => {
        if (!user || !api.accessToken) {
            // Disconnect if user logs out
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
                setIsConnected(false);
            }
            return;
        }

        // Get API URL and convert to WebSocket URL
        const apiUrl = api.getApiUrl();
        const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
        const wsBaseUrl = apiUrl.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}://${wsBaseUrl}/chat/ws?token=${api.accessToken}`;

        console.log('WebSocketContext: Connecting to WebSocket:', wsUrl);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocketContext: Connected successfully');
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('WebSocketContext: Message received:', data);

                // Notify all registered message handlers
                messageHandlersRef.current.forEach(handler => handler(data));
            } catch (error) {
                console.error('WebSocketContext: Error parsing message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocketContext: Error:', error);
        };

        ws.onclose = () => {
            console.log('WebSocketContext: Connection closed');
            setIsConnected(false);
        };

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [user, api.accessToken]);

    // Method to send a message
    const sendMessage = (recipientId, content) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }

        wsRef.current.send(JSON.stringify({
            recipient_id: recipientId,
            content: content,
        }));
    };

    // Method to register a message handler
    const addMessageHandler = (handler) => {
        messageHandlersRef.current.push(handler);

        // Return cleanup function
        return () => {
            messageHandlersRef.current = messageHandlersRef.current.filter(h => h !== handler);
        };
    };

    const value = {
        isConnected,
        sendMessage,
        addMessageHandler,
    };

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};
