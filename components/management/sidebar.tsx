"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS: { href: string; label: string; adminOnly?: boolean; exact?: boolean }[] = [
  { href: "/management", label: "Dashboard", exact: true },
  { href: "/management/bookings", label: "Bookings" },
  { href: "/management/vehicles", label: "Vehicles" },
  { href: "/management/customers", label: "Customers" },
  { href: "/management/calendar", label: "Calendar" },
  { href: "/management/maintenance", label: "Maintenance" },
  { href: "/management/settings", label: "Settings", adminOnly: true },
];

export function ManagementSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 bg-navy border-r border-navy-light py-8 px-4 min-h-screen">
      <div className="mb-8 px-2">
        <span className="text-lg font-bold tracking-widest uppercase text-white">WABS</span>
        <span className="block text-xs tracking-[0.3em] text-gold uppercase">Management</span>
      </div>
      <nav>
        <ul className="space-y-1">
          {ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`block px-3 py-2 rounded text-sm ${isActive ? "bg-gold text-deep font-semibold" : "text-white hover:bg-navy-light hover:text-gold"}`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
