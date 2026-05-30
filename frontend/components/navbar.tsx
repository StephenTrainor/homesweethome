"use client";

import Link from "next/link";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useTheme } from "@/hooks/use-theme";
import { useUnreadCount } from "@/hooks/use-unread-count";

export function Navbar() {
  const authState = useSupabaseAuth();
  const { theme, toggleTheme } = useTheme();
  const unreadCount = useUnreadCount();

  const isSignedIn =
    authState.status === "ready" && authState.session !== null;

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <Link href="/" className="navbar-brand">
          Home Sweet Home
        </Link>

        <div className="navbar-actions">
          {authState.status === "loading" ? (
            <span className="navbar-loading">...</span>
          ) : isSignedIn ? (
            <>
              <Link href="/chat" className="auth-btn chat-btn">
                <ChatIcon />
                Messages
                {unreadCount > 0 && (
                  <span className="navbar-unread-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/my-listings" className="auth-btn my-listings-btn">
                My Listings
              </Link>
              <Link href="/list" className="auth-btn create-listing-btn">
                Create Listing
              </Link>
              <form action="/auth/sign-out" method="post">
                <button type="submit" className="auth-btn sign-out-btn">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="auth-btn sign-in-btn">
              Sign in
            </Link>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle-btn"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </button>

        </div>
      </div>
    </nav>
  );
}

function ChatIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
