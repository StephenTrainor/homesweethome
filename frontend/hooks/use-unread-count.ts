"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { UnreadCountResponse } from "@/types/chat";

export function useUnreadCount(): number {
  const [count, setCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setCount(0);
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/chat/unread-count`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data: UnreadCountResponse = await response.json();
        setCount(data.unread_count);
      }
    } catch {
      // Silently fail - unread count is non-critical
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Also listen for new messages via Supabase Realtime
  useEffect(() => {
    let supabase: ReturnType<typeof createBrowserSupabaseClient>;
    try {
      supabase = createBrowserSupabaseClient();
    } catch {
      return;
    }

    const channel = supabase
      .channel("unread-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          // Refetch count when any message is inserted
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUnreadCount]);

  return count;
}
