export interface ChatParticipant {
  user_id: string;
  email: string | null;
  full_name: string | null;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface Chat {
  id: string;
  participants: ChatParticipant[];
  last_message: Message | null;
  unread_count: number;
  updated_at: string;
}

export interface ChatDetail {
  id: string;
  participants: ChatParticipant[];
  messages: Message[];
  page: number;
  page_size: number;
  total_messages: number;
  total_pages: number;
}

export interface StartChatResponse {
  chat_id: string;
}

export interface UnreadCountResponse {
  unread_count: number;
}
