-- Grant SELECT to anon role for public read access to active listings
-- RLS policies already restrict to status = 'active' for non-owners
GRANT SELECT ON public.listings TO anon;
GRANT SELECT ON public.listing_amenities TO anon;
GRANT SELECT ON public.listing_images TO anon;
