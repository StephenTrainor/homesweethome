"use client";

import { useMemo, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  SUBLET_TYPES,
  SUBLET_TYPE_LABELS,
  AMENITIES,
  AMENITY_LABELS,
  MAX_IMAGES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_MB,
  ALLOWED_IMAGE_TYPES,
  type SubletType,
  type Amenity,
  type ListingCreatePayload,
} from "@/types/listing";

interface ListFormProps {
  userId: string;
  userEmail?: string;
}

interface ImagePreview {
  file: File;
  previewUrl: string;
}

export function ListForm({ userId }: ListFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [subletType, setSubletType] = useState<SubletType | "">("");
  const [bedrooms, setBedrooms] = useState<number | "">("");
  const [bathrooms, setBathrooms] = useState<number | "">("");
  const [sqft, setSqft] = useState<number | "">("");
  const [monthlyRent, setMonthlyRent] = useState<number | "">("");
  const [utilitiesIncluded, setUtilitiesIncluded] = useState(false);
  const [additionalFees, setAdditionalFees] = useState<number | "">(0);
  const [furnished, setFurnished] = useState(false);
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [images, setImages] = useState<ImagePreview[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronous re-entrancy guard. `pending` is React state — two clicks in the
  // same tick can both read `pending === false` before either re-render runs.
  // A ref flips immediately, so the second click is dropped on the floor.
  const submittingRef = useRef(false);

  // Stable per-form-mount idempotency key. Sent on every submission attempt so
  // the backend can dedupe retried POSTs (e.g. network blips, frantic clicks).
  const idempotencyKey = useMemo(
    () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    [],
  );

  function toggleAmenity(amenity: Amenity) {
    setAmenities((prev) =>
      prev.includes(amenity)
        ? prev.filter((a) => a !== amenity)
        : [...prev, amenity]
    );
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newImages: ImagePreview[] = [];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      if (images.length + newImages.length >= MAX_IMAGES) {
        errors.push(`Maximum ${MAX_IMAGES} images allowed`);
        break;
      }

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Only JPEG, PNG, and WebP images are allowed`);
        continue;
      }

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        errors.push(`${file.name}: File must be under ${MAX_IMAGE_SIZE_MB}MB`);
        continue;
      }

      newImages.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (errors.length > 0) {
      setError(errors.join(". "));
    } else {
      setError(null);
    }

    setImages((prev) => [...prev, ...newImages]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const removed = prev[index];
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  function validateForm(): string | null {
    if (!description.trim()) return "Description is required";
    if (!subletType) return "Sublet type is required";
    if (bedrooms === "" || bedrooms < 0) return "Number of bedrooms is required";
    if (bathrooms === "" || bathrooms < 0) return "Number of bathrooms is required";
    if (monthlyRent === "" || monthlyRent < 0) return "Monthly rent is required";
    if (!location.trim()) return "Location is required";
    if (!address.trim()) return "Address is required";
    if (!startDate) return "Start date is required";
    if (!endDate) return "End date is required";
    if (new Date(startDate) >= new Date(endDate)) {
      return "End date must be after start date";
    }
    if (images.length === 0) return "At least one image is required";
    return null;
  }

  async function uploadImages(): Promise<string[]> {
    const supabase = createBrowserSupabaseClient();
    const uploadedPaths: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      setUploadProgress(`Uploading image ${i + 1} of ${images.length}...`);

      const timestamp = Date.now();
      const ext = image.file.name.split(".").pop() || "jpg";
      const path = `${userId}/${timestamp}-${i}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("listings")
        .upload(path, image.file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        for (const uploadedPath of uploadedPaths) {
          await supabase.storage.from("listings").remove([uploadedPath]);
        }
        throw new Error(`Failed to upload ${image.file.name}: ${uploadError.message}`);
      }

      uploadedPaths.push(path);
    }

    return uploadedPaths;
  }

  async function deleteUploadedImages(paths: string[]) {
    if (paths.length === 0) return;
    const supabase = createBrowserSupabaseClient();
    await supabase.storage.from("listings").remove(paths);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Synchronous guard — wins the race against React state updates so a
    // double click in the same tick can never start two submissions.
    if (submittingRef.current) return;
    submittingRef.current = true;

    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      submittingRef.current = false;
      return;
    }

    setPending(true);
    let uploadedPaths: string[] = [];

    try {
      uploadedPaths = await uploadImages();
      setUploadProgress("Creating listing...");

      const payload: ListingCreatePayload = {
        description: description.trim(),
        sublet_type: subletType as SubletType,
        bedrooms: bedrooms as number,
        bathrooms: bathrooms as number,
        sqft: sqft === "" ? null : sqft,
        monthly_rent: monthlyRent as number,
        utilities_included: utilitiesIncluded,
        additional_fees: additionalFees === "" ? 0 : additionalFees,
        furnished,
        location: location.trim(),
        address: address.trim(),
        start_date: startDate,
        end_date: endDate,
        amenities,
        image_paths: uploadedPaths,
      };

      const supabase = createBrowserSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/listings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to create listing");
      }

      for (const img of images) {
        URL.revokeObjectURL(img.previewUrl);
      }

      window.location.href = "/";
    } catch (err) {
      await deleteUploadedImages(uploadedPaths);
      setError(err instanceof Error ? err.message : "Failed to create listing");
      // Allow the user to fix and retry. The same idempotency key is reused
      // so the backend will return the original row if a previous attempt
      // actually reached the DB before the network error.
      submittingRef.current = false;
    } finally {
      setPending(false);
      setUploadProgress(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="list-form" aria-busy={pending}>
      {error && (
        <p role="alert" className="list-error">
          {error}
        </p>
      )}

      <section className="form-section">
        <h2 className="form-section-title">Property Details</h2>

        <div className="form-group">
          <label htmlFor="subletType" className="form-label">
            Sublet Type <span className="required">*</span>
          </label>
          <select
            id="subletType"
            value={subletType}
            onChange={(e) => setSubletType(e.target.value as SubletType)}
            className="form-select"
            required
          >
            <option value="">Select type...</option>
            {SUBLET_TYPES.map((type) => (
              <option key={type} value={type}>
                {SUBLET_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="description" className="form-label">
            Description <span className="required">*</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="form-textarea"
            rows={4}
            placeholder="Describe your property..."
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="bedrooms" className="form-label">
              Bedrooms <span className="required">*</span>
            </label>
            <input
              type="number"
              id="bedrooms"
              value={bedrooms}
              onChange={(e) =>
                setBedrooms(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="form-input"
              min={0}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="bathrooms" className="form-label">
              Bathrooms <span className="required">*</span>
            </label>
            <input
              type="number"
              id="bathrooms"
              value={bathrooms}
              onChange={(e) =>
                setBathrooms(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="form-input"
              min={0}
              step={0.5}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="sqft" className="form-label">
              Square Feet
            </label>
            <input
              type="number"
              id="sqft"
              value={sqft}
              onChange={(e) =>
                setSqft(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="form-input"
              min={0}
            />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Location</h2>

        <div className="form-group">
          <label htmlFor="location" className="form-label">
            City / Neighborhood <span className="required">*</span>
          </label>
          <input
            type="text"
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="form-input"
            placeholder="e.g., Downtown Austin"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="address" className="form-label">
            Address <span className="required">*</span>
          </label>
          <input
            type="text"
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="form-input"
            placeholder="Full street address"
            required
          />
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Rental Details</h2>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="monthlyRent" className="form-label">
              Monthly Rent ($) <span className="required">*</span>
            </label>
            <input
              type="number"
              id="monthlyRent"
              value={monthlyRent}
              onChange={(e) =>
                setMonthlyRent(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              className="form-input"
              min={0}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="additionalFees" className="form-label">
              Additional Fees ($)
            </label>
            <input
              type="number"
              id="additionalFees"
              value={additionalFees}
              onChange={(e) =>
                setAdditionalFees(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              className="form-input"
              min={0}
            />
          </div>
        </div>

        <div className="form-row checkbox-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={utilitiesIncluded}
              onChange={(e) => setUtilitiesIncluded(e.target.checked)}
              className="form-checkbox"
            />
            <span>Utilities Included</span>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={furnished}
              onChange={(e) => setFurnished(e.target.checked)}
              className="form-checkbox"
            />
            <span>Furnished</span>
          </label>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="startDate" className="form-label">
              Available From <span className="required">*</span>
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="endDate" className="form-label">
              Available Until <span className="required">*</span>
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-input"
              required
            />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">
          Amenities <span className="required">*</span>
        </h2>
        <p className="form-hint">Select all that apply</p>

        <div className="amenities-grid">
          {AMENITIES.map((amenity) => (
            <label key={amenity} className="checkbox-label amenity-item">
              <input
                type="checkbox"
                checked={amenities.includes(amenity)}
                onChange={() => toggleAmenity(amenity)}
                className="form-checkbox"
              />
              <span>{AMENITY_LABELS[amenity]}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">
          Photos <span className="required">*</span>
        </h2>
        <p className="form-hint">
          Upload up to {MAX_IMAGES} photos (max {MAX_IMAGE_SIZE_MB}MB each). At
          least one photo is required.
        </p>

        <div className="image-upload-area">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            multiple
            onChange={handleImageSelect}
            className="file-input"
            id="imageUpload"
            disabled={images.length >= MAX_IMAGES}
          />
          <label
            htmlFor="imageUpload"
            className={`file-input-label ${images.length >= MAX_IMAGES ? "disabled" : ""}`}
          >
            <UploadIcon />
            <span>
              {images.length >= MAX_IMAGES
                ? "Maximum photos reached"
                : "Click or drag to upload photos"}
            </span>
          </label>
        </div>

        {images.length > 0 && (
          <div className="image-preview-grid">
            {images.map((img, index) => (
              <div key={img.previewUrl} className="image-preview-item">
                <img
                  src={img.previewUrl}
                  alt={`Preview ${index + 1}`}
                  className="image-preview"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="image-remove-btn"
                  aria-label="Remove image"
                >
                  <CloseIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="form-actions">
        <button
          type="submit"
          disabled={pending}
          aria-disabled={pending}
          className="submit-btn"
        >
          {pending ? uploadProgress || "Creating..." : "Create Listing"}
        </button>
      </div>
    </form>
  );
}

function UploadIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
