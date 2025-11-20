from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError

from app.db.session import get_db
from app.core.config import get_settings
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.chat_message import ChatMessageResponse
from app.services.chat_service import ChatService, manager
from sqlalchemy import select

settings = get_settings()
router = APIRouter(prefix="/chat", tags=["Chat"])


async def get_user_from_token(token: str, db: AsyncSession) -> User:
    """Authenticate user from WebSocket token"""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """
    WebSocket endpoint for real-time chat.
    Connect with: ws://localhost:8000/chat/ws?token=YOUR_JWT_TOKEN
    
    Message format (send):
    {
        "recipient_id": 123,
        "content": "Hello!",
        "attachment_url": "optional_url"
    }
    
    Message format (receive):
    {
        "type": "message",
        "id": 456,
        "sender_id": 789,
        "recipient_id": 123,
        "content": "Hello!",
        "attachment_url": null,
        "timestamp": "2025-11-19T12:00:00"
    }
    """
    try:
        # Authenticate user
        user = await get_user_from_token(token, db)
        
        # Connect user
        await manager.connect(user.id, websocket)
        
        try:
            while True:
                # Receive message from client
                data = await websocket.receive_json()
                
                recipient_id = data.get("recipient_id")
                content = data.get("content")
                attachment_url = data.get("attachment_url")
                
                if not recipient_id or not content:
                    await websocket.send_json({
                        "type": "error",
                        "message": "recipient_id and content are required"
                    })
                    continue
                
                # Verify recipient exists
                recipient = await db.get(User, recipient_id)
                if not recipient:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Recipient not found"
                    })
                    continue
                
                # Save message to database
                message = await ChatService.save_message(
                    db, user.id, recipient_id, content, attachment_url
                )
                
                # Prepare message payload
                message_data = {
                    "type": "message",
                    "id": message.id,
                    "sender_id": message.sender_id,
                    "recipient_id": message.recipient_id,
                    "content": message.content,
                    "attachment_url": message.attachment_url,
                    "timestamp": message.timestamp.isoformat()
                }
                
                # Send to recipient if online
                await manager.send_personal_message(message_data, recipient_id)
                
                # Echo back to sender
                await websocket.send_json({
                    **message_data,
                    "type": "sent"
                })
                
        except WebSocketDisconnect:
            manager.disconnect(user.id)
            
    except HTTPException:
        await websocket.close(code=1008)  # Policy violation


@router.get("/history/{user_id}", response_model=list[ChatMessageResponse])
async def get_chat_history(
    user_id: int,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get chat history between current user and another user.
    Returns up to 'limit' most recent messages.
    Also marks messages as read.
    """
    # Verify the other user exists
    other_user = await db.get(User, user_id)
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    messages = await ChatService.get_chat_history(db, current_user.id, user_id, limit)
    
    # Mark messages from the other user as read
    await ChatService.mark_messages_as_read(db, current_user.id, user_id)
    
    return messages


@router.get("/unread-counts")
async def get_unread_counts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get unread message counts for all conversations.
    Returns dict with partner_id as key and unread count as value.
    """
    counts = await ChatService.get_unread_counts(db, current_user.id)
    return counts
