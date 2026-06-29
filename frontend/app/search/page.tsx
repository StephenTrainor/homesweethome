import { SearchView } from "./search-view";

export default function SearchPage() {
  return (
    <main className="search-page">
      <div className="search-container">
        <div className="search-header">
          <h1 className="search-title">Find Your Perfect Home</h1>
          <p className="search-subtitle">
            Search through available listings to find the ideal sublet for you
          </p>
        </div>

        <SearchView />
      </div>
    </main>
  );
}
