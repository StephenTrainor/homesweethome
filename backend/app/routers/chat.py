from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import AuthContext, get_auth_context
from ..schemas import (
    ChatDetailResponse,
    ChatParticipant,
    ChatResponse,
    MessageCreate,
    MessageResponse,
    StartChatRequest,
    StartChatResponse,
    UnreadCountResponse,
)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/", response_model=list[ChatResponse])
async def get_chats(ctx: AuthContext = Depends(get_auth_context)) -> list[ChatResponse]:
    """Get all chats for the current user, ordered by most recent activity."""
    supabase = ctx.supabase

    # Get all chats where user is a participant
    participants_resp = (
        supabase.table("chat_participants")
        .select("chat_id")
        .eq("user_id", ctx.user_id)
        .execute()
    )

    if not participants_resp.data:
        return []

    chat_ids = [p["chat_id"] for p in participants_resp.data]

    # Get chat details with participants
    chats_resp = (
        supabase.table("chats")
        .select("id, updated_at")
        .in_("id", chat_ids)
        .order("updated_at", desc=True)
        .execute()
    )

    result = []
    for chat in chats_resp.data:
        chat_id = chat["id"]

        # Get all participants for this chat
        all_participants_resp = (
            supabase.table("chat_participants")
            .select("user_id, last_read_at, profiles(id, email, full_name)")
            .eq("chat_id", chat_id)
            .execute()
        )

        participants = []
        user_last_read = None
        for p in all_participants_resp.data:
            if p["user_id"] == ctx.user_id:
                user_last_read = p["last_read_at"]
            profile = p.get("profiles") or {}
            participants.append(
                ChatParticipant(
                    user_id=p["user_id"],
                    email=profile.get("email"),
                    full_name=profile.get("full_name"),
                )
            )

        # Get last message
        last_msg_resp = (
            supabase.table("messages")
            .select("id, chat_id, sender_id, content, created_at")
            .eq("chat_id", chat_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

        last_message = None
        if last_msg_resp.data:
            msg = last_msg_resp.data[0]
            last_message = MessageResponse(
                id=msg["id"],
                chat_id=msg["chat_id"],
                sender_id=msg["sender_id"],
                content=msg["content"],
                created_at=msg["created_at"],
            )

        # Count unread messages
        unread_count = 0
        if user_last_read:
            unread_resp = (
                supabase.table("messages")
                .select("id", count="exact")
                .eq("chat_id", chat_id)
                .gt("created_at", user_last_read)
                .neq("sender_id", ctx.user_id)
                .execute()
            )
            unread_count = unread_resp.count or 0

        result.append(
            ChatResponse(
                id=chat_id,
                participants=participants,
                last_message=last_message,
                unread_count=unread_count,
                updated_at=chat["updated_at"],
            )
        )

    return result


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    ctx: AuthContext = Depends(get_auth_context),
) -> UnreadCountResponse:
    """Get total unread message count across all chats."""
    supabase = ctx.supabase

    # Get all chats where user is a participant with their last_read_at
    participants_resp = (
        supabase.table("chat_participants")
        .select("chat_id, last_read_at")
        .eq("user_id", ctx.user_id)
        .execute()
    )

    if not participants_resp.data:
        return UnreadCountResponse(unread_count=0)

    total_unread = 0
    for p in participants_resp.data:
        unread_resp = (
            supabase.table("messages")
            .select("id", count="exact")
            .eq("chat_id", p["chat_id"])
            .gt("created_at", p["last_read_at"])
            .neq("sender_id", ctx.user_id)
            .execute()
        )
        total_unread += unread_resp.count or 0

    return UnreadCountResponse(unread_count=total_unread)


@router.get("/{chat_id}", response_model=ChatDetailResponse)
async def get_chat(
    chat_id: str, ctx: AuthContext = Depends(get_auth_context)
) -> ChatDetailResponse:
    """Get a specific chat with all messages."""
    supabase = ctx.supabase

    # Verify user is a participant
    participant_check = (
        supabase.table("chat_participants")
        .select("chat_id")
        .eq("chat_id", chat_id)
        .eq("user_id", ctx.user_id)
        .execute()
    )

    if not participant_check.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found",
        )

    # Get all participants
    participants_resp = (
        supabase.table("chat_participants")
        .select("user_id, profiles(id, email, full_name)")
        .eq("chat_id", chat_id)
        .execute()
    )

    participants = []
    for p in participants_resp.data:
        profile = p.get("profiles") or {}
        participants.append(
            ChatParticipant(
                user_id=p["user_id"],
                email=profile.get("email"),
                full_name=profile.get("full_name"),
            )
        )

    # Get messages
    messages_resp = (
        supabase.table("messages")
        .select("id, chat_id, sender_id, content, created_at")
        .eq("chat_id", chat_id)
        .order("created_at", desc=False)
        .execute()
    )

    messages = [
        MessageResponse(
            id=m["id"],
            chat_id=m["chat_id"],
            sender_id=m["sender_id"],
            content=m["content"],
            created_at=m["created_at"],
        )
        for m in messages_resp.data
    ]

    # Update last_read_at for current user
    supabase.table("chat_participants").update({"last_read_at": "now()"}).eq(
        "chat_id", chat_id
    ).eq("user_id", ctx.user_id).execute()

    return ChatDetailResponse(
        id=chat_id,
        participants=participants,
        messages=messages,
    )


@router.post("/start", response_model=StartChatResponse)
async def start_chat(
    request: StartChatRequest, ctx: AuthContext = Depends(get_auth_context)
) -> StartChatResponse:
    """Start a chat with another user (or get existing chat)."""
    supabase = ctx.supabase

    if request.other_user_id == ctx.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot start a chat with yourself",
        )

    # Verify other user exists
    other_user_resp = (
        supabase.table("profiles")
        .select("id")
        .eq("id", request.other_user_id)
        .execute()
    )

    if not other_user_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Use the find_or_create_chat function
    chat_resp = supabase.rpc(
        "find_or_create_chat",
        {"user1_id": ctx.user_id, "user2_id": request.other_user_id},
    ).execute()

    chat_id = chat_resp.data

    return StartChatResponse(chat_id=chat_id)


@router.post("/{chat_id}/messages", response_model=MessageResponse)
async def send_message(
    chat_id: str,
    message: MessageCreate,
    ctx: AuthContext = Depends(get_auth_context),
) -> MessageResponse:
    """Send a message in a chat."""
    supabase = ctx.supabase

    # Verify user is a participant
    participant_check = (
        supabase.table("chat_participants")
        .select("chat_id")
        .eq("chat_id", chat_id)
        .eq("user_id", ctx.user_id)
        .execute()
    )

    if not participant_check.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found",
        )

    # Insert message
    msg_resp = (
        supabase.table("messages")
        .insert(
            {
                "chat_id": chat_id,
                "sender_id": ctx.user_id,
                "content": message.content,
            }
        )
        .execute()
    )

    if not msg_resp.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send message",
        )

    msg = msg_resp.data[0]

    # Update sender's last_read_at
    supabase.table("chat_participants").update({"last_read_at": "now()"}).eq(
        "chat_id", chat_id
    ).eq("user_id", ctx.user_id).execute()

    return MessageResponse(
        id=msg["id"],
        chat_id=msg["chat_id"],
        sender_id=msg["sender_id"],
        content=msg["content"],
        created_at=msg["created_at"],
    )


@router.post("/{chat_id}/read")
async def mark_chat_read(
    chat_id: str, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, str]:
    """Mark a chat as read."""
    supabase = ctx.supabase

    # Verify user is a participant and update last_read_at
    result = (
        supabase.table("chat_participants")
        .update({"last_read_at": "now()"})
        .eq("chat_id", chat_id)
        .eq("user_id", ctx.user_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found",
        )

    return {"status": "ok"}
