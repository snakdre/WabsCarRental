import { ManagementSidebar } from "@/components/management/sidebar";
import { getUserRole, isAdmin } from "@/lib/utils/roles";

export default async function ManagementLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-deep text-white flex">
      <ManagementSidebar isAdmin={isAdmin(await getUserRole())} />
      <div className="flex-1 bg-warm-white text-navy">
        {children}
      </div>
    </div>
  );
}
