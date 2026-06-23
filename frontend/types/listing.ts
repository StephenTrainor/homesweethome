export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
}

export const SUBLET_TYPES = ["one_bedroom", "entire_house"] as const;
export type SubletType = (typeof SUBLET_TYPES)[number];

export const SUBLET_TYPE_LABELS: Record<SubletType, string> = {
  one_bedroom: "One Bedroom",
  entire_house: "Entire Property",
};

export const AMENITIES = [
  "wifi",
  "air_conditioning",
  "heating",
  "washer",
  "dryer",
  "dishwasher",
  "parking",
  "gym",
  "pool",
  "pets_allowed",
  "balcony",
  "elevator",
  "doorman",
  "storage",
] as const;
export type Amenity = (typeof AMENITIES)[number];

export const AMENITY_LABELS: Record<Amenity, string> = {
  wifi: "WiFi",
  air_conditioning: "Air Conditioning",
  heating: "Heating",
  washer: "Washer",
  dryer: "Dryer",
  dishwasher: "Dishwasher",
  parking: "Parking",
  gym: "Gym",
  pool: "Pool",
  pets_allowed: "Pets Allowed",
  balcony: "Balcony",
  elevator: "Elevator",
  doorman: "Doorman",
  storage: "Storage",
};

export interface ListingFormData {
  description: string;
  subletType: SubletType;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  monthlyRent: number;
  utilitiesIncluded: boolean;
  additionalFees: number;
  furnished: boolean;
  location: string;
  address: string;
  startDate: string;
  endDate: string;
  amenities: Amenity[];
  imagePaths: string[];
}

export interface ListingCreatePayload {
  description: string;
  sublet_type: SubletType;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  monthly_rent: number;
  utilities_included: boolean;
  additional_fees: number;
  furnished: boolean;
  location: string;
  address: string;
  start_date: string;
  end_date: string;
  amenities: Amenity[];
  image_paths: string[];
}

export interface AddressInput {
  street: string;
  street2: string;
  city: string;
  state: string;
  zip5: string;
}

export interface ValidatedAddress {
  street: string;
  street2: string;
  city: string;
  state: string;
  zip5: string;
  zip4: string;
  is_valid: boolean;
  error: string | null;
}

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
] as const;

export const MAX_IMAGES = 10;
export const MAX_IMAGE_SIZE_MB = 5;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  rented: "Rented",
};

export interface ListingDetail {
  id: string;
  owner_id: string;
  description: string;
  sublet_type: SubletType;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  monthly_rent_cents: number;
  utilities_included: boolean;
  additional_fees_cents: number;
  furnished: boolean;
  location: string;
  address: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  updated_at: string;
  amenities: Amenity[];
  images: string[];
}
