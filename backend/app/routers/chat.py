from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException, UploadFile, File, status, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError
import os
import mimetypes
from pathlib import Path

from app.db.session import get_db
from app.core.config import get_settings
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.chat_message import MessageType
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
                message_type = data.get("message_type", "TEXT")
                file_name = data.get("file_name")
                file_size = data.get("file_size")
                
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
                
                # Parse message type
                try:
                    msg_type = MessageType(message_type)
                except ValueError:
                    msg_type = MessageType.TEXT
                
                # Save message to database
                message = await ChatService.save_message(
                    db, user.id, recipient_id, content, msg_type, attachment_url, file_name, file_size
                )
                
                # Prepare message payload
                message_data = {
                    "type": "message",
                    "id": message.id,
                    "sender_id": message.sender_id,
                    "recipient_id": message.recipient_id,
                    "content": message.content,
                    "message_type": message.message_type.value,
                    "attachment_url": message.attachment_url,
                    "file_name": message.file_name,
                    "file_size": message.file_size,
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
            manager.disconnect(user.id, websocket)
            
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


@router.post("/send", response_model=ChatMessageResponse)
async def send_message(
    message_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Send a chat message via REST API (alternative to WebSocket).
    """
    recipient_id = message_data.get("recipient_id")
    content = message_data.get("content")
    
    if not recipient_id or not content:
        raise HTTPException(
            status_code=400, 
            detail="recipient_id and content are required"
        )
    
    # Verify recipient exists
    recipient = await db.get(User, recipient_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Save message to database
    message = await ChatService.save_message(
        db, current_user.id, recipient_id, content, MessageType.TEXT
    )
    
    # Prepare message payload for WebSocket broadcast
    message_data = {
        "type": "message",
        "id": message.id,
        "sender_id": message.sender_id,
        "recipient_id": message.recipient_id,
        "content": message.content,
        "message_type": message.message_type.value,
        "attachment_url": message.attachment_url,
        "file_name": message.file_name,
        "file_size": message.file_size,
        "timestamp": message.timestamp.isoformat()
    }
    
    # Send to recipient if online via WebSocket
    await manager.send_personal_message(message_data, recipient_id)
    
    return message


@router.post("/upload-file")
async def upload_chat_file(
    file: UploadFile = File(...),
    recipient_id: int = Query(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a file (PDF or audio) and send as chat message.
    """
    # Verify recipient exists
    recipient = await db.get(User, recipient_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    try:
        # Save the file
        file_path, original_filename, file_size = await ChatService.save_file(file, current_user.id)
        
        # Determine message type
        message_type = ChatService.get_message_type_from_content_type(file.content_type)
        
        # Create file URL (relative path for serving)
        file_url = f"/chat/files/{Path(file_path).name}"
        
        # Create content message based on file type
        if message_type == MessageType.PDF:
            content = f"📄 {original_filename}"
        elif message_type == MessageType.AUDIO:
            content = f"🎵 {original_filename}"
        else:
            content = f"📎 {original_filename}"
        
        # Save message to database
        message = await ChatService.save_message(
            db=db,
            sender_id=current_user.id,
            recipient_id=recipient_id,
            content=content,
            message_type=message_type,
            attachment_url=file_url,
            file_name=original_filename,
            file_size=file_size
        )
        
        # Prepare message for WebSocket broadcast
        message_data = {
            "type": "message",
            "id": message.id,
            "sender_id": message.sender_id,
            "recipient_id": message.recipient_id,
            "content": message.content,
            "message_type": message.message_type.value,
            "attachment_url": message.attachment_url,
            "file_name": message.file_name,
            "file_size": message.file_size,
            "timestamp": message.timestamp.isoformat()
        }
        
        # Send to recipient if online via WebSocket
        await manager.send_personal_message(message_data, recipient_id)
        
        # Also send to sender (echo back) so they see their own message
        await manager.send_personal_message({
            **message_data,
            "type": "sent"
        }, current_user.id)
        
        return {
            "message": "File uploaded successfully",
            "data": message_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException, UploadFile, File, status, Request, Response
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import os
from pathlib import Path
import mimetypes

# ... imports ...

@router.get("/files/{filename}")
async def serve_chat_file(
    request: Request,
    filename: str,
    token: str = Query(..., description="JWT token for authentication"),
    db: AsyncSession = Depends(get_db)
):
    """
    Serve uploaded chat files with token-based authentication and Range support.
    """
    try:
        # Authenticate user from token
        user = await get_user_from_token(token, db)
        
        file_path = Path("uploads/chat") / filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
            
        file_size = os.path.getsize(file_path)
        
        # Determine media type
        media_type, _ = mimetypes.guess_type(file_path)
        if not media_type:
            media_type = "application/octet-stream"

        # Handle Range header
        range_header = request.headers.get("range")
        if range_header:
            from fastapi.responses import StreamingResponse
            
            byte1, byte2 = 0, None
            
            match = range_header.replace("bytes=", "").split("-")
            if match[0]:
                byte1 = int(match[0])
            if match[1]:
                byte2 = int(match[1])
            
            if byte2 is None:
                byte2 = file_size - 1
                
            length = byte2 - byte1 + 1
            
            def iterfile():
                with open(file_path, "rb") as f:
                    f.seek(byte1)
                    data = f.read(length)
                    yield data
            
            headers = {
                "Content-Range": f"bytes {byte1}-{byte2}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(length),
                "Content-Type": media_type,
            }
            
            return StreamingResponse(
                iterfile(), 
                status_code=206, 
                headers=headers, 
                media_type=media_type
            )
            
        # No range header, return full file
        return FileResponse(
            path=str(file_path),
            media_type=media_type,
            filename=filename,
            headers={"Accept-Ranges": "bytes"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error serving file: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
