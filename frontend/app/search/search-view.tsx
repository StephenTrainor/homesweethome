"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  type ListingDetail,
  type PaginatedResponse,
  SUBLET_TYPES,
  SUBLET_TYPE_LABELS,
  AMENITIES,
  AMENITY_LABELS,
  type SubletType,
  type Amenity,
} from "@/types/listing";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 12;

interface SearchFilters {
  query: string;
  location: string;
  zipcode: string;
  minPrice: string;
  maxPrice: string;
  minBedrooms: string;
  maxBedrooms: string;
  minBathrooms: string;
  maxBathrooms: string;
  subletType: SubletType | "";
  amenities: Amenity[];
  startDate: string;
  endDate: string;
  furnished: boolean | null;
}

const initialFilters: SearchFilters = {
  query: "",
  location: "",
  zipcode: "",
  minPrice: "",
  maxPrice: "",
  minBedrooms: "",
  maxBedrooms: "",
  minBathrooms: "",
  maxBathrooms: "",
  subletType: "",
  amenities: [],
  startDate: "",
  endDate: "",
  furnished: null,
};

export function SearchView() {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [listings, setListings] = useState<ListingDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  const activeFilterCount = countActiveFilters(filters);

  const search = useCallback(async (searchFilters: SearchFilters, targetPage: number) => {
    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("page_size", String(PAGE_SIZE));

      if (searchFilters.query) params.set("q", searchFilters.query);
      if (searchFilters.location) params.set("location", searchFilters.location);
      if (searchFilters.zipcode) params.set("zipcode", searchFilters.zipcode);
      if (searchFilters.minPrice) params.set("min_price", searchFilters.minPrice);
      if (searchFilters.maxPrice) params.set("max_price", searchFilters.maxPrice);
      if (searchFilters.minBedrooms) params.set("min_bedrooms", searchFilters.minBedrooms);
      if (searchFilters.maxBedrooms) params.set("max_bedrooms", searchFilters.maxBedrooms);
      if (searchFilters.minBathrooms) params.set("min_bathrooms", searchFilters.minBathrooms);
      if (searchFilters.maxBathrooms) params.set("max_bathrooms", searchFilters.maxBathrooms);
      if (searchFilters.subletType) params.set("sublet_type", searchFilters.subletType);
      if (searchFilters.amenities.length > 0) {
        params.set("amenities", searchFilters.amenities.join(","));
      }
      if (searchFilters.startDate) params.set("start_date", searchFilters.startDate);
      if (searchFilters.endDate) params.set("end_date", searchFilters.endDate);
      if (searchFilters.furnished !== null) {
        params.set("furnished", String(searchFilters.furnished));
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/listings/search?${params}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to search listings");
      }

      const data: PaginatedResponse<ListingDetail> = await response.json();
      setListings(data.items);
      setPage(data.page);
      setTotalPages(data.total_pages);
      setTotalCount(data.total_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search listings");
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    search(filters, 1);
  }

  function handlePageChange(newPage: number) {
    search(filters, newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleFilterChange<K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleAmenityToggle(amenity: Amenity) {
    setFilters((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  }

  function clearFilters() {
    setFilters(initialFilters);
  }

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

  return (
    <div className="search-view">
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-bar-container">
          <div className="search-bar">
            <SearchIcon />
            <input
              type="text"
              className="search-input"
              placeholder="Search by keywords, description..."
              value={filters.query}
              onChange={(e) => handleFilterChange("query", e.target.value)}
            />
          </div>

          <div className="search-location-bar">
            <LocationIcon />
            <input
              type="text"
              className="search-input"
              placeholder="City or neighborhood"
              value={filters.location}
              onChange={(e) => handleFilterChange("location", e.target.value)}
            />
          </div>

          <div className="search-zipcode-bar">
            <input
              type="text"
              className="search-input search-zipcode-input"
              placeholder="Zipcode"
              value={filters.zipcode}
              onChange={(e) => handleFilterChange("zipcode", e.target.value)}
              maxLength={5}
              pattern="[0-9]*"
            />
          </div>

          <button type="submit" className="search-submit-btn" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="search-actions">
          <button
            type="button"
            className={`filter-toggle-btn ${showFilters ? "active" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FilterIcon />
            Filters
            {activeFilterCount > 0 && (
              <span className="filter-count">{activeFilterCount}</span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button
              type="button"
              className="clear-filters-btn"
              onClick={clearFilters}
            >
              Clear all
            </button>
          )}
        </div>

        {showFilters && (
          <div className="search-filters">
            <div className="filter-section">
              <h3 className="filter-section-title">Price Range</h3>
              <div className="filter-row">
                <div className="filter-group">
                  <label className="filter-label">Min Price</label>
                  <input
                    type="number"
                    className="filter-input"
                    placeholder="$0"
                    value={filters.minPrice}
                    onChange={(e) => handleFilterChange("minPrice", e.target.value)}
                    min="0"
                  />
                </div>
                <span className="filter-separator">—</span>
                <div className="filter-group">
                  <label className="filter-label">Max Price</label>
                  <input
                    type="number"
                    className="filter-input"
                    placeholder="Any"
                    value={filters.maxPrice}
                    onChange={(e) => handleFilterChange("maxPrice", e.target.value)}
                    min="0"
                  />
                </div>
              </div>
            </div>

            <div className="filter-section">
              <h3 className="filter-section-title">Bedrooms & Bathrooms</h3>
              <div className="filter-row">
                <div className="filter-group">
                  <label className="filter-label">Bedrooms</label>
                  <div className="filter-range">
                    <select
                      className="filter-select"
                      value={filters.minBedrooms}
                      onChange={(e) => handleFilterChange("minBedrooms", e.target.value)}
                    >
                      <option value="">Any</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>{n}+</option>
                      ))}
                    </select>
                    <span className="filter-separator">to</span>
                    <select
                      className="filter-select"
                      value={filters.maxBedrooms}
                      onChange={(e) => handleFilterChange("maxBedrooms", e.target.value)}
                    >
                      <option value="">Any</option>
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="filter-group">
                  <label className="filter-label">Bathrooms</label>
                  <div className="filter-range">
                    <select
                      className="filter-select"
                      value={filters.minBathrooms}
                      onChange={(e) => handleFilterChange("minBathrooms", e.target.value)}
                    >
                      <option value="">Any</option>
                      {[1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>{n}+</option>
                      ))}
                    </select>
                    <span className="filter-separator">to</span>
                    <select
                      className="filter-select"
                      value={filters.maxBathrooms}
                      onChange={(e) => handleFilterChange("maxBathrooms", e.target.value)}
                    >
                      <option value="">Any</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="filter-section">
              <h3 className="filter-section-title">Property Type</h3>
              <div className="filter-chips">
                <button
                  type="button"
                  className={`filter-chip ${filters.subletType === "" ? "active" : ""}`}
                  onClick={() => handleFilterChange("subletType", "")}
                >
                  All Types
                </button>
                {SUBLET_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`filter-chip ${filters.subletType === type ? "active" : ""}`}
                    onClick={() => handleFilterChange("subletType", type)}
                  >
                    {SUBLET_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-section">
              <h3 className="filter-section-title">Furnished</h3>
              <div className="filter-chips">
                <button
                  type="button"
                  className={`filter-chip ${filters.furnished === null ? "active" : ""}`}
                  onClick={() => handleFilterChange("furnished", null)}
                >
                  Any
                </button>
                <button
                  type="button"
                  className={`filter-chip ${filters.furnished === true ? "active" : ""}`}
                  onClick={() => handleFilterChange("furnished", true)}
                >
                  Furnished
                </button>
                <button
                  type="button"
                  className={`filter-chip ${filters.furnished === false ? "active" : ""}`}
                  onClick={() => handleFilterChange("furnished", false)}
                >
                  Unfurnished
                </button>
              </div>
            </div>

            <div className="filter-section">
              <h3 className="filter-section-title">Availability Dates</h3>
              <div className="filter-row">
                <div className="filter-group">
                  <label className="filter-label">Move-in after</label>
                  <input
                    type="date"
                    className="filter-input"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange("startDate", e.target.value)}
                  />
                </div>
                <span className="filter-separator">—</span>
                <div className="filter-group">
                  <label className="filter-label">Move-out before</label>
                  <input
                    type="date"
                    className="filter-input"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange("endDate", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="filter-section">
              <h3 className="filter-section-title">Amenities</h3>
              <div className="search-amenities-grid">
                {AMENITIES.map((amenity) => (
                  <label key={amenity} className="amenity-checkbox">
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={filters.amenities.includes(amenity)}
                      onChange={() => handleAmenityToggle(amenity)}
                    />
                    <span>{AMENITY_LABELS[amenity]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </form>

      {error && (
        <div className="search-error">
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="search-loading">
          <p>Searching listings...</p>
        </div>
      )}

      {!loading && hasSearched && (
        <>
          <div className="search-results-header">
            <p className="search-results-count">
              {totalCount === 0
                ? "No listings found"
                : totalCount === 1
                ? "1 listing found"
                : `${totalCount.toLocaleString()} listings found`}
            </p>
          </div>

          {listings.length > 0 && (
            <>
              <div className="listings-grid">
                {listings.map((listing) => (
                  <Link
                    key={listing.id}
                    href={`/listings/${listing.id}`}
                    className="listing-card-link"
                  >
                    <article className="listing-card">
                      <div className="listing-card-image">
                        {listing.images.length > 0 ? (
                          <img
                            src={getImageUrl(listing.images[0])}
                            alt={`${listing.location} listing`}
                          />
                        ) : (
                          <div className="listing-card-no-image">
                            <HomeIcon />
                          </div>
                        )}
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
                          {listing.furnished && (
                            <>
                              <span className="details-divider">·</span>
                              <span>Furnished</span>
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

              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                loading={loading}
              />
            </>
          )}

          {listings.length === 0 && (
            <div className="search-empty">
              <div className="search-empty-icon">
                <SearchIcon />
              </div>
              <h3>No listings match your criteria</h3>
              <p>Try adjusting your filters or search terms</p>
              <button
                type="button"
                className="search-empty-btn"
                onClick={clearFilters}
              >
                Clear all filters
              </button>
            </div>
          )}
        </>
      )}

      {!hasSearched && !loading && (
        <div className="search-prompt">
          <div className="search-prompt-icon">
            <HomeIcon />
          </div>
          <h3>Start your search</h3>
          <p>Enter keywords, location, or zipcode above to find available listings</p>
        </div>
      )}
    </div>
  );
}

function countActiveFilters(filters: SearchFilters): number {
  let count = 0;
  if (filters.query) count++;
  if (filters.location) count++;
  if (filters.zipcode) count++;
  if (filters.minPrice) count++;
  if (filters.maxPrice) count++;
  if (filters.minBedrooms) count++;
  if (filters.maxBedrooms) count++;
  if (filters.minBathrooms) count++;
  if (filters.maxBathrooms) count++;
  if (filters.subletType) count++;
  if (filters.amenities.length > 0) count++;
  if (filters.startDate) count++;
  if (filters.endDate) count++;
  if (filters.furnished !== null) count++;
  return count;
}

function SearchIcon() {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function LocationIcon() {
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
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function FilterIcon() {
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
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
