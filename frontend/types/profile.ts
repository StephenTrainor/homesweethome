import { ListingDetail } from "./listing";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
}

export interface ProfileWithListings {
  profile: Profile;
  listings: ListingDetail[];
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
}
