import Link from "next/link";
import { redirect } from "next/navigation";
import { BookingsTable } from "@/components/customer/account/bookings-table";
import { ProfileForm } from "@/components/customer/account/profile-form";
import { FavoritesGrid } from "@/components/customer/account/favorites-grid";
import { DocumentsPanel } from "@/components/customer/account/documents-panel";
import { NotificationsList } from "@/components/customer/account/notifications-list";
import {
  getMyProfile, listMyDocuments, listMyNotifications, countMyUnreadNotifications,
} from "@/lib/queries/account";
import { parseAccountTab, type AccountTab } from "@/lib/validators/account";

export const dynamic = "force-dynamic";

const TAB_LABEL: Record<AccountTab, string> = {
  bookings: "Bookings",
  profile: "Profile",
  favorites: "Favorites",
  documents: "Documents",
  notifications: "Notifications",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tab = parseAccountTab((await searchParams).tab);
  const [profile, unread] = await Promise.all([getMyProfile(), countMyUnreadNotifications()]);
  if (!profile) redirect("/login");

  const greetingName = profile.first_name ? `, ${profile.first_name}` : "";

  return (
    <main className="max-w-6xl mx-auto p-8">
      <div className="mb-6">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Account</p>
        <h1 className="text-3xl font-bold text-navy">Welcome back{greetingName}</h1>
      </div>

      <nav className="flex gap-1 border-b border-gray-200 mb-8 overflow-x-auto" aria-label="Account sections">
        {(Object.keys(TAB_LABEL) as AccountTab[]).map(t => (
          <Link
            key={t}
            href={t === "bookings" ? "/account" : `/account?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            data-testid={`account-tab-${t}`}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${
              t === tab ? "border-gold text-navy font-semibold" : "border-transparent text-text-muted-wabs hover:text-navy"
            }`}
          >
            {TAB_LABEL[t]}
            {t === "notifications" && unread > 0 && (
              <span className="ml-2 text-xs bg-gold text-deep rounded-full px-2 py-0.5">{unread}</span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "bookings" && <BookingsTable />}
      {tab === "profile" && <ProfileForm profile={profile} />}
      {tab === "favorites" && <FavoritesGrid />}
      {tab === "documents" && <DocumentsPanel documents={await listMyDocuments()} />}
      {tab === "notifications" && <NotificationsList notifications={await listMyNotifications()} />}
    </main>
  );
}
