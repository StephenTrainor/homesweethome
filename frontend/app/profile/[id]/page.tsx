import Link from "next/link";
import { ProfileView } from "./profile-view";

interface ProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params;

  return (
    <main className="profile-page">
      <div className="profile-container">
        <nav className="profile-breadcrumb">
          <Link href="/" className="breadcrumb-link">
            Home
          </Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Profile</span>
        </nav>

        <ProfileView userId={id} />
      </div>
    </main>
  );
}
