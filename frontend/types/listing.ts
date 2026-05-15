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

export const MAX_IMAGES = 10;
export const MAX_IMAGE_SIZE_MB = 5;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
