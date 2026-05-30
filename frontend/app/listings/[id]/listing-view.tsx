"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  type ListingDetail,
  SUBLET_TYPE_LABELS,
  STATUS_LABELS,
  AMENITY_LABELS,
  type Amenity,
} from "@/types/listing";
import { parseAddressJson } from "@/lib/address";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";

interface ListingViewProps {
  listingId: string;
}

export function ListingView({ listingId }: ListingViewProps) {
  const authState = useSupabaseAuth();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const currentUserId =
    authState.status === "ready" && authState.session?.user?.id;
  const isOwnListing = listing && currentUserId === listing.owner_id;

  useEffect(() => {
    async function fetchListing() {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/listings/${listingId}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Listing not found");
          }
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || "Failed to fetch listing");
        }

        const data = await response.json();
        setListing(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load listing");
      } finally {
        setLoading(false);
      }
    }

    fetchListing();
  }, [listingId]);

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
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="listing-view-loading">
        <p>Loading listing...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="listing-view-error">
        <p>{error}</p>
        <Link href="/" className="back-link">
          Back to home
        </Link>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="listing-view-error">
        <p>Listing not found</p>
        <Link href="/" className="back-link">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="listing-view">
      <div className="listing-view-gallery">
        {listing.images.length > 0 && (
          <>
            <div className="listing-view-main-image">
              <img
                src={getImageUrl(listing.images[activeImageIndex])}
                alt={`${listing.location} - Image ${activeImageIndex + 1}`}
              />
            </div>
            {listing.images.length > 1 && (
              <div className="listing-view-thumbnails">
                {listing.images.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={`thumbnail-btn ${index === activeImageIndex ? "active" : ""}`}
                  >
                    <img
                      src={getImageUrl(image)}
                      alt={`Thumbnail ${index + 1}`}
                    />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="listing-view-content">
        <div className="listing-view-header">
          <div className="listing-view-title-row">
            <h1 className="listing-view-title">{listing.location}</h1>
            <span className={`listing-view-status listing-status-${listing.status}`}>
              {STATUS_LABELS[listing.status] || listing.status}
            </span>
          </div>
          <p className="listing-view-type">
            {SUBLET_TYPE_LABELS[listing.sublet_type]}
          </p>
        </div>

        <div className="listing-view-address">
          {(() => {
            const addr = parseAddressJson(listing.address);
            if (!addr) return <p>{listing.address}</p>;
            return (
              <>
                <p className="address-street">{addr.street}</p>
                {addr.street2 && <p className="address-street2">{addr.street2}</p>}
                <p className="address-city-state">
                  {addr.city}, {addr.state} {addr.zip4 ? `${addr.zip5}-${addr.zip4}` : addr.zip5}
                </p>
              </>
            );
          })()}
        </div>

        <div className="listing-view-details">
          <div className="listing-view-detail-item">
            <span className="detail-value">{listing.bedrooms}</span>
            <span className="detail-label">Bedrooms</span>
          </div>
          <div className="listing-view-detail-item">
            <span className="detail-value">{listing.bathrooms}</span>
            <span className="detail-label">Bathrooms</span>
          </div>
          {listing.sqft && (
            <div className="listing-view-detail-item">
              <span className="detail-value">{listing.sqft.toLocaleString()}</span>
              <span className="detail-label">Sq Ft</span>
            </div>
          )}
        </div>

        <div className="listing-view-pricing">
          <h3 className="section-title">Rent & Costs</h3>
          <div className="pricing-grid">
            <div className="pricing-item pricing-item-primary">
              <span className="pricing-label">Monthly Rent</span>
              <span className="pricing-value">{formatCurrency(listing.monthly_rent_cents)}</span>
            </div>
            {listing.additional_fees_cents > 0 && (
              <div className="pricing-item">
                <span className="pricing-label">Additional Fees</span>
                <span className="pricing-value">+{formatCurrency(listing.additional_fees_cents)}</span>
              </div>
            )}
            <div className="pricing-item">
              <span className="pricing-label">Utilities</span>
              <span className="pricing-value">
                {listing.utilities_included ? "Included" : "Not Included"}
              </span>
            </div>
            <div className="pricing-item">
              <span className="pricing-label">Furnished</span>
              <span className="pricing-value">{listing.furnished ? "Yes" : "No"}</span>
            </div>
          </div>
        </div>

        <div className="listing-view-availability-amenities">
          <h3 className="section-title">Availability & Amenities</h3>
          <div className="availability-row">
            <span className="availability-label">Available</span>
            <span className="availability-dates">
              {formatDate(listing.start_date)} — {formatDate(listing.end_date)}
            </span>
          </div>
          {listing.amenities.length > 0 && (
            <div className="amenities-list">
              {listing.amenities.map((amenity) => (
                <span key={amenity} className="amenity-tag">
                  {AMENITY_LABELS[amenity as Amenity] || amenity}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="listing-view-description">
          <h3 className="section-title">Description</h3>
          <p className="description-text">{listing.description}</p>
        </div>

        {!isOwnListing && (
          <div className="listing-view-contact">
            <h3 className="section-title">Interested in this listing?</h3>
            <div className="listing-contact-actions">
              <Link
                href={`/profile/${listing.owner_id}`}
                className="contact-btn profile-btn"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                View Owner Profile
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
