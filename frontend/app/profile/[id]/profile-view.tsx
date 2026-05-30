"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ProfileWithListings } from "@/types/profile";
import {
  SUBLET_TYPE_LABELS,
  AMENITY_LABELS,
  type Amenity,
} from "@/types/listing";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";

interface ProfileViewProps {
  userId: string;
}

export function ProfileView({ userId }: ProfileViewProps) {
  const router = useRouter();
  const authState = useSupabaseAuth();
  const [data, setData] = useState<ProfileWithListings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingChat, setStartingChat] = useState(false);

  const currentUserId =
    authState.status === "ready" && authState.session?.user?.id;
  const isOwnProfile = currentUserId === userId;

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/profiles/${userId}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Profile not found");
          }
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || "Failed to fetch profile");
        }

        const profileData = await response.json();
        setData(profileData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [userId]);

  const handleStartChat = async () => {
    if (startingChat) return;

    setStartingChat(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/chat/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ other_user_id: userId }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to start chat");
      }

      const { chat_id } = await response.json();
      router.push(`/chat?chatId=${chat_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start chat");
      setStartingChat(false);
    }
  };

  function getImageUrl(storagePath: string): string {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return `${supabaseUrl}/storage/v1/object/public/listings/${storagePath}`;
  }

  function formatCurrency(cents: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatMemberSince(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="profile-loading">
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-error">
        <p>{error}</p>
        <Link href="/" className="back-link">
          Back to home
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="profile-error">
        <p>Profile not found</p>
        <Link href="/" className="back-link">
          Back to home
        </Link>
      </div>
    );
  }

  const { profile, listings } = data;
  const displayName = profile.full_name || profile.email || "User";

  return (
    <div className="profile-view">
      <div className="profile-header">
        <div className="profile-avatar">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="profile-info">
          <h1 className="profile-name">{displayName}</h1>
          <p className="profile-member-since">
            Member since {formatMemberSince(profile.created_at)}
          </p>
        </div>
      </div>

      <div className="profile-contact">
        <h2 className="section-title">Contact</h2>
        <div className="profile-contact-actions">
          {profile.email && (
            <a href={`mailto:${profile.email}`} className="contact-btn email-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              {profile.email}
            </a>
          )}
          {!isOwnProfile && authState.status === "ready" && (
            <button
              type="button"
              onClick={handleStartChat}
              disabled={startingChat}
              className="contact-btn message-btn"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {startingChat ? "Opening chat..." : "Send Message"}
            </button>
          )}
          {!isOwnProfile && authState.status !== "ready" && (
            <Link href="/login" className="contact-btn message-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Sign in to message
            </Link>
          )}
        </div>
      </div>

      <div className="profile-listings">
        <h2 className="section-title">
          {isOwnProfile ? "Your Listings" : `${displayName.split(" ")[0]}'s Listings`}
        </h2>

        {listings.length === 0 ? (
          <div className="profile-listings-empty">
            <p>No active listings</p>
          </div>
        ) : (
          <div className="listings-grid">
            {listings.map((listing) => (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="listing-card-link"
              >
                <article className="listing-card">
                  <div className="listing-card-image">
                    {listing.images.length > 0 && (
                      <img
                        src={getImageUrl(listing.images[0])}
                        alt={`${listing.location} listing`}
                      />
                    )}
                  </div>

                  <div className="listing-card-content">
                    <div className="listing-card-header">
                      <h3 className="listing-card-price">
                        {formatCurrency(listing.monthly_rent_cents)}
                        <span className="listing-card-price-period">/mo</span>
                      </h3>
                      <span className="listing-card-type">
                        {SUBLET_TYPE_LABELS[listing.sublet_type]}
                      </span>
                    </div>

                    <p className="listing-card-location">{listing.location}</p>

                    <div className="listing-card-details">
                      <span>{listing.bedrooms} bed</span>
                      <span className="details-divider">·</span>
                      <span>{listing.bathrooms} bath</span>
                      {listing.sqft && (
                        <>
                          <span className="details-divider">·</span>
                          <span>{listing.sqft.toLocaleString()} sqft</span>
                        </>
                      )}
                    </div>

                    <div className="listing-card-dates">
                      <span>
                        {formatDate(listing.start_date)} — {formatDate(listing.end_date)}
                      </span>
                    </div>

                    {listing.amenities.length > 0 && (
                      <div className="listing-card-amenities">
                        {listing.amenities.slice(0, 3).map((amenity) => (
                          <span key={amenity} className="amenity-tag">
                            {AMENITY_LABELS[amenity as Amenity] || amenity}
                          </span>
                        ))}
                        {listing.amenities.length > 3 && (
                          <span className="amenity-tag amenity-tag-more">
                            +{listing.amenities.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
