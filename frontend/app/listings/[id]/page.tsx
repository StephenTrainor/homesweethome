import Link from "next/link";
import { ListingView } from "./listing-view";

interface ListingPageProps {
  params: Promise<{ id: string }>;
}

export default async function ListingPage({ params }: ListingPageProps) {
  const { id } = await params;

  return (
    <main className="listing-page">
      <div className="listing-container">
        <nav className="listing-breadcrumb">
          <Link href="/" className="breadcrumb-link">
            Home
          </Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Listing</span>
        </nav>

        <ListingView listingId={id} />
      </div>
    </main>
  );
}
