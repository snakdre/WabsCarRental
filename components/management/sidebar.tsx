"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/management/bookings", label: "Bookings", enabled: true },
  { href: "/management/vehicles", label: "Vehicles", enabled: true },
  { href: "#", label: "Customers", enabled: false },
  { href: "#", label: "Calendar", enabled: false },
  { href: "#", label: "Maintenance", enabled: false },
  { href: "#", label: "Settings", enabled: false },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ManagementSidebar({ activeHref: _activeHref }: { activeHref?: string }) {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 bg-navy border-r border-navy-light py-8 px-4 min-h-screen">
      <div className="mb-8 px-2">
        <span className="text-lg font-bold tracking-widest uppercase text-white">WABS</span>
        <span className="block text-xs tracking-[0.3em] text-gold uppercase">Management</span>
      </div>
      <nav>
        <ul className="space-y-1">
          {ITEMS.map((item) => {
            const isActive = item.enabled && pathname.startsWith(item.href);
            const base = "block px-3 py-2 rounded text-sm";
            if (!item.enabled) {
              return (
                <li key={item.label}>
                  <span className={`${base} text-text-muted-wabs cursor-not-allowed opacity-50`}>
                    {item.label}
                  </span>
                </li>
              );
            }
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`${base} ${isActive ? "bg-gold text-deep font-semibold" : "text-white hover:bg-navy-light hover:text-gold"}`}
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
