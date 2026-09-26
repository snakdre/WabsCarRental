import { ManagementSidebar } from "@/components/management/sidebar";

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-deep text-white flex">
      <ManagementSidebar activeHref="/management/bookings" />
      <div className="flex-1 bg-warm-white text-navy">
        {children}
      </div>
    </div>
  );
}
