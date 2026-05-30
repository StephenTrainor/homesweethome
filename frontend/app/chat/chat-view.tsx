"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Chat, ChatDetail, Message, ChatParticipant } from "@/types/chat";

interface ChatViewProps {
  currentUserId: string;
}

export function ChatView({ currentUserId }: ChatViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<ChatDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchChats = useCallback(async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Your session has expired. Please sign in again.");
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch chats");
      }

      const data: Chat[] = await response.json();
      setChats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chats");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChatDetail = useCallback(
    async (chatId: string) => {
      setChatLoading(true);
      try {
        const supabase = createBrowserSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setError("Your session has expired. Please sign in again.");
          return;
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/chat/${chatId}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch chat");
        }

        const data: ChatDetail = await response.json();
        setActiveChat(data);

        // Update unread count in chat list
        setChats((prev) =>
          prev.map((c) => (c.id === chatId ? { ...c, unread_count: 0 } : c))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load chat");
      } finally {
        setChatLoading(false);
      }
    },
    []
  );

  // Initial load and handle URL params for opening specific chat
  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Handle chatId from URL params (when clicking "Message" from profile)
  useEffect(() => {
    const chatId = searchParams.get("chatId");
    if (chatId && !loading) {
      fetchChatDetail(chatId);
    }
  }, [searchParams, loading, fetchChatDetail]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (activeChat?.messages.length) {
      scrollToBottom();
    }
  }, [activeChat?.messages, scrollToBottom]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!activeChat) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`chat:${activeChat.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${activeChat.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          // Avoid duplicates
          setActiveChat((prev) => {
            if (!prev) return prev;
            if (prev.messages.some((m) => m.id === newMessage.id)) {
              return prev;
            }
            return {
              ...prev,
              messages: [...prev.messages, newMessage],
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChat?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || !messageInput.trim() || sending) return;

    setSending(true);
    const content = messageInput.trim();
    setMessageInput("");

    try {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Your session has expired. Please sign in again.");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/chat/${activeChat.id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const newMessage: Message = await response.json();

      // Add message to local state (realtime will also add it, but we want immediate feedback)
      setActiveChat((prev) => {
        if (!prev) return prev;
        if (prev.messages.some((m) => m.id === newMessage.id)) {
          return prev;
        }
        return {
          ...prev,
          messages: [...prev.messages, newMessage],
        };
      });

      // Update chat list with new last message
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChat.id
            ? { ...c, last_message: newMessage, updated_at: newMessage.created_at }
            : c
        )
      );

      // Refresh chat list to update order
      fetchChats();
    } catch (err) {
      setMessageInput(content);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const openChat = (chatId: string) => {
    router.push(`/chat?chatId=${chatId}`, { scroll: false });
    fetchChatDetail(chatId);
  };

  const closeChat = () => {
    router.push("/chat", { scroll: false });
    setActiveChat(null);
  };

  const getOtherParticipant = (participants: ChatParticipant[]): ChatParticipant | null => {
    return participants.find((p) => p.user_id !== currentUserId) || null;
  };

  const getDisplayName = (participant: ChatParticipant | null): string => {
    if (!participant) return "Unknown User";
    return participant.full_name || participant.email || "Unknown User";
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  if (loading) {
    return (
      <div className="chat-loading">
        <p>Loading chats...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-error">
        <p>{error}</p>
        <button onClick={() => { setError(null); fetchChats(); }} className="retry-btn">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className={`chat-sidebar ${activeChat ? "chat-sidebar-hidden-mobile" : ""}`}>
        <div className="chat-sidebar-header">
          <h1>Messages</h1>
        </div>

        {chats.length === 0 ? (
          <div className="chat-empty">
            <p>No conversations yet</p>
            <p className="chat-empty-hint">
              Start a conversation by visiting someone&apos;s profile and clicking the message button
            </p>
          </div>
        ) : (
          <div className="chat-list">
            {chats.map((chat) => {
              const other = getOtherParticipant(chat.participants);
              const isActive = activeChat?.id === chat.id;
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => openChat(chat.id)}
                  className={`chat-list-item ${isActive ? "active" : ""} ${chat.unread_count > 0 ? "unread" : ""}`}
                >
                  <div className="chat-list-avatar">
                    {getDisplayName(other).charAt(0).toUpperCase()}
                  </div>
                  <div className="chat-list-content">
                    <div className="chat-list-header">
                      <span className="chat-list-name">{getDisplayName(other)}</span>
                      {chat.last_message && (
                        <span className="chat-list-time">
                          {formatTime(chat.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    {chat.last_message && (
                      <p className="chat-list-preview">
                        {chat.last_message.sender_id === currentUserId ? "You: " : ""}
                        {chat.last_message.content}
                      </p>
                    )}
                  </div>
                  {chat.unread_count > 0 && (
                    <span className="chat-unread-badge">{chat.unread_count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={`chat-main ${!activeChat ? "chat-main-empty" : ""}`}>
        {!activeChat ? (
          <div className="chat-main-placeholder">
            <p>Select a conversation to start messaging</p>
          </div>
        ) : chatLoading ? (
          <div className="chat-main-loading">
            <p>Loading messages...</p>
          </div>
        ) : (
          <>
            <div className="chat-main-header">
              <button
                type="button"
                onClick={closeChat}
                className="chat-back-btn"
                aria-label="Back to chat list"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <div className="chat-header-info">
                <h2>{getDisplayName(getOtherParticipant(activeChat.participants))}</h2>
              </div>
            </div>

            <div className="chat-messages">
              {activeChat.messages.length === 0 ? (
                <div className="chat-messages-empty">
                  <p>No messages yet. Say hello!</p>
                </div>
              ) : (
                activeChat.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`chat-message ${message.sender_id === currentUserId ? "sent" : "received"}`}
                  >
                    <div className="chat-message-bubble">
                      <p>{message.content}</p>
                      <span className="chat-message-time">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="chat-input-form">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type a message..."
                className="chat-input"
                disabled={sending}
              />
              <button
                type="submit"
                className="chat-send-btn"
                disabled={!messageInput.trim() || sending}
              >
                {sending ? (
                  <span className="sending-indicator">...</span>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13" />
                    <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
