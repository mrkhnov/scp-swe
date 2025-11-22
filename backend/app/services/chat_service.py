from typing import Dict
from fastapi import WebSocket, WebSocketDisconnect, UploadFile, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
import aiofiles
import os
import uuid
from pathlib import Path

from app.models.chat_message import ChatMessage, MessageType
from app.models.user import User


class ConnectionManager:
    """Manages WebSocket connections for real-time chat"""
    
    def __init__(self):
        # Maps user_id to List of WebSocket connections
        self.active_connections: Dict[int, list[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        """Accept and store a new WebSocket connection"""
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        """Remove a WebSocket connection"""
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        """Send a message to a specific user if they're connected"""
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    # Handle stale connections
                    pass

    async def broadcast_to_company(self, message: dict, company_id: int, db: AsyncSession):
        """Broadcast a message to all connected users in a company"""
        from sqlalchemy import select
        # Get all users in the company
        result = await db.execute(
            select(User.id).where(User.company_id == company_id)
        )
        company_user_ids = [row[0] for row in result]
        
        # Send to all connected users from this company
        for user_id in company_user_ids:
            if user_id in self.active_connections:
                for connection in self.active_connections[user_id]:
                    try:
                        await connection.send_json(message)
                    except Exception:
                        pass

    async def broadcast(self, message: dict, exclude_user_id: int = None):
        """Broadcast a message to all connected users"""
        for user_id, connections in self.active_connections.items():
            if exclude_user_id and user_id == exclude_user_id:
                continue
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass


# Global connection manager instance
manager = ConnectionManager()


class ChatService:
    """Service for handling chat operations"""
    
    @staticmethod
    async def save_message(
        db: AsyncSession, 
        sender_id: int, 
        recipient_id: int, 
        content: str, 
        message_type: MessageType = MessageType.TEXT,
        attachment_url: str = None,
        file_name: str = None,
        file_size: int = None
    ) -> ChatMessage:
        """Save a chat message to the database"""
        message = ChatMessage(
            sender_id=sender_id,
            recipient_id=recipient_id,
            content=content,
            message_type=message_type,
            attachment_url=attachment_url,
            file_name=file_name,
            file_size=file_size,
            timestamp=datetime.utcnow()
        )
        db.add(message)
        await db.commit()
        await db.refresh(message)
        return message

    @staticmethod
    async def get_chat_history(db: AsyncSession, user1_id: int, user2_id: int, limit: int = 50) -> list[ChatMessage]:
        """Get chat history between two users"""
        from sqlalchemy import select, or_, and_
        
        query = select(ChatMessage).where(
            or_(
                and_(ChatMessage.sender_id == user1_id, ChatMessage.recipient_id == user2_id),
                and_(ChatMessage.sender_id == user2_id, ChatMessage.recipient_id == user1_id)
            )
        ).order_by(ChatMessage.timestamp.desc()).limit(limit)
        
        result = await db.execute(query)
        messages = list(result.scalars().all())
        return list(reversed(messages))  # Return in chronological order

    @staticmethod
    async def mark_messages_as_read(db: AsyncSession, current_user_id: int, partner_id: int):
        """Mark all messages from partner as read"""
        from sqlalchemy import update
        
        stmt = update(ChatMessage).where(
            ChatMessage.sender_id == partner_id,
            ChatMessage.recipient_id == current_user_id,
            ChatMessage.is_read == False
        ).values(is_read=True)
        
        await db.execute(stmt)
        await db.commit()

    @staticmethod
    async def get_unread_counts(db: AsyncSession, user_id: int) -> dict:
        """Get unread message counts per conversation partner"""
        from sqlalchemy import select, func
        
        query = select(
            ChatMessage.sender_id,
            func.count(ChatMessage.id).label('count')
        ).where(
            ChatMessage.recipient_id == user_id,
            ChatMessage.is_read == False
        ).group_by(ChatMessage.sender_id)
        
        result = await db.execute(query)
        counts = {row.sender_id: row.count for row in result}
        return counts

    @staticmethod
    async def save_file(file: UploadFile, user_id: int) -> tuple[str, str, int]:
        """Save uploaded file and return file_path, file_name, file_size"""
        # Validate file type
        allowed_types = {
            'application/pdf': 'pdf',
            'audio/mpeg': 'mp3',
            'audio/wav': 'wav',
            'audio/mp4': 'm4a',
            'audio/x-m4a': 'm4a'
        }
        
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail=f"File type {file.content_type} not supported. Allowed: PDF, MP3, WAV, M4A"
            )
        
        # Create uploads directory if it doesn't exist
        upload_dir = Path("uploads/chat")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        file_extension = allowed_types[file.content_type]
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = upload_dir / unique_filename
        
        # Save file
        file_size = 0
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            file_size = len(content)
            await f.write(content)
        
        # Validate file size (100MB limit)
        max_size = 100 * 1024 * 1024  # 100MB
        if file_size > max_size:
            os.unlink(file_path)  # Delete the file
            raise HTTPException(status_code=400, detail="File size exceeds 100MB limit")
        
        return str(file_path), file.filename, file_size

    @staticmethod
    def get_message_type_from_content_type(content_type: str) -> MessageType:
        """Determine message type from file content type"""
        if content_type == 'application/pdf':
            return MessageType.PDF
        elif content_type.startswith('audio/'):
            return MessageType.AUDIO
        else:
            return MessageType.TEXT
