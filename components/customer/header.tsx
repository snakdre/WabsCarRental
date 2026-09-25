import Link from "next/link";
import { getCurrentUser } from "@/lib/utils/session";
import { HeaderAccountMenu } from "./header-account-menu";
import { HeaderMobileMenu } from "./header-mobile-menu";

export async function CustomerHeader() {
  const user = await getCurrentUser();
  const authed = Boolean(user);

  return (
    <header className="bg-navy text-white sticky top-0 z-40 border-b border-navy-light">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="text-xl font-bold tracking-widest uppercase">WABS</span>
          <span className="text-xs tracking-[0.3em] text-gold uppercase hidden sm:inline">Car Rental</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <Link href="/vehicles" className="hover:text-gold">Fleet</Link>
          <Link href="/" className="hover:text-gold">How It Works</Link>
          <Link href="/" className="hover:text-gold">About</Link>
        </nav>
        <div className="flex items-center gap-3">
          {!authed && (
            <div className="hidden md:flex items-center gap-4">
              <Link href="/login" className="text-sm hover:text-gold">Sign In</Link>
              <Link href="/register" className="text-sm bg-gold text-deep px-4 py-2 rounded font-semibold hover:bg-gold-muted">Register</Link>
            </div>
          )}
          {authed && user?.email && (
            <div className="hidden md:block">
              <HeaderAccountMenu email={user.email} />
            </div>
          )}
          <HeaderMobileMenu authed={authed} />
        </div>
      </div>
    </header>
  );
}
