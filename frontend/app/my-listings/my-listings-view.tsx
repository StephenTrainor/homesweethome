"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  type ListingDetail,
  SUBLET_TYPE_LABELS,
  STATUS_LABELS,
  AMENITY_LABELS,
  type Amenity,
} from "@/types/listing";

export function MyListingsView() {
  const [listings, setListings] = useState<ListingDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchListings() {
      try {
        const supabase = createBrowserSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setError("Your session has expired. Please sign in again.");
          setLoading(false);
          return;
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/listings/mine`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || "Failed to fetch listings");
        }

        const data = await response.json();
        setListings(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load listings");
      } finally {
        setLoading(false);
      }
    }

    fetchListings();
  }, []);

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

  if (loading) {
    return (
      <div className="my-listings-loading">
        <p>Loading your listings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-listings-error">
        <p>{error}</p>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="my-listings-empty">
        <p>You haven&apos;t created any listings yet.</p>
        <Link href="/list" className="create-listing-link">
          Create your first listing
        </Link>
      </div>
    );
  }

  return (
    <div className="listings-grid">
      {listings.map((listing) => (
        <article key={listing.id} className="listing-card">
          <div className="listing-card-image">
            {listing.images.length > 0 && (
              <img
                src={getImageUrl(listing.images[0])}
                alt={`${listing.location} listing`}
              />
            )}
            <span className={`listing-status listing-status-${listing.status}`}>
              {STATUS_LABELS[listing.status] || listing.status}
            </span>
          </div>

          <div className="listing-card-content">
            <div className="listing-card-header">
              <h2 className="listing-card-price">
                {formatCurrency(listing.monthly_rent_cents)}
                <span className="listing-card-price-period">/mo</span>
              </h2>
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
                {listing.amenities.slice(0, 4).map((amenity) => (
                  <span key={amenity} className="amenity-tag">
                    {AMENITY_LABELS[amenity as Amenity] || amenity}
                  </span>
                ))}
                {listing.amenities.length > 4 && (
                  <span className="amenity-tag amenity-tag-more">
                    +{listing.amenities.length - 4} more
                  </span>
                )}
              </div>
            )}

            <div className="listing-card-meta">
              <span className="listing-card-created">
                Created {formatDate(listing.created_at)}
              </span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
